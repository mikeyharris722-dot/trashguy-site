"use client";
import { useState } from "react";
import { siteFetch } from "@/lib/site-fetch";
import {
  prizeTotal,
  validatePrizeSettings,
  type PrizeSettings,
} from "@/lib/prize-settings";
const dollars = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export default function PrizeSettingsEditor({
  settings,
  saved,
}: {
  settings: PrizeSettings;
  saved: (settings: PrizeSettings) => void;
}) {
  const [amounts, setAmounts] = useState(settings.leaderboard.map(String));
  const [prediction, setPrediction] = useState(
    String(settings.predictionPrize),
  );
  const [start, setStart] = useState(settings.leaderboardStart);
  const [end, setEnd] = useState(settings.leaderboardEnd);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const preview = {
    leaderboard: amounts.map(Number),
    predictionPrize: Number(prediction),
    leaderboardStart: start,
    leaderboardEnd: end,
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      if ([...amounts, prediction].some((value) => !value.trim()))
        throw Error("Fill every prize amount. Use 0 for places with no prize.");
      const next = validatePrizeSettings(preview);
      setBusy(true);
      const response = await siteFetch("/api/prize-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: next,
          requestId: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Could not save prize settings.");
      saved(data.settings);
      setMessage(
        "Prize settings saved. The public leaderboard has updated. New community hunts will use this prediction prize.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-panel prize-editor">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Public prize amounts</p>
          <h2>Prizes & payouts</h2>
          <p>
            Set the amounts visitors see. Existing rewards, claims and community
            hunt prizes keep their recorded values.
          </p>
        </div>
        <div className="prize-pool">
          <span>Leaderboard prize pool</span>
          <strong>{dollars(prizeTotal(preview))}</strong>
        </div>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="competition-settings">
          <legend>Site leaderboard schedule</legend>
          <p>
            Choose Trashguy’s own competition period. The dates control both the
            standings requested from Roulo and this site’s countdown; they do
            not change Roulo’s competition.
          </p>
          <div className="prize-fields">
            <label>
              Start date (UTC)
              <input
                type="date"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label>
              End date (UTC)
              <input
                type="date"
                required
                min={start || undefined}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
          </div>
          <small>The period starts and ends at 00:00 UTC on these dates.</small>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Leaderboard places</legend>
          <div className="prize-fields">
            {amounts.map((amount, index) => (
              <label key={index}>
                Place {index + 1}
                <div className="money-field">
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(event) =>
                      setAmounts((old) =>
                        old.map((value, place) =>
                          place === index ? event.target.value : value,
                        ),
                      )
                    }
                  />
                </div>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="prediction-prize-field">
          Closest prediction prize ($)
          <input
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            required
            disabled={busy}
            value={prediction}
            onChange={(event) => setPrediction(event.target.value)}
          />
          <small>
            Used for the bonus hunt prediction banner and saved onto newly
            created community hunts. Set 0 to show no cash prize.
          </small>
        </label>
        <div className="form-footer">
          <p>
            Leaderboard total is calculated automatically. Saving these settings
            does not issue a payment.
          </p>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Save prize amounts"}
          </button>
        </div>
        {message && (
          <p className="form-feedback" role="status">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
