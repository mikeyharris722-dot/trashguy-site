const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');const cache={};function load(name){if(cache[name])return cache[name];const module={exports:{}};cache[name]=module.exports;const source=ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(source,{module,exports:module.exports,require:n=>n.startsWith('./')?load(n.slice(2)):require(n),Date,Intl,Number,Map,Set,console});return module.exports;}
const {trashBossProgress,defaultBossTargets}=load('trash-bosses');const {validatePrizeSettings,defaultPrizeSettings}=load('prize-settings');
const row=(id,name,payout,date)=>({id,call_id:name==='Manual'?'manual:'+id:'call:'+id,username:name,slot_name:'Slot',status:'collected',bet_size:1,payout,updated_at:date});const hunt=(entries,source='site')=>({id:source,title:'Hunt',source,casino:source==='community'?'Rainbet':'Roulobets',phase:'finished',startCost:100,entries});const from='2026-10-05',to='2026-11-05',date='2026-10-10T00:00:00Z';
let result=trashBossProgress([hunt([row('1','Gettyyy_',600,date),row('2','gettyyy_',500,date),row('3','Second',1500,date),row('4','Manual',5000,date)]),hunt([row('5','Gettyyy_',9999,date)],'community')],from,to,defaultBossTargets);
assert.equal(result.length,2);assert.equal(result[0].name,'Second');assert.equal(result[1].total,1100);assert.equal(result[1].reached,1);
assert.equal(trashBossProgress([hunt([row('1','A',1000,'2026-11-05T00:00:00Z')])],from,to,defaultBossTargets).length,0);
assert.equal(trashBossProgress([hunt([row('1','A',1000,from+'T00:00:00Z')])],from,to,defaultBossTargets)[0].reached,1);
const edited={...row('1','A',1000,'2026-12-10T00:00:00Z'),payout_recorded_at:date};assert.equal(trashBossProgress([hunt([edited])],from,to,defaultBossTargets)[0].total,1000);
assert.equal(trashBossProgress([hunt([row('1','A',1000,date),row('1','A',1000,date)])],from,to,defaultBossTargets)[0].total,1000);
assert.equal(validatePrizeSettings({...defaultPrizeSettings,trashBosses:defaultBossTargets}).trashBosses[2].target,3000);
assert.throws(()=>validatePrizeSettings({...defaultPrizeSettings,trashBosses:[{target:2000,reward:10},{target:1000,reward:20},{target:3000,reward:30}]}));
assert.equal(validatePrizeSettings({...defaultPrizeSettings}).trashBossesEnabled,false);assert.equal(validatePrizeSettings({...defaultPrizeSettings,trashBossesEnabled:true}).trashBossesEnabled,true);assert.throws(()=>validatePrizeSettings({...defaultPrizeSettings,trashBossesEnabled:'true'}));
const assigned={...row('assigned','Gettyyy_',900,date),call_id:'manual:viewer:12345678-1234-1234-1234-123456789012'};
assert.equal(trashBossProgress([hunt([assigned])],from,to,defaultBossTargets)[0].total,900);
assert.equal(trashBossProgress([hunt([assigned],'community')],from,to,defaultBossTargets).length,0);
assert.equal(trashBossProgress([hunt([{...assigned,call_id:'manual:12345678-1234-1234-1234-123456789012'}])],from,to,defaultBossTargets).length,0);
assert.equal(trashBossProgress([hunt([{...assigned,call_id:'manual:viewer:invalid'}])],from,to,defaultBossTargets).length,0);
const {trackerCaller}=load('tracker-caller');assert.equal(trackerCaller({call_id:'manual:abc',username:'Manual'}),'');assert.equal(trackerCaller(assigned),'Gettyyy_');assert.equal(trackerCaller({call_id:'call:abc',username:'Manual'}),'Manual');
console.log('PASS: wheel-only results, payouts by leaderboard date, case matching, ranking, duplicate exclusion, date edits and target validation.');

const cad={...hunt([{...row('cad','Gettyyy_',2000,date),payout_usd:1400}]),id:'cad',currency:'CAD'};assert.equal(trashBossProgress([cad],from,to,defaultBossTargets)[0].total,1400);delete cad.entries[0].payout_usd;assert.equal(trashBossProgress([cad],from,to,defaultBossTargets).length,0);cad.source='community';cad.entries[0].payout_usd=1400;assert.equal(trashBossProgress([cad],from,to,defaultBossTargets).length,0);console.log('PASS saved USD values, no foreign amount fallback and community exclusion');
