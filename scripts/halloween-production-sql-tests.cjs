const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict');const container=process.argv[2];if(!/^trashguy-tier-test-\d+$/.test(container||''))throw Error('Use a disposable test container.');
const original=fs.readFileSync('supabase/migrations/20261016102905_twitch_channel_points_clips.sql','utf8').match(/CREATE OR REPLACE FUNCTION public\.claw_production_command[\s\S]*?END;\$\$;/)[0];
const sql=`begin;create table public.claw_production_state(id boolean primary key,event_id uuid,started_at timestamptz,actor uuid,clip text default 'claw',volume numeric default 0.7,duration_ms integer default 10000,queue jsonb default '[]');insert into public.claw_production_state(id)values(true);create table public.twitch_points_receipts(status text,event_id uuid);\n`+original+'\n'+fs.readFileSync('supabase/migrations/20261030153429_halloween_production_clip.sql','utf8')+`
do $$declare a uuid:=gen_random_uuid();r uuid:=gen_random_uuid();next uuid:=gen_random_uuid();v jsonb;begin
 v:=public.claw_production_halloween(a,r);
 if v->>'clip'<>'halloween' or (v->>'durationMs')::integer<>30000 then raise exception 'Incorrect Halloween event';end if;
 if public.claw_production_halloween(a,r)<>v then raise exception 'Retry changed event';end if;
 begin perform public.claw_production_halloween(gen_random_uuid(),r);raise exception 'Wrong admin accepted';exception when others then if sqlerrm='Wrong admin accepted' then raise;end if;end;
 begin perform public.claw_production_halloween(a,next);raise exception 'Overlap accepted';exception when others then if sqlerrm='Overlap accepted' then raise;end if;end;
 perform public.claw_production_command(a,'stop',null);
 perform public.claw_production_command(a,'play',next);
 begin perform public.claw_production_halloween(a,next);raise exception 'Claw request reused';exception when others then if sqlerrm='Claw request reused' then raise;end if;end;
 perform public.claw_production_command(a,'stop',null);
 update public.claw_production_state set queue='[{"id":"queued"}]';
 begin perform public.claw_production_halloween(a,r);raise exception 'Queue overridden';exception when others then if sqlerrm='Queue overridden' then raise;end if;end;
 if jsonb_array_length((select queue from public.claw_production_state))<>1 then raise exception 'Queue changed';end if;
 if has_function_privilege('anon','public.claw_production_halloween(uuid,uuid)','execute') or has_function_privilege('authenticated','public.claw_production_halloween(uuid,uuid)','execute') then raise exception 'Public trigger permission';end if;
end;$$;rollback;`;
const result=cp.spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});assert.equal(result.status,0,result.stderr);console.log('PASS SQL Halloween clip/duration, idempotent retry, admin ownership, shared overlap/queue protection, normal production isolation and service-only RPC; rolled back.');
