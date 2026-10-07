begin;
create or replace function public.site_tracker_entry_order() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.site_tracker_hunts where hunt_id=new.hunt_id for update;
 select coalesce(max(sort_order),-1)+1 into new.sort_order from public.site_tracker_entries where hunt_id=new.hunt_id;
 if new.status='collected' and exists(select 1 from public.site_tracker_entries where hunt_id=new.hunt_id and deleted_at is null and status='collected' and identifier=new.identifier) then raise exception 'This slot is already in the hunt';end if;
 return new;
end;$$;
alter table public.site_tracker_settings add column opening_queue uuid[] not null default '{}';
create function public.site_tracker_opening_focus(p_actor uuid,p_hunt uuid,p_entries uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.site_tracker_hunts where hunt_id=p_hunt and phase='opening' and deleted_at is null for update;
 if not found then raise exception 'Hunt is not opening';end if;
 if p_entries is null or cardinality(p_entries)<>(select count(*) from public.site_tracker_entries where hunt_id=p_hunt and status='collected' and deleted_at is null and payout is null) or (select count(distinct x) from unnest(p_entries) x)<>cardinality(p_entries) or exists(select 1 from unnest(p_entries) x where not exists(select 1 from public.site_tracker_entries where id=x and hunt_id=p_hunt and deleted_at is null and status='collected' and payout is null)) then raise exception 'Opening list changed; retry';end if;
 update public.site_tracker_settings set opening_queue=p_entries,updated_at=now() where active_hunt_id=p_hunt;
end;$$;
revoke execute on function public.site_tracker_opening_focus(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.site_tracker_opening_focus(uuid,uuid,uuid[]) to service_role;
commit;
