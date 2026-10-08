"use client";
import { useState } from "react";
export default function PendingRegistration({
  amount,
  busy,
  closed,
  save,
}: {
  amount: string | null;
  busy: boolean;
  closed: boolean;
  save: (action: string, body?: Record<string, unknown>) => Promise<boolean>;
}) {
  const [value, setValue] = useState(amount || "");
  return (
    <div className="pending-registration">
      <p>
        <strong>Waiting for approval</strong> · ${Number(amount).toFixed(2)}{" "}
        contribution
      </p>
      <p>
        The streamer will confirm your place. You can correct or withdraw this
        request before it is approved.
      </p>
      <details>
        <summary>Change my request</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("updateContribution", { amount: value });
          }}
        >
          <label>
            Your contribution ($)
            <input
              aria-label="Update pending contribution"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={busy || closed}
          >
            Save contribution
          </button>
          <button
            type="button"
            className="withdraw-request"
            disabled={busy || closed}
            onClick={() => void save("cancelRegistration")}
          >
            Withdraw request
          </button>
        </form>
      </details>
    </div>
  );
}
