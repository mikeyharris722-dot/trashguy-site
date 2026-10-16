const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=require('node:path').resolve(__dirname,'..');
const ts=require(repo+'/node_modules/typescript');
function instance(fetch){const cache={};function load(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;const js=ts.transpileModule(fs.readFileSync(repo+'/lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,require:n=>n==='server-only'?{}:n.startsWith('./')?load(n.slice(2)):require(n),Date,Symbol,AbortSignal,fetch});return module.exports;}return load('community-fx');}
const good=()=>({result:'success',base_code:'USD',time_last_update_unix:Math.floor(Date.now()/1000),rates:{CAD:1.3743214,GBP:.75,ARS:1100}});
(async()=>{
 let calls=0;const fx=instance(async()=>{calls++;return{ok:true,json:async()=>good()}});
 assert.equal((await fx.communityFx('USD')).equityRate,'1');assert.equal(calls,0);
 const rows=await Promise.all(Array.from({length:10},()=>fx.communityFx('CAD')));assert.equal(calls,1);assert.equal(rows[0].equityRate,'1.374321');assert.equal(rows[0].equityRateSource,'ExchangeRate-API');
 assert.equal((await fx.communityFx('ARS')).equityRate,'1100.000000');assert.equal((await fx.communityFx('GBP')).equityRate,'0.750000');assert.equal(calls,1);
 await assert.rejects(fx.communityFx('GPB'),/Choose USD/);
 for(const change of [{base_code:'EUR'},{result:'error'},{time_last_update_unix:0},{time_last_update_unix:Math.floor(Date.now()/1000)+10000},{rates:{CAD:0}},{rates:{CAD:-1}},{rates:{CAD:'1.37'}},{rates:{CAD:Infinity}},{rates:{CAD:0.00000001}}]){
  const bad=instance(async()=>({ok:true,json:async()=>({...good(),...change})}));await assert.rejects(bad.communityFx('CAD'));
 }
 let retry=0;const recover=instance(async()=>{if(++retry===1)throw Error('offline');return{ok:true,json:async()=>good()}});await assert.rejects(recover.communityFx('CAD'),/No changes were saved/);assert.equal((await recover.communityFx('CAD')).equityRate,'1.374321');
 const limited=instance(async()=>({ok:false,status:429}));await assert.rejects(limited.communityFx('CAD'),/No changes were saved/);
 console.log('PASS automatic USD/CAD/ARS/GBP lookup, shared cache, parallel request deduplication, dated source, precision, invalid/stale/future/missing-rate rejection and failure recovery.');
})().catch(e=>{console.error(e);process.exitCode=1});
