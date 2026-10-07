begin;
create or replace function public.site_tracker_entry_order() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.site_tracker_hunts where hunt_id=new.hunt_id for update;
 select coalesce(max(sort_order),-1)+1 into new.sort_order from public.site_tracker_entries where hunt_id=new.hunt_id;
 if new.status='collected' and exists(select 1 from public.site_tracker_entries where hunt_id=new.hunt_id and deleted_at is null and status='collected' and (identifier=new.identifier or lower(trim(slot_name))=lower(trim(new.slot_name)))) then raise exception 'This slot is already in the hunt';end if;
 return new;
end;$$;
commit;
