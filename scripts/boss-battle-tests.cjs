const fs=require('fs');const ts=require('typescript');const assert=require('node:assert/strict');
const source=ts.transpileModule(fs.readFileSync('lib/boss-battle.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleObject={exports:{}};new Function('module','exports',source)(moduleObject,moduleObject.exports);
const {battleState}=moduleObject.exports;
const make=(payouts,start=1000)=>({id:'test',title:'test',phase:'opening',startCost:start,bonuses:payouts.map((payout,i)=>({id:String(i),slotName:'Slot',username:'Viewer',betSize:1,payout}))});
assert.equal(battleState(make([])).hp,1000);
assert.equal(battleState(make([0])).cleared,0);
for(const [amount,count] of [[333.32,0],[333.33,1],[666.67,2],[1000,3],[1500,4],[2000,5],[10000,5]]){const s=battleState(make([amount]));assert.equal(s.cleared,count);}
assert.equal(battleState(make([1000,1000])).finished,true);
assert.equal(battleState(make([1000,0])).cleared,3);
const duplicate=make([500]);duplicate.bonuses.push({...duplicate.bonuses[0]});assert.equal(battleState(duplicate).total,500);
assert.equal(battleState(make([NaN,-1,null])).total,0);
assert.equal(battleState(make([100],0)).valid,false);
assert.equal(battleState(make([2000])).kills.filter(Boolean).length,5);
assert.equal(battleState(make([0.1,0.2])).total,0.3);
console.log('Boss progression checks passed: thresholds, edits, duplicate IDs, zero wins, money rounding and finishers.');




