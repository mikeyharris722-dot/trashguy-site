begin;
create table public.hunts(id uuid primary key);
create table public.slot_calls(id uuid primary key default gen_random_uuid(),username text,slot_name text,platform text default 'twitch',created_at timestamptz default now());
alter table public.slot_calls enable row level security;
grant all on public.slot_calls to service_role;
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

alter table public.slot_calls add column if not exists picked_at timestamptz;

create or replace function public.slot_call_queue(p_username text,p_platform text,p_slot text,p_match jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_call public.slot_calls%rowtype;v_replaced boolean;begin
 if p_username is null or length(trim(p_username))=0 or length(p_username)>100 or p_slot is null or length(trim(p_slot))=0 or length(p_slot)>120 or p_platform not in ('twitch','kick') then raise exception 'Invalid slot call';end if;
 if p_match->>'status' not in ('matched','review') or jsonb_typeof(p_match->'suggestions')<>'array' then raise exception 'Invalid game match';end if;
 perform pg_advisory_xact_lock(72631617);
 select * into v_call from public.slot_calls where lower(username)=lower(trim(p_username)) and platform=p_platform and picked_at is null order by created_at,id limit 1 for update;
 v_replaced:=found;
 if exists(select 1 from public.slot_calls where lower(slot_name)=lower(trim(p_slot)) and (not v_replaced or id<>v_call.id)) then raise exception 'This slot is already on the wheel or currently picked';end if;
 if v_replaced then update public.slot_calls set slot_name=trim(p_slot) where id=v_call.id and picked_at is null returning * into v_call;
 else insert into public.slot_calls(username,platform,slot_name) values(trim(p_username),p_platform,trim(p_slot)) returning * into v_call;end if;
 insert into public.roulo_call_matches(call_id,original_request,identifier,status,suggestions)
 values(v_call.id::text,coalesce(p_match->>'original_request',trim(p_slot)),p_match->>'identifier',p_match->>'status',p_match->'suggestions')
 on conflict(call_id) do update set original_request=excluded.original_request,identifier=excluded.identifier,status=excluded.status,suggestions=excluded.suggestions;
 return jsonb_build_object('call',to_jsonb(v_call),'replaced',v_replaced,'needsReview',p_match->>'status'='review');
end;$$;

create or replace function public.slot_call_pick(p_actor uuid,p_call uuid,p_expected_slot text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_call public.slot_calls%rowtype;v_match public.roulo_call_matches%rowtype;begin
 if p_actor is null then raise exception 'Admin required';end if;
 perform pg_advisory_xact_lock(72631617);
 select * into v_call from public.slot_calls where id=p_call for update;
 if not found then raise exception 'This call is no longer queued. Refresh and spin again';end if;
 if v_call.slot_name is distinct from p_expected_slot then raise exception 'This call changed before it was picked. Refresh and spin again';end if;
 update public.slot_calls set picked_at=coalesce(picked_at,now()) where id=p_call returning * into v_call;
 select * into v_match from public.roulo_call_matches where call_id=p_call::text;
 return jsonb_build_object('call',to_jsonb(v_call),'needsReview',v_match.status='review','originalRequest',v_match.original_request,'suggestions',coalesce(v_match.suggestions,'[]'::jsonb));
end;$$;
revoke execute on function public.slot_call_queue(text,text,text,jsonb),public.slot_call_pick(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.slot_call_queue(text,text,text,jsonb),public.slot_call_pick(uuid,uuid,text) to service_role;
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


insert into public.hunts(id) values('00000000-0000-4000-8000-000000000001');
insert into public.site_tracker_hunts(hunt_id,title,start_amount) values('00000000-0000-4000-8000-000000000001','Test',100);
insert into public.roulo_catalogue_state(id,games,source) values(true,'[{"identifier":"a","name":"Slot A"},{"identifier":"b","name":"Slot B"},{"identifier":"c","name":"Slot C"}]','test');
do $$ declare a uuid;b uuid;c uuid;entry uuid;v jsonb;begin
 v:=public.slot_call_queue('Viewer','twitch','Slot A','{"status":"matched","identifier":"a","suggestions":[]}');a:=(v->'call'->>'id')::uuid;
 perform public.slot_call_pick('00000000-0000-4000-8000-000000000002',a,'Slot A');
 v:=public.slot_call_queue('VIEWER','twitch','Slot B','{"status":"matched","identifier":"b","suggestions":[]}');b:=(v->'call'->>'id')::uuid;
 if a=b or (select count(*) from public.slot_calls)<>2 then raise exception 'Next call overwrote the selected call';end if;
 if (select slot_name from public.slot_calls where id=a)<>'Slot A' or (select picked_at from public.slot_calls where id=a) is null then raise exception 'Selected call changed';end if;
 v:=public.slot_call_queue('Viewer','twitch','Slot C','{"status":"matched","identifier":"c","suggestions":[]}');c:=(v->'call'->>'id')::uuid;
 if c<>b or (v->>'replaced')::boolean is not true then raise exception 'Pending replacement failed';end if;
 begin perform public.slot_call_pick('00000000-0000-4000-8000-000000000002',c,'Slot B');raise exception 'Stale call was selected';exception when raise_exception then if sqlerrm='Stale call was selected' then raise;end if;end;
 if (select picked_at from public.slot_calls where id=c) is not null then raise exception 'Failed claim modified the call';end if;
 entry:=public.site_tracker_collect('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',a::text,'collected',1,0);
 if (select slot_name from public.site_tracker_entries where id=entry)<>'Slot A' then raise exception 'Wrong slot recorded';end if;
 if not exists(select 1 from public.slot_calls where id=c and slot_name='Slot C' and picked_at is null) then raise exception 'Recording result removed the next call';end if;
 if public.site_tracker_collect('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',a::text,'collected',1,0)<>entry then raise exception 'Result retry failed';end if;
 perform public.slot_call_pick('00000000-0000-4000-8000-000000000002',c,'Slot C');
 v:=public.slot_call_queue('Viewer','twitch','Slot B','{"status":"matched","identifier":"b","suggestions":[]}');b:=(v->'call'->>'id')::uuid;
 perform public.site_tracker_collect('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',c::text,'failed',1,0);
 if not exists(select 1 from public.slot_calls where id=b and slot_name='Slot B' and picked_at is null) then raise exception 'Failed result removed next call';end if;
 begin
  perform public.slot_call_queue('Viewer','twitch','Broken Slot','{"status":"matched","suggestions":null}');
  raise exception 'Invalid metadata accepted';
 exception when others then if sqlerrm='Invalid metadata accepted' then raise;end if;end;
 if not exists(select 1 from public.slot_calls where id=b and slot_name='Slot B') then raise exception 'Metadata failure changed pending call';end if;
 if has_function_privilege('anon','public.slot_call_pick(uuid,uuid,text)','execute') or has_function_privilege('authenticated','public.slot_call_queue(text,text,text,jsonb)','execute') then raise exception 'Public RPC access';end if;
 raise notice 'PASS frozen selected slot, separate next call, pending-only replacement, stale selection rejection, correct result, retry safety and service-only RPCs';
end $$;
rollback;

