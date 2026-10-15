const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');let enabled=false,reads=0,broken=false;
function load(file){const module={exports:{}};const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;const mocks={
 '@/lib/server-prize-settings':{serverPrizeSettings:async()=>{if(broken)throw Error('Settings unavailable');return {trashBossesEnabled:enabled,leaderboardStart:'2026-10-05'};}},
 '@/lib/community-local':{communityState:async()=>{if(broken)throw Error('Settings unavailable');return {prizeSettings:{trashBossesEnabled:enabled,leaderboardStart:'2026-10-05'}};}},
 '@/lib/trash-bosses':{isBossCall:()=>true},'@/lib/prize-settings':{resolvedPrizeSettings:s=>s},'@/lib/site-tracker':{trackerHunts:async()=>{reads++;return[];}},'@/lib/trash-boss-claims':{bossClaims:async()=>[]},
 '@/lib/site-db':{requireTrackerAdmin:async req=>{if(req.headers.get('authorization')!=='verified-admin')throw Error('AUTH: denied');},apiError:e=>Response.json({error:e.message},{status:400})}
};vm.runInNewContext(source,{module,exports:module.exports,require:n=>mocks[n]||require(n),Response,Request,console});return module.exports;}
(async()=>{const data=load('app/api/trash-bosses/route.ts'),access=load('app/api/trash-bosses/access/route.ts');const anonymous=new Request('http://local/api/trash-bosses'),admin=new Request('http://local/api/trash-bosses',{headers:{authorization:'verified-admin'}});
let r=await data.GET(anonymous);assert.equal(r.status,404);assert.equal(reads,0);assert((r.headers.get('cache-control')||'').includes('private'));assert.equal((await r.json()).hunts,undefined);
r=await data.GET(admin);assert.equal(r.status,200);assert.equal(reads,1);let a=await (await access.GET(anonymous)).json();assert.equal(a.admin,false);assert.equal(a.enabled,false);a=await (await access.GET(admin)).json();assert.equal(a.admin,true);
enabled=true;assert.equal((await data.GET(anonymous)).status,200);enabled=false;assert.equal((await data.GET(anonymous)).status,404);assert.equal(reads,2);
broken=true;assert.equal((await data.GET(admin)).status,400);assert.equal(reads,2);
console.log('PASS: inactive viewers receive no data; verified admins preview; active public access works; deactivation blocks access; configuration failures fail closed; responses are not shared-cacheable.');
})().catch(e=>{console.error(e);process.exitCode=1});
