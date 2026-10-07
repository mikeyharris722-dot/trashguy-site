begin;
alter table public.site_tracker_entries add column sort_order integer not null default 0;
with ranked as (select id,row_number() over(partition by hunt_id order by created_at,id)-1 n from public.site_tracker_entries)
update public.site_tracker_entries e set sort_order=r.n from ranked r where r.id=e.id;
create function public.site_tracker_entry_order() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.site_tracker_hunts where hunt_id=new.hunt_id for update;
 select coalesce(max(sort_order),-1)+1 into new.sort_order from public.site_tracker_entries where hunt_id=new.hunt_id;
 if new.status='collected' and new.call_id not like 'manual:%' and exists(select 1 from public.site_tracker_entries where hunt_id=new.hunt_id and deleted_at is null and status='collected' and identifier=new.identifier) then raise exception 'Slot already in hunt; ignore this call';end if;
 return new;
end;$$;
create trigger site_tracker_entry_order before insert on public.site_tracker_entries for each row execute function public.site_tracker_entry_order();
revoke execute on function public.site_tracker_entry_order() from public,anon,authenticated;
grant execute on function public.site_tracker_entry_order() to service_role;
create function public.site_tracker_reorder(p_actor uuid,p_hunt uuid,p_entries uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare v_count integer;begin
 perform 1 from public.site_tracker_hunts where hunt_id=p_hunt and deleted_at is null and phase='collecting' for update;
 if not found then raise exception 'Reorder while collecting, before opening';end if;
 select count(*) into v_count from public.site_tracker_entries where hunt_id=p_hunt and deleted_at is null;
 if p_entries is null or cardinality(p_entries)<>v_count or (select count(distinct x) from unnest(p_entries) x)<>v_count or exists(select 1 from unnest(p_entries) x where not exists(select 1 from public.site_tracker_entries where id=x and hunt_id=p_hunt and deleted_at is null)) then raise exception 'List changed; refresh and reorder again';end if;
 update public.site_tracker_entries e set sort_order=r.n-1 from unnest(p_entries) with ordinality r(id,n) where e.id=r.id and e.hunt_id=p_hunt;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'reorder',jsonb_build_object('hunt_id',p_hunt,'entries',p_entries));
end;$$;
revoke execute on function public.site_tracker_reorder(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.site_tracker_reorder(uuid,uuid,uuid[]) to service_role;
commit;
