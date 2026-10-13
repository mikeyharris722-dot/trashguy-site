export function trackerCaller(entry:{call_id?:string|null;username?:string|null}):string {
 const id=entry.call_id||'',name=(entry.username||'').trim();
 if(id.startsWith('manual:')&&!id.startsWith('manual:viewer:'))return '';
 return name==='Manual'&&!id?'':name;
}
