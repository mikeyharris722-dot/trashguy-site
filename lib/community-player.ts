import 'server-only';
import { siteDb } from './site-db';

export async function communityPlayer(value: unknown) {
  const id = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw Error('Choose a registered site player.');
  const db = siteDb();
  const { data, error } = await db.from('profiles').select('id,username,twitch_user_id').eq('id',id).maybeSingle();
  if (error) throw Error('Could not verify the selected player. Please retry.');
  if (!data?.username || !data.twitch_user_id) throw Error('Choose a registered Twitch player.');
  let twitchId = String(data.twitch_user_id);
  if (!/^\d+$/.test(twitchId)) {
    const auth = await db.auth.admin.getUserById(id);
    const identity = auth.data?.user?.identities?.find(i=>i.provider==='twitch');
    twitchId = String(identity?.identity_data?.provider_id || identity?.identity_data?.sub || '');
    if (auth.error || !/^\d+$/.test(twitchId)) throw Error('Ask this player to sign in to the site with Twitch first.');
  }
  return { id: String(data.id), name: String(data.username), twitchId };
}
