import 'server-only';
const key=Symbol.for('trashguy.slot-call-avatars');
type State={pictures:Map<string,{url:string|null;expires:number}>;token?:{value:string;expires:number};tokenPending?:Promise<string>;pending:Map<string,Promise<void>>;retryAfter:number};
const shared=globalThis as typeof globalThis & {[key]?:State};
const state=():State=>shared[key]??=( {pictures:new Map(),pending:new Map(),retryAfter:0} );
export function avatarLogins(values:string[]){return [...new Set(values.map(v=>v.trim().replace(/^@/,'').toLowerCase()).filter(v=>/^[a-z0-9_]{1,25}$/.test(v)))].sort().slice(0,100);}
async function token(s:State,id:string,secret:string){
 if(s.token&&s.token.expires>Date.now())return s.token.value;
 if(s.tokenPending)return s.tokenPending;
 s.tokenPending=(async()=>{const r=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:id,client_secret:secret,grant_type:'client_credentials'}),signal:AbortSignal.timeout(4000),cache:'no-store'});if(!r.ok)throw Error('Twitch unavailable');const data=await r.json();if(typeof data.access_token!=='string'||!Number.isFinite(Number(data.expires_in))||Number(data.expires_in)<=0)throw Error('Twitch unavailable');s.token={value:data.access_token,expires:Date.now()+Math.max(0,Number(data.expires_in)-60)*1000};return data.access_token;})();
 try{return await s.tokenPending;}finally{delete s.tokenPending;}
}
export async function slotCallAvatars(values:string[]):Promise<Record<string,string>>{
 const logins=avatarLogins(values),s=state(),id=process.env.TWITCH_CLIENT_ID||process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID,secret=process.env.TWITCH_CLIENT_SECRET;
 const missing=logins.filter(n=>!s.pictures.has(n)||s.pictures.get(n)!.expires<Date.now());
 if(missing.length&&id&&secret&&s.retryAfter<Date.now()){
  const batch=missing.join(',');let pending=s.pending.get(batch);
  if(!pending){pending=(async()=>{try{
   const access=await token(s,id,secret),params=new URLSearchParams();missing.forEach(n=>params.append('login',n));
   const r=await fetch('https://api.twitch.tv/helix/users?'+params,{headers:{'Client-Id':id,Authorization:'Bearer '+access},signal:AbortSignal.timeout(4000),cache:'no-store'});
   if(r.status===401)delete s.token;
   if(!r.ok)throw Error('Twitch unavailable');const data=await r.json();if(!Array.isArray(data.data))throw Error('Twitch unavailable');
   const returned=new Map<string,string>();for(const user of data.data){const name=String(user.login||'').toLowerCase();if(!missing.includes(name))continue;try{const u=new URL(user.profile_image_url);if(u.protocol==='https:'&&u.hostname==='static-cdn.jtvnw.net')returned.set(name,u.href);}catch{ /* Invalid/missing images use initials. */ }}
   for(const name of missing)s.pictures.set(name,{url:returned.get(name)||null,expires:Date.now()+(returned.has(name)?86400000:300000)});
   while(s.pictures.size>2000)s.pictures.delete(s.pictures.keys().next().value!);
  }catch{s.retryAfter=Date.now()+60000;}})();s.pending.set(batch,pending);}
  try{await pending;}finally{if(s.pending.get(batch)===pending)s.pending.delete(batch);}
 }
 return Object.fromEntries(logins.flatMap(name=>{const url=s.pictures.get(name)?.url;return url?[[name,url]]:[];}));
}
