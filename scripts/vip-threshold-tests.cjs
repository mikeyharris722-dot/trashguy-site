const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let wagered=9999;
const db={from(table){assert.equal(table,'vip_snapshots');let latest=false;return {select(columns){latest=columns.includes('period_start');return this;},order(){return this;},limit(){return this;},eq(){return this;},ilike(){return this;},async maybeSingle(){return {data:latest?{period_start:'2026-09-05',period_end:'2026-10-05'}:{wagered},error:null}}}}};
const files=[['app/api/roulo-link/route.ts','isPreviousLeaderboardVip'],['app/api/chat-giveaway/enter/route.ts','getPreviousLeaderboardVip'],['app/api/prize-portal/route.ts','getPreviousLeaderboardVip']];
(async()=>{for(const [file,name] of files){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8')+'\nexport const testPreviousVip='+name+';', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(code,{module,exports:module.exports,require:n=>n==='@/lib/vip'?{VIP_WAGER_REQUIREMENT:10000}:n==='@/lib/review-client'?{createClient:()=>db}:{},process:{env:{}},console,Response,Date});
wagered=9999;assert.equal(await module.exports.testPreviousVip('tester'),false,file+' rejects old 5K snapshot');wagered=10000;assert.equal(await module.exports.testPreviousVip('tester'),true,file+' accepts 10K snapshot');}
console.log('PASS 10K saved VIP boundary across account linking, giveaway eligibility and Prize Portal; historical 5K membership alone no longer grants VIP.');})().catch(e=>{console.error(e);process.exitCode=1});
