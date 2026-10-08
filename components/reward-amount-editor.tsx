"use client";
import { useState } from "react";
import { siteFetch } from "@/lib/site-fetch";
export default function RewardAmountEditor({
  id,
  amount,
  paid,
  saved,
}: {
  id: string;
  amount: number;
  paid: boolean;
  saved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(String(amount)),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await siteFetch(
        `/api/admin/rewards?id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: Number(value) }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw Error(data.error || "Could not update prize.");
      await saved();
      setEditing(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save prize.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="reward-amount-editor">
      <strong>
        {amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}
      </strong>
      {!paid && !editing && (
        <button
          type="button"
          onClick={() => {
            setValue(String(amount));
            setEditing(true);
          }}
        >
          Edit amount
        </button>
      )}
      {editing && (
        <form onSubmit={save}>
          <label>
            New prize amount ($)
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              required
              value={value}
              disabled={busy}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <div>
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save amount"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </form>
      )}
    </div>
  );
}
