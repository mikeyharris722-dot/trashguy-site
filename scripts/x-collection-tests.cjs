const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'trash-x-collection-')),cache={};let starts=0,spent=0,tier='FREE',failStart=false,runStatus='SUCCEEDED',currentPost='2122067827620298779',rows=require('./fixtures/x-collected-11.json');
async function fakeFetch(url,options){assert(url.startsWith('https://api.apify.com/v2/'));assert.equal(options.headers.Authorization,'Bearer test-only-token');
 if(url.includes('/runs?limit='))return Response.json({data:{total:1,items:[{usageTotalUsd:spent}]}});
 if(url.includes('/runs?')){starts++;const input=JSON.parse(options.body);assert.equal(input.maxItems,20);assert.deepEqual(input.engagementTypes,['replies']);assert(url.includes('maxTotalChargeUsd=0.05'));assert(url.includes('timeout=180'));currentPost=input.startUrls[0].split('/').pop();if(failStart)throw Error('test timeout');return Response.json({data:{id:'testRun'+starts}});}
 if(url.includes('/actor-runs/'))return Response.json({data:{status:runStatus,defaultDatasetId:'testDataset',usageTotalUsd:0.002}});
 if(url.includes('/datasets/'))return Response.json(rows.map(r=>({...r,sourceTarget:currentPost,inReplyToId:currentPost})));
 throw Error('Unexpected URL');}
function load(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;const file=path.resolve('lib',name+'.ts');vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>n==='server-only'?{}:n==='./site-db'?{siteDb:()=>{throw Error('No live database in tests');}}:n.startsWith('./')?load(n.slice(2)):require(n),process:{env:{NODE_ENV:'development',APIFY_API_TOKEN:'test-only-token',APIFY_FREE_PLAN_CONFIRMED:'1'},cwd:()=>temp},URL,Set,Map,Date,Response,AbortSignal,fetch:fakeFetch,console});return module.exports;}
(async()=>{const api=load('x-collection'),x=load('x-giveaway'),server=load('x-giveaway-server'),store=load('x-giveaway-store');
 const url='https://x.com/trashguy__/status/2122067827620298779';
 assert.equal(x.eligibleEntries(api.collectedEntries(rows,'2122067827620298779'),'trashguy__',[]).entries.length,9);
 assert.throws(()=>api.collectedEntries([{resultType:'replies',sourceTarget:'wrong'}],'2122067827620298779'),/another post/);
 const job=await api.startCollection(url);assert.equal(starts,1);assert.equal((await api.startCollection(url)).id,job.id);assert.equal(starts,1);
 const done=await api.pollCollection(job.id);assert.equal(done.raw,11);assert.equal(done.limited,false);assert.equal(done.status,'succeeded');assert.equal(done.entries[0].accountId,'810451591350259712');
 assert.equal((await api.startCollection(url)).id,job.id);assert.equal(starts,1);
 const snap=await server.xCommand('admin',{action:'snapshot',requestId:crypto.randomUUID(),postUrl:url,collectionId:job.id,entries:done.entries});assert.equal(snap.entries.length,9);
 rows=Array.from({length:20},(_,i)=>({resultType:'replies',author:{id:String(i+100),username:'entry_'+i}}));
 const capped=await api.startCollection('https://x.com/trashguy__/status/123');const limited=await api.pollCollection(capped.id);assert.equal(limited.limited,true);
 const blocked=await server.xCommand('admin',{action:'snapshot',requestId:crypto.randomUUID(),postUrl:'https://x.com/trashguy__/status/123',collectionId:capped.id,entries:limited.entries});await assert.rejects(server.xCommand('admin',{action:'draw',snapshotId:blocked.id}),/limit reached/);
 spent=4.6;await assert.rejects(api.startCollection('https://x.com/trashguy__/status/456'),/exhausted/);assert.equal(starts,2);spent=0;
 failStart=true;await assert.rejects(api.startCollection('https://x.com/trashguy__/status/789'),/not confirm/);assert.equal(starts,3);const failed=await api.startCollection('https://x.com/trashguy__/status/789');assert.equal(failed.status,'failed');assert.equal(starts,3);
 failStart=false;
 for(const terminal of ['FAILED','TIMED-OUT','ABORTED']){
  runStatus=terminal;const target='https://x.com/trashguy__/status/99'+terminal.replace(/[^A-Z]/g,'').length;
  const attempt=await api.startCollection(target);const stopped=await api.pollCollection(attempt.id);assert.equal(stopped.status,'failed');assert.equal(stopped.retryable,true);
  runStatus='SUCCEEDED';const beforeRetry=starts;const retried=await api.startCollection(target);assert.equal(starts,beforeRetry+1);assert.notEqual(retried.id,attempt.id);await api.pollCollection(retried.id);
 }
 spent=4.6;assert.equal((await api.startCollection(url)).status,'succeeded');spent=0;
 const {state,version}=await store.readX();state.collections=Array.from({length:60},(_,i)=>({id:'limit'+i,postUrl:'https://x.com/a/status/'+i,startedAt:new Date().toISOString(),status:'succeeded'}));await store.saveX(state,version);await assert.rejects(api.startCollection('https://x.com/trashguy__/status/888'),/60 collections/);
 console.log('PASS actual 11-row response -> 9 IDs; source validation; 20-row/run budget; scoped monthly usage guards; cached retries; failed start never repeated; partial-list draw block; 60/month ceiling; local persistence.');
})().catch(e=>{console.error(e);process.exitCode=1;});
