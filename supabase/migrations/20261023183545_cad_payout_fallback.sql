-- Permit only the configured CAD fallback while preserving existing snapshots and function permissions.
CREATE OR REPLACE FUNCTION public.site_tracker_fx_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE code text; fx jsonb; rate numeric;
BEGIN
 IF NEW.payout IS NULL THEN NEW.payout_usd:=NULL;NEW.usd_rate:=NULL;NEW.usd_rate_date:=NULL;NEW.usd_rate_source:=NULL;RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NEW.payout IS NOT DISTINCT FROM OLD.payout AND OLD.payout_usd IS NOT NULL THEN NEW.payout_usd:=OLD.payout_usd;NEW.usd_rate:=OLD.usd_rate;NEW.usd_rate_date:=OLD.usd_rate_date;NEW.usd_rate_source:=OLD.usd_rate_source;RETURN NEW;END IF;
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
