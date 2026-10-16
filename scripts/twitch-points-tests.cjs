const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('node:crypto'),os=require('node:os'),path=require('node:path');
function load(file,imports={},extra={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports:out,require:n=>{if(n in imports)return imports[n];if(n.startsWith('node:'))return require(n);throw Error(n)},process:{env:{TWITCH_CLIENT_SECRET:'local-test-secret-never-a-real-credential'},cwd:()=>temporary},Buffer,Headers,Response,Request,URL,URLSearchParams,AbortSignal,Date,console,...extra});return out;}
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'trashguy-points-test-'));
const security=load('lib/twitch-points-security.ts');
const body=JSON.stringify({event:{id:'redeem-1'}}),stamp=new Date().toISOString(),id='message-1';
function signed(text=body,time=stamp,message=id){return new Headers({'twitch-eventsub-message-id':message,'twitch-eventsub-message-timestamp':time,'twitch-eventsub-message-signature':'sha256='+crypto.createHmac('sha256',security.webhookSecret()).update(message+time+text).digest('hex')});}
assert(security.verifyWebhook(signed(),body));assert(!security.verifyWebhook(signed(),body+'x'));assert(!security.verifyWebhook(signed(body,new Date(Date.now()-601000).toISOString()),body));assert(!security.verifyWebhook(signed(body,new Date(Date.now()+120000).toISOString()),body));assert(!security.verifyWebhook(new Headers(),body));
const token=security.seal({access_token:'test',refresh_token:'test-refresh'});assert(!token.includes('test-refresh'));assert.equal(security.unseal(token).access_token,'test');assert.throws(()=>security.unseal(token.slice(0,-4)+'abcd'));assert.throws(()=>security.pointsSettings({enabled:true,rewardId:'',volume:1}));assert.throws(()=>security.pointsSettings({enabled:false,rewardId:'',volume:2}));assert.equal(security.pointsSettings({enabled:false,rewardId:'',volume:0}).volume,0);
console.log('PASS webhook signatures, body tampering, stale/future events, token encryption/tampering and settings validation');
const config={enabled:true,broadcaster_id:'123',reward_id:'reward',subscription_id:'sub'};let enqueued=0,patches=[];
const webhook=load('app/api/twitch-points/webhook/route.ts',{'@/lib/twitch-points-security':security,'@/lib/twitch-points-server':{pointsConfig:async()=>config,savePoints:async patch=>patches.push(patch),enqueueRedemption:async()=>{enqueued++}}});
async function post(payload,type='notification',headers){const text=JSON.stringify(payload);return webhook.POST(new Request('http://local/api/twitch-points/webhook',{method:'POST',body:text,headers:headers||new Headers([...signed(text),['twitch-eventsub-message-type',type]])}));}
const event={subscription:{id:'sub',type:security.REDEMPTION_TYPE,version:'1',condition:{broadcaster_user_id:'123'}},event:{id:'redeem-1',broadcaster_user_id:'123',user_login:'viewer',reward:{id:'reward'}}};
(async()=>{
 assert.equal((await post(event)).status,204);assert.equal(enqueued,1);
 assert.equal((await post({...event,event:{...event.event,reward:{id:'unrelated'}}})).status,204);assert.equal(enqueued,1);
 assert.equal((await post({...event,subscription:{...event.subscription,condition:{broadcaster_user_id:'other'}}})).status,403);
 assert.equal((await post({...event,subscription:{...event.subscription,id:'wrong'}})).status,403);
 assert.equal((await post(event,'notification',new Headers())).status,403);
 const challenge=await post({...event,challenge:'raw-challenge'},'webhook_callback_verification');assert.equal(await challenge.text(),'raw-challenge');assert.equal(patches.at(-1).subscription_status,'enabled');
 assert.equal((await post({...event,subscription:{...event.subscription,status:'authorization_revoked'}},'revocation')).status,204);assert.equal(patches.at(-1).enabled,false);
 console.log('PASS real signed webhook route, raw challenge, channel/subscription validation, unrelated reward isolation and revocation');
 const production=load('lib/claw-production.ts');
 const state=load('lib/claw-production-server.ts',{'server-only':{},'./community-store':{localCommunity:()=>true},'./site-db':{},'./claw-production':production,'./twitch-points-security':security});
 const claw=await state.productionCommand('admin','play',crypto.randomUUID());await state.queueLocalScotland(.8);await state.queueLocalScotland(.5);
 assert.equal((await state.productionState(true)).id,claw.id,'claw stays on air when redemption arrives');
 await assert.rejects(()=>state.productionCommand('admin','play',crypto.randomUUID()),/playing/);
 let saved=JSON.parse(fs.readFileSync(path.join(temporary,'.local/claw-production.json')));saved.event.startedAt=new Date(Date.now()-11000).toISOString();fs.writeFileSync(path.join(temporary,'.local/claw-production.json'),JSON.stringify(saved));
 assert.equal((await state.productionState(false)).id,claw.id,'admin status reads do not consume queue');
 const first=await state.productionState(true);assert.equal(first.clip,'scotland');assert.equal(first.volume,.8);assert.equal(first.durationMs,68105);assert.equal((await state.productionState(true)).id,first.id,'multiple overlay reads do not double-consume');
 await state.productionCommand('admin','stop');assert.equal(await state.productionState(true),null);saved=JSON.parse(fs.readFileSync(path.join(temporary,'.local/claw-production.json')));assert.equal(saved.queue.length,0);
 console.log('PASS local shared queue, no overlap with claw, ordered volume/duration, future event idempotence, admin reads and emergency cleanup');
 const denied=load('app/api/admin/twitch-points/route.ts',{'@/lib/site-db':{requireTrackerAdmin:async()=>{throw Error('AUTH: no')},apiError:()=>new Response(null,{status:403})},'@/lib/twitch-points-server':{},'@/lib/twitch-points-security':security,'@/lib/claw-production-server':{},'@/lib/community-store':{}});
 assert.equal((await denied.GET(new Request('http://local'))).status,403);assert.equal((await denied.POST(new Request('http://local',{method:'POST',body:'{}'}))).status,403);
 console.log('PASS anonymous users cannot read connection data or change playback settings');
 let consumed=0,connected=0;
 const callback=load('app/api/twitch-points/callback/route.ts',{'next/server':{NextResponse:{redirect:url=>({url:String(url),cookies:{delete(){ }},headers:new Headers()})}},'@/lib/twitch-points-security':security,'@/lib/twitch-points-server':{connectBroadcaster:async()=>{connected++},validInvite:async(_token,consume)=>{if(consume)consumed++;return consumed===1}}});
 const authRequest=(state,expires=Date.now()+600000)=>({url:'https://local/api/twitch-points/callback?code=code&state='+state,nextUrl:new URL('https://local/api/twitch-points/callback?code=code&state='+state),cookies:{get:()=>({value:security.seal({state:'expected-state',invite:'invite',expires})})}});
 assert((await callback.GET(authRequest('wrong-state'))).url.endsWith('result=error'));assert.equal(consumed,0);
 assert((await callback.GET(authRequest('expected-state',Date.now()-1000))).url.endsWith('result=error'));assert.equal(consumed,0);
 assert((await callback.GET(authRequest('expected-state'))).url.endsWith('result=connected'));assert.equal(connected,1);
 assert((await callback.GET(authRequest('expected-state'))).url.endsWith('result=error'));assert.equal(connected,1);
 console.log('PASS OAuth cookie state, expired state and one-use invite replay rejection');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>fs.rmSync(temporary,{recursive:true,force:true}));
