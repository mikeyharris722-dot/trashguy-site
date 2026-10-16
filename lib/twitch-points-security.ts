import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const REDEMPTION_TYPE = 'channel.channel_points_custom_reward_redemption.add';
export const POINTS_SCOPE = 'channel:read:redemptions';
export const SCOTLAND_MOVIE = '/claw-production/scotland-forever-v1.mp4';
export const SCOTLAND_MS = 68105;
export function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function secret() {
  const value = process.env.TWITCH_CLIENT_SECRET;
  if (!value) throw Error('Twitch application credentials are not configured.');
  return value;
}
export function webhookSecret() { return createHmac('sha256', secret()).update('trashguy:channel-points:webhook:v1').digest('hex'); }
function key() { return createHash('sha256').update('trashguy:channel-points:tokens:v1:' + secret()).digest(); }
export function seal(value: unknown) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
}
export function unseal<T>(value: string): T {
  const [iv, tag, ciphertext] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString('utf8')) as T;
}
export function verifyWebhook(headers: Headers, body: string, now = Date.now()) {
  const id = headers.get('twitch-eventsub-message-id') || '';
  const stamp = headers.get('twitch-eventsub-message-timestamp') || '';
  const signature = headers.get('twitch-eventsub-message-signature') || '';
  const age = now - Date.parse(stamp);
  if (!id || id.length > 200 || !Number.isFinite(age) || age < -60000 || age > 600000 || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = 'sha256=' + createHmac('sha256', webhookSecret()).update(id + stamp + body).digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export function pointsSettings(body: Record<string, unknown>) {
  const rewardId = String(body.rewardId || '').trim();
  const volume = Number(body.volume);
  if (typeof body.enabled !== 'boolean' || !Number.isFinite(volume) || volume < 0 || volume > 1) throw Error('Choose a valid volume and activation setting.');
  if (rewardId && !/^[0-9a-f-]{36}$/i.test(rewardId)) throw Error('Choose a valid Twitch reward.');
  if (body.enabled && !rewardId) throw Error('Select a Twitch reward before enabling playback.');
  return { enabled: body.enabled, reward_id: rewardId, volume };
}
