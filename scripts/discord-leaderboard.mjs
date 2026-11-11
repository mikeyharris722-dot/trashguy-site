const leaderboardUrl = 'https://trashguy.me/api/leaderboard';
import { discordLeaderboardPayload } from '../lib/discord-leaderboard-payload.mjs';

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Request returned HTTP ' + response.status);
  return response.json();
}

async function main() {
  const result = await request(leaderboardUrl);
  const payload = discordLeaderboardPayload(result);

  if (process.argv.includes('--preview')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const webhook = process.env.DISCORD_LEADERBOARD_WEBHOOK;
  const message = process.env.DISCORD_LEADERBOARD_MESSAGE_ID;
  const create = process.argv.includes('--create');
  if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(webhook || '') ||
      (!create && !/^\d+$/.test(message || ''))) throw new Error('Missing Discord leaderboard configuration');
  const updated = await request(create ? webhook + '?wait=true' : webhook + '/messages/' + message, {
    method: create ? 'POST' : 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!/^\d+$/.test(updated?.id || '')) throw new Error('Discord did not return a message ID');
  console.log(updated.id);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
