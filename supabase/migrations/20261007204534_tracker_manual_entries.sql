begin;
alter table public.site_tracker_entries add column deleted_at timestamptz;
create function public.site_tracker_manual(p_actor uuid,p_hunt uuid,p_request uuid,p_game jsonb,p_bet numeric) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select id into v_id from public.site_tracker_entries where call_id='manual:'||p_request;
 if v_id is not null then return v_id;end if;
 perform 1 from public.site_tracker_hunts where hunt_id=p_hunt and deleted_at is null and phase='collecting' for update;
 if not found then raise exception 'Select a collecting hunt';end if;
 if p_bet is null or p_bet<=0 or coalesce(p_game->>'identifier','')='' or coalesce(p_game->>'name','')='' then raise exception 'Select a game and positive bet size';end if;
 insert into public.site_tracker_entries(hunt_id,call_id,username,slot_name,provider,identifier,artwork_url,status,bet_size,collection_cost)
 values(p_hunt,'manual:'||p_request,'Manual',p_game->>'name',p_game->>'provider',p_game->>'identifier',p_game->>'artwork_url','collected',p_bet,0) returning id into v_id;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'manual_bonus',jsonb_build_object('hunt_id',p_hunt,'entry_id',v_id));return v_id;
end;$$;
create function public.site_tracker_remove_entry(p_actor uuid,p_entry uuid) returns void language plpgsql security invoker set search_path='' as $$
declare v_hunt uuid;v_old jsonb;begin
 select hunt_id into v_hunt from public.site_tracker_entries where id=p_entry;
 perform 1 from public.site_tracker_hunts where hunt_id=v_hunt and deleted_at is null and phase<>'finished' for update;
 if not found then raise exception 'Hunt finished or missing';end if;
 select to_jsonb(e) into v_old from public.site_tracker_entries e where id=p_entry and deleted_at is null for update;
 if v_old is null then raise exception 'Entry missing';end if;
 update public.site_tracker_entries set deleted_at=now(),updated_at=now() where id=p_entry;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'remove_bonus',jsonb_build_object('entry_id',p_entry,'before',v_old));
end;$$;
revoke execute on function public.site_tracker_manual(uuid,uuid,uuid,jsonb,numeric),public.site_tracker_remove_entry(uuid,uuid) from public,anon,authenticated;
grant execute on function public.site_tracker_manual(uuid,uuid,uuid,jsonb,numeric),public.site_tracker_remove_entry(uuid,uuid) to service_role;
create or replace function public.site_tracker_phase(p_actor uuid,p_hunt uuid,p_phase text) returns void language plpgsql security invoker set search_path='' as $$
declare v_phase text;v_total numeric;begin
 select phase into v_phase from public.site_tracker_hunts where hunt_id=p_hunt and deleted_at is null for update;
 if v_phase is null or p_phase not in ('collecting','opening','finished') or v_phase='finished' then raise exception 'Invalid phase';end if;
 if p_phase='finished' and exists(select 1 from public.site_tracker_entries where hunt_id=p_hunt and deleted_at is null and status='collected' and payout is null) then raise exception 'Record all payouts before finishing';end if;
 select coalesce(sum(payout) filter(where status='collected'),0) into v_total from public.site_tracker_entries where hunt_id=p_hunt and deleted_at is null;
 update public.site_tracker_hunts set phase=p_phase,updated_at=now() where hunt_id=p_hunt and deleted_at is null;
 update public.hunts set status=case when p_phase='finished' then 'completed' else 'open' end,prediction_status=case when p_phase='collecting' then 'open' else 'locked' end,final_amount=case when p_phase='finished' then v_total else null end,updated_at=now() where id=p_hunt;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'phase',jsonb_build_object('hunt_id',p_hunt,'before',v_phase,'after',p_phase));end;$$;
create or replace function public.site_tracker_payout(p_actor uuid,p_entry uuid,p_payout numeric,p_bet numeric,p_cost numeric) returns void language plpgsql security invoker set search_path='' as $$
declare v_old jsonb;v_hunt uuid;begin
 select hunt_id into v_hunt from public.site_tracker_entries where id=p_entry;
 perform 1 from public.site_tracker_hunts where hunt_id=v_hunt and phase<>'finished' for update;if not found then raise exception 'Hunt finished or missing';end if;
 select to_jsonb(e) into v_old from public.site_tracker_entries e where e.id=p_entry and e.deleted_at is null and e.status='collected' for update;if v_old is null then raise exception 'Collected bonus missing';end if;
 if p_payout<0 or p_bet<=0 or p_cost<0 then raise exception 'Invalid amount';end if;
 update public.site_tracker_entries set payout=p_payout,bet_size=p_bet,collection_cost=p_cost,updated_at=now() where id=p_entry;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'edit_bonus',jsonb_build_object('entry_id',p_entry,'before',v_old,'payout',p_payout,'bet',p_bet,'cost',p_cost));end;$$;
create or replace function public.site_tracker_undo(p_actor uuid,p_entry uuid) returns void language plpgsql security invoker set search_path='' as $$
declare v_entry public.site_tracker_entries%rowtype;begin
 select * into v_entry from public.site_tracker_entries where id=p_entry and deleted_at is null for update;if not found then raise exception 'Result missing';end if;
 perform 1 from public.site_tracker_hunts where hunt_id=v_entry.hunt_id and phase<>'finished' for update;if not found then raise exception 'Hunt finished';end if;
 if v_entry.call_id like 'manual:%' then raise exception 'Use Remove from hunt for manual entries';end if;
 if v_entry.payout is not null then raise exception 'Clear the payout before undoing collection';end if;
 insert into public.slot_calls(id,username,slot_name,platform,created_at) values(v_entry.call_id::uuid,v_entry.username,v_entry.slot_name,'twitch',now());
 insert into public.roulo_call_matches(call_id,original_request,identifier,status) values(v_entry.call_id,v_entry.slot_name,v_entry.identifier,'matched') on conflict(call_id) do update set identifier=excluded.identifier,status='matched';
 delete from public.site_tracker_entries where id=p_entry;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'undo_result',to_jsonb(v_entry));end;$$;
commit;
