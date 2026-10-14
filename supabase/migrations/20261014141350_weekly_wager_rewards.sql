CREATE TABLE public.weekly_wager_claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text NOT NULL,tier_id text NOT NULL,period_start date NOT NULL,period_end date NOT NULL,target numeric NOT NULL CHECK(target>0),amount numeric NOT NULL CHECK(amount>0),weighted_wager numeric NOT NULL CHECK(weighted_wager>=0),reward_id uuid REFERENCES public.rewards(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(username,period_start,tier_id));
ALTER TABLE public.weekly_wager_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_wager_claims FROM anon,authenticated;GRANT ALL ON public.weekly_wager_claims TO service_role;
CREATE FUNCTION public.claim_weekly_wager(p_username text,p_tier text,p_start date,p_end date,p_target numeric,p_amount numeric,p_weighted numeric) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE config jsonb; tier jsonb; old_claim uuid; reward uuid; claim uuid; name text:=lower(trim(p_username));
BEGIN
 SELECT payload->'prizeSettings'->'weeklyWager' INTO config FROM community_documents WHERE id='hunts' FOR SHARE;
 IF COALESCE((config->>'enabled')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Weekly wager rewards are deactivated'; END IF;
 SELECT item INTO tier FROM jsonb_array_elements(config->'targets') AS item WHERE item->>'id'=p_tier;
 IF tier IS NULL OR (config->>'start')::date IS DISTINCT FROM p_start OR (config->>'end')::date IS DISTINCT FROM p_end OR (tier->>'target')::numeric IS DISTINCT FROM p_target OR (tier->>'reward')::numeric IS DISTINCT FROM p_amount THEN RAISE EXCEPTION 'Weekly settings changed. Refresh and retry'; END IF;
 IF name='' OR p_start>=p_end OR now()<(p_start::timestamp AT TIME ZONE 'UTC') OR p_target<=0 OR p_amount<=0 OR p_weighted IS NULL OR round(p_weighted*100)<round(p_target*100) THEN RAISE EXCEPTION 'Weekly reward is not eligible'; END IF;
 SELECT id,reward_id INTO old_claim,reward FROM weekly_wager_claims WHERE username=name AND period_start=p_start AND tier_id=p_tier;
 IF FOUND THEN RETURN COALESCE(reward,old_claim); END IF;
 INSERT INTO weekly_wager_claims(username,tier_id,period_start,period_end,target,amount,weighted_wager) VALUES(name,p_tier,p_start,p_end,p_target,p_amount,p_weighted) ON CONFLICT(username,period_start,tier_id) DO NOTHING RETURNING id INTO claim;
 IF claim IS NULL THEN SELECT COALESCE(reward_id,id) INTO reward FROM weekly_wager_claims WHERE username=name AND period_start=p_start AND tier_id=p_tier;RETURN reward;END IF;
 INSERT INTO rewards(twitch_username,display_name,platform,amount,type,title,status,claimed,paid,claimed_at) VALUES(name,name,'twitch',p_amount,'weekly_wager','Weekly Trash Cashback · '||p_start||' to '||p_end,'claimed',true,false,now()) RETURNING id INTO reward;
 UPDATE weekly_wager_claims SET reward_id=reward WHERE id=claim;RETURN reward;
END;$$;
REVOKE ALL ON FUNCTION public.claim_weekly_wager(text,text,date,date,numeric,numeric,numeric) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.claim_weekly_wager(text,text,date,date,numeric,numeric,numeric) TO service_role;
