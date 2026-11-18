-- Prepared only. Apply to the existing database after local review, before release.
begin;
create table if not exists public.x_giveaway_state (
  id integer primary key check (id = 1),
  state jsonb not null default '{"snapshots":[]}'::jsonb,
  version bigint not null default 0
);
alter table public.x_giveaway_state enable row level security;
revoke all on public.x_giveaway_state from anon, authenticated;
grant select, insert, update on public.x_giveaway_state to service_role;
insert into public.x_giveaway_state(id) values(1) on conflict do nothing;
create or replace function public.x_giveaway_commit(p_expected bigint,p_state jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.x_giveaway_state set state=p_state,version=version+1
  where id=1 and version=p_expected;
  return found;
end;
$$;
revoke all on function public.x_giveaway_commit(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.x_giveaway_commit(bigint,jsonb) to service_role;
commit;
