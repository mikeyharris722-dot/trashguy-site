const fs=require('node:fs'),cp=require('node:child_process');
const container='trashguy-tier-test-20261029';
const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_monthly_wager_rewards.sql'));
let sql=`BEGIN;
CREATE TABLE public.community_documents(id text primary key,payload jsonb);
CREATE TABLE public.rewards(id uuid primary key default gen_random_uuid(),twitch_username text,display_name text,platform text,amount numeric,type text,title text,status text,claimed boolean,paid boolean,claimed_at timestamptz);
${fs.readFileSync('supabase/migrations/20261014141350_weekly_wager_rewards.sql','utf8')}
${fs.readFileSync('supabase/migrations/'+migration,'utf8').replaceAll('now()',"TIMESTAMPTZ '2026-11-10 00:00:00+00'")}
INSERT INTO community_documents VALUES('hunts',jsonb_build_object('prizeSettings',jsonb_build_object('leaderboardStart',(current_date-5)::text,'leaderboardEnd',(current_date+20)::text,'weeklyWager',jsonb_build_object('enabled',true,'periodMode','leaderboard','start','2000-01-01','end','2000-02-01','targets','[{"id":"monthly-5k","target":5000,"reward":10},{"id":"monthly-10k","target":10000,"reward":15}]'::jsonb))));
DO $$ DECLARE a uuid; b uuid; BEGIN
IF has_function_privilege('anon','public.claim_monthly_wager(text,text,date,date,numeric,numeric,numeric)','EXECUTE') OR has_function_privilege('authenticated','public.claim_monthly_wager(text,text,date,date,numeric,numeric,numeric)','EXECUTE') THEN RAISE EXCEPTION 'Public claim access';END IF;
IF has_table_privilege('anon','public.weekly_wager_claims','SELECT') THEN RAISE EXCEPTION 'Private claim history exposed';END IF;
a:=claim_monthly_wager('tester','monthly-5k',current_date-5,current_date+19,5000,10,10000);
b:=claim_monthly_wager('tester','monthly-5k',current_date-5,current_date+19,5000,10,10000);
IF a<>b THEN RAISE EXCEPTION 'Duplicate payout';END IF;
PERFORM claim_monthly_wager('tester','monthly-10k',current_date-5,current_date+19,10000,15,10000);
IF (SELECT sum(amount) FROM rewards)<>25 OR (SELECT count(*) FROM rewards)<>2 THEN RAISE EXCEPTION 'Stacking payout failed';END IF;
BEGIN PERFORM claim_monthly_wager('other','monthly-10k',current_date-5,current_date+19,10000,15,9999);RAISE EXCEPTION 'TEST accepted ineligible';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST%' THEN RAISE;END IF;END;
BEGIN PERFORM claim_monthly_wager('other','monthly-5k',current_date-5,current_date+19,5000,99,10000);RAISE EXCEPTION 'TEST accepted tampered payout';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST%' THEN RAISE;END IF;END;
BEGIN PERFORM claim_monthly_wager('other','monthly-5k',current_date-6,current_date+19,5000,10,10000);RAISE EXCEPTION 'TEST accepted stale period';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST%' THEN RAISE;END IF;END;
UPDATE community_documents SET payload=jsonb_set(payload,'{prizeSettings,leaderboardStart}',to_jsonb((current_date-4)::text));
PERFORM claim_monthly_wager('tester','monthly-5k',current_date-4,current_date+19,5000,10,10000);
IF (SELECT count(*) FROM rewards)<>3 THEN RAISE EXCEPTION 'New period failed';END IF;
UPDATE community_documents SET payload=jsonb_set(payload,'{prizeSettings,leaderboardEnd}',to_jsonb(current_date::text));
BEGIN PERFORM claim_monthly_wager('late','monthly-5k',current_date-4,current_date-1,5000,10,10000);RAISE EXCEPTION 'TEST accepted ended period';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST%' THEN RAISE;END IF;END;
UPDATE community_documents SET payload=jsonb_set(jsonb_set(payload,'{prizeSettings,leaderboardStart}','"2026-10-05"'::jsonb),'{prizeSettings,leaderboardEnd}','"2026-11-05"'::jsonb);
BEGIN PERFORM claim_monthly_wager('excluded','monthly-5k',DATE '2026-10-05',DATE '2026-11-04',5000,10,10000);RAISE EXCEPTION 'TEST accepted excluded launch period';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Monthly rewards start%' THEN RAISE;END IF;END;
END $$;
ROLLBACK;`;
sql=sql.replaceAll('current_date',"DATE '2026-11-10'");
cp.execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']});
console.log('PASS isolated database: atomic duplicate protection, stacking $25, live leaderboard dates, stale/tampered/ineligible/expired claim rejection, rollover, private history and service-only RPC; all fixtures rolled back.');
