-- Permit only the configured CAD fallback while preserving existing snapshots and function permissions.
CREATE OR REPLACE FUNCTION public.site_tracker_fx_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE code text; fx jsonb; rate numeric;
BEGIN
 IF NEW.payout IS NULL THEN NEW.payout_usd:=NULL;NEW.usd_rate:=NULL;NEW.usd_rate_date:=NULL;NEW.usd_rate_source:=NULL;RETURN NEW;END IF;
 IF coalesce(current_setting('trashguy.currency_correction',true),'')<>NEW.hunt_id::text AND TG_OP='UPDATE' AND NEW.payout IS NOT DISTINCT FROM OLD.payout AND OLD.payout_usd IS NOT NULL THEN NEW.payout_usd:=OLD.payout_usd;NEW.usd_rate:=OLD.usd_rate;NEW.usd_rate_date:=OLD.usd_rate_date;NEW.usd_rate_source:=OLD.usd_rate_source;RETURN NEW;END IF;
 SELECT currency INTO STRICT code FROM public.site_tracker_hunts WHERE hunt_id=NEW.hunt_id;
 IF code='USD' THEN NEW.payout_usd:=round(NEW.payout,2);NEW.usd_rate:=1;NEW.usd_rate_date:=(now() AT TIME ZONE 'UTC')::date;NEW.usd_rate_source:='USD';RETURN NEW;END IF;
 fx:=nullif(current_setting('trashguy.payout_fx',true),'')::jsonb;
 IF fx IS NULL OR fx->>'currency' IS DISTINCT FROM code THEN RAISE EXCEPTION 'A verified USD exchange rate is required';END IF;
 IF fx->>'source' IS DISTINCT FROM 'Frankfurter' THEN
  -- Only the explicitly configured CAD fallback is allowed; never treat it as a live quote.
  IF code IS DISTINCT FROM 'CAD' OR fx->>'source' IS DISTINCT FROM 'Configured CAD fallback: 1 USD = 1.41 CAD'
   OR (fx->>'rate')::numeric IS NULL OR abs((fx->>'rate')::numeric - 1::numeric/1.41)>0.000000000001
   OR (fx->>'date')::date IS DISTINCT FROM (now() AT TIME ZONE 'UTC')::date THEN
   RAISE EXCEPTION 'A verified USD exchange rate is required';
  END IF;
 END IF;
 rate:=(fx->>'rate')::numeric;
 IF rate IS NULL OR rate<=0 OR rate::text IN ('NaN','Infinity','-Infinity') OR (fx->>'date')::date IS NULL OR (fx->>'date')::date>(now() AT TIME ZONE 'UTC')::date OR (fx->>'date')::date<(now() AT TIME ZONE 'UTC')::date-7 THEN RAISE EXCEPTION 'Exchange rate is invalid or stale';END IF;
 NEW.payout_usd:=round(NEW.payout*rate,2);NEW.usd_rate:=rate;NEW.usd_rate_date:=(fx->>'date')::date;NEW.usd_rate_source:=fx->>'source';RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.site_tracker_currency_lock() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.currency IS DISTINCT FROM OLD.currency AND coalesce(current_setting('trashguy.currency_correction',true),'')<>OLD.hunt_id::text THEN
  RAISE EXCEPTION 'Use the hunt currency correction action';
 END IF;
 RETURN NEW;
END;$$;

CREATE FUNCTION public.site_tracker_correct_currency(p_actor uuid,p_hunt uuid,p_from text,p_currency text,p_fx jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_currency text; corrected integer; review_count integer;
BEGIN
 IF p_currency IS NULL OR p_currency NOT IN ('USD','CAD','ARS','GBP') THEN RAISE EXCEPTION 'Unsupported currency'; END IF;
 -- Serialize against Monster Reward claims, which hold a share lock here.
 PERFORM 1 FROM public.community_documents WHERE id='hunts' FOR UPDATE;
 SELECT currency INTO old_currency FROM public.site_tracker_hunts WHERE hunt_id=p_hunt AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Hunt not found'; END IF;
 IF old_currency IS DISTINCT FROM p_from THEN RAISE EXCEPTION 'Currency changed. Refresh and retry.'; END IF;
 IF old_currency=p_currency THEN RETURN jsonb_build_object('corrected',0,'claimsToReview',0); END IF;
 PERFORM set_config('trashguy.currency_correction',p_hunt::text,true);
 PERFORM set_config('trashguy.payout_fx',coalesce(p_fx::text,''),true);
 UPDATE public.site_tracker_hunts SET currency=p_currency WHERE hunt_id=p_hunt;
 UPDATE public.site_tracker_entries SET payout=payout WHERE hunt_id=p_hunt AND payout IS NOT NULL;
 GET DIAGNOSTICS corrected=ROW_COUNT;
 PERFORM set_config('trashguy.currency_correction','',true);
 PERFORM set_config('trashguy.payout_fx','',true);
 SELECT count(*) INTO review_count FROM public.trash_boss_claims c WHERE EXISTS (
  SELECT 1 FROM public.site_tracker_entries e WHERE e.hunt_id=p_hunt AND e.deleted_at IS NULL
  AND lower(trim(e.username))=c.username AND e.status='collected' AND e.payout IS NOT NULL
  AND e.call_id IS NOT NULL AND (e.call_id NOT LIKE 'manual:%' OR e.call_id ~ '^manual:viewer:[0-9a-fA-F-]{36}$')
  AND coalesce(e.payout_recorded_at,e.updated_at)>=(c.period_start::timestamp AT TIME ZONE 'UTC')
  AND coalesce(e.payout_recorded_at,e.updated_at)<(c.period_end::timestamp AT TIME ZONE 'UTC'));
 INSERT INTO public.site_tracker_audit(actor,action,details) VALUES(p_actor,'correct_currency',
  jsonb_build_object('huntId',p_hunt,'from',old_currency,'to',p_currency,'corrected',corrected,'claimsToReview',review_count,'fx',p_fx));
 RETURN jsonb_build_object('corrected',corrected,'claimsToReview',review_count);
END;$$;
REVOKE ALL ON FUNCTION public.site_tracker_correct_currency(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.site_tracker_correct_currency(uuid,uuid,text,text,jsonb) TO service_role;
