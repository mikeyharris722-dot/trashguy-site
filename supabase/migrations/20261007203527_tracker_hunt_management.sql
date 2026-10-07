begin;
alter table public.site_tracker_hunts add column deleted_at timestamptz;
create function public.site_tracker_edit(p_actor uuid,p_hunt uuid,p_title text,p_start numeric) returns void language plpgsql security invoker set search_path='' as $$
declare v_old jsonb;begin
 select to_jsonb(h) into v_old from public.site_tracker_hunts h where hunt_id=p_hunt and deleted_at is null for update;
 if v_old is null then raise exception 'Hunt missing';end if;
 if p_start is null or p_start<0 or p_title is null or length(trim(p_title))=0 or length(p_title)>160 then raise exception 'Invalid hunt settings';end if;
 update public.site_tracker_hunts set title=trim(p_title),start_amount=p_start,updated_at=now() where hunt_id=p_hunt;
 update public.hunts set title=trim(p_title),start_amount=p_start,updated_at=now() where id=p_hunt;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'edit_hunt',jsonb_build_object('hunt_id',p_hunt,'before',v_old,'title',trim(p_title),'start',p_start));
end;$$;
create function public.site_tracker_delete(p_actor uuid,p_hunt uuid,p_title text) returns void language plpgsql security invoker set search_path='' as $$
declare v_old jsonb;begin
 perform pg_advisory_xact_lock(72631001);
 select to_jsonb(h) into v_old from public.site_tracker_hunts h where hunt_id=p_hunt and deleted_at is null for update;
 if v_old is null then raise exception 'Hunt missing';end if;
 if p_title is distinct from v_old->>'title' then raise exception 'Type the exact hunt title to delete';end if;
 update public.site_tracker_hunts set deleted_at=now(),phase='finished',updated_at=now() where hunt_id=p_hunt;
 update public.hunts set status='completed',prediction_status='locked',updated_at=now() where id=p_hunt;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'delete_hunt',jsonb_build_object('hunt_id',p_hunt,'before',v_old));
end;$$;
revoke execute on function public.site_tracker_edit(uuid,uuid,text,numeric),public.site_tracker_delete(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.site_tracker_edit(uuid,uuid,text,numeric),public.site_tracker_delete(uuid,uuid,text) to service_role;
commit;
