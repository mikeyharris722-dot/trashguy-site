-- Keep the selected call, result and bonus type in one transaction.
create function public.site_tracker_collect_tier(
 p_actor uuid,p_hunt uuid,p_call text,p_status text,p_bet numeric,p_cost numeric,
 p_tier text default 'standard',p_payout numeric default null,p_fx jsonb default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;begin
 if p_tier is null or p_tier not in ('standard','super','super_super') then
  raise exception 'Invalid bonus type';
 end if;
 if p_status is null or p_status not in ('collected','failed') then raise exception 'Invalid result';end if;
 if p_payout is not null and p_status <> 'collected' then raise exception 'Only collected bonuses can have a payout';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_call,0));
 -- Retries must preserve the first saved result, including its bonus type.
 select id into v_id from public.site_tracker_entries where call_id=p_call;
 if v_id is not null then return v_id;end if;
 if p_payout is null then
  v_id:=public.site_tracker_collect(p_actor,p_hunt,p_call,p_status,p_bet,p_cost);
 else
  v_id:=public.site_tracker_record_currency(p_actor,p_hunt,p_call,p_bet,p_cost,p_payout,p_fx);
 end if;
 update public.site_tracker_entries set bonus_tier=p_tier where id=v_id;
 return v_id;
end;$$;
revoke all on function public.site_tracker_collect_tier(uuid,uuid,text,text,numeric,numeric,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.site_tracker_collect_tier(uuid,uuid,text,text,numeric,numeric,text,numeric,jsonb) to service_role;
