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

export function discordLeaderboardPayload(result) {
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
    const rank = ['🥇', '🥈', '🥉'][index] ?? String(index + 1);
    const prize = period.prizes[index] || 0;
    return rank + '  **' + escapeDiscord(player.username) + '**\n' +
      '└ Weighted wager: **' + format(player.wagered) + '**' + (prize ? ' · Prize: **' + format(prize) + '**' : '');
  });
  const countdown = end * 1000 <= Date.now() ? 'Ended <t:' + end + ':R>' : '<t:' + end + ':R>';
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '🏆 Trashguy · Roulo Leaderboard',
      url: siteUrl,
      color: 0x9b5de5,
      description: '**Prize pool** · ' + format(period.prizes.reduce((sum, prize) => sum + prize, 0)) +
        '\n**Ends** · <t:' + end + ':f> · ' + countdown +
        '\n\n## Leaderboard\n' + (standings.join('\n\n') || 'No recorded wagers yet.') +
        '\n\u200b\n## RTP contribution\n' +
        '97% RTP or less → **100%**\n' +
        'Over 97% and under 98% RTP → **50%**\n' +
        '98% RTP or higher → **10%**',
      timestamp: new Date().toISOString(),
    }],
  };

}
