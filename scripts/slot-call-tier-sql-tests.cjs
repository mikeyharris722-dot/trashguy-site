const fs=require('fs'),cp=require('child_process');
const container=process.argv[2];if(!/^trashguy-tier-test-\d+$/.test(container||''))throw Error('Use a dedicated disposable tier test container.');
let fixture=fs.readFileSync('scripts/slot-call-reservation-test.sql','utf8').split('do $$ declare a uuid;')[0];
const sql="do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;create role authenticated;create role service_role;end if;end;$$;\n"+fixture+`
alter table public.site_tracker_entries add column bonus_tier text not null default 'standard' check(bonus_tier in ('standard','super','super_super'));
`+fs.readFileSync('supabase/migrations/20261029192825_slot_call_bonus_tier.sql','utf8')+`
do $$declare a uuid;b uuid;e uuid;v jsonb;t text;begin
 foreach t in array array['standard','super','super_super'] loop
 v:=public.slot_call_queue(t,'twitch','Slot A','{"status":"matched","identifier":"a","suggestions":[]}');a:=(v->'call'->>'id')::uuid;
 perform public.slot_call_pick('00000000-0000-4000-8000-000000000002',a,'Slot A');
 v:=public.slot_call_queue(t,'twitch','Slot B','{"status":"matched","identifier":"b","suggestions":[]}');b:=(v->'call'->>'id')::uuid;
 e:=public.site_tracker_collect_tier('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',a::text,'collected',1,0,t);
 if (select bonus_tier from public.site_tracker_entries where id=e)<>t then raise exception 'Wrong tier';end if;
 if not exists(select 1 from public.slot_calls where id=b) then raise exception 'Pending call lost';end if;
 perform public.site_tracker_collect_tier('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',a::text,'failed',1,0,'super');
 if (select bonus_tier from public.site_tracker_entries where id=e)<>t or (select status from public.site_tracker_entries where id=e)<>'collected' then raise exception 'Retry altered first result';end if;
 perform public.site_tracker_collect_tier('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',b::text,'failed',1,0,t);
 if not exists(select 1 from public.site_tracker_entries where call_id=b::text and status='failed' and bonus_tier=t) then raise exception 'Failed tier lost';end if;
 end loop;
 v:=public.slot_call_queue('invalid','twitch','Slot C','{"status":"matched","identifier":"c","suggestions":[]}');a:=(v->'call'->>'id')::uuid;
 begin perform public.site_tracker_collect_tier('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',a::text,'collected',1,0,'bad');raise exception 'Accepted bad tier';exception when others then if sqlerrm='Accepted bad tier' then raise;end if;end;
 if not exists(select 1 from public.slot_calls where id=a) then raise exception 'Invalid tier consumed call';end if;
 alter table public.site_tracker_entries add constraint reject_super_fixture check(bonus_tier<>'super') not valid;
 begin perform public.site_tracker_collect_tier('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',a::text,'collected',1,0,'super');raise exception 'Accepted failed update';exception when check_violation then null;end;
 if not exists(select 1 from public.slot_calls where id=a) or exists(select 1 from public.site_tracker_entries where call_id=a::text) then raise exception 'Tier failure did not roll back collection';end if;
 if has_function_privilege('anon','public.site_tracker_collect_tier(uuid,uuid,text,text,numeric,numeric,text,numeric,jsonb)','execute') or has_function_privilege('authenticated','public.site_tracker_collect_tier(uuid,uuid,text,text,numeric,numeric,text,numeric,jsonb)','execute') then raise exception 'Public execute grant';end if;
end;$$;
rollback;`;
const r=cp.spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);console.log('PASS all three tiers, failed results, retry preservation, next-call isolation, invalid tier rejection, atomic rollback, service-only grants.');
