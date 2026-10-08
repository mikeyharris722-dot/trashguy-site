const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..');
const ts=require(repo+'/node_modules/typescript');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trash-community-test-'));
const cache={};
function load(name){if(cache[name])return cache[name].exports;const file=path.join(repo,'lib',name+'.ts');const module={exports:{}};cache[name]=module;const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='server-only'?{}:n==='@/data/rainbet-community.json'?require(repo+'/data/rainbet-community.json'):n.startsWith('./')?load(n.slice(2)):require(n),process:{...process,env:{...process.env,NODE_ENV:'development',COMMUNITY_HUNT_LOCAL:'1'},cwd:()=>dir},URL,AbortSignal,fetch,console},{filename:file});return module.exports;}
(async()=>{
 const c=load('community-local'),a={id:'admin',name:'TEST Admin'},p={id:'player',name:'TEST Player'};
 await assert.rejects(c.communityCommand(p,false,{action:'create',title:'x'}),/Admin/);
 const id=await c.communityCommand(a,true,{action:'create',title:'TEST-COMMUNITY',limit:1});
 await c.communityCommand(p,false,{action:'register',huntId:id,amount:'50'});
 let h=(await c.communityState()).hunts[0];assert.equal(c.communityTracker(h).startCost,0);
 const games=await c.rainbetGames('Wanted Dead');assert(games.length);const g=games[0];
 await assert.rejects(c.communityCommand(p,false,{action:'submit',huntId:id,identifier:g.identifier}),/approval/);
 await c.communityCommand(a,true,{action:'approve',huntId:id,userId:p.id});
 h=(await c.communityState()).hunts[0];assert.equal(c.communityTracker(h).startCost,50);
 await c.communityCommand(p,false,{action:'submit',huntId:id,identifier:g.identifier});
 const other=(await c.rainbetGames('Gates of Olympus'))[0];
 await assert.rejects(c.communityCommand(p,false,{action:'submit',huntId:id,identifier:other.identifier}),/full/);
 await c.communityCommand(a,true,{action:'random',huntId:id});
 h=(await c.communityState()).hunts[0];const call=h.calls[0];assert.equal(call.status,'selected');
 await c.communityCommand(a,true,{action:'result',huntId:id,callId:call.id,status:'collected',bet:'.20'}).catch(async()=>{await c.communityCommand(a,true,{action:'result',huntId:id,callId:call.id,status:'collected',bet:'0.20'});});
 h=(await c.communityState()).hunts[0];assert.equal(c.communityTracker(h).stats.bonusCount,1);
 await assert.rejects(c.communityCommand(p,false,{action:'submit',huntId:id,identifier:g.identifier}),/already/);
 await c.communityCommand(p,false,{action:'submit',huntId:id,identifier:other.identifier});
 h=(await c.communityState()).hunts[0];await c.communityCommand(a,true,{action:'result',huntId:id,callId:h.calls[1].id,status:'failed'});
 await c.communityCommand(a,true,{action:'phase',huntId:id,phase:'opening'});
 await assert.rejects(c.communityCommand(p,false,{action:'register',huntId:id,amount:'20'}),/closed/);
 h=(await c.communityState()).hunts[0];const entry=h.entries[0];await c.communityCommand(a,true,{action:'openingFocus',huntId:id,entryIds:[entry.id]});
 await c.communityCommand(a,true,{action:'payout',huntId:id,entryId:entry.id,bet:'0.20',payout:'75',tier:'super',notes:'TEST note'});
 h=(await c.communityState()).hunts[0];assert.equal(c.communityTracker(h).stats.totalWinnings,75);assert.equal(c.communityTracker(h).stats.averagePayoutRequired,0);
 assert(c.validLaunch(g.rainbet_launch_url));assert(!c.validLaunch('javascript:alert(1)'));assert(!c.validLaunch('https://rainbet.com.evil.test/casino/slots/a'));
 const cat=load('community-catalogue');assert.throws(()=>cat.normalizeImport([{id:1,name:'TEST',producer:'Test',type:'slots',url:'https://evil.test'}]),/Invalid/);
 const saved=await cat.saveCatalogue([{id:123456789,name:'TEST Import',producer:'Test',type:'slots',url:'test-import'}]);assert.equal(saved.added,1);assert((await c.rainbetGames('TEST Import')).length===1);
 await c.communityCommand(a,true,{action:'delete',huntId:id,confirmTitle:'TEST-COMMUNITY'});assert((await c.communityState()).hunts[0].deleted);assert.equal((await c.communityState()).activeHuntId,'');
 console.log('PASS: approval, equity totals, call limits/release, duplicates, selection, collection, payout, phases, URL validation, import and recoverable deletion.');
 // Remove only the exact temporary test directory created above.
 fs.rmSync(dir,{recursive:true});
})().catch(e=>{console.error(e);process.exitCode=1});
