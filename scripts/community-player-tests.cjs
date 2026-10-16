const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=require('node:path').resolve(__dirname,'..'),ts=require(repo+'/node_modules/typescript');
const id='00000000-0000-4000-8000-000000000001';
function helper(profile,error=null,identity=null){let reads=0;const db={from(table){assert.equal(table,'profiles');reads++;return{select(){return this},eq(k,v){assert.equal(k,'id');assert.equal(v,id);return this},async maybeSingle(){return{data:profile,error}}}},auth:{admin:{async getUserById(){return{data:{user:{identities:identity?[identity]:[]}},error:null}}}}};const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(repo+'/lib/community-player.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:n=>n==='server-only'?{}:{siteDb:()=>db}});return{player:module.exports.communityPlayer,reads:()=>reads};}
(async()=>{
 const valid=helper({id,username:'Stored Name',twitch_user_id:'12345'});await assert.rejects(valid.player('invalid'),/registered site/);assert.equal(valid.reads(),0);const player=await valid.player(id);assert.equal(player.id,id);assert.equal(player.name,'Stored Name');assert.equal(player.twitchId,'12345');
 await assert.rejects(helper(null).player(id),/registered Twitch/);await assert.rejects(helper({id,username:'No Twitch',twitch_user_id:null}).player(id),/registered Twitch/);await assert.rejects(helper(null,{message:'offline'}).player(id),/verify/);
 await assert.rejects(helper({id,username:'Legacy',twitch_user_id:'legacy-login'}).player(id),/sign in/);
 const legacy=helper({id,username:'Legacy',twitch_user_id:'legacy-login'},null,{provider:'twitch',identity_data:{provider_id:'67890'}});assert.equal((await legacy.player(id)).twitchId,'67890');
 console.log('PASS registered Twitch profile lookup, stored names, invalid IDs, missing accounts, read failures and validated legacy account matching.');
})().catch(e=>{console.error(e);process.exitCode=1});
