const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'trash-x-test-')),cache={};let selected=0,randomCalls=0;
function load(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;const file=path.resolve('lib',name+'.ts');vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>n==='server-only'?{}:n==='./site-db'?{siteDb:()=>{throw Error('Live DB must never be used in tests');}}:n==='node:crypto'?{...crypto,randomInt:n=>{assert(n>0&&n<=200);randomCalls++;return selected%n;}}:n.startsWith('./')?load(n.slice(2)):require(n),process:{env:{NODE_ENV:'development'},cwd:()=>temp},URL,Set,Map,Date,console});return module.exports;}
(async()=>{
 const x=load('x-giveaway'),store=load('x-giveaway-store'),server=load('x-giveaway-server');
 const csv=fs.readFileSync(process.argv[2]||'scripts/fixtures/x-replies-13.csv','utf8'),entries=x.importEntries(csv);
 const result=x.eligibleEntries(entries,'trashguy__',[]);assert.equal(result.raw,13);assert.equal(result.entries.length,11);assert.equal(result.duplicates,1);assert.equal(result.exclusions,1);
 assert.equal(x.importEntries('Handle,User ID\n@Name,9999999999999999999')[0].accountId,'9999999999999999999');
 assert.equal(x.importEntries('Username,Post text\r\n@Test,"hello,\nworld ""quoted"""')[0].username,'Test');
 assert.equal(x.eligibleEntries(x.importEntries('@Name\n@NAME\nhttps://x.com/Other',true),'',[]).entries.length,2);
 assert.equal(x.eligibleEntries([{username:'old',accountId:'123'},{username:'new',accountId:'123'}],'',[]).entries.length,1);
 assert.equal(x.eligibleEntries([{username:'old',accountId:'123'},{username:'new',accountId:'123'}],'',['old']).entries.length,0);
 for(const bad of ['Username\ninvalid name','Username,User ID\nA,1.2E+18','Username\n"unfinished'])assert.throws(()=>x.importEntries(bad));
 for(const url of ['http://x.com/a/status/1','https://evil.test/a/status/1','https://x.com@evil.test/a/status/1'])assert.throws(()=>x.postInfo(url));
 assert.equal(x.eligibleEntries([{username:'same'},{username:'SAME',accountId:'123'},{username:'alias',accountId:'123'}],'',[]).entries.length,1);
 assert.equal(x.entriesForPost(entries,'https://x.com/trashguy__/status/2122759407897333983','https://x.com/trashguy__/status/2122067827620298779').length,0);
 assert.equal(x.entriesForPost(entries,'https://x.com/trashguy__/status/1','https://twitter.com/trashguy__/status/1?x=1').length,13);
 const url='https://x.com/trashguy__/status/2122759407897333983',key=crypto.randomUUID();
 const snap=await server.xCommand('admin',{action:'snapshot',requestId:key,postUrl:url,entries});assert.equal(snap.entries.length,11);
 assert.equal((await server.xCommand('admin',{action:'snapshot',requestId:key,postUrl:url,entries})).id,snap.id);
 await assert.rejects(server.xCommand('admin',{action:'snapshot',requestId:key,entries:[]}),/already used/);
 await assert.rejects(server.xCommand('',{action:'draw',snapshotId:snap.id}),/AUTH/);
 selected=10;const draws=await Promise.all(Array.from({length:6},()=>server.xCommand('admin',{action:'draw',snapshotId:snap.id})));
 assert(draws.every(d=>d.draw.index===10&&d.draw.winner.username===snap.entries[10].username));
 assert.equal((await store.readX()).state.snapshots.length,1);assert.equal((await store.readX()).version,2);
 const calls=randomCalls;await server.xCommand('admin',{action:'draw',snapshotId:snap.id});assert.equal(randomCalls,calls);
 const synthetic=Array.from({length:200},(_,i)=>({username:'test_user_'+String(i).padStart(3,'0')}));assert.equal(x.eligibleEntries(synthetic,'',[]).entries.length,200);
 assert.throws(()=>x.eligibleEntries([...synthetic,{username:'extra'}],'',[]),/201/);
 const big=await server.xCommand('admin',{action:'snapshot',requestId:crypto.randomUUID(),entries:synthetic});selected=199;assert.equal((await server.xCommand('admin',{action:'draw',snapshotId:big.id})).draw.winner.username,'test_user_199');
 // Every segment, including the 200th, maps to the same predetermined pointer index.
 for(let n=1;n<=200;n++)for(let i=0;i<n;i++){const a=(360-(i+.5)*360/n)%360;assert.equal(Math.floor(((360-a)%360)/(360/n)),i);}
 const restored=JSON.parse(fs.readFileSync(path.join(temp,'.local/x-giveaways.json'),'utf8'));assert.equal(restored.state.snapshots[1].entries.length,200);assert(restored.state.snapshots[0].draw.createdAt);
 const empty=await server.xCommand('admin',{action:'snapshot',requestId:crypto.randomUUID(),postUrl:url,entries:[]});assert.equal(empty.postUrl,url);await assert.rejects(server.xCommand('admin',{action:'draw',snapshotId:empty.id}),/at least one/);
 console.log('PASS: 13 CSV rows -> 1 duplicate + 1 author excluded -> 11; quoted CSV; exact IDs; manual/case dedup; exclusions; invalid input; snapshot retries; concurrent/retried draw; persistence; 200 entrants; overflow rejection; pointer alignment 1–200.');
})().catch(e=>{console.error(e);process.exitCode=1;});
