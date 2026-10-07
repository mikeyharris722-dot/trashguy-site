begin;
create table public.roulo_catalogue_state (id boolean primary key default true check(id), games jsonb not null check(jsonb_typeof(games)='array'), updated_at timestamptz not null default now(), source text not null, revision uuid not null default gen_random_uuid());
create table public.roulo_catalogue_overrides (identifier text primary key, name text, artwork_url text, enabled boolean, aliases jsonb not null default '[]', updated_at timestamptz not null default now());
create table public.roulo_call_matches (call_id text primary key, original_request text not null, identifier text, status text not null check(status in ('matched','review')), suggestions jsonb not null default '[]', created_at timestamptz not null default now());
create table public.site_tracker_hunts (hunt_id uuid primary key references public.hunts(id), title text not null, start_amount numeric(20,6) not null check(start_amount>=0), phase text not null default 'collecting' check(phase in ('collecting','opening','finished')), created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.site_tracker_entries (id uuid primary key default gen_random_uuid(),hunt_id uuid not null references public.site_tracker_hunts(hunt_id),call_id text unique not null, username text not null,slot_name text not null,provider text,identifier text,artwork_url text, status text not null check(status in ('collected','failed')),bet_size numeric(20,6) not null check(bet_size>0),collection_cost numeric(20,6) not null check(collection_cost>=0),payout numeric(20,6) check(payout>=0),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index on public.site_tracker_entries(hunt_id,created_at);
create table public.site_tracker_audit (id bigint generated always as identity primary key,actor uuid not null,action text not null,details jsonb not null,created_at timestamptz not null default now());
alter table public.roulo_catalogue_state enable row level security;
alter table public.roulo_catalogue_overrides enable row level security;
alter table public.roulo_call_matches enable row level security;
alter table public.site_tracker_hunts enable row level security;
alter table public.site_tracker_entries enable row level security;
alter table public.site_tracker_audit enable row level security;
revoke all on public.roulo_catalogue_state,public.roulo_catalogue_overrides,public.roulo_call_matches,public.site_tracker_hunts,public.site_tracker_entries,public.site_tracker_audit from anon,authenticated;
grant all on public.roulo_catalogue_state,public.roulo_catalogue_overrides,public.roulo_call_matches,public.site_tracker_hunts,public.site_tracker_entries,public.site_tracker_audit to service_role;
grant usage,select on sequence public.site_tracker_audit_id_seq to service_role;

create function public.site_tracker_create(p_actor uuid,p_title text,p_start numeric) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid:=gen_random_uuid();begin
 if p_start<0 or p_title is null or length(trim(p_title))=0 then raise exception 'Invalid hunt';end if;
 perform pg_advisory_xact_lock(72631001);
 if exists(select 1 from public.site_tracker_hunts where phase<>'finished') then raise exception 'Finish the current site hunt first';end if;
 insert into public.hunts(id,external_hunt_id,title,casino,start_amount,status,prediction_status,created_at,updated_at,opened_at) values(v_id,'local:'||v_id,p_title,'Roulobets',p_start,'open','open',now(),now(),now());
 insert into public.site_tracker_hunts(hunt_id,title,start_amount) values(v_id,p_title,p_start);
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'create',jsonb_build_object('hunt_id',v_id,'start',p_start));return v_id;end;$$;

create function public.site_tracker_collect(p_actor uuid,p_hunt uuid,p_call text,p_status text,p_bet numeric,p_cost numeric) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_entry uuid;v_call jsonb;v_game jsonb;v_match public.roulo_call_matches%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended(p_call,0));
 select id into v_entry from public.site_tracker_entries where call_id=p_call;
 if v_entry is not null then return v_entry;end if;
 perform 1 from public.site_tracker_hunts where hunt_id=p_hunt and phase='collecting' for update;if not found then raise exception 'Hunt is not collecting';end if;
 if p_status not in ('collected','failed') or p_bet<=0 or p_cost<0 then raise exception 'Invalid result';end if;
 select to_jsonb(c) into v_call from public.slot_calls c where c.id::text=p_call for update;if v_call is null then raise exception 'Call no longer queued';end if;
 select * into v_match from public.roulo_call_matches where call_id=p_call;
 if v_match.status='review' then raise exception 'Confirm the game match first';end if;
 select game into v_game from public.roulo_catalogue_state s cross join lateral jsonb_array_elements(s.games) game where game->>'identifier'=v_match.identifier limit 1;
 insert into public.site_tracker_entries(hunt_id,call_id,username,slot_name,provider,identifier,artwork_url,status,bet_size,collection_cost) values(p_hunt,p_call,v_call->>'username',v_call->>'slot_name',v_game->>'provider',v_match.identifier,v_game->>'artwork_url',p_status,p_bet,p_cost) returning id into v_entry;
 delete from public.slot_calls where id::text=p_call;
 delete from public.roulo_call_matches where call_id=p_call;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,p_status,jsonb_build_object('entry_id',v_entry,'call',v_call));return v_entry;end;$$;

create function public.site_tracker_payout(p_actor uuid,p_entry uuid,p_payout numeric,p_bet numeric,p_cost numeric) returns void language plpgsql security invoker set search_path='' as $$
declare v_old jsonb;v_hunt uuid;begin
 select hunt_id into v_hunt from public.site_tracker_entries where id=p_entry;
 perform 1 from public.site_tracker_hunts where hunt_id=v_hunt and phase<>'finished' for update;if not found then raise exception 'Hunt finished or missing';end if;
 select to_jsonb(e) into v_old from public.site_tracker_entries e where e.id=p_entry and e.status='collected' for update;if v_old is null then raise exception 'Collected bonus missing';end if;
 if p_payout<0 or p_bet<=0 or p_cost<0 then raise exception 'Invalid amount';end if;
 update public.site_tracker_entries set payout=p_payout,bet_size=p_bet,collection_cost=p_cost,updated_at=now() where id=p_entry;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'edit_bonus',jsonb_build_object('entry_id',p_entry,'before',v_old,'payout',p_payout,'bet',p_bet,'cost',p_cost));end;$$;

create function public.site_tracker_phase(p_actor uuid,p_hunt uuid,p_phase text) returns void language plpgsql security invoker set search_path='' as $$
declare v_phase text;v_total numeric;begin
 select phase into v_phase from public.site_tracker_hunts where hunt_id=p_hunt for update;
 if v_phase is null or p_phase not in ('collecting','opening','finished') or v_phase='finished' then raise exception 'Invalid phase';end if;
 if p_phase='finished' and exists(select 1 from public.site_tracker_entries where hunt_id=p_hunt and status='collected' and payout is null) then raise exception 'Record all payouts before finishing';end if;
 select coalesce(sum(payout) filter(where status='collected'),0) into v_total from public.site_tracker_entries where hunt_id=p_hunt;
 update public.site_tracker_hunts set phase=p_phase,updated_at=now() where hunt_id=p_hunt;
 update public.hunts set status=case when p_phase='finished' then 'completed' else 'open' end,prediction_status=case when p_phase='collecting' then 'open' else 'locked' end,final_amount=case when p_phase='finished' then v_total else null end,updated_at=now() where id=p_hunt;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'phase',jsonb_build_object('hunt_id',p_hunt,'before',v_phase,'after',p_phase));end;$$;
revoke execute on function public.site_tracker_create(uuid,text,numeric),public.site_tracker_collect(uuid,uuid,text,text,numeric,numeric),public.site_tracker_payout(uuid,uuid,numeric,numeric,numeric),public.site_tracker_phase(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.site_tracker_create(uuid,text,numeric),public.site_tracker_collect(uuid,uuid,text,text,numeric,numeric),public.site_tracker_payout(uuid,uuid,numeric,numeric,numeric),public.site_tracker_phase(uuid,uuid,text) to service_role;
create function public.site_tracker_undo(p_actor uuid,p_entry uuid) returns void language plpgsql security invoker set search_path='' as $$
declare v_entry public.site_tracker_entries%rowtype;begin
 select * into v_entry from public.site_tracker_entries where id=p_entry for update;if not found then raise exception 'Result missing';end if;
 perform 1 from public.site_tracker_hunts where hunt_id=v_entry.hunt_id and phase<>'finished' for update;if not found then raise exception 'Hunt finished';end if;
 if v_entry.payout is not null then raise exception 'Clear the payout before undoing collection';end if;
 insert into public.slot_calls(id,username,slot_name,platform,created_at) values(v_entry.call_id::uuid,v_entry.username,v_entry.slot_name,'twitch',now());
 insert into public.roulo_call_matches(call_id,original_request,identifier,status) values(v_entry.call_id,v_entry.slot_name,v_entry.identifier,'matched') on conflict(call_id) do update set identifier=excluded.identifier,status='matched';
 delete from public.site_tracker_entries where id=p_entry;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'undo_result',to_jsonb(v_entry));end;$$;
revoke execute on function public.site_tracker_undo(uuid,uuid) from public,anon,authenticated;
grant execute on function public.site_tracker_undo(uuid,uuid) to service_role;
create function public.site_tracker_resolve(p_actor uuid,p_call text,p_identifier text,p_name text) returns void language plpgsql security invoker set search_path='' as $$
declare v_original text;begin
 select slot_name into v_original from public.slot_calls where id::text=p_call for update;if not found then raise exception 'Call missing';end if;
 update public.slot_calls set slot_name=p_name where id::text=p_call;
 insert into public.roulo_call_matches(call_id,original_request,identifier,status,suggestions) values(p_call,v_original,p_identifier,'matched','[]') on conflict(call_id) do update set identifier=excluded.identifier,status='matched',suggestions='[]';
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'resolve_call',jsonb_build_object('call_id',p_call,'before',v_original,'identifier',p_identifier));end;$$;
revoke execute on function public.site_tracker_resolve(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.site_tracker_resolve(uuid,text,text,text) to service_role;
commit;
