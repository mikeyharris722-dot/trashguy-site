const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const Module = require('node:module');
const source = ts.transpileModule(fs.readFileSync('lib/claw-music.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod = new Module('claw-music'); mod._compile(source,'claw-music.js');
const {ClawMusic,CLAW_MUSIC_KEY} = mod.exports;
global.window = new EventTarget();
global.KeyboardEvent = class extends Event { constructor(type, key='Enter') {super(type);this.key=key;this.repeat=false;} };
const storage = new Map();
global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
class AudioMock extends EventTarget {
 constructor(outcomes=[]) {super();this.outcomes=outcomes;this.calls=0;this.paused=true;this.currentTime=42;}
 async play() {this.calls++; const result=this.outcomes.shift(); if(result instanceof Error)throw result; if(result)await result; this.paused=false;}
 pause(){this.paused=true;}
 removeAttribute(name){if(name==='src')this.src='';}
 load(){this.loaded=true;}
}
const blocked=()=>Object.assign(new Error('blocked'),{name:'NotAllowedError'});
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 let states=[],a=new AudioMock(),p=new ClawMusic(a,s=>states.push(s));
 assert.equal(a.volume,.2);assert.equal(a.loop,true);await p.play();assert.equal(states.at(-1).status,'playing');
 p.setVolume(.35);assert.equal(a.currentTime,42);assert.equal(a.calls,1);p.toggleMute();assert.equal(a.paused,true);
 p.destroy();assert.equal(a.src,'');assert.equal(a.loaded,true);
 a=new AudioMock();p=new ClawMusic(a,s=>states.push(s));await p.play();assert.equal(a.calls,0);assert.equal(a.volume,.35);assert.equal(states.at(-1).status,'muted');
 p.toggleMute();await flush();assert.equal(a.calls,1);assert.equal(a.currentTime,42);p.destroy();
 storage.clear();a=new AudioMock([blocked(),blocked()]);p=new ClawMusic(a,s=>states.push(s));await p.play();assert.equal(states.at(-1).status,'waiting');
 window.dispatchEvent(new KeyboardEvent('keydown','Shift'));assert.equal(a.calls,1);
 window.dispatchEvent(new Event('click'));await flush();assert.equal(states.at(-1).status,'blocked');assert.equal(a.calls,2);
 window.dispatchEvent(new Event('click'));await flush();assert.equal(a.calls,2);p.enable();await flush();assert.equal(states.at(-1).status,'playing');p.destroy();
 a=new AudioMock([blocked()]);p=new ClawMusic(a,s=>states.push(s));await p.play();window.dispatchEvent(new KeyboardEvent('keydown'));await flush();assert.equal(states.at(-1).status,'playing');p.destroy();
 a=new AudioMock([blocked()]);p=new ClawMusic(a,s=>states.push(s));await p.play();p.destroy();window.dispatchEvent(new Event('click'));await flush();assert.equal(a.calls,1);
 let resolve; a=new AudioMock([new Promise(r=>resolve=r)]);p=new ClawMusic(a,s=>states.push(s));const pending=p.play();void p.play();assert.equal(a.calls,1);p.destroy();resolve();await pending;assert.equal(a.paused,true);
 storage.set(CLAW_MUSIC_KEY,'broken');a=new AudioMock();p=new ClawMusic(a,()=>{});assert.equal(a.volume,.2);p.destroy();
 console.log('PASS: initial autoplay, loop flag, 20% default, controls preserve playhead, saved mute/volume, click and keyboard retry, Enable sound fallback, pending-play deduplication and navigation cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
