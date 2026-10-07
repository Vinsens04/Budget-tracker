-- An optimistic revision mismatch is an HTTP 409 conflict, rather than a
-- retryable serialization failure. Preserve the atomic write and RLS boundary.
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
 if result is null then raise exception 'Workspace changed; reload before saving' using errcode='23505'; end if;
 return result;
end $$;
revoke all on function public.save_finance_workspace(jsonb,bigint) from public, anon;
grant execute on function public.save_finance_workspace(jsonb,bigint) to authenticated;
