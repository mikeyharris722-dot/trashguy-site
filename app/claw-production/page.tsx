"use client";
import { startPolling } from "@/lib/polling";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CLAW_PRODUCTION_MS, CLAW_PRODUCTION_MOVIE, SCOTLAND_MS, productionMovie, productionAge, productionIsActive, type ProductionEvent } from "@/lib/claw-production";
import "./production.css";

const subscribe = () => () => {};
const FADE_SECONDS = 0.25;

export default function ClawProductionOverlay() {
  const preview = useSyncExternalStore(subscribe,
    () => new URLSearchParams(window.location.search).get("preview") === "1", () => false);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const lastSeen = useRef("");
  const generation = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<ProductionEvent | null>(null);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState("");

  const finish = useCallback(() => {
    generation.current++;
    current.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    video.current?.pause();
    if (frame.current) frame.current.style.opacity = "0";
    setActive(false);
  }, []);

  // Use media time, so fades also work when OBS joins partway through an intro.
  useEffect(() => {
    if (!active) return;
    let animation = 0;
    const draw = () => {
      const element = video.current;
      if (element && frame.current) {
        const duration = Number.isFinite(element.duration) ? element.duration : 9;
        const opacity = Math.max(0, Math.min(1,
          element.currentTime / FADE_SECONDS,
          (duration - element.currentTime) / FADE_SECONDS));
        frame.current.style.opacity = String(opacity);
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [active]);

  const start = useCallback(async (event: ProductionEvent, age: number) => {
    const element = video.current;
    if (!element || age < 0 || age >= event.durationMs) return;
    const token = ++generation.current;
    const invokedAt = performance.now();
    current.current = event;
    if (timeout.current) clearTimeout(timeout.current);
    element.pause();
    element.muted = false;
    element.volume = Math.max(0,Math.min(1,event.volume ?? (event.clip==='scotland'?1:0.7)));
    const source = productionMovie(event);
    if (element.getAttribute('src') !== source) { element.src = source; element.load(); }
    setMuted(false);
    setMessage("");
    setActive(true);
    timeout.current = setTimeout(finish, Math.max(0, event.durationMs - age));
    try {
      if (element.readyState < 1) await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); reject(Error("Movie is not ready.")); }, 8000);
        const cleanup = () => {
          clearTimeout(timer);
          element.removeEventListener("loadedmetadata", loaded);
          element.removeEventListener("error", failed);
        };
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(Error("Movie failed to load.")); };
        element.addEventListener("loadedmetadata", loaded, { once: true });
        element.addEventListener("error", failed, { once: true });
        element.load();
      });
      if (token !== generation.current) return;
      const position = (age + performance.now() - invokedAt) / 1000;
      if (position >= element.duration) { finish(); return; }
      element.currentTime = position;
      await element.play();
      if (token !== generation.current && !current.current) element.pause();
    } catch (error) {
      if (token !== generation.current) return;
      if (!(error instanceof DOMException) || error.name !== "NotAllowedError") { setMessage("Movie unavailable. Check the media source."); finish(); return; }
      try {
        element.muted = true;
        setMuted(true);
        setMessage("Browser blocked sound. Allow sound for this site or enable it below.");
        await element.play();
      } catch {
        setMessage("The movie could not play. Check the media source.");
        finish();
      }
    }
  }, [finish]);

  useEffect(() => {
    let disposed = false;
    let busy = false;
    const abort = new AbortController();
    async function poll() {
      if (disposed || busy || preview) return;
      busy = true;
      try {
        const response = await fetch("/api/claw-production?overlay=1", { cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]) });
        if (!response.ok) return false;
        const body = await response.json();
        if (disposed) return;
        const event = body.event as ProductionEvent | null;
        if (!event) { if (current.current) finish(); return; }
        if (event.id === lastSeen.current) return;
        if (Date.parse(event.startedAt) > body.serverNow) return;
        lastSeen.current = event.id;
        if (productionIsActive(event, body.serverNow)) void start(event, productionAge(event, body.serverNow));
      } catch { return false; /* Back off without replaying a seen event. */ }
      finally { busy = false; }
    }
    const stop = startPolling(poll, 500, {visibleOnly:false});
    return () => { disposed = true; abort.abort(); stop(); finish(); };
  }, [finish, start, preview]);

  return <main className={"production-overlay" + (active ? " production-active" : "") + (preview ? " production-preview-mode" : "")} aria-label="Trash Claw production overlay">
    <div ref={frame} className="production-frame" aria-hidden={!active}>
      <video ref={video} src={CLAW_PRODUCTION_MOVIE} preload="auto" playsInline
        onEnded={finish} onError={() => { if (current.current) { setMessage("Movie unavailable."); finish(); } }}
        aria-label="Trash Claw intro" />
    </div>
    {preview && <aside className="production-preview-tools">
      <strong>Production overlay test</strong>
      <p>Only this tab plays. This does not trigger OBS or change a giveaway.</p>
      <button disabled={active} onClick={() => void start({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), durationMs: CLAW_PRODUCTION_MS }, 0)}>▶ Play preview with sound</button>
      <button disabled={active} onClick={() => void start({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), durationMs: SCOTLAND_MS, clip: 'scotland', volume: 1 }, 0)}>▶ Play Scotland with sound</button>
      <button onClick={finish}>Stop / return to transparent</button>
      {muted && <button onClick={() => {
        const element = video.current;
        if (element) { element.muted = false; void element.play().then(() => { setMuted(false); setMessage("Sound enabled."); }, () => setMessage("Allow sound for this site in your browser.")); }
      }}>Enable sound</button>}
      {message && <p role="status">{message}</p>}
      <Link href="/#admin">Back to Admin</Link>
    </aside>}
  </main>;
}
