const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),ts=require(repo+'/node_modules/typescript');
const documents={hunts:{payload:{hunts:[],activeHuntId:''},version:0},catalogue:{payload:[],version:0}},receipts=new Map();
let conflicts=0;
const db={from(table){let id;return{select(){return this},eq(k,v){id=v;return this},async single(){return{data:structuredClone(documents[id]),error:null}},async maybeSingle(){return{data:structuredClone(receipts.get(id)||null),error:null}}}},async rpc(name,p){assert.equal(name,'community_commit');const d=documents[p.p_document],old=receipts.get(p.p_request);if(old)return{data:{committed:true,result:old.result},error:null};if(d.version!==p.p_expected){conflicts++;return{data:{committed:false,result:null},error:null}}d.payload=structuredClone(p.p_payload);d.version++;receipts.set(p.p_request,{actor_id:p.p_actor,document:p.p_document,fingerprint:p.p_fingerprint,result:p.p_result});return{data:{committed:true,result:p.p_result},error:null}}};
function instance(){const cache={};function load(name){if(name==='site-db')return{siteDb:()=>db};if(cache[name])return cache[name].exports;const file=path.join(repo,'lib',name+'.ts'),module={exports:{}};cache[name]=module;const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='server-only'?{}:n==='@/data/rainbet-community.json'?require(repo+'/data/rainbet-community.json'):n.startsWith('./')?load(n.slice(2)):require(n),process:{...process,env:{...process.env,NODE_ENV:'production',COMMUNITY_HUNT_LOCAL:'1'}},URL,AbortSignal,fetch,console,structuredClone},{filename:file});return module.exports;}return load('community-local');}
(async()=>{
 const servers=Array.from({length:4},instance),admin={id:crypto.randomUUID(),name:'Admin'},players=Array.from({length:4},(_,i)=>({id:crypto.randomUUID(),name:'Viewer'+i}));
 const create={action:'create',title:'Concurrent test',limit:3,requestId:crypto.randomUUID()};
 const id=await servers[0].communityCommand(admin,true,create);
 assert.equal(await servers[1].communityCommand(admin,true,create),id);assert.equal(documents.hunts.payload.hunts.length,1);
 await Promise.all(servers.map((s,i)=>s.communityCommand(players[i],false,{action:'register',huntId:id,amount:'25',requestId:crypto.randomUUID()})));
 assert.equal(documents.hunts.payload.hunts[0].members.length,4);assert(conflicts>0,'separate instances must encounter and retry CAS conflicts');
 await Promise.all(servers.map((s,i)=>s.communityCommand(admin,true,{action:'approve',huntId:id,userId:players[i].id,requestId:crypto.randomUUID()})));
 assert.equal(servers[0].communityTracker(documents.hunts.payload.hunts[0]).startCost,100);
 const g=(await servers[0].rainbetGames('Wanted Dead'))[0];
 const calls=await Promise.allSettled(servers.map((s,i)=>s.communityCommand(players[i],false,{action:'submit',huntId:id,identifier:g.identifier,requestId:crypto.randomUUID()})));
 assert.equal(calls.filter(r=>r.status==='fulfilled').length,1);assert.equal(documents.hunts.payload.hunts[0].calls.length,1);
 const call=documents.hunts.payload.hunts[0].calls[0];
 const result={action:'result',huntId:id,callId:call.id,status:'collected',bet:'1',requestId:crypto.randomUUID()};
 await servers[0].communityCommand(admin,true,result);await servers[1].communityCommand(admin,true,result);
 assert.equal(documents.hunts.payload.hunts[0].entries.length,1);
 await assert.rejects(servers[2].communityCommand(admin,true,{...create,title:'Another title'}),/request ID/);
 await assert.rejects(servers[0].communityCommand(players[0],false,{action:'delete',huntId:id,confirmTitle:'Concurrent test'}),/Admin/);
 console.log('PASS: production ignores local flag; 4 separate servers retain every contribution; atomic duplicate rejection; request replay creates one hunt and one bonus; actor/admin checks. CAS conflicts retried:',conflicts);
})().catch(e=>{console.error(e);process.exitCode=1});
