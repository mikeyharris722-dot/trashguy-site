create table public.discord_slot_board (
 id boolean primary key default true check(id), enabled boolean not null default false,
 webhook_url text not null default '', messages jsonb not null default '{}',
 lease_id uuid, lease_until timestamptz, next_attempt timestamptz not null default now(),
 last_synced_at timestamptz, last_error text not null default ''
);
alter table public.discord_slot_board enable row level security;
revoke all on public.discord_slot_board from public,anon,authenticated;
grant select,insert,update on public.discord_slot_board to service_role;
insert into public.discord_slot_board(id) values(true);
create function public.discord_slot_board_claim(p_lease uuid) returns setof public.discord_slot_board
language sql security invoker set search_path='' as $$
 update public.discord_slot_board set lease_id=p_lease,lease_until=now()+interval '90 seconds'
 where id=true and enabled and webhook_url<>'' and next_attempt<=now() and (lease_until is null or lease_until<now()) returning *;
$$;
revoke all on function public.discord_slot_board_claim(uuid) from public,anon,authenticated;
grant execute on function public.discord_slot_board_claim(uuid) to service_role;
