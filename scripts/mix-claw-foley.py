"""Mix licensed recorded foley into short, non-musical prize-name effects."""
from pathlib import Path
import subprocess,numpy as np,wave
SR=48000;MAX=SR*4;root=Path('.local/claw-foley');out=Path('public/claw-reveal/v3');out.mkdir(parents=True,exist_ok=True)
cache={};used=set()
def sample(pack,name,rate=1):
 file=root/(pack+'/Audio/'+name+'.ogg' if pack in ['casino','rpg','impact'] else name+'.mp3');used.add(str(file))
 key=(str(file),rate)
 if key not in cache:
  pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-f','f32le','-ac','1','-ar',str(SR),'-'])
  a=np.frombuffer(pcm,dtype='<f4').copy();active=np.where(abs(a)>.008)[0]
  if len(active):a=a[max(0,active[0]-int(SR*.008)):min(len(a),active[-1]+int(SR*.035))]
  if rate!=1:a=np.interp(np.arange(0,len(a),rate),np.arange(len(a)),a)
  a=a/max(abs(a).max(),.001);cache[key]=a
 return cache[key].copy()
def mix(events,key):
 a=np.zeros((MAX,2));end=0
 for pack,name,at,gain,pan,rate,limit in events:
  s=sample(pack,name,rate)
  if limit:s=s[:int(SR*limit)]
  fade=min(int(SR*.006),len(s)//2);s[:fade]*=np.linspace(0,1,fade);s[-fade:]*=np.linspace(1,0,fade)
  i=int(at*SR);n=min(len(s),MAX-i);s=s[:n]*gain;a[i:i+n,0]+=s*np.sqrt((1-pan)/2);a[i:i+n,1]+=s*np.sqrt((1+pan)/2);end=max(end,i+n)
 a=a[:min(MAX,end+int(SR*.06))];a=np.tanh(a*.85);a*=.82/max(abs(a).max(),.001)
 fade=min(int(SR*.012),len(a)//2);a[:fade]*=np.linspace(0,1,fade)[:,None];a[-fade:]*=np.linspace(1,0,fade)[:,None]
 file=out/(key+'.wav')
 with wave.open(str(file),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((a*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(file),'-c:a','libmp3lame','-b:a','160k',str(out/(key+'.mp3'))],check=True);file.unlink();print(key,round(len(a)/SR,2),'s')
def e(pack,name,at=0,gain=1,pan=0,rate=1,limit=None):return (pack,name,at,gain,pan,rate,limit)
mix([e('rpg','handleCoins',0,.75,-.3),e('extra','cash-register',.3,.9,.2)],'cash')
mix([e('casino','chips-stack-2',0,.85,-.4),e('casino','chips-stack-5',.45,1,.4)],'double')
mix([e('casino','chips-handle-2',0,.8,-.2),e('casino','chip-lay-1',.5,.45,.35),e('rpg','dropLeather',.85,.5,0)],'loss')
mix([e('extra','phone',0,.75,0,1,2.2)],'trash-call')
mix([e('rpg','metalClick',0,.35,-.2),e('extra','radio',.15,.8,.1,1,1.25)],'mod-call')
mix([e('casino','card-shuffle',0,.7,-.3,limit=.7),e('casino','card-fan-1',.45,.7,.2),e('casino','card-place-1',.85,.9,0)],'slot-picker')
mix([e('casino','chips-handle-4',0,.8,-.25),e('casino','chips-stack-4',.4,.95,.3)],'boost')
mix([e('casino','card-fan-2',0,.8,-.45),e('casino','card-place-2',.3,.65,.35),e('casino','chips-stack-3',.5,.8,0),e('casino','dice-throw-2',.75,.65,.25)],'tables')
mix([e('casino','card-slide-1',0,.8,-.6),e('casino','card-slide-4',.3,.8,.6),e('casino','card-place-3',.68,1,0)],'choice')
events=[e('rpg','metalLatch',0,.65)]
for i,t in enumerate([.13,.19,.25,.31,.38,.46,.55,.65,.77,.91,1.08]):events.append(e('rpg','metalClick',t,.2+(i/40),(-1 if i%2 else 1)*.25,1+(i%3)*.04,.075))
for t,p in [(1.2,-.5),(1.43,0),(1.66,.5)]:events.append(e('impact','impactWood_medium_001',t,.6,p,1,.2))
mix(events,'feature-spins')
mix([e('casino','cards-pack-open-1',0,.7,-.2),e('casino','cards-pack-take-out-1',.4,.8,.2)],'prize')
Path('.local/claw-foley/used-sources.txt').write_text('\n'.join(sorted(used)),encoding='utf-8')
