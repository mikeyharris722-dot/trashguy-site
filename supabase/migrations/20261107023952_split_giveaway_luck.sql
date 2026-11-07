-- Preserve the existing ALL balance; seed VIP with exactly the same saved values.
-- Apply once immediately before releasing the mode-aware application code.
ALTER TABLE public.giveaway_luck
 ADD COLUMN luck_modes_split boolean NOT NULL DEFAULT false,
 ADD COLUMN vip_luck numeric NOT NULL DEFAULT 0 CHECK (vip_luck >= 0),
 ADD COLUMN vip_loss_count bigint NOT NULL DEFAULT 0 CHECK (vip_loss_count >= 0),
 ADD COLUMN vip_win_count bigint NOT NULL DEFAULT 0 CHECK (vip_win_count >= 0);
UPDATE public.giveaway_luck SET
 vip_luck=COALESCE(luck,0),
 vip_loss_count=COALESCE(loss_count,0),
 vip_win_count=COALESCE(win_count,0);
COMMENT ON COLUMN public.giveaway_luck.luck IS 'ALL giveaway luck; independent of vip_luck after the split.';
COMMENT ON COLUMN public.giveaway_luck.vip_luck IS 'VIP giveaway luck, copied from legacy luck once at migration; thereafter mode-specific.';

-- During a rolling deployment, old draw handlers still update legacy luck.
-- Mirror those writes until this account receives its first mode-aware update.
CREATE FUNCTION public.keep_legacy_giveaway_luck() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT NEW.luck_modes_split THEN
  NEW.vip_luck:=COALESCE(NEW.luck,0);
  NEW.vip_loss_count:=COALESCE(NEW.loss_count,0);
  NEW.vip_win_count:=COALESCE(NEW.win_count,0);
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.keep_legacy_giveaway_luck() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER giveaway_luck_legacy_bridge BEFORE INSERT OR UPDATE ON public.giveaway_luck
FOR EACH ROW EXECUTE FUNCTION public.keep_legacy_giveaway_luck();
