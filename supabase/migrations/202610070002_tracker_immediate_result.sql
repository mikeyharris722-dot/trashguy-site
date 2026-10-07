begin;
create function public.site_tracker_record(p_actor uuid,p_hunt uuid,p_call text,p_bet numeric,p_cost numeric,p_payout numeric) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(p_call,0));
 select id into v_id from public.site_tracker_entries where call_id=p_call;
 if v_id is not null then return v_id;end if;
 if p_payout is null or p_payout<0 then raise exception 'Invalid payout';end if;
 v_id:=public.site_tracker_collect(p_actor,p_hunt,p_call,'collected',p_bet,p_cost);
 perform public.site_tracker_payout(p_actor,v_id,p_payout,p_bet,p_cost);
 return v_id;end;$$;
revoke execute on function public.site_tracker_record(uuid,uuid,text,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.site_tracker_record(uuid,uuid,text,numeric,numeric,numeric) to service_role;
commit;
