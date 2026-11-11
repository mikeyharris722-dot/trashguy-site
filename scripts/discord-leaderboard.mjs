const leaderboardUrl = 'https://trashguy.me/api/leaderboard';
const siteUrl = 'https://trashguy.me/#leaderboard';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const format = value => money.format(value);
const escapeDiscord = value => String(value).replace(/[\r\n]/g, ' ').replace(/[\\*_~`|<>]/g, '\\$&').slice(0, 80);
const timestamp = date => {
  const seconds = Date.parse(date + 'T00:00:00Z') / 1000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(seconds)) {
    throw new Error('Invalid leaderboard date');
  }
  return seconds;
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Request returned HTTP ' + response.status);
  return response.json();
}

async function main() {
  const result = await request(leaderboardUrl);
  const { period, currentStart, players } = result;
  if (!result.success || !period || period.start !== currentStart ||
      !Array.isArray(period.prizes) || !period.prizes.every(Number.isFinite) ||
      !Array.isArray(players) || !players.every(player => Number.isFinite(player.wagered))) {
    throw new Error('The website did not return a valid current leaderboard');
  }

  const start = timestamp(period.start);
  const end = timestamp(period.end);
  if (end <= start) throw new Error('Invalid leaderboard period');
  const standings = players.slice(0, 10).map((player, index) => {
    const rank = ['🥇', '🥈', '🥉'][index] ?? ('#' + (index + 1));
    const prize = period.prizes[index] || 0;
    return {
      name: rank + '  ' + escapeDiscord(player.username),
      value: 'Weighted wager **' + format(player.wagered) + '**' +
        (prize ? '  ·  Prize **' + format(prize) + '**' : ''),
    };
  });
  const countdown = end * 1000 <= Date.now() ? 'Ended <t:' + end + ':R>' : '<t:' + end + ':R>';
  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '🏆 Trashguy · Roulo Leaderboard',
      url: siteUrl,
      color: 0x9b5de5,
      description: '**Prize pool** · ' + format(period.prizes.reduce((sum, prize) => sum + prize, 0)) +
        '\n**Period** · <t:' + start + ':D> – <t:' + end + ':D>' +
        '\n**Ends** · ' + countdown + ' (<t:' + end + ':f>)',
      fields: [
        ...(standings.length ? standings : [{ name: 'Standings', value: 'No recorded wagers yet.' }]),
        { name: '🎮 RTP and wager contribution', value:
          '**97% RTP or less**\nCounts **100%** of your wager\n\n' +
          '**Over 97% but under 98% RTP**\nCounts **50%** of your wager\n\n' +
          '**98% RTP or higher**\nCounts **10%** of your wager' },
      ],
      footer: { text: 'Trashguy.me · Leaderboard refreshed' },
      timestamp: new Date().toISOString(),
    }],
  };

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
