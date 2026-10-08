"use client";
import { useState } from "react";
import {
  huntTimeZones,
  localScheduleToUtc,
  scheduleInput,
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
    title: string;
    limit: number;
    scheduledAt: string | null;
    timeZone: string;
  };
  busy: boolean;
  save: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(hunt.title),
    [limit, setLimit] = useState(String(hunt.limit)),
    [zone, setZone] = useState(hunt.timeZone),
    [when, setWhen] = useState(scheduleInput(hunt.scheduledAt, hunt.timeZone)),
    [error, setError] = useState("");
  return (
    <details className="community-settings">
      <summary>Edit hunt details and schedule</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await save({
              title,
              limit: Number(limit),
              timeZone: zone,
              scheduledAt: localScheduleToUtc(when, zone),
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
        <ScheduleFields
          value={when}
          zone={zone}
          onValue={setWhen}
          onZone={setZone}
        />
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
