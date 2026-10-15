BEGIN;
CREATE TABLE public.site_tracker_hunts(hunt_id uuid PRIMARY KEY,title text,start_amount numeric,phase text DEFAULT 'collecting',deleted_at timestamptz);
CREATE TABLE public.site_tracker_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),hunt_id uuid,call_id text,username text,slot_name text,status text DEFAULT 'collected',bet_size numeric DEFAULT 1,collection_cost numeric DEFAULT 0,payout numeric,deleted_at timestamptz,payout_recorded_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.community_documents(id text PRIMARY KEY,payload jsonb);
CREATE TABLE public.rewards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),twitch_username text,display_name text,platform text,amount numeric,type text,title text,status text,claimed boolean,paid boolean,claimed_at timestamptz);
CREATE TABLE public.trash_boss_claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text,boss integer,period_start date,period_end date,target numeric,amount numeric,reward_id uuid,UNIQUE(username,boss,period_start));
CREATE FUNCTION public.site_tracker_create(p_actor uuid,p_title text,p_start numeric) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE id uuid:=gen_random_uuid();BEGIN INSERT INTO public.site_tracker_hunts VALUES(id,p_title,p_start,'collecting',NULL);RETURN id;END;$$;
CREATE FUNCTION public.site_tracker_bonus_edit(p_actor uuid,p_entry uuid,p_payout numeric,p_bet numeric,p_cost numeric,p_tier text,p_notes text) RETURNS void LANGUAGE sql AS $$ UPDATE public.site_tracker_entries SET payout=p_payout,bet_size=p_bet,collection_cost=p_cost WHERE id=p_entry;$$;
CREATE FUNCTION public.site_tracker_record(p_actor uuid,p_hunt uuid,p_call text,p_bet numeric,p_cost numeric,p_payout numeric) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE id uuid;BEGIN INSERT INTO public.site_tracker_entries(hunt_id,call_id,username,payout,bet_size,collection_cost) VALUES(p_hunt,p_call,'viewer',p_payout,p_bet,p_cost) RETURNING site_tracker_entries.id INTO id;RETURN id;END;$$;
-- INSERT_MIGRATION_UNDER_TEST

DO $$ DECLARE h uuid; e uuid; other uuid; a uuid:=gen_random_uuid();fx jsonb:=jsonb_build_object('currency','CAD','rate',0.7,'date',current_date,'source','Frankfurter');BEGIN
 h:=public.site_tracker_create_currency(a,'CAD proof',1000,'CAD');IF (SELECT currency FROM public.site_tracker_hunts WHERE hunt_id=h)<>'CAD' THEN RAISE EXCEPTION 'Currency not persisted';END IF;
 e:=public.site_tracker_record_currency(a,h,'call',1,0,2000,fx);
 IF (SELECT payout_usd FROM public.site_tracker_entries WHERE id=e)<>1400 THEN RAISE EXCEPTION 'USD conversion mismatch';END IF;
 PERFORM public.site_tracker_bonus_edit_currency(a,e,2000,2,0,'super','note',fx||'{"rate":0.9}'::jsonb);
 IF (SELECT payout_usd FROM public.site_tracker_entries WHERE id=e)<>1400 THEN RAISE EXCEPTION 'Saved snapshot drifted';END IF;
 BEGIN PERFORM public.site_tracker_bonus_edit_currency(a,e,3000,2,0,'super','note',NULL);RAISE EXCEPTION 'Missing rate accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Missing rate accepted' THEN RAISE;END IF;END;
 BEGIN UPDATE public.site_tracker_hunts SET currency='USD' WHERE hunt_id=h;RAISE EXCEPTION 'Currency mutation accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Currency mutation accepted' THEN RAISE;END IF;END;
 INSERT INTO public.community_documents VALUES('hunts',jsonb_build_object('prizeSettings',jsonb_build_object('trashBossesEnabled',true,'leaderboardStart','2026-01-01','leaderboardEnd','2027-01-01','trashBosses',jsonb_build_array(jsonb_build_object('target',1500,'reward',10)))));
 BEGIN PERFORM public.claim_trash_boss('viewer',0,'2026-01-01','2027-01-01',1500,10);RAISE EXCEPTION 'Foreign amount counted as USD';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Your called-slot winnings have not reached this target' THEN RAISE;END IF;END;
 PERFORM public.site_tracker_bonus_edit_currency(a,e,3000,2,0,'super','note',fx);
 PERFORM public.claim_trash_boss('viewer',0,'2026-01-01','2027-01-01',1500,10);
 IF (SELECT count(*) FROM public.trash_boss_claims)<>1 THEN RAISE EXCEPTION 'Claim not saved';END IF;
 IF has_function_privilege('anon','public.site_tracker_create_currency(uuid,text,numeric,text)','EXECUTE') THEN RAISE EXCEPTION 'Public write grant';END IF;
 other:=public.site_tracker_create(a,'Legacy',100);IF (SELECT currency FROM public.site_tracker_hunts WHERE hunt_id=other)<>'USD' THEN RAISE EXCEPTION 'Legacy default wrong';END IF;
 PERFORM public.site_tracker_bonus_edit_currency(a,e,NULL,2,0,'super','note',NULL);IF (SELECT payout_usd FROM public.site_tracker_entries WHERE id=e) IS NOT NULL THEN RAISE EXCEPTION 'Cleared payout retained credit';END IF;
 RAISE NOTICE 'PASS currency defaults and immutability, exact USD snapshots, edit preservation, atomic missing-rate rejection, converted claim eligibility, denied anonymous RPC and payout removal';END;$$;
ROLLBACK;
