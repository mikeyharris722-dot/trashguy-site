CREATE TABLE IF NOT EXISTS public.trash_boss_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL, boss integer NOT NULL CHECK(boss BETWEEN 0 AND 2),
 period_start date NOT NULL, period_end date NOT NULL, target numeric NOT NULL, amount numeric NOT NULL,
 reward_id uuid REFERENCES public.rewards(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(username,boss,period_start)
);
ALTER TABLE public.trash_boss_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trash_boss_claims FROM anon,authenticated;
GRANT ALL ON public.trash_boss_claims TO service_role;
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
 AND e.call_id IS NOT NULL AND e.call_id NOT LIKE 'manual:%' AND COALESCE(e.payout_recorded_at,e.updated_at)>=(p_start::timestamp AT TIME ZONE 'UTC') AND COALESCE(e.payout_recorded_at,e.updated_at)<(p_end::timestamp AT TIME ZONE 'UTC');
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
