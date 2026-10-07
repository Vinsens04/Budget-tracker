-- Enable pg_cron in Supabase, then run the optional schedule statement below.
create or replace function public.process_due_transactions() returns integer
language plpgsql security definer set search_path=public as $$
declare workspace record; rule jsonb; rules jsonb; tx jsonb; next_date date; target_month date; v_state jsonb; transaction_id text; changed boolean; processed integer:=0; iteration integer;
begin
 for workspace in select * from public.finance_workspaces for update skip locked loop
  v_state:=workspace.state; tx:=v_state->'transactions';rules:='[]'::jsonb;changed:=false;
  for rule in select value from jsonb_array_elements(v_state->'recurring') loop
   next_date:=(rule->>'next')::date;iteration:=0;
   while (rule->>'active')::boolean and next_date<=(now() at time zone 'Asia/Jakarta')::date and iteration<1000 loop
    transaction_id:='recurring-'||(rule->>'id')||'-'||next_date::text;
    if not exists(select 1 from jsonb_array_elements(tx) t where t->>'id'=transaction_id) then
     tx:=tx||jsonb_build_array(jsonb_build_object('id',transaction_id,'type',rule->>'type','amount',(rule->>'amount')::numeric,'name',rule->>'name','category',rule->>'category','wallet',rule->>'wallet','date',next_date::text,'note','Scheduled transaction','recurringId',rule->>'id'));
    end if;
    if rule->>'frequency'='weekly' then next_date:=next_date+7;
    else
     target_month:=date_trunc('month',next_date)::date+case when rule->>'frequency'='yearly' then interval '1 year' else interval '1 month' end;
     next_date:=target_month+(least(extract(day from next_date)::integer,extract(day from target_month+interval '1 month - 1 day')::integer)-1);
    end if;
    changed:=true;iteration:=iteration+1;
   end loop;
   rules:=rules||jsonb_build_array(jsonb_set(rule,'{next}',to_jsonb(next_date::text)));
  end loop;
  if changed then
   v_state:=jsonb_set(jsonb_set(v_state,'{transactions}',tx),'{recurring}',rules);
   perform public.validate_finance_state(v_state);
   update public.finance_workspaces set state=v_state,revision=revision+1,updated_at=now() where user_id=workspace.user_id;
   processed:=processed+1;
  end if;
 end loop;
 return processed;
end $$;
revoke all on function public.process_due_transactions() from public,anon,authenticated;
-- After enabling pg_cron, uncomment and run once:
-- select cron.schedule('saldo-recurring-hourly','5 * * * *','select public.process_due_transactions()');

