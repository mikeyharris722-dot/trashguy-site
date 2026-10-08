const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),ts=require(repo+'/node_modules/typescript'),cache={};
function load(name){if(cache[name])return cache[name].exports;const file=path.join(repo,'lib',name+'.ts'),module={exports:{}};cache[name]=module;const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='server-only'?{}:n==='@/data/rainbet-community.json'?require(repo+'/data/rainbet-community.json'):n.startsWith('./')?load(n.slice(2)):require(n),process:{...process,env:{...process.env,NODE_ENV:'development',COMMUNITY_HUNT_LOCAL:'1',NEXT_PUBLIC_LOCAL_REVIEW:'1'},cwd:()=>repo},URL,AbortSignal,fetch,console,structuredClone},{filename:file});return module.exports;}
(async()=>{
 const store=load('community-store');if(!store.localCommunity())throw Error('Local demo storage is required.');
 const c=load('community-local'),state=await c.communityState();
 const existing=state.hunts.find(h=>h.title==='LOCAL REVIEW · Friday Community Hunt'&&!h.deleted);
 if(existing&&(existing.members.length||existing.entries.length||existing.calls.length)){console.log('Existing local review demo retained. No reset performed.');return;}
 const actorMember=state.hunts.flatMap(h=>h.members).find(m=>m.name.toLowerCase()==='gettyyy_');
 if(!actorMember)throw Error('Sign in and register once in a local test hunt before seeding.');
 const actor={id:actorMember.id,name:'gettyyy_'},approved={id:crypto.randomUUID(),name:'DEMO Approved Player'},pending={id:crypto.randomUUID(),name:'DEMO Pending Player'};
 const filename=path.join(repo,'.local','community-hunts.json'),backup=path.join(repo,'.local','community-hunts.before-review-fixtures.json');
 if(!fs.existsSync(backup)&&fs.existsSync(filename))fs.copyFileSync(filename,backup);
 const id=existing?.id||await c.communityCommand(actor,true,{action:'create',title:'LOCAL REVIEW · Friday Community Hunt',scheduledAt:'2026-10-09T19:00:00.000Z',timeZone:'Europe/London',limit:3});
 await c.communityCommand(actor,false,{action:'register',huntId:id,amount:'25'});
 await c.communityCommand(approved,false,{action:'register',huntId:id,amount:'100'});await c.communityCommand(actor,true,{action:'approve',huntId:id,userId:approved.id});
 await c.communityCommand(pending,false,{action:'register',huntId:id,amount:'50'});
 for(const [name,bet,tier,notes]of [['Wanted Dead or a Wild','1','super','DEMO: Super bonus — check the opening note.'],['Gates of Olympus','0.50','standard',''],['Snoop Dogg Dollars','2','super_super','DEMO: Super Super — test dragging this bonus to the top.']]){
  const game=(await c.rainbetGames(name))[0];if(!game)throw Error('Demo game unavailable: '+name);
  await c.communityCommand(actor,true,{action:'manual',huntId:id,identifier:game.identifier,bet,tier,notes});
 }
 for(const name of ['Nut Job','Chicken Man','Sweet Bonanza']){const game=(await c.rainbetGames(name))[0];await c.communityCommand(actor,true,{action:'hostCall',huntId:id,identifier:game.identifier});}
 const h=(await c.communityState()).hunts.find(h=>h.id===id),last=h.calls.at(-1);await c.communityCommand(actor,true,{action:'result',huntId:id,callId:last.id,status:'failed'});
 await c.communityCommand(actor,true,{action:'select',huntId:id});
 console.log('Local-only demo ready: scheduled Friday 20:00 London; Getty pending $25; approved demo $100; pending demo $50; 3 tiered bonuses; 2 queued calls; 1 failed call. Existing test hunts preserved.');
})().catch(e=>{console.error(e);process.exitCode=1});
