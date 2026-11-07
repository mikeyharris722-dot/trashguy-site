export type GiveawayLuckMode = 'regular' | 'vip';
export function giveawayLuckFields(mode:GiveawayLuckMode) {
 return mode==='vip'
  ? {luck:'vip_luck',losses:'vip_loss_count',wins:'vip_win_count'} as const
  : {luck:'luck',losses:'loss_count',wins:'win_count'} as const;
}
export function giveawayLuckSelect(mode:GiveawayLuckMode) {
 return mode==='vip'
  ? 'twitch_username,luck:vip_luck,loss_count:vip_loss_count,win_count:vip_win_count'
  : 'twitch_username,luck,loss_count,win_count';
}
