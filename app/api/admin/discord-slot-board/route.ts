import {apiError,requireTrackerAdmin,siteDb} from '@/lib/site-db';
import {scheduleSlotBoard,slotBoardStatus} from '@/lib/discord-slot-board';
import {discordWebhook} from '@/lib/discord-slot-board-format';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{await requireTrackerAdmin(request);return Response.json(await slotBoardStatus(),{headers});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 await requireTrackerAdmin(request);if(process.env.NODE_ENV!=='production')throw Error('Live Discord changes are disabled in local preview.');
 const b=await request.json(),db=siteDb();
 const current=await db.from('discord_slot_board').select('webhook_url,lease_until').eq('id',true).single();if(current.error)throw Error('Could not read Discord settings.');
 if(current.data.lease_until&&Date.parse(current.data.lease_until)>Date.now())throw Error('An update is running. Try again shortly.');
 if(b.action==='save'){
  if(typeof b.enabled!=='boolean')throw Error('Choose whether the board is enabled.');
  const patch:Record<string,unknown>={enabled:b.enabled,next_attempt:new Date().toISOString()};
  if(b.webhook){const url=discordWebhook(String(b.webhook));patch.webhook_url=url;if(url!==current.data.webhook_url)patch.messages={};}
  if(b.enabled&&!b.webhook&&!current.data.webhook_url)throw Error('Enter a webhook before enabling Discord.');
  const r=await db.from('discord_slot_board').update(patch).eq('id',true).or('lease_until.is.null,lease_until.lt.'+new Date().toISOString()).select('id');if(r.error||!r.data?.length)throw Error('Could not save Discord settings. Please retry.');

 }else if(b.action==='refresh'){const r=await db.from('discord_slot_board').update({next_attempt:new Date().toISOString()}).eq('id',true);if(r.error)throw Error('Could not request an update.');}else throw Error('Unknown Discord action.');
 scheduleSlotBoard();return Response.json(await slotBoardStatus(),{headers});
}catch(e){return apiError(e);}}
