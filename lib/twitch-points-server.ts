import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { siteDb } from './site-db';
import { localCommunity } from './community-store';
import { digest, POINTS_SCOPE, REDEMPTION_TYPE, seal, secret, unseal, webhookSecret } from './twitch-points-security';

export type PointsConfig = { enabled: boolean; reward_id: string; volume: number; broadcaster_id?: string | null; broadcaster_login?: string | null; tokens?: string | null; subscription_id?: string | null; subscription_status?: string | null };
type Receipt = {redemption_id: string; viewer: string; status: string; received_at: string};
type Local = {config: PointsConfig; invites: Record<string, {expires_at: string; consumed_at?: string}>; receipts: Receipt[]};
const filename = path.join(process.cwd(), '.local', 'twitch-points.json');
const key = Symbol.for('trashguy.points.store');
const globalStore = globalThis as typeof globalThis & {[key]?: Promise<unknown>};
export const defaultPoints: PointsConfig = {enabled:false,reward_id:'',volume:1};
async function local<T>(change: (state: Local) => Promise<T> | T): Promise<T> {
  const run = async () => {
    let state: Local;
    try { state = JSON.parse(await fs.readFile(filename, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; state = {config:{...defaultPoints},invites:{},receipts:[]}; }
    const result = await change(state);
    await fs.mkdir(path.dirname(filename), {recursive:true});
    await fs.writeFile(filename + '.tmp', JSON.stringify(state)); await fs.rename(filename + '.tmp', filename);
    return result;
  };
  const job = (globalStore[key] || Promise.resolve()).catch(() => {}).then(run);
  globalStore[key] = job; return job;
}
function dbError(error: unknown) { if (error) throw Error('Channel-point database setup is unavailable.'); }
export async function pointsConfig(): Promise<PointsConfig> {
  if (localCommunity()) return local(state => ({...state.config}));
  const {data,error} = await siteDb().from('twitch_points_config').select('*').eq('id',true).single();
  dbError(error); return data;
}
export async function savePoints(patch: Partial<PointsConfig>) {
  if (localCommunity()) return local(state => { Object.assign(state.config,patch); });
  const {error} = await siteDb().from('twitch_points_config').update({...patch,updated_at:new Date().toISOString()}).eq('id',true); dbError(error);
}
export async function disablePoints() {
  if(localCommunity()) { await savePoints({enabled:false}); return; }
  const {error}=await siteDb().rpc('twitch_points_disable');dbError(error);
}
export function appConfig() {
  const clientId = process.env.TWITCH_CLIENT_ID || '';
  const origin = new URL(process.env.TWITCH_POINTS_SITE_URL || 'https://trashguy.me').origin;
  return {clientId,origin,callback:origin+'/api/twitch-points/callback',webhook:origin+'/api/twitch-points/webhook',expectedLogin:(process.env.TWITCH_CHANNEL_LOGIN || 'trashguy__').toLowerCase()};
}
export async function invite() {
  if (localCommunity()) throw Error('Connection links are available after publishing. Local previews never connect or change Twitch.');
  secret(); if (!appConfig().clientId) throw Error('Set the Twitch application client ID first.');
  const token = randomBytes(32).toString('base64url'), token_hash=digest(token), expires_at=new Date(Date.now()+15*60000).toISOString();
  const {error}=await siteDb().from('twitch_points_invites').insert({token_hash,expires_at}); dbError(error);
  return {url:appConfig().origin+'/twitch-connect?invite='+token,expiresAt:expires_at};
}
export async function validInvite(token: string, consume=false) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || localCommunity()) return false;
  const query=siteDb().from('twitch_points_invites');
  const {data,error}=await (consume?query.update({consumed_at:new Date().toISOString()}):query.select('token_hash')).eq('token_hash',digest(token)).is('consumed_at',null).gt('expires_at',new Date().toISOString()).select('token_hash').maybeSingle();
  dbError(error); return Boolean(data);
}
export async function recentReceipts() {
  if (localCommunity()) return local(state => state.receipts.slice(-20).reverse());
  const {data,error}=await siteDb().from('twitch_points_receipts').select('redemption_id,viewer,status,received_at').order('received_at',{ascending:false}).limit(20); dbError(error); return data || [];
}
type Tokens = {access_token:string;refresh_token:string;expires_at:number;validated_at:number};
async function twitchFetch(url:string,init:RequestInit={}) {
  const response=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw Error(response.status===401?'Twitch authorisation expired. Reconnect the broadcaster.':response.status===429?'Twitch is limiting requests. Wait before trying again.':'Twitch could not complete the request ('+response.status+').');
  return response.status===204?null:response.json();
}
export async function oauthTokens(code:string) {
  return twitchFetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:appConfig().clientId,client_secret:secret(),code,grant_type:'authorization_code',redirect_uri:appConfig().callback})});
}
export async function connectBroadcaster(code:string) {
  const tokens=await oauthTokens(code);
  const identity=await twitchFetch('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:'OAuth '+tokens.access_token}});
  if (identity.client_id!==appConfig().clientId || identity.login?.toLowerCase()!==appConfig().expectedLogin || !identity.scopes?.includes(POINTS_SCOPE)) throw Error('Please connect the '+appConfig().expectedLogin+' Twitch account and approve channel-point access.');
  await savePoints({enabled:false,broadcaster_id:identity.user_id,broadcaster_login:identity.login,tokens:seal({...tokens,expires_at:Date.now()+tokens.expires_in*1000,validated_at:Date.now()}),subscription_id:null,subscription_status:'not_subscribed'});
}
async function userToken(config:PointsConfig) {
  if (!config.tokens || !config.broadcaster_id) throw Error('Connect the broadcaster first.');
  let tokens=unseal<Tokens>(config.tokens);
  if (tokens.expires_at<Date.now()+60000) {
    const next=await twitchFetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:appConfig().clientId,client_secret:secret(),grant_type:'refresh_token',refresh_token:tokens.refresh_token})});
    tokens={access_token:next.access_token,refresh_token:next.refresh_token,expires_at:Date.now()+next.expires_in*1000,validated_at:0};
  }
  if (tokens.validated_at<Date.now()-3600000) {
    const identity=await twitchFetch('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:'OAuth '+tokens.access_token}});
    if (identity.client_id!==appConfig().clientId || identity.user_id!==config.broadcaster_id || !identity.scopes?.includes(POINTS_SCOPE)) throw Error('Twitch channel-point access must be reconnected.');
    tokens.validated_at=Date.now();
  }
  await savePoints({tokens:seal(tokens)});
  return tokens.access_token;
}
async function appToken() { const result=await twitchFetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:appConfig().clientId,client_secret:secret(),grant_type:'client_credentials'})}); return result.access_token as string; }
export async function rewards() {
  if (localCommunity()) return [];
  const config=await pointsConfig(),token=await userToken(config);
  const body=await twitchFetch('https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id='+config.broadcaster_id,{headers:{'Client-Id':appConfig().clientId,Authorization:'Bearer '+token}});
  return (body.data || []).map((item:{id:string;title:string;cost:number;is_enabled:boolean})=>({id:item.id,title:item.title,cost:item.cost,enabled:item.is_enabled}));
}
export async function subscribe() {
  if (localCommunity()) throw Error('Twitch subscriptions are disabled in local preview.');
  const config=await pointsConfig();
  await userToken(config);
  const token=await appToken(),headers={'Client-Id':appConfig().clientId,Authorization:'Bearer '+token};
  // Query by our broadcaster, never delete another application's subscriptions.
  const list=await twitchFetch('https://api.twitch.tv/helix/eventsub/subscriptions?user_id='+config.broadcaster_id,{headers});
  const existing=(list.data || []).find((item:{id:string;type:string;status:string;transport:{callback?:string}})=>item.type===REDEMPTION_TYPE&&item.transport.callback===appConfig().webhook&&['enabled','webhook_callback_verification_pending'].includes(item.status));
  if (existing) { await savePoints({subscription_id:existing.id,subscription_status:existing.status}); return existing.status; }
  const result=await twitchFetch('https://api.twitch.tv/helix/eventsub/subscriptions',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({type:REDEMPTION_TYPE,version:'1',condition:{broadcaster_user_id:config.broadcaster_id},transport:{method:'webhook',callback:appConfig().webhook,secret:webhookSecret()}})});
  const current=await pointsConfig();
  const status=current.subscription_id===result.data[0].id&&current.subscription_status==='enabled'?'enabled':result.data[0].status;
  await savePoints({subscription_id:result.data[0].id,subscription_status:status}); return status;
}
export async function checkSubscription() {
  if(localCommunity())return;
  const config=await pointsConfig();if(!config.subscription_id||!config.broadcaster_id)return;
  const token=await appToken();
  const list=await twitchFetch('https://api.twitch.tv/helix/eventsub/subscriptions?user_id='+config.broadcaster_id,{headers:{'Client-Id':appConfig().clientId,Authorization:'Bearer '+token}});
  const item=(list.data||[]).find((subscription:{id:string})=>subscription.id===config.subscription_id);
  const status=item?.status||'not_subscribed';
  await savePoints({subscription_status:status});
  if(!['enabled','webhook_callback_verification_pending'].includes(status))await disablePoints();
}
export async function enqueueRedemption(id:string,viewer:string,broadcaster:string,reward:string) {
  if (localCommunity()) throw Error('Real Twitch events are disabled in local preview.');
  const {data,error}=await siteDb().rpc('twitch_points_enqueue',{p_redemption:id,p_viewer:viewer,p_broadcaster:broadcaster,p_reward:reward,p_event:randomUUID()}); dbError(error); return data;
}
export async function pointsStatus() {
  const [config,receipts]=await Promise.all([pointsConfig(),recentReceipts()]);
  return {local:localCommunity(),configured:Boolean(process.env.TWITCH_CLIENT_ID&&process.env.TWITCH_CLIENT_SECRET),callback:appConfig().callback,expectedLogin:appConfig().expectedLogin,enabled:config.enabled,rewardId:config.reward_id,volume:config.volume,connected:Boolean(config.tokens),login:config.broadcaster_login || null,subscriptionStatus:config.subscription_status || 'not_connected',receipts};
}
