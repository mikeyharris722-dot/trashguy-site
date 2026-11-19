const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const env={};let calls=0,result={data:{token:'test-vault-token',freePlanConfirmed:true},error:null};
const moduleRef={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/x-collection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 module:moduleRef,exports:moduleRef.exports,process:{env},require:n=>n==='server-only'?{}:n==='./site-db'?{siteDb:()=>({rpc:async name=>{assert.equal(name,'x_collector_config');calls++;return result;}})}:n.startsWith('./')?{}:require(n)
});
(async()=>{
 const config=moduleRef.exports.collectorConfig;
 assert.equal((await config()).token,'test-vault-token');assert.equal((await config()).freePlanConfirmed,true);
 result={data:{token:'test-vault-token',freePlanConfirmed:'true'},error:null};assert.equal((await config()).freePlanConfirmed,false);
 for(const data of [null,{}, {token:''}]){result={data,error:null};await assert.rejects(config(),/server API connection/);}
 result={data:null,error:{message:'sensitive internal error'}};await assert.rejects(config(),/server API connection/);
 env.APIFY_API_TOKEN='test-env-token';env.APIFY_FREE_PLAN_CONFIRMED='1';const before=calls;assert.equal((await config()).token,'test-env-token');assert.equal((await config()).freePlanConfirmed,true);assert.equal(calls,before);
 env.APIFY_FREE_PLAN_CONFIRMED='0';assert.equal((await config()).freePlanConfirmed,false);
 console.log('PASS server-only Vault fallback, invalid/unconfirmed config rejection, redacted errors and environment precedence.');
})().catch(e=>{console.error(e);process.exitCode=1;});
