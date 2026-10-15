-- Existing hunts remain USD. Currency is fixed at creation.
ALTER TABLE public.site_tracker_hunts ADD COLUMN currency text NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD','CAD','ARS','GBP'));
ALTER TABLE public.site_tracker_entries ADD COLUMN payout_usd numeric(20,2), ADD COLUMN usd_rate numeric, ADD COLUMN usd_rate_date date, ADD COLUMN usd_rate_source text;
CREATE FUNCTION public.site_tracker_fx_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE code text; fx jsonb; rate numeric;
BEGIN
 IF NEW.payout IS NULL THEN NEW.payout_usd:=NULL;NEW.usd_rate:=NULL;NEW.usd_rate_date:=NULL;NEW.usd_rate_source:=NULL;RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NEW.payout IS NOT DISTINCT FROM OLD.payout AND OLD.payout_usd IS NOT NULL THEN NEW.payout_usd:=OLD.payout_usd;NEW.usd_rate:=OLD.usd_rate;NEW.usd_rate_date:=OLD.usd_rate_date;NEW.usd_rate_source:=OLD.usd_rate_source;RETURN NEW;END IF;
 SELECT currency INTO STRICT code FROM public.site_tracker_hunts WHERE hunt_id=NEW.hunt_id;
 IF code='USD' THEN NEW.payout_usd:=round(NEW.payout,2);NEW.usd_rate:=1;NEW.usd_rate_date:=(now() AT TIME ZONE 'UTC')::date;NEW.usd_rate_source:='USD';RETURN NEW;END IF;
 fx:=nullif(current_setting('trashguy.payout_fx',true),'')::jsonb;
 IF fx IS NULL OR fx->>'currency' IS DISTINCT FROM code OR fx->>'source' IS DISTINCT FROM 'Frankfurter' THEN RAISE EXCEPTION 'A verified USD exchange rate is required';END IF;
 rate:=(fx->>'rate')::numeric;
 IF rate IS NULL OR rate<=0 OR rate::text IN ('NaN','Infinity','-Infinity') OR (fx->>'date')::date IS NULL OR (fx->>'date')::date>(now() AT TIME ZONE 'UTC')::date OR (fx->>'date')::date<(now() AT TIME ZONE 'UTC')::date-7 THEN RAISE EXCEPTION 'Exchange rate is invalid or stale';END IF;
 NEW.payout_usd:=round(NEW.payout*rate,2);NEW.usd_rate:=rate;NEW.usd_rate_date:=(fx->>'date')::date;NEW.usd_rate_source:='Frankfurter';RETURN NEW;
END;$$;
CREATE TRIGGER site_tracker_fx_snapshot BEFORE INSERT OR UPDATE ON public.site_tracker_entries FOR EACH ROW EXECUTE FUNCTION public.site_tracker_fx_snapshot();
CREATE FUNCTION public.site_tracker_currency_lock() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF NEW.currency IS DISTINCT FROM OLD.currency THEN RAISE EXCEPTION 'Currency is fixed when a hunt is created';END IF;RETURN NEW;END;$$;
CREATE TRIGGER site_tracker_currency_lock BEFORE UPDATE ON public.site_tracker_hunts FOR EACH ROW EXECUTE FUNCTION public.site_tracker_currency_lock();
CREATE FUNCTION public.site_tracker_create_currency(p_actor uuid,p_title text,p_start numeric,p_currency text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE id uuid;BEGIN IF p_currency IS NULL OR p_currency NOT IN ('USD','CAD','ARS','GBP') THEN RAISE EXCEPTION 'Unsupported currency';END IF;
-- Set the insert default for this transaction through a dedicated insert trigger.
PERFORM set_config('trashguy.hunt_currency',p_currency,true);id:=public.site_tracker_create(p_actor,p_title,p_start);PERFORM set_config('trashguy.hunt_currency','',true);RETURN id;END;$$;
CREATE FUNCTION public.site_tracker_currency_insert() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN NEW.currency:=coalesce(nullif(current_setting('trashguy.hunt_currency',true),''),'USD');RETURN NEW;END;$$;
CREATE TRIGGER site_tracker_currency_insert BEFORE INSERT ON public.site_tracker_hunts FOR EACH ROW EXECUTE FUNCTION public.site_tracker_currency_insert();
CREATE FUNCTION public.site_tracker_bonus_edit_currency(p_actor uuid,p_entry uuid,p_payout numeric,p_bet numeric,p_cost numeric,p_tier text,p_notes text,p_fx jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN PERFORM set_config('trashguy.payout_fx',coalesce(p_fx::text,''),true);PERFORM public.site_tracker_bonus_edit(p_actor,p_entry,p_payout,p_bet,p_cost,p_tier,p_notes);PERFORM set_config('trashguy.payout_fx','',true);END;$$;
CREATE FUNCTION public.site_tracker_record_currency(p_actor uuid,p_hunt uuid,p_call text,p_bet numeric,p_cost numeric,p_payout numeric,p_fx jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ DECLARE id uuid;BEGIN PERFORM set_config('trashguy.payout_fx',coalesce(p_fx::text,''),true);id:=public.site_tracker_record(p_actor,p_hunt,p_call,p_bet,p_cost,p_payout);PERFORM set_config('trashguy.payout_fx','',true);RETURN id;END;$$;
REVOKE ALL ON FUNCTION public.site_tracker_fx_snapshot(),public.site_tracker_currency_lock(),public.site_tracker_currency_insert(),public.site_tracker_create_currency(uuid,text,numeric,text),public.site_tracker_bonus_edit_currency(uuid,uuid,numeric,numeric,numeric,text,text,jsonb),public.site_tracker_record_currency(uuid,uuid,text,numeric,numeric,numeric,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.site_tracker_fx_snapshot(),public.site_tracker_currency_lock(),public.site_tracker_currency_insert(),public.site_tracker_create_currency(uuid,text,numeric,text),public.site_tracker_bonus_edit_currency(uuid,uuid,numeric,numeric,numeric,text,text,jsonb),public.site_tracker_record_currency(uuid,uuid,text,numeric,numeric,numeric,jsonb) TO service_role;

-- Reward eligibility always sums the stored USD payout, never foreign amounts.
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
 SELECT COALESCE(sum(round(coalesce(e.payout_usd,CASE WHEN h.currency='USD' THEN e.payout ELSE NULL END)*100)),0)/100 INTO v_total FROM site_tracker_entries e JOIN site_tracker_hunts h ON h.hunt_id=e.hunt_id
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

