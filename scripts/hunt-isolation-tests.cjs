const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),ts=require(repo+'/node_modules/typescript');
function load(file,mocks,env={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(repo,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>{if(name in mocks)return mocks[name];throw Error('Unexpected dependency: '+name)},process:{env},Response,Request,URL,AbortSignal,Map,Set,Date});return module.exports;}
const community={activeHuntId:'community',hunts:[{id:'community',title:'Independent community',phase:'collecting',currency:'CAD',createdAt:'2026-10-16',deleted:false,entries:[],calls:[],openingQueue:[]}]};
const regular={id:'regular',source:'site',title:'Live regular',currency:'USD',phase:'opening',startCost:100,stats:{totalWinnings:0},entries:[{id:'bonus',status:'collected',slot_name:'Regular Bonus',username:'Viewer',bet_size:'1',payout:null,bonus_tier:'standard',sort_order:0}]};
const settings={active_hunt_id:'regular',opening_queue:['bonus']},writes=[];
const fixtures={site_tracker_settings:[settings],slot_calls:[{id:'normal-call',slot_name:'Regular Call',username:'Viewer'}],roulo_call_matches:[],site_tracker_entries:[],slot_call_results:[]};
const db={from(table){let single=false;const q={select(){return q},eq(){return q},is(){return q},order(){return q},in(){return q},maybeSingle(){single=true;return q},then(resolve,reject){return Promise.resolve({data:single?(fixtures[table]?.[0]||null):fixtures[table]||[],error:null}).then(resolve,reject)}};return q},async rpc(name,args){writes.push({name,args});return{data:args.p_hunt,error:null}}};
const site={'@/lib/discord-slot-board':{scheduleSlotBoard:()=>{}},'@/lib/site-db':{siteDb:()=>db,requireTrackerAdmin:async()=> 'admin',apiError:e=>Response.json({error:e.message},{status:400})}};
(async()=>{
 const track=load('app/api/site-tracker/route.ts',{...site,'@/lib/site-tracker':{trackerHunts:async id=>!id||id==='regular'?[regular]:[]},'@/lib/review-selection':{reviewNativeSelection:async()=>''}});
 const list=await(await track.GET(new Request('http://local/api/site-tracker'))).json();assert.equal(list.activeHuntId,'regular');assert.equal(list.hunts.length,1);assert.equal(list.hunts[0].id,'regular');
 const selection=await(await track.GET(new Request('http://local/api/site-tracker?selection=1'))).json();assert.equal(selection.activeHuntId,'regular');
 const other=await(await track.GET(new Request('http://local/api/site-tracker?huntId=community'))).json();assert.equal(other.hunts.length,0);
 const overlay=load('app/api/overlay/route.ts',{...site,'@/lib/tracker-caller':{trackerCaller:e=>e.username},'@/lib/site-tracker':{trackerHunts:async()=>[regular]},'@/lib/review-selection':{reviewNativeSelection:async()=>''}});
 assert.equal((await(await overlay.GET()).json()).hunt.id,'regular');
 const ownOverlay=load('app/api/community/overlay/route.ts',{...site,'@/lib/community-local':{communityState:async()=>community,communityTracker:()=>({startCost:137,stats:{totalWinnings:0}})}});
 assert.equal((await(await ownOverlay.GET()).json()).hunt.id,'community');
 const calls=load('app/api/slot-calls/route.ts',{...site,'@/lib/review-selection':{reviewNativeSelection:async()=>''},'@/lib/roulo-catalogue':{},'@/lib/slot-matching':{},'next/server':{NextResponse:Response},'@/lib/review-client':{createClient:()=>db}});
 assert.equal((await(await calls.GET()).json()).calls[0].id,'normal-call');
 const commands=load('app/api/admin/site-tracker/route.ts',{...site,'@/lib/hunt-currency':{},'@/lib/hunt-fx':{},'@/lib/roulo-catalogue':{},'@/lib/site-tracker':{},'@/lib/review-selection':{},'@/lib/tracker-math':{}});
 assert.equal((await commands.POST(new Request('http://local/api/admin/site-tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'select',huntId:'regular'})}))).status,200);
 assert.equal(writes.length,1);assert.equal(writes[0].name,'site_tracker_select');assert.equal(community.activeHuntId,'community');
 assert(!fs.readFileSync(path.join(repo,'components/hunt-prediction-selector.tsx'),'utf8').includes('/api/community'));
 console.log('PASS independent regular/community selection, normal calls, separate simultaneous OBS feeds, no community data dependency in regular routes, and regular selection never clears community signup.');
})().catch(e=>{console.error(e);process.exitCode=1});
