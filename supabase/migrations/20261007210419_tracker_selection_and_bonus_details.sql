begin;
alter table public.site_tracker_entries add column bonus_tier text not null default 'standard' check(bonus_tier in ('standard','super','super_super')),add column notes text not null default '' check(length(notes)<=1000);
create table public.site_tracker_settings(id boolean primary key default true check(id),active_hunt_id uuid references public.site_tracker_hunts(hunt_id),updated_at timestamptz not null default now());
alter table public.site_tracker_settings enable row level security;
revoke all on public.site_tracker_settings from anon,authenticated;
grant all on public.site_tracker_settings to service_role;
insert into public.site_tracker_settings(id,active_hunt_id) select true,hunt_id from public.site_tracker_hunts where deleted_at is null order by (phase<>'finished') desc,created_at desc limit 1;
create function public.site_tracker_select(p_actor uuid,p_hunt uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_hunt is not null then perform 1 from public.site_tracker_hunts where hunt_id=p_hunt and deleted_at is null for share;if not found then raise exception 'Hunt missing';end if;end if;
 insert into public.site_tracker_settings(id,active_hunt_id) values(true,p_hunt) on conflict(id) do update set active_hunt_id=excluded.active_hunt_id,updated_at=now();
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'select_hunt',jsonb_build_object('hunt_id',p_hunt));
end;$$;
create function public.site_tracker_bonus_edit(p_actor uuid,p_entry uuid,p_payout numeric,p_bet numeric,p_cost numeric,p_tier text,p_notes text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_tier is not null and p_tier not in ('standard','super','super_super') or length(p_notes)>1000 then raise exception 'Invalid bonus details';end if;
 perform public.site_tracker_payout(p_actor,p_entry,p_payout,p_bet,p_cost);
 update public.site_tracker_entries set bonus_tier=coalesce(p_tier,bonus_tier),notes=coalesce(p_notes,notes) where id=p_entry;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'bonus_details',jsonb_build_object('entry_id',p_entry,'tier',p_tier,'notes',p_notes));
end;$$;
revoke execute on function public.site_tracker_select(uuid,uuid),public.site_tracker_bonus_edit(uuid,uuid,numeric,numeric,numeric,text,text) from public,anon,authenticated;
grant execute on function public.site_tracker_select(uuid,uuid),public.site_tracker_bonus_edit(uuid,uuid,numeric,numeric,numeric,text,text) to service_role;
create or replace function public.site_tracker_create(p_actor uuid,p_title text,p_start numeric) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid:=gen_random_uuid();begin
 if p_start<0 or p_title is null or length(trim(p_title))=0 then raise exception 'Invalid hunt';end if;
 perform pg_advisory_xact_lock(72631001);
 if exists(select 1 from public.site_tracker_hunts where phase<>'finished' and deleted_at is null) then raise exception 'Finish the current site hunt first';end if;
 insert into public.hunts(id,external_hunt_id,title,casino,start_amount,status,prediction_status,created_at,updated_at,opened_at) values(v_id,'local:'||v_id,p_title,'Roulobets',p_start,'open','open',now(),now(),now());
 insert into public.site_tracker_hunts(hunt_id,title,start_amount) values(v_id,p_title,p_start);
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'create',jsonb_build_object('hunt_id',v_id,'start',p_start));perform public.site_tracker_select(p_actor,v_id);return v_id;end;$$;
create or replace function public.site_tracker_delete(p_actor uuid,p_hunt uuid,p_title text) returns void language plpgsql security invoker set search_path='' as $$
declare v_old jsonb;begin
 perform pg_advisory_xact_lock(72631001);
 select to_jsonb(h) into v_old from public.site_tracker_hunts h where hunt_id=p_hunt and deleted_at is null for update;
 if v_old is null then raise exception 'Hunt missing';end if;
 if p_title is distinct from v_old->>'title' then raise exception 'Type the exact hunt title to delete';end if;
 update public.site_tracker_hunts set deleted_at=now(),phase='finished',updated_at=now() where hunt_id=p_hunt;
 update public.hunts set status='completed',prediction_status='locked',updated_at=now() where id=p_hunt;
 update public.site_tracker_settings set active_hunt_id=null,updated_at=now() where active_hunt_id=p_hunt;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'delete_hunt',jsonb_build_object('hunt_id',p_hunt,'before',v_old));
end;$$;
create or replace function public.site_tracker_manual(p_actor uuid,p_hunt uuid,p_request uuid,p_game jsonb,p_bet numeric) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select id into v_id from public.site_tracker_entries where call_id='manual:'||p_request;
 if v_id is not null then return v_id;end if;
 perform 1 from public.site_tracker_hunts where hunt_id=p_hunt and deleted_at is null and phase='collecting' for update;
 if not found then raise exception 'Select a collecting hunt';end if;
 if p_bet is null or p_bet<=0 or coalesce(p_game->>'identifier','')='' or coalesce(p_game->>'name','')='' then raise exception 'Select a game and positive bet size';end if;
 insert into public.site_tracker_entries(hunt_id,call_id,username,slot_name,provider,identifier,artwork_url,status,bet_size,collection_cost,bonus_tier,notes)
 values(p_hunt,'manual:'||p_request,'Manual',p_game->>'name',p_game->>'provider',p_game->>'identifier',p_game->>'artwork_url','collected',p_bet,0,coalesce(p_game->>'bonus_tier','standard'),coalesce(p_game->>'notes','')) returning id into v_id;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'manual_bonus',jsonb_build_object('hunt_id',p_hunt,'entry_id',v_id));return v_id;
end;$$;
commit;
