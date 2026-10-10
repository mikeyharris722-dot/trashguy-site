"use client";
import { useEffect, useRef, useState } from "react";
import { ClawMusic, type MusicState } from "@/lib/claw-music";

export default function ClawMusicControls() {
  const player = useRef<ClawMusic | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<MusicState>({ volume: 0.2, muted: false, status: "starting" });
  useEffect(() => {
    if (!audio.current) return;
    const music = new ClawMusic(audio.current, setState);
    player.current = music;
    const initial = setTimeout(() => void music.play(), 0);
    return () => { clearTimeout(initial); music.destroy(); player.current = null; };
  }, []);
  return <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-purple-200/65" aria-label="Trash Claw background music">
    <audio ref={audio} hidden aria-hidden="true" />
    <span>Music</span>
    <button type="button" aria-label={state.muted ? "Unmute music" : "Mute music"} aria-pressed={state.muted}
      className="rounded-md border border-purple-300/20 bg-purple-500/10 px-2 py-1 hover:bg-purple-500/20" onClick={() => player.current?.toggleMute()}>
      {state.muted ? "Unmute" : "Mute"}
    </button>
    <input type="range" min="0" max="100" step="1" value={Math.round(state.volume * 100)} aria-label="Music volume"
      className="h-4 w-24 accent-purple-400" onChange={e => player.current?.setVolume(Number(e.target.value) / 100)} />
    <span className="w-7 tabular-nums">{Math.round(state.volume * 100)}%</span>
    {state.status === "blocked" && <button type="button" className="rounded-md border border-purple-300/30 px-2 py-1 text-purple-100" onClick={() => player.current?.enable()}>Enable sound</button>}
    <span role="status" aria-live="polite">{state.status === "waiting" ? "Sound starts on your next interaction" : state.status === "error" ? "Music unavailable — reload to retry" : ""}</span>
  </div>;
}
