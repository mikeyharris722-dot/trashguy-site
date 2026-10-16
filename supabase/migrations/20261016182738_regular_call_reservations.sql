begin;
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
commit;
