-- Apply before deploying the site-user call feature.
BEGIN;
create or replace function public.site_tracker_manual(p_actor uuid,p_hunt uuid,p_request uuid,p_game jsonb,p_bet numeric) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_username text; v_call text; begin
 if p_request is null then raise exception 'Missing request ID'; end if;
 v_call:='manual:'||p_request;
 if coalesce(p_game->>'caller_profile_id','')<>'' then
  select username into v_username from public.profiles where id=(p_game->>'caller_profile_id')::uuid and coalesce(twitch_user_id,'')<>'' and coalesce(trim(username),'')<>'';
  if not found then raise exception 'Select a registered Twitch user'; end if;
  v_call:='manual:viewer:'||p_request;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select id into v_id from public.site_tracker_entries where call_id in ('manual:'||p_request,'manual:viewer:'||p_request);
 if v_id is not null then return v_id;end if;
 perform 1 from public.site_tracker_hunts where hunt_id=p_hunt and deleted_at is null and phase='collecting' for update;
 if not found then raise exception 'Select a collecting hunt';end if;
 if p_bet is null or p_bet<=0 or coalesce(p_game->>'identifier','')='' or coalesce(p_game->>'name','')='' then raise exception 'Select a game and positive bet size';end if;
 if exists(select 1 from public.site_tracker_entries where hunt_id=p_hunt and deleted_at is null and status='collected' and (identifier=p_game->>'identifier' or lower(trim(slot_name))=lower(trim(p_game->>'name')))) then raise exception 'This slot is already in the hunt'; end if;
 insert into public.site_tracker_entries(hunt_id,call_id,username,slot_name,provider,identifier,artwork_url,status,bet_size,collection_cost,bonus_tier,notes)
 values(p_hunt,v_call,coalesce(v_username,'Manual'),p_game->>'name',p_game->>'provider',p_game->>'identifier',p_game->>'artwork_url','collected',p_bet,0,coalesce(p_game->>'bonus_tier','standard'),coalesce(p_game->>'notes','')) returning id into v_id;
 insert into public.site_tracker_audit(actor,action,details) values(p_actor,'manual_bonus',jsonb_build_object('hunt_id',p_hunt,'entry_id',v_id,'caller_profile_id',p_game->>'caller_profile_id','username',coalesce(v_username,'Manual')));return v_id;
end;$$;
CREATE OR REPLACE FUNCTION public.claim_trash_boss(p_username text,p_boss integer,p_start date,p_end date,p_target numeric,p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_total numeric; v_claim uuid; v_reward uuid; v_name text:=lower(trim(p_username)); v_settings jsonb;
BEGIN
 SELECT payload->'prizeSettings' INTO v_settings FROM community_documents WHERE id='hunts' FOR SHARE;
 IF COALESCE((v_settings->>'trashBossesEnabled')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Trash Bosses is deactivated. Reward claims are disabled.'; END IF;
 IF (v_settings->>'leaderboardStart')::date IS DISTINCT FROM p_start OR (v_settings->>'leaderboardEnd')::date IS DISTINCT FROM p_end
 OR (v_settings->'trashBosses'->p_boss->>'target')::numeric IS DISTINCT FROM p_target OR (v_settings->'trashBosses'->p_boss->>'reward')::numeric IS DISTINCT FROM p_amount THEN RAISE EXCEPTION 'Boss settings changed. Refresh and retry.'; END IF;
 IF p_boss NOT BETWEEN 0 AND 2 OR p_start>=p_end OR p_target<=0 OR p_amount<=0 OR v_name='' THEN RAISE EXCEPTION 'Invalid reward request'; END IF;
 SELECT id,reward_id INTO v_claim,v_reward FROM trash_boss_claims WHERE username=v_name AND boss=p_boss AND period_start=p_start;
 IF FOUND THEN RETURN COALESCE(v_reward,v_claim); END IF;
 SELECT COALESCE(sum(round(e.payout*100)),0)/100 INTO v_total FROM site_tracker_entries e JOIN site_tracker_hunts h ON h.hunt_id=e.hunt_id
 WHERE e.deleted_at IS NULL AND h.deleted_at IS NULL AND lower(trim(e.username))=v_name AND e.status='collected' AND e.payout IS NOT NULL
 AND e.call_id IS NOT NULL AND (e.call_id NOT LIKE 'manual:%' OR e.call_id ~ '^manual:viewer:[0-9a-fA-F-]{36}$') AND COALESCE(e.payout_recorded_at,e.updated_at)>=(p_start::timestamp AT TIME ZONE 'UTC') AND COALESCE(e.payout_recorded_at,e.updated_at)<(p_end::timestamp AT TIME ZONE 'UTC');
 IF v_total<p_target THEN RAISE EXCEPTION 'Your called-slot winnings have not reached this target'; END IF;
 INSERT INTO trash_boss_claims(username,boss,period_start,period_end,target,amount) VALUES(v_name,p_boss,p_start,p_end,p_target,p_amount)
 ON CONFLICT(username,boss,period_start) DO NOTHING RETURNING id INTO v_claim;
 IF v_claim IS NULL THEN SELECT COALESCE(reward_id,id) INTO v_reward FROM trash_boss_claims WHERE username=v_name AND boss=p_boss AND period_start=p_start; RETURN v_reward; END IF;
 INSERT INTO rewards(twitch_username,display_name,platform,amount,type,title,status,claimed,paid,claimed_at)
 VALUES(v_name,v_name,'twitch',p_amount,'trash_boss','Trash Boss '||(p_boss+1)||' · '||p_start||' to '||p_end,'claimed',true,false,now()) RETURNING id INTO v_reward;
 UPDATE trash_boss_claims SET reward_id=v_reward WHERE id=v_claim;
 RETURN v_reward;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_trash_boss(text,integer,date,date,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_trash_boss(text,integer,date,date,numeric,numeric) TO service_role;

COMMIT;
