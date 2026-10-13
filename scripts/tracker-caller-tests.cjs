const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
function route(file,mocks){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:n=>{if(n in mocks)return mocks[n];throw Error(n);},Request,Response,URL,process:{env:{NEXT_PUBLIC_LOCAL_REVIEW:'0'}}});return module.exports;}
(async()=>{
let admin=true,captured=null;const users=[{id:'11111111-1111-1111-1111-111111111111',username:'Gettyyy_'}],queries=[];
const builder={select(value){queries.push(['select',value]);return this;},not(){return this;},neq(){return this;},ilike(field,value){queries.push(['ilike',value]);return this;},order(){return this;},async limit(value){assert.equal(value,20);return {data:users,error:null};}};
const db={from(table){assert.equal(table,'profiles');return builder;},async rpc(name,body){captured={name,body};return {data:'entry-id',error:null};}};
const deps={siteDb:()=>db,requireTrackerAdmin:async()=>{if(!admin)throw Error('AUTH: denied');return 'admin-id';},apiError:e=>Response.json({error:e.message},{status:403})};
const search=route('app/api/admin/tracker-users/route.ts',{'@/lib/site-db':deps});
assert.equal((await search.GET(new Request('http://localhost/api/admin/tracker-users?q=g'))).status,200);assert.equal(queries.length,0);
let response=await search.GET(new Request('http://localhost/api/admin/tracker-users?q=gettyyy_'));assert.deepEqual((await response.json()).users,users);assert.equal(queries.find(q=>q[0]==='select')[1],'id,username');assert.equal(queries.find(q=>q[0]==='ilike')[1],'%gettyyy\\_%');
admin=false;assert.equal((await search.GET(new Request('http://localhost/api/admin/tracker-users?q=getty'))).status,403);admin=true;
const tracker=route('app/api/admin/site-tracker/route.ts',{'@/lib/site-db':deps,'@/lib/community-local':{communityEnabled:()=>false},'@/lib/roulo-catalogue':{catalogue:async()=>[{identifier:'nut',name:'Nut Job',enabled:true}]},'@/lib/site-tracker':{},'@/lib/review-selection':{},'@/lib/tracker-math':{money:v=>{if(Number(v)<0)throw Error('negative');}}});
const body={action:'manual',huntId:'hunt',requestId:'request',identifier:'nut',bet:'1',callerProfileId:users[0].id,username:'Spoofed name'};
response=await tracker.POST(new Request('http://localhost/api/admin/site-tracker',{method:'POST',body:JSON.stringify(body)}));assert.equal(response.status,200);assert.equal(captured.name,'site_tracker_manual');assert.equal(captured.body.p_game.caller_profile_id,users[0].id);assert.equal(captured.body.p_game.username,undefined);
delete body.callerProfileId;await tracker.POST(new Request('http://localhost/api/admin/site-tracker',{method:'POST',body:JSON.stringify(body)}));assert.equal(captured.body.p_game.caller_profile_id,null);
admin=false;captured=null;assert.equal((await tracker.POST(new Request('http://localhost/api/admin/site-tracker',{method:'POST',body:JSON.stringify(body)}))).status,403);assert.equal(captured,null);
console.log('PASS: admin-only user search, literal underscore matching, minimal profile fields, caller IDs forwarded without trusting supplied names, unassigned entries and denied writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
