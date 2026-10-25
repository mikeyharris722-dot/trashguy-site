-- Two waiting calls per viewer; picked calls never count toward replacement.
-- The shared lock serializes submissions with slot_call_pick.
create or replace function public.slot_call_queue(p_username text,p_platform text,p_slot text,p_match jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_call public.slot_calls%rowtype;v_old public.slot_calls%rowtype;v_count integer;v_replaced boolean;begin
 if p_username is null or length(trim(p_username))=0 or length(p_username)>100 or p_slot is null or length(trim(p_slot))=0 or length(p_slot)>120 or p_platform is null or p_platform not in ('twitch','kick') then raise exception 'Invalid slot call';end if;
 if p_match is null or coalesce(p_match->>'status','') not in ('matched','review') or jsonb_typeof(p_match->'suggestions') is distinct from 'array' then raise exception 'Invalid game match';end if;
 perform pg_advisory_xact_lock(72631617);
 select count(*) into v_count from public.slot_calls where lower(username)=lower(trim(p_username)) and platform=p_platform and picked_at is null;
 v_replaced:=v_count>=2;
 if v_replaced then
  select * into v_old from public.slot_calls where lower(username)=lower(trim(p_username)) and platform=p_platform and picked_at is null order by created_at,id limit 1 for update;
 end if;
 if exists(select 1 from public.slot_calls where lower(slot_name)=lower(trim(p_slot)) and (not v_replaced or id<>v_old.id)) then raise exception 'This slot is already on the wheel or currently picked';end if;
 if v_replaced then
  delete from public.roulo_call_matches where call_id=v_old.id::text;
  delete from public.slot_calls where id=v_old.id and picked_at is null;
 end if;
 -- A fresh ID and timestamp put the new call at the back and invalidate stale picks.
 insert into public.slot_calls(username,platform,slot_name,created_at) values(trim(p_username),p_platform,trim(p_slot),clock_timestamp()) returning * into v_call;
 insert into public.roulo_call_matches(call_id,original_request,identifier,status,suggestions)
 values(v_call.id::text,coalesce(p_match->>'original_request',trim(p_slot)),p_match->>'identifier',p_match->>'status',p_match->'suggestions');
 return jsonb_build_object('call',to_jsonb(v_call),'replaced',v_replaced,'replacedCallId',case when v_replaced then v_old.id else null end,'needsReview',p_match->>'status'='review');
end;$$;
-- CREATE OR REPLACE retains the existing service-only function grants.
