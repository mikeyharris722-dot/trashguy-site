const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const js=ts.transpileModule(fs.readFileSync('lib/review-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(browser=false,review=false){const out={};vm.runInNewContext(js,{exports:out,require:()=>({createClient(){}}),process:{env:{NEXT_PUBLIC_LOCAL_REVIEW:review?'1':'0'}},URL,Request,Response,DOMException,fetch,AbortSignal:{timeout:()=>AbortSignal.timeout(20),any:AbortSignal.any.bind(AbortSignal)},...(browser?{window:{}}:{})});return out.reviewFetch;}
(async()=>{
 let received;
 const original=async(input,init)=>{received=init;return new Response('ok')};
 await load()(original)('https://example.supabase.co/rest/v1/hunts');assert.ok(received.signal);
 const caller=new AbortController();caller.abort();await load()(original)('https://example.supabase.co/rest/v1/hunts',{signal:caller.signal});assert.equal(received.signal.aborted,true);
 await load()(original)('https://example.supabase.co/rest/v1/hunts',{method:'POST'});assert.equal(received.signal,undefined);
 await load(true)(original)('https://example.supabase.co/rest/v1/hunts');assert.equal(received,undefined);
 const blocked=await load(false,true)(original)('https://example.supabase.co/rest/v1/hunts',{method:'POST'});assert.equal(blocked.status,403);
 const keepAlive=setTimeout(()=>{},100);
 await assert.rejects(load()(async(input,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})))('https://example.supabase.co/rest/v1/hunts'),{name:'AbortError'});clearTimeout(keepAlive);
 console.log('PASS stalled database reads abort; caller cancellation, browser behavior, write behavior and local protection preserved');
})().catch(e=>{console.error(e);process.exitCode=1});
