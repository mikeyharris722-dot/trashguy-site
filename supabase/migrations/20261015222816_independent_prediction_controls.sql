-- Prediction state belongs only to the prediction controls.
-- Replacements retain existing function signatures, invoker security and grants.
begin;
set local lock_timeout = '3s';
create or replace function public.site_tracker_create(p_actor uuid,p_title text,p_start numeric) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid:=gen_random_uuid();begin
 if p_start<0 or p_title is null or length(trim(p_title))=0 then raise exception 'Invalid hunt';end if;
 perform pg_advisory_xact_lock(72631001);
 if exists(select 1 from public.site_tracker_hunts where phase<>'finished' and deleted_at is null) then raise exception 'Finish the current site hunt first';end if;
 insert into public.hunts(id,external_hunt_id,title,casino,start_amount,status,prediction_status,created_at,updated_at,opened_at) values(v_id,'local:'||v_id,p_title,'Roulobets',p_start,'open','locked',now(),now(),now());
 insert into public.site_tracker_hunts(hunt_id,title,start_amount) values(v_id,p_title,p_start);
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'create',jsonb_build_object('hunt_id',v_id,'start',p_start));perform public.site_tracker_select(p_actor,v_id);return v_id;end;$$;

create or replace function public.site_tracker_phase(p_actor uuid,p_hunt uuid,p_phase text) returns void language plpgsql security invoker set search_path='' as $$
declare v_phase text;v_total numeric;begin
 select phase into v_phase from public.site_tracker_hunts where hunt_id=p_hunt and deleted_at is null for update;
 if v_phase is null or p_phase not in ('collecting','opening','finished') or v_phase='finished' then raise exception 'Invalid phase';end if;
 if p_phase='finished' and exists(select 1 from public.site_tracker_entries where hunt_id=p_hunt and deleted_at is null and status='collected' and payout is null) then raise exception 'Record all payouts before finishing';end if;
 select coalesce(sum(payout) filter(where status='collected'),0) into v_total from public.site_tracker_entries where hunt_id=p_hunt and deleted_at is null;
 update public.site_tracker_hunts set phase=p_phase,updated_at=now() where hunt_id=p_hunt and deleted_at is null;
 update public.hunts set status=case when p_phase='finished' then 'completed' else 'open' end,final_amount=case when p_phase='finished' then v_total else null end,updated_at=now() where id=p_hunt;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'phase',jsonb_build_object('hunt_id',p_hunt,'before',v_phase,'after',p_phase));end;$$;

create or replace function public.site_tracker_delete(p_actor uuid,p_hunt uuid,p_title text) returns void language plpgsql security invoker set search_path='' as $$
declare v_old jsonb;begin
 perform pg_advisory_xact_lock(72631001);
 select to_jsonb(h) into v_old from public.site_tracker_hunts h where hunt_id=p_hunt and deleted_at is null for update;
 if v_old is null then raise exception 'Hunt missing';end if;
 if p_title is distinct from v_old->>'title' then raise exception 'Type the exact hunt title to delete';end if;
 update public.site_tracker_hunts set deleted_at=now(),phase='finished',updated_at=now() where hunt_id=p_hunt;
 update public.hunts set status='completed',updated_at=now() where id=p_hunt;
 update public.site_tracker_settings set active_hunt_id=null,updated_at=now() where active_hunt_id=p_hunt;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'delete_hunt',jsonb_build_object('hunt_id',p_hunt,'before',v_old));
end;$$;
commit;
