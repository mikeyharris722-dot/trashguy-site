"use client";
import { useState } from "react";
import {
  huntTimeZones,
  scheduleLabel,
} from "@/lib/community-schedule";
export function ScheduleFields({
  value,
  zone,
  onValue,
  onZone,
}: {
  value: string;
  zone: string;
  onValue: (v: string) => void;
  onZone: (v: string) => void;
}) {
  return (
    <div className="schedule-fields">
      <label>
        Start date and time <span className="optional-label">Optional</span>
        <input
          aria-label="Hunt start date and time"
          type="datetime-local"
          value={value}
          onChange={(e) => onValue(e.target.value)}
        />
      </label>
      <label>
        Time zone
        <select
          aria-label="Hunt time zone"
          value={zone}
          onChange={(e) => onZone(e.target.value)}
        >
          {huntTimeZones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <p>
        The date is shown to players before they join. Registration stays open
        until you begin opening bonuses.
      </p>
    </div>
  );
}
export function ScheduleCard({
  scheduledAt,
  timeZone,
  phase,
}: {
  scheduledAt: string | null;
  timeZone: string;
  phase: string;
}) {
  return (
    <section className="hunt-schedule-card">
      <span aria-hidden="true" className="calendar-symbol">
        ◷
      </span>
      <div>
        <p className="eyebrow">
          {phase === "finished"
            ? "Hunt completed"
            : scheduledAt
              ? "Scheduled hunt"
              : "Hunt schedule"}
        </p>
        <h2>
          {scheduledAt ? (
            <time dateTime={scheduledAt}>
              {scheduleLabel(scheduledAt, timeZone)}
            </time>
          ) : (
            "Start time to be announced"
          )}
        </h2>
        <p>
          {scheduledAt
            ? `Time zone: ${timeZone.replaceAll("_", " ")}`
            : "The streamer will confirm the start time here."}
          {phase === "collecting"
            ? " · Registration is open."
            : phase === "opening"
              ? " · Bonuses are being opened; registration is closed."
              : " · View the results below."}
        </p>
      </div>
    </section>
  );
}
export function CommunitySettings({
  hunt,
  busy,
  save,
}: {
  hunt: {
    currency?: string;
    catalogue?: "rainbet" | "roulobets";
    equityRate?: string | null;
    phase?: string;
    members?: {status:string}[];
    entries?: {payout:string|null}[];
    title: string;
    limit: number;
    scheduledAt: string | null;
    timeZone: string;
  };
  busy: boolean;
  save: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [catalogue, setCatalogue] = useState(hunt.catalogue || "rainbet");
  const [title, setTitle] = useState(hunt.title),
    [limit, setLimit] = useState(String(hunt.limit)),
    [error, setError] = useState("");
  const rateLocked = hunt.phase === 'finished' || (!!hunt.equityRate && (hunt.phase !== 'collecting' || !!hunt.entries?.some(e=>e.payout !== null) || !!hunt.members?.some(m=>m.status === 'accepted')));
  return (
    <details className="community-settings">
      <summary>Edit hunt details</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await save({
              title,
              catalogue,
              limit: Number(limit),
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Check the schedule.");
          }
        }}
      >
        <div className="hunt-create-row">
          <label>
            Hunt name
            <input
              required
              maxLength={160}
              aria-label="Edit community hunt name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Call spaces per player
            <input
              aria-label="Edit call spaces per player"
              type="number"
              min={1}
              max={10}
              required
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
        </div>

        <div className="hunt-create-row community-catalogue-row">
          <label>
            Slot catalogue
            <select aria-label="Edit community slot catalogue" value={catalogue}
              disabled={busy || hunt.phase === 'finished'}
              onChange={e => setCatalogue(e.target.value as 'rainbet' | 'roulobets')}>
              <option value="rainbet">Rainbet</option>
              <option value="roulobets">Roulobets</option>
            </select>
          </label>
          <p className="text-xs text-white/60 self-center">
            {hunt.phase === 'finished' ? 'Reopen the hunt to change its catalogue.' : 'Matching queued calls stay; unavailable calls are removed when you save. Collected bonuses and contributions stay unchanged.'}
          </p>
        </div>

        {(hunt.currency || 'USD') !== 'USD' && <div className="hunt-create-row">
          <div className="text-xs text-white/70 self-center">
            <p>{hunt.equityRate ? `Saved rate · 1 USD = ${Number(hunt.equityRate).toLocaleString('en-US',{maximumFractionDigits:6})} ${hunt.currency}` : 'No saved exchange rate yet.'}</p>
            <p>{rateLocked ? 'Locked for this hunt.' : 'Latest available rate · locked after the first approval. Existing contributions remain USD.'}</p>
          </div>
          {!rateLocked && <button type="button" className="primary-button" disabled={busy} onClick={()=>void save({title,limit:Number(limit),refreshEquityRate:true})}>{busy ? 'Looking up…' : hunt.equityRate ? 'Update exchange rate' : 'Get latest exchange rate'}</button>}
        </div>}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Saving…" : "Save hunt details"}
        </button>
      </form>
    </details>
  );
}
