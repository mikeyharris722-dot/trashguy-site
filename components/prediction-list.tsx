"use client";
import { useState } from "react";
type Prediction = {
  id: string;
  username: string;
  guess: number;
  createdAt: string | null;
};
export default function PredictionList({
  entries,
  viewer,
}: {
  entries: Prediction[];
  viewer: string;
}) {
  const [sort, setSort] = useState("newest"),
    [limit, setLimit] = useState(8);
  const sorted = [...entries].sort((a, b) =>
    sort === "highest"
      ? b.guess - a.guess
      : (b.createdAt || "").localeCompare(a.createdAt || ""),
  );
  return (
    <section className="workspace-panel prediction-list">
      <div className="workspace-heading">
        <div>
          <h2>Predictions</h2>
          <p>
            {entries.length} {entries.length === 1 ? "entry" : "entries"} · Your
            saved prediction is highlighted.
          </p>
        </div>
        <label>
          Sort predictions
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setLimit(8);
            }}
          >
            <option value="newest">Newest first</option>
            <option value="highest">Highest amount</option>
          </select>
        </label>
      </div>
      {!sorted.length ? (
        <p className="empty-state">No predictions saved yet.</p>
      ) : (
        <ol>
          {sorted.slice(0, limit).map((entry, index) => (
            <li
              className={
                entry.username.toLowerCase() === viewer.toLowerCase()
                  ? "prediction-mine"
                  : ""
              }
              key={entry.id}
            >
              <span className="table-rank">{index + 1}</span>
              <span>
                {entry.username}
                {entry.username.toLowerCase() === viewer.toLowerCase() && (
                  <small> You</small>
                )}
              </span>
              <strong>
                {entry.guess.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </strong>
            </li>
          ))}
        </ol>
      )}
      {sorted.length > limit && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => setLimit(limit + 20)}
        >
          Show more predictions ({sorted.length - limit} remaining)
        </button>
      )}
    </section>
  );
}
