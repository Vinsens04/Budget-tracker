-- Run once in Supabase's SQL editor. Financial changes are committed atomically.
create table if not exists public.finance_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.finance_workspaces enable row level security;
drop policy if exists "Read own finances" on public.finance_workspaces;
create policy "Read own finances" on public.finance_workspaces for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.finance_workspaces from anon, authenticated;
grant select on public.finance_workspaces to authenticated;

create or replace function public.validate_finance_state(s jsonb) returns void
language plpgsql set search_path = public as $$
declare collection text; row jsonb; wallet_ids text[]; goal_ids text[]; amount numeric;
begin
 if s is null or jsonb_typeof(s) <> 'object' or octet_length(s::text)>2097152 then raise exception 'Invalid workspace'; end if;
 foreach collection in array array['transactions','wallets','budgets','goals','recurring','transfers','contributions'] loop
  if jsonb_typeof(s->collection) is distinct from 'array' then raise exception 'Invalid collection'; end if;
  if (select count(*) from jsonb_array_elements(s->collection))<>(select count(distinct x->>'id') from jsonb_array_elements(s->collection) x) then raise exception 'Duplicate or missing identifier'; end if;
 end loop;
 select array_agg(x->>'id') into wallet_ids from jsonb_array_elements(s->'wallets') x;
 select array_agg(x->>'id') into goal_ids from jsonb_array_elements(s->'goals') x;
 if jsonb_typeof(s->'settings') is distinct from 'object' or length(s->'settings'->>'name') not between 1 and 60 or s->'settings'->>'theme' not in ('light','dark','system') or s->'settings'->>'currency' <> 'IDR' then raise exception 'Invalid settings'; end if;
 foreach collection in array array['transactions','recurring','transfers','contributions'] loop
  for row in select value from jsonb_array_elements(s->collection) loop
   amount:=(row->>'amount')::numeric;
   if amount is null or amount<=0 or amount<>trunc(amount) or amount>9007199254740991 then raise exception 'Invalid amount'; end if;
   if collection in ('transactions','recurring') then
    if not coalesce((row->>'wallet')=any(wallet_ids),false) or row->>'type' not in ('expense','income') or length(row->>'name') not between 1 and 120 then raise exception 'Invalid transaction'; end if;
    if collection='transactions' then perform (row->>'date')::date; else perform (row->>'next')::date; end if;
   elsif collection='transfers' then
    if row->>'from'=row->>'to' or not coalesce((row->>'from')=any(wallet_ids),false) or not coalesce((row->>'to')=any(wallet_ids),false) then raise exception 'Invalid transfer'; end if;
   elsif collection='contributions' and not coalesce((row->>'goal')=any(goal_ids),false) then raise exception 'Invalid goal';
   end if;
  end loop;
 end loop;
 for row in select value from jsonb_array_elements(s->'wallets') loop
  amount:=(row->>'opening')::numeric;
  if amount is null or amount<>trunc(amount) or abs(amount)>9007199254740991 or length(row->>'name') not between 1 and 60 or jsonb_typeof(row->'archived') is distinct from 'boolean' then raise exception 'Invalid wallet'; end if;
 end loop;
 for row in select value from jsonb_array_elements(s->'budgets') loop
  amount:=(row->>'limit')::numeric;
  if amount is null or amount<=0 or amount<>trunc(amount) or row->>'month' !~ '^\d{4}-\d{2}$' or (row->>'threshold')::integer not in (50,75,90,100) then raise exception 'Invalid budget'; end if;
 end loop;
 if (select count(*) from jsonb_array_elements(s->'budgets'))<>(select count(distinct (x->>'month',x->>'category')) from jsonb_array_elements(s->'budgets') x) then raise exception 'Duplicate budget'; end if;
 for row in select value from jsonb_array_elements(s->'goals') loop
  if coalesce((row->>'target')::numeric,0)<=0 or coalesce((row->>'saved')::numeric,-1)<0 or (row->>'target')::numeric<>trunc((row->>'target')::numeric) or (row->>'saved')::numeric<>trunc((row->>'saved')::numeric) or length(row->>'name') not between 1 and 120 then raise exception 'Invalid saving goal'; end if;
  perform (row->>'date')::date;
 end loop;
end $$;
revoke all on function public.validate_finance_state(jsonb) from public, anon, authenticated;

create or replace function public.save_finance_workspace(new_state jsonb, expected_revision bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare owner uuid:=auth.uid(); result bigint;
begin
 if owner is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform public.validate_finance_state(new_state);
 if expected_revision=0 then
  insert into public.finance_workspaces(user_id,state,revision) values(owner,new_state,1) on conflict do nothing returning revision into result;
 else
  update public.finance_workspaces set state=new_state,revision=revision+1,updated_at=now() where user_id=owner and revision=expected_revision returning revision into result;
 end if;
 if result is null then raise exception 'Workspace changed; reload before saving' using errcode='40001'; end if;
 return result;
end $$;
revoke all on function public.save_finance_workspace(jsonb,bigint) from public, anon;
grant execute on function public.save_finance_workspace(jsonb,bigint) to authenticated;

-- Relational read models retain the atomic workspace as the source of truth.
-- security_invoker preserves each signed-in user's row-level access.
create or replace view public.transactions with (security_invoker=true) as
select w.user_id,x.id,x.type,x.amount,x.name as description,x.category,x.wallet as wallet_id,x.date as transaction_date,x.note,x.receipt from public.finance_workspaces w cross join lateral jsonb_to_recordset(w.state->'transactions') x(id text,type text,amount numeric,name text,category text,wallet text,date date,note text,receipt text);
create or replace view public.wallets with (security_invoker=true) as
select w.user_id,x.id,x.name,x.opening as opening_balance,x.archived as is_archived from public.finance_workspaces w cross join lateral jsonb_to_recordset(w.state->'wallets') x(id text,name text,opening numeric,archived boolean);
create or replace view public.budgets with (security_invoker=true) as
select w.user_id,x.id,x.category,x."limit" as limit_amount,x.threshold as alert_threshold,x.month from public.finance_workspaces w cross join lateral jsonb_to_recordset(w.state->'budgets') x(id text,category text,"limit" numeric,threshold integer,month text);
create or replace view public.saving_goals with (security_invoker=true) as
select w.user_id,x.id,x.name,x.target as target_amount,x.saved as current_amount,x.date as target_date from public.finance_workspaces w cross join lateral jsonb_to_recordset(w.state->'goals') x(id text,name text,target numeric,saved numeric,date date);
create or replace view public.saving_contributions with (security_invoker=true) as
select w.user_id,x.id,x.goal as goal_id,x.amount,x.date from public.finance_workspaces w cross join lateral jsonb_to_recordset(w.state->'contributions') x(id text,goal text,amount numeric,date date);
create or replace view public.wallet_transfers with (security_invoker=true) as
select w.user_id,x.id,x."from" as from_wallet_id,x."to" as to_wallet_id,x.amount,x.date from public.finance_workspaces w cross join lateral jsonb_to_recordset(w.state->'transfers') x(id text,"from" text,"to" text,amount numeric,date date);
create or replace view public.recurring_transactions with (security_invoker=true) as
select w.user_id,x.* from public.finance_workspaces w cross join lateral jsonb_to_recordset(w.state->'recurring') x(id text,name text,amount numeric,category text,wallet text,type text,frequency text,next date,active boolean);
create or replace view public.profiles with (security_invoker=true) as select user_id,state->'settings'->>'name' as name from public.finance_workspaces;
create or replace view public.user_settings with (security_invoker=true) as select user_id,state->'settings' as settings from public.finance_workspaces;
grant select on public.transactions,public.wallets,public.budgets,public.saving_goals,public.saving_contributions,public.wallet_transfers,public.recurring_transactions,public.profiles,public.user_settings to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('receipts','receipts',false,5242880,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
drop policy if exists "Own receipts read" on storage.objects;
create policy "Own receipts read" on storage.objects for select to authenticated using(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Own receipts upload" on storage.objects;
create policy "Own receipts upload" on storage.objects for insert to authenticated with check(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Own receipts delete" on storage.objects;
create policy "Own receipts delete" on storage.objects for delete to authenticated using(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
