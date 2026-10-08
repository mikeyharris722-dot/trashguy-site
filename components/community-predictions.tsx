"use client";
import { useState } from "react";
type Prediction = {
  username: string;
  amount: string;
  mine: boolean;
  createdAt: string;
};
export type PredictionHunt = {
  id: string;
  phase: string;
  prediction_status: string;
  predictionPrize: number;
  predictions: Prediction[];
  stats: { totalWinnings: number };
};
const money = (amount: number) =>
  amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
export default function CommunityPredictions({
  hunt,
  admin,
  signedIn,
  busy,
  command,
}: {
  hunt: PredictionHunt;
  admin: boolean;
  signedIn: boolean;
  busy: boolean;
  command: (action: string, extra: Record<string, unknown>) => Promise<unknown>;
}) {
  const mine = hunt.predictions.find((prediction) => prediction.mine);
  const [amount, setAmount] = useState(mine?.amount || ""),
    [expanded, setExpanded] = useState(false);
  const open = hunt.phase === "collecting" && hunt.prediction_status === "open";
  const finished = hunt.phase === "finished";
  const ranked = [...hunt.predictions].sort((a, b) =>
    finished
      ? Math.abs(Number(a.amount) - hunt.stats.totalWinnings) -
          Math.abs(Number(b.amount) - hunt.stats.totalWinnings) ||
        a.createdAt.localeCompare(b.createdAt)
      : a.createdAt.localeCompare(b.createdAt),
  );
  return (
    <section className="workspace-panel community-predictions">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Community predictions</p>
          <h2>Guess the final bonus total</h2>
          <p>
            Predict the total returned by all collected bonuses. One prediction
            per Twitch account; edit yours until predictions close.
            Equal-distance ties go to the earlier first entry.
          </p>
        </div>
        <span className={`status-chip ${open ? "status-open" : ""}`}>
          {finished
            ? "Results final"
            : open
              ? "Predictions open"
              : "Predictions closed"}
        </span>
      </div>
      <div className="prediction-summary">
        <div>
          <span>Closest prediction prize</span>
          <strong>
            {hunt.predictionPrize > 0
              ? money(hunt.predictionPrize)
              : "No cash prize"}
          </strong>
        </div>
        <div>
          <span>Entries</span>
          <strong>{ranked.length}</strong>
        </div>
        <div>
          <span>{finished ? "Final bonus total" : "Returned so far"}</span>
          <strong>{money(hunt.stats.totalWinnings)}</strong>
        </div>
      </div>
      {admin && hunt.phase === "collecting" && (
        <div className="prediction-admin">
          <p>Close entries before revealing any bonus results.</p>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => void command("predictionStatus", { closed: open })}
          >
            {open ? "Close predictions" : "Reopen predictions"}
          </button>
        </div>
      )}
      {finished && ranked.length > 0 && (
        <div className="prediction-winner">
          <span>Closest prediction</span>
          <strong>{ranked[0].username}</strong>
          <p>
            {money(Number(ranked[0].amount))} · off by{" "}
            {money(
              Math.abs(Number(ranked[0].amount) - hunt.stats.totalWinnings),
            )}
          </p>
          {admin && (
            <small>
              Confirm and record this prize in the Prize Portal. Results do not
              create a payment automatically.
            </small>
          )}
        </div>
      )}
      {signedIn && open ? (
        <form
          className="prediction-form"
          onSubmit={(event) => {
            event.preventDefault();
            void command("predict", { amount });
          }}
        >
          <label>
            Your prediction ($)
            <input
              required
              type="number"
              inputMode="decimal"
              min="0"
              max="1000000"
              step="0.01"
              value={amount}
              disabled={busy}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 1,250.00"
            />
            <small>
              {mine
                ? `Your saved prediction: ${money(Number(mine.amount))}`
                : "You can predict without contributing to the hunt."}
            </small>
          </label>
          <button className="primary-button" disabled={busy || amount === ""}>
            {busy ? "Saving…" : mine ? "Update prediction" : "Save prediction"}
          </button>
        </form>
      ) : (
        <p className="prediction-help">
          {!signedIn && open
            ? "Sign in with Twitch at the top to enter your prediction."
            : !finished
              ? "Entries are locked. Saved predictions remain visible below."
              : "This hunt has finished. See the final results above."}
        </p>
      )}
      <div className="prediction-list">
        <h3>{finished ? "Final rankings" : "Saved predictions"}</h3>
        {!ranked.length ? (
          <p className="empty-state">No predictions yet.</p>
        ) : (
          <ol>
            {(expanded ? ranked : ranked.slice(0, 6)).map(
              (prediction, index) => (
                <li key={prediction.username + prediction.createdAt}>
                  <span className="table-rank">{index + 1}</span>
                  <span>
                    {prediction.username}
                    {prediction.mine && <small> You</small>}
                  </span>
                  <strong>{money(Number(prediction.amount))}</strong>
                  {finished && (
                    <small>
                      Off by{" "}
                      {money(
                        Math.abs(
                          Number(prediction.amount) - hunt.stats.totalWinnings,
                        ),
                      )}
                    </small>
                  )}
                </li>
              ),
            )}
          </ol>
        )}
        {ranked.length > 6 && (
          <button
            type="button"
            className="secondary-button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? "Show fewer predictions"
              : `View all ${ranked.length} predictions`}
          </button>
        )}
      </div>
    </section>
  );
}
