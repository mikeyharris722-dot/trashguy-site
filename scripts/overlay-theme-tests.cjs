const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trash-overlay-theme-')),cache={};
function load(name){if(cache[name])return cache[name].exports;const m={exports:{}};cache[name]=m;vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join('lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,require:n=>n==='server-only'?{}:n==='./site-db'?{siteDb:()=>{throw Error('No live DB in tests')}}:n==='@/data/rainbet-community.json'?require(path.resolve('data/rainbet-community.json')):n.startsWith('./')?load(n.slice(2)):require(n),process:{...process,env:{NODE_ENV:'development',COMMUNITY_HUNT_LOCAL:'1'},cwd:()=>dir},console,URL,AbortSignal,fetch,structuredClone});return m.exports;}
(async()=>{
 const t=load('overlay-theme'),c=load('community-local'),p=load('prize-settings');
 assert.equal(t.overlayAccent('#aBcD01'),'#ABCD01');
 for(const bad of ['red','#123','#12345678','#12345G','url(x)',null,123])assert.throws(()=>t.overlayAccent(bad),/six-digit/);
 assert.equal(Object.keys(t.overlayTheme('#075D5E')).length,0);
 assert.equal(t.overlayTheme('#FFFFFF')['--hunt-header-text'],'#000000');
 assert.equal(t.overlayTheme('#000000')['--hunt-header-text'],'#FFFFFF');
 const admin={id:'admin',name:'Admin'},before=JSON.stringify(await c.communityState());
 await assert.rejects(c.communityCommand({id:'viewer',name:'Viewer'},false,{action:'overlayAppearance',accentColor:'#ABCDEF'}),/Admin/);
 await assert.rejects(c.communityCommand(admin,true,{action:'overlayAppearance',accentColor:'red'}),/six-digit/);
 assert.equal(JSON.stringify(await c.communityState()),before);
 const requestId=crypto.randomUUID();await c.communityCommand(admin,true,{action:'overlayAppearance',accentColor:'#aa33ff',requestId});
 await c.communityCommand(admin,true,{action:'overlayAppearance',accentColor:'#aa33ff',requestId});
 let state=await c.communityState();assert.equal(state.prizeSettings.overlayAccent,'#AA33FF');assert.equal(state.hunts.length,0);assert.deepEqual([...state.prizeSettings.leaderboard],[...p.defaultPrizeSettings.leaderboard]);
 await c.communityCommand(admin,true,{action:'prizeSettings',settings:{...p.defaultPrizeSettings,predictionPrize:20}});
 state=await c.communityState();assert.equal(state.prizeSettings.overlayAccent,'#AA33FF');assert.equal(state.prizeSettings.predictionPrize,20);
 await c.communityCommand(admin,true,{action:'overlayAppearance',accentColor:t.DEFAULT_OVERLAY_ACCENT});assert.equal((await c.communityState()).prizeSettings.overlayAccent,t.DEFAULT_OVERLAY_ACCENT);
 console.log('PASS hex validation, readable black/white headers, original teal defaults, admin-only save, retries, persistence, prize-save preservation and reset.');
})().catch(e=>{console.error(e);process.exitCode=1;});
