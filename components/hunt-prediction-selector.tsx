"use client";
import { startPolling } from "@/lib/polling";
import { useCallback, useEffect, useRef, useState } from "react";
import { siteFetch } from "@/lib/site-fetch";
import CommunityBonusList, { type CommunityBonus } from "./community-bonus-list";
import CommunityHuntSummary from "./community-hunt-summary";
import CommunityPredictions, {
  type PredictionHunt,
} from "./community-predictions";
type Community = PredictionHunt & { title: string; startCost?:number; casino?:string; bonuses?: CommunityBonus[] };
export default function HuntPredictionSelector({
  hunts,
  selectedId,
  activeId,
  signedIn,
  admin,
  onSelect,
}: {
  hunts: { localId?: string; title: string }[];
  selectedId: string;
  activeId: string;
  signedIn: boolean;
  admin: boolean;
  onSelect: (id: string, community: boolean) => void;
}) {
  const [historyQuery, setHistoryQuery] = useState("");
  const [community, setCommunity] = useState<Community[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    const r = await siteFetch("/api/community", { cache: "no-store", signal });
    if (!(r.headers.get('content-type') || '').includes('application/json'))
      throw Error('Community hunts are temporarily unavailable. Retrying…');
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Could not load community hunts");
    setCommunity(d.hunts || []);
    setError("");
  }, []);
  useEffect(() => {
    const c = new AbortController();
    const refresh = () => {
      return load(c.signal).catch((e) => {
        if (!c.signal.aborted) setError(e.message);
        return false;
      });
    };
    const timer = startPolling(refresh, 5000);
    return () => {
      c.abort();
      timer();
    };
  }, [load, signedIn]);
  const initialSelection = useRef(false);
  useEffect(() => {
    if (initialSelection.current || !activeId) return;
    const isCommunity = community.some((h) => h.id === activeId);
    if (isCommunity || hunts.some((h) => h.localId === activeId)) {
      initialSelection.current = true;
      onSelect(activeId, isCommunity);
    }
  }, [activeId, community, hunts, onSelect]);
  const selected = community.find((h) => h.id === selectedId);
  const pendingCommand = useRef(false);
  async function command(action: string, extra: Record<string, unknown>) {
    if (pendingCommand.current) return;
    pendingCommand.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await siteFetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          huntId: selectedId,
          requestId: crypto.randomUUID(),
          ...extra,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Could not save prediction");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save prediction");
    } finally {
      pendingCommand.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="hunt-history-controls">
        <label className="hunt-filter">Find a hunt<input type="search" placeholder="Search hunt names" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} /></label>
        <label>
          Choose a bonus hunt
          <select
            aria-label="Choose bonus hunt from history"
            value={selectedId}
            onChange={(e) =>
              onSelect(
                e.target.value,
                community.some((h) => h.id === e.target.value),
              )
            }
          >
            <option value="" disabled>
              Choose a hunt
            </option>
            <optgroup label="Wheel and manual hunts">
              {[...hunts].filter((h) => h.localId === selectedId || h.localId === activeId || h.title.toLowerCase().includes(historyQuery.toLowerCase())).sort((a,b) => Number(b.localId === activeId) - Number(a.localId === activeId)).map((h) => (
                <option key={h.localId} value={h.localId}>
                  {h.title}
                  {h.localId === activeId ? " · Active" : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="Community hunts">
              {[...community].filter((h) => h.id === selectedId || h.id === activeId || h.title.toLowerCase().includes(historyQuery.toLowerCase())).sort((a,b) => Number(b.id === activeId) - Number(a.id === activeId)).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title}
                  {h.id === activeId ? " · Active" : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {selected && (
        <CommunityPredictions
          key={selected.id}
          hunt={selected}
          summary={<CommunityHuntSummary hunt={selected}/>}
          slots={<CommunityBonusList bonuses={selected.bonuses} currency={selected.currency}/>}
          admin={admin}
          signedIn={signedIn}
          busy={busy}
          command={command}
        />
      )}
    </>
  );
}
