const fs=require('node:fs');
const {PGlite}=require('../.local/luck-db-test/node_modules/@electric-sql/pglite');
(async()=>{const db=new PGlite();try{const sql=`BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon;END IF;IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated;END IF;END $$;
CREATE TABLE public.giveaway_luck(twitch_username text primary key,platform text,luck numeric NOT NULL DEFAULT 0,loss_count bigint NOT NULL DEFAULT 0,win_count bigint NOT NULL DEFAULT 0);
ALTER TABLE public.giveaway_luck ENABLE ROW LEVEL SECURITY;
INSERT INTO public.giveaway_luck VALUES('alice','twitch',7.5,9,2),('bob','twitch',3,3,0),('idle','twitch',99,99,0);
${fs.readFileSync('supabase/migrations/20261107023952_split_giveaway_luck.sql','utf8')}
DO $$ BEGIN
IF EXISTS(SELECT 1 FROM giveaway_luck WHERE luck<>vip_luck OR loss_count<>vip_loss_count OR win_count<>vip_win_count) THEN RAISE EXCEPTION 'Legacy balances not preserved';END IF;
IF NOT(SELECT relrowsecurity FROM pg_class WHERE oid='public.giveaway_luck'::regclass) THEN RAISE EXCEPTION 'RLS changed';END IF;
END $$;
UPDATE giveaway_luck SET luck_modes_split=true,luck=0,win_count=win_count+1 WHERE twitch_username='alice';
UPDATE giveaway_luck SET luck_modes_split=true,luck=luck+1,loss_count=loss_count+1 WHERE twitch_username='bob';
DO $$ BEGIN
IF (SELECT vip_luck FROM giveaway_luck WHERE twitch_username='alice')<>7.5 OR (SELECT vip_luck FROM giveaway_luck WHERE twitch_username='bob')<>3 THEN RAISE EXCEPTION 'ALL changed VIP luck';END IF;
END $$;
UPDATE giveaway_luck SET luck_modes_split=true,vip_luck=0,vip_win_count=vip_win_count+1 WHERE twitch_username='bob';
UPDATE giveaway_luck SET luck_modes_split=true,vip_luck=vip_luck+1,vip_loss_count=vip_loss_count+1 WHERE twitch_username='alice';
DO $$ BEGIN
IF (SELECT luck FROM giveaway_luck WHERE twitch_username='bob')<>4 OR (SELECT luck FROM giveaway_luck WHERE twitch_username='alice')<>0 THEN RAISE EXCEPTION 'VIP changed ALL luck';END IF;
IF (SELECT vip_luck FROM giveaway_luck WHERE twitch_username='alice')<>8.5 THEN RAISE EXCEPTION 'VIP missed-draw increment failed';END IF;
IF (SELECT luck FROM giveaway_luck WHERE twitch_username='idle')<>99 OR (SELECT vip_luck FROM giveaway_luck WHERE twitch_username='idle')<>99 THEN RAISE EXCEPTION 'Non-entrant changed';END IF;
END $$;
UPDATE giveaway_luck SET luck=100 WHERE twitch_username='idle';
DO $$ BEGIN
IF (SELECT vip_luck FROM giveaway_luck WHERE twitch_username='idle')<>100 THEN RAISE EXCEPTION 'Legacy deployment bridge failed';END IF;
END $$;
UPDATE giveaway_luck SET luck_modes_split=true, vip_luck=75 WHERE twitch_username='idle';
UPDATE giveaway_luck SET luck=101 WHERE twitch_username='idle';
DO $$ BEGIN
IF (SELECT vip_luck FROM giveaway_luck WHERE twitch_username='idle')<>75 THEN RAISE EXCEPTION 'Separated balances remerged';END IF;
END $$;
ROLLBACK;`;await db.exec(sql);console.log('PASS Postgres: existing decimal luck and counters copied exactly, mode isolation, participant-only changes, RLS preserved, legacy bridge and cutover; no live database used.');}finally{await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
