const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
let now=Date.parse('2026-10-15T12:00:00Z');
class Clock extends Date { constructor(value){super(value===undefined?now:value)} static now(){return now} }
function compile(file,imports,extra={}){
 const exports={};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{exports,require:name=>{if(name in imports)return imports[name];throw Error('Unexpected dependency: '+name)},Date:Clock,Symbol,Promise,process:{cwd:()=>'/fixture'},...extra});
 return exports;
}
(async()=>{
 const playback=compile('lib/claw-production.ts',{});
 const id='00000000-0000-4000-8000-000000000001', next='00000000-0000-4000-8000-000000000002';
 assert.equal(playback.productionIsActive(null),false);
 assert.equal(playback.productionIsActive({id,startedAt:new Clock().toISOString(),durationMs:10000}),true);
 assert.equal(playback.productionIsActive({id,startedAt:new Clock(now+1).toISOString(),durationMs:10000}),false);
 assert.throws(()=>playback.validProductionRequest('bad'));
 const files=new Map();
 const promises={readFile:async p=>{if(!files.has(p))throw Object.assign(Error('missing'),{code:'ENOENT'});return files.get(p)},mkdir:async()=>{},writeFile:async(p,v)=>files.set(p,v),rename:async(a,b)=>{files.set(b,files.get(a));files.delete(a)}};
 const server=compile('lib/claw-production-server.ts',{'server-only':{},'node:fs':{promises},'node:path':require('node:path').posix,'./community-store':{localCommunity:()=>true},'./site-db':{siteDb:()=>{throw Error('Must never access a live database')}},'./claw-production':playback});
 const event=await server.productionCommand('admin','play',id);
 assert.equal(event.durationMs,10000);
 assert.equal((await server.productionState()).id,id);
 assert.equal((await server.productionCommand('admin','play',id)).startedAt,event.startedAt);
 await assert.rejects(server.productionCommand('other-admin','play',id),/another admin/);
 const overlap=await Promise.allSettled([server.productionCommand('admin','play',next),server.productionCommand('admin','play','00000000-0000-4000-8000-000000000003')]);
 assert.ok(overlap.every(v=>v.status==='rejected'&&/already playing/.test(v.reason.message)));
 now+=10000;
 assert.equal(playback.productionIsActive(event),false);
 const replay=await server.productionCommand('admin','play',next);
 assert.equal(replay.id,next);
 await server.productionCommand('admin','stop');
 assert.equal(await server.productionState(),null);
 await assert.rejects(server.productionCommand('admin','invalid'),/Choose play or stop/);
 const guard=compile('lib/api-access.ts',{});
 assert.equal(guard.requiresAdmin('/api/claw-production','POST'),true);
 assert.equal(guard.requiresAdmin('/api/claw-production','GET'),false);
 const source=fs.readFileSync('app/page.tsx','utf8');
 assert.match(source,/actions=\{activeAdminTab === "giveaway" \? <ClawProductionControls/);
 assert.doesNotMatch(source,/activeAdminTab === "trashClaw" && <ClawProductionControls/);
 assert.ok(fs.existsSync('public'+playback.CLAW_PRODUCTION_MOVIE));
 console.log('PASS local-only trigger, duplicate/overlap protection, expiry, replay, stop, admin POST/public OBS GET, and giveaway-only placement');
})().catch(e=>{console.error(e);process.exitCode=1});
