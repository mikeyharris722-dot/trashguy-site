-- Poker state contains the deck and private cards. Only the application server may read it.
create table public.poker_state (
 id integer primary key check (id = 1),
 state jsonb not null default '{"enabled":false,"event":null,"receipts":[]}'::jsonb,
 version bigint not null default 0,
 updated_at timestamptz not null default now(),
 constraint poker_state_size check (octet_length(state::text) <= 524288)
);
alter table public.poker_state enable row level security;
revoke all on public.poker_state from public, anon, authenticated;
grant select, update, insert on public.poker_state to service_role;
insert into public.poker_state(id) values (1);
create function public.poker_commit(p_expected bigint, p_state jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
 update public.poker_state set state = p_state, version = version + 1, updated_at = now()
 where id = 1 and version = p_expected;
 return found;
end;
$$;
revoke all on function public.poker_commit(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.poker_commit(bigint,jsonb) to service_role;
