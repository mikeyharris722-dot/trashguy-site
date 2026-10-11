-- Existing rows retain updated_at; legacy payout dates use that last-known timestamp.
-- Retain the first payout date when a result or its notes are later edited.
ALTER TABLE public.site_tracker_entries ADD COLUMN IF NOT EXISTS payout_recorded_at timestamptz;
CREATE FUNCTION public.preserve_tracker_payout_date() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.payout_recorded_at:=CASE WHEN NEW.payout IS NOT NULL THEN now() ELSE NULL END;
 ELSIF NEW.payout IS NULL THEN
  NEW.payout_recorded_at:=NULL;
 ELSIF OLD.payout IS NULL THEN
  NEW.payout_recorded_at:=now();
 ELSE
  NEW.payout_recorded_at:=COALESCE(OLD.payout_recorded_at,OLD.updated_at,now());
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preserve_tracker_payout_date BEFORE INSERT OR UPDATE ON public.site_tracker_entries FOR EACH ROW EXECUTE FUNCTION public.preserve_tracker_payout_date();
