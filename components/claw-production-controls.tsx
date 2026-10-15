"use client";

import { useEffect, useRef, useState } from "react";
import { siteFetch } from "@/lib/site-fetch";
import { productionIsActive, type ProductionEvent } from "@/lib/claw-production";

export default function ClawProductionControls() {
  const [event, setEvent] = useState<ProductionEvent | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    let stopped = false;
    let polling = false;
    const controller = new AbortController();
    const load = async () => {
      if (polling) return;
      polling = true;
      try {
        const response = await fetch("/api/claw-production", {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) return;
        const body = await response.json();
        if (!stopped) {
          setEvent(body.event);
          setNow(body.serverNow);
        }
      } catch { /* The command reports actionable errors. */ }
      finally { polling = false; }
    };
    void load();
    const poll = setInterval(load, 1000);
    const clock = setInterval(() => setNow(n => n + 250), 250);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  const active = productionIsActive(event, now);
  async function command(action: "play" | "stop") {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    if (action === "play") request.current ??= crypto.randomUUID();
    try {
      const response = await siteFetch("/api/claw-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId: request.current }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Production could not start.");
      setEvent(body.event);
      setNow(body.serverNow);
      request.current = null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Production could not start. Retry safely.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="giveaway-production-actions" role="group" aria-label="Trash Claw production">
      <button type="button" className="production-launch" disabled={busy || active}
        onClick={() => void command("play")} title="Play the Trash Claw intro in OBS">
        {busy ? "SENDING…" : active ? "ON AIR" : "▶ PRODUCTION"}
      </button>
      {active && <button type="button" className="production-stop" disabled={busy}
        onClick={() => void command("stop")}>Stop</button>}
      {message && <p className="production-inline-message" role="status">{message}</p>}
    </div>
  );
}
