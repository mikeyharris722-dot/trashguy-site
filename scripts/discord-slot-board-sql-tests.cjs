const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict');const container=process.argv[2];if(!/^trashguy-tier-test-\d+$/.test(container||''))throw Error('Use the disposable test container.');
const sql='begin;\n'+fs.readFileSync('supabase/migrations/20261029200339_discord_slot_call_board.sql','utf8')+`
do $$declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();begin
 if has_table_privilege('anon','public.discord_slot_board','select') or has_table_privilege('authenticated','public.discord_slot_board','select') then raise exception 'Webhook exposed';end if;
 if has_function_privilege('anon','public.discord_slot_board_claim(uuid)','execute') then raise exception 'Public lease access';end if;
 if exists(select 1 from public.discord_slot_board_claim(a)) then raise exception 'Disabled board claimed';end if;
 update public.discord_slot_board set enabled=true,webhook_url='https://discord.com/api/webhooks/123/test';
 if not exists(select 1 from public.discord_slot_board_claim(a)) then raise exception 'Enabled board not claimed';end if;
 if exists(select 1 from public.discord_slot_board_claim(b)) then raise exception 'Concurrent lease accepted';end if;
 update public.discord_slot_board set lease_until=now()-interval '1 second',next_attempt=now()+interval '30 seconds';
 if exists(select 1 from public.discord_slot_board_claim(b)) then raise exception 'Rate-limit backoff ignored';end if;
 update public.discord_slot_board set next_attempt=now()-interval '1 second';
 if not exists(select 1 from public.discord_slot_board_claim(b)) then raise exception 'Expired lease did not recover';end if;
end;$$;rollback;`;
const r=cp.spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});assert.equal(r.status,0,r.stderr);console.log('PASS private webhook table/RLS, service-only lease, disabled state, concurrent exclusion, durable rate-limit backoff, expired-worker recovery; rolled back.');
