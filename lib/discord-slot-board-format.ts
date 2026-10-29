export type BoardCall={username:string;slot_name:string;picked_at?:string|null};
export type BoardEntry={username:string;slot_name:string;status:string;bonus_tier?:string;call_id:string};
export type BoardPayload={allowed_mentions:{parse:string[]};embeds:{title:string;description:string;color:number;footer:{text:string}}[]};
export function discordWebhook(value:string){
 const u=new URL(value.trim());
 if(u.protocol!=='https:'||u.hostname!=='discord.com'||u.port||u.username||u.password||!/^\/api(?:\/v10)?\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(u.pathname)||u.search||u.hash)throw Error('Enter a valid Discord webhook URL.');
 return u.origin+u.pathname;
}
function clean(value:string,max:number){return String(value||'').replace(/[\r\n\t]/g,' ').replace(/@/g,'＠').replace(/[\\*_`~|<>\[\]()]/g,'').slice(0,max);}
export function slotBoard(hunt:string,calls:BoardCall[],entries:BoardEntry[]):Record<string,BoardPayload[]>{
 const rows=entries.filter(e=>!e.call_id.startsWith('manual:'));
 const groups=[{key:'live',title:'🎰 Live slot calls',color:0x9b59b6,lines:calls.map(c=>`${c.picked_at?'▶ Playing · ':''}**${clean(c.slot_name,120)}** — ${clean(c.username,100)}`)},
 {key:'got',title:'✅ Got in',color:0x2ecc71,lines:rows.filter(e=>e.status==='collected').map(e=>`**${clean(e.slot_name,120)}** — ${clean(e.username,100)}${e.bonus_tier==='super'?' · Super':e.bonus_tier==='super_super'?' · Super Super':''}`)},
 {key:'failed',title:'❌ Failed',color:0xe74c3c,lines:rows.filter(e=>e.status==='failed').map(e=>`**${clean(e.slot_name,120)}** — ${clean(e.username,100)}`)}];
 return Object.fromEntries(groups.map(g=>{
  const pages:string[][]=[[]];for(const line of g.lines){let p=pages[pages.length-1];if(p.join('\n').length+line.length+1>3500){p=[];pages.push(p);}p.push(line);}
  return [g.key,pages.map((lines,i)=>({allowed_mentions:{parse:[]},embeds:[{title:g.title+(pages.length>1?` · ${i+1}/${pages.length}`:''),description:lines.join('\n')||'No slots yet.',color:g.color,footer:{text:`${clean(hunt||'No active slot picker hunt',140)} · ${g.lines.length} slots · Updates automatically`}}]}))];
 }));
}
