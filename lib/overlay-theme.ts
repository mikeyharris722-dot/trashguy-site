export const DEFAULT_OVERLAY_ACCENT = '#075D5E';
export function overlayAccent(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
    throw Error('Enter a six-digit hex colour, such as #00D4FF.');
  return value.toUpperCase();
}
export function overlayTheme(value: unknown): Record<string,string> {
  let accent: string;
  try { accent = overlayAccent(value); } catch { return {}; }
  if (accent === DEFAULT_OVERLAY_ACCENT) return {};
  const rgb=[1,3,5].map(i=>parseInt(accent.slice(i,i+2),16));
  const mix=(white:boolean,amount:number)=>'#'+rgb.map(c=>Math.round(c*(1-amount)+(white?255:0)*amount).toString(16).padStart(2,'0')).join('');
  const linear=rgb.map(c=>{const s=c/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
  const luminance=linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
  return {'--hunt-accent':accent,'--hunt-header-text':luminance>.179?'#000000':'#FFFFFF',
    '--hunt-border':mix(false,.55),'--hunt-current':mix(false,.70),
    '--hunt-highlight':mix(true,.65),'--hunt-latest':mix(false,.78)};
}
