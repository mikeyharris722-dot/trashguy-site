"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import SlotSearch, { type SlotOption } from "./slot-search";
import TrackerAdmin from "./tracker-admin";
import { type PredictionHunt } from "./community-predictions";
import PendingRegistration from "./pending-registration";
import {
  ScheduleFields,
  ScheduleCard,
  CommunitySettings,
} from "./community-schedule";
import { localScheduleToUtc } from "@/lib/community-schedule";
import { supabaseBrowser } from "@/lib/supabase/client";
type Member = {
  id: string;
  name: string;
  amount: string | null;
  status: string;
};
type Call = {
  id: string;
  userId: string;
  username: string;
  slot_name: string;
  artwork_url: string | null;
  launch: string | null;
  status: string;
};
type Hunt = PredictionHunt & {
  id: string;
  title: string;
  phase: string;
  scheduledAt: string | null;
  timeZone: string;
  startCost: number;
  limit: number;
  members: Member[];
  calls: Call[];
  stats: {
    totalWinnings: number;
    averagePayoutRequired: number | null;
    bonusCount: number;
    unopenedBonuses: number;
  };
};
const field =
  "rounded-lg border border-purple-300/20 bg-black/60 px-3 py-2 text-sm";
const button =
  "rounded-lg bg-purple-400/20 px-4 py-2 text-sm font-bold disabled:opacity-40";
export default function CommunityHunt({ admin = false }: { admin?: boolean }) {
  const [confirmTitle, setConfirmTitle] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [timeZone, setTimeZone] = useState("Europe/London");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hunts, setHunts] = useState<Hunt[]>([]),
    [id, setId] = useState(""),
    [me, setMe] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [amount, setAmount] = useState(""),
    [title, setTitle] = useState(""),
    [limit, setLimit] = useState("3"),
    [choice, setChoice] = useState<SlotOption | null>(null),
    [bet, setBet] = useState("1"),
    [tab, setTab] = useState("queued"),
    [reset, setReset] = useState(0);
  const headers = useCallback(async () => {
    const { data } = await supabaseBrowser.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (data.session?.access_token || ""),
    };
  }, []);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/community", {
        headers: await headers(),
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setLoadError("");
      setHunts(d.hunts);
      setId((old) =>
        admin
          ? d.activeHuntId
          : old && d.hunts.some((h: Hunt) => h.id === old)
            ? old
            : d.activeHuntId || d.hunts[0]?.id || "",
      );
      const { data } = await supabaseBrowser.auth.getSession();
      setMe(data.session?.user.id || "");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load hunts");
    } finally {
      setLoading(false);
    }
  }, [admin, headers]);
  useEffect(() => {
    const initial = setTimeout(load, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);
  const pendingRequest = useRef<{ body: string; id: string } | null>(null);
  async function command(action: string, extra: Record<string, unknown> = {}) {
    const body = JSON.stringify({ huntId: id, action, ...extra });
    if (pendingRequest.current?.body !== body)
      pendingRequest.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/community", {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify({
          huntId: id,
          action,
          requestId: pendingRequest.current.id,
          ...extra,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      pendingRequest.current = null;
      if (action === "create") {
        setId(d.result);
        setTitle("");
        setScheduled("");
      }
      if (action === "submit" || action === "hostCall") {
        setChoice(null);
        setReset((n) => n + 1);
      }
      await load();
      const labels: Record<string, string> = {
        create: "Community hunt created.",
        predict: "Your prediction is saved. You can edit it until predictions close.",
        predictionStatus: "Prediction entry status updated.",
        register: "Request sent. Your place will be confirmed after approval.",
        approve: "Contribution approved. The starting bankroll has updated.",
        decline: "Registration declined.",
        submit: "Your slot call has been queued.",
        hostCall: "Host call added to the queue.",
        random: "A new slot call has been selected.",
        result: "Call result saved.",
        edit: "Hunt details saved.",
        delete: "Hunt hidden from the public list.",
        withdraw: "Your call has been withdrawn.",
        updateContribution:
          "Your contribution has been updated. It is still waiting for approval.",
        cancelRegistration: "Your registration request has been withdrawn.",
      };
      setMessage(labels[action] || "Changes saved.");
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function catalogueAction(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/community/catalogue", {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(`Catalogue updated: ${d.total} slots, ${d.added} new.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  const h = hunts.find((h) => h.id === id),
    member = h?.members.find((m) => m.id === me),
    selected = h?.calls.find((c) => c.status === "selected");
  function game(c: Call) {
    return c.launch ? (
      <a
        href={c.launch}
        target="slot-hub-rainbet"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-3 underline decoration-purple-400/40"
        aria-label={"Open " + c.slot_name + " on Rainbet"}
      >
        {c.artwork_url && (
          <Image
            unoptimized
            width={48}
            height={48}
            src={c.artwork_url}
            alt=""
            className="h-12 w-12 rounded-lg object-cover"
          />
        )}
        <span>{c.slot_name}</span>
      </a>
    ) : (
      <span>{c.slot_name} · Game link unavailable</span>
    );
  }
  return (
    <section className="community-layout mx-auto max-w-6xl space-y-5 text-white">
      <div className="rounded-2xl border border-purple-300/20 bg-black/80 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
          Community · Rainbet slots
        </p>
        <h1 className="mt-2 text-3xl font-black">Community Hunt</h1>
        <p className="mt-2 text-sm text-white/60">
          {admin
            ? "Set the hunt date, review player contributions and collect Rainbet bonuses. The active hunt also powers the shared tracker and OBS overlay."
            : "Join with your contribution, wait for approval, then call your favourite Rainbet slots. Follow the bonuses and results together."}
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-lg border border-purple-300/30 bg-black/80 p-3"
        >
          {message}
        </p>
      )}
      {loadError && (
        <p role="alert" className="form-error">
          {loadError}{" "}
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {admin && (
        <details className="community-create" open={hunts.length === 0}>
          <summary>Create a community hunt</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                void command("create", {
                  title,
                  limit: Number(limit),
                  scheduledAt: localScheduleToUtc(scheduled, timeZone),
                  timeZone,
                });
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Check the schedule.",
                );
              }
            }}
          >
            <div className="hunt-create-row">
              <label>
                Hunt name
                <input
                  aria-label="Community hunt title"
                  required
                  maxLength={160}
                  placeholder="e.g. Friday community hunt"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Call spaces per player
                <input
                  aria-label="Call spaces per player"
                  type="number"
                  required
                  min="1"
                  max="10"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </label>
            </div>
            <ScheduleFields
              value={scheduled}
              zone={timeZone}
              onValue={setScheduled}
              onZone={setTimeZone}
            />
            <div className="form-footer">
              <p>
                Starting bankroll is the total of approved player contributions.
              </p>
              <button
                type="submit"
                className="primary-button"
                disabled={busy || !title.trim()}
              >
                {busy ? "Creating…" : "Create community hunt"}
              </button>
            </div>
          </form>
        </details>
      )}
      <label className="block text-sm font-bold">
        Hunt
        <select
          aria-label="Choose community hunt"
          className={field + " mt-2 block w-full max-w-xl"}
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            if (admin) void command("select", { huntId: e.target.value });
          }}
        >
          <option value="">Select a hunt</option>
          {hunts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.title} ·{" "}
              {(
                {
                  collecting: "Registration & collection",
                  opening: "Opening bonuses",
                  finished: "Finished",
                } as Record<string, string>
              )[h.phase] || h.phase}
            </option>
          ))}
        </select>
      </label>
      {!h ? (
        <div className="empty-state">
          <h2>
            {loading
              ? "Loading community hunts…"
              : hunts.length
                ? "Choose a community hunt"
                : "No community hunt scheduled yet"}
          </h2>
          <p>
            {loading
              ? "Getting the latest hunt details."
              : hunts.length
                ? "Choose a community hunt from the selector above to see its registration and results."
                : admin
                  ? "Create a hunt above to open registration."
                  : "Check back here for the next hunt. Its date and registration details will appear here."}
          </p>
        </div>
      ) : (
        <>
          <ScheduleCard
            scheduledAt={h.scheduledAt}
            timeZone={h.timeZone}
            phase={h.phase}
          />

          {admin && (
            <CommunitySettings
              key={[h.id, h.title, h.scheduledAt, h.timeZone, h.limit].join(
                ":",
              )}
              hunt={h}
              busy={busy}
              save={(body) => command("edit", body)}
            />
          )}
          {!admin && (
            <div className="rounded-xl border border-white/10 bg-black/75 p-4">
              {!me ? (
                <p>
                  Use the Twitch sign-in button at the top to join and submit
                  slot calls. Everyone can follow the hunt.
                </p>
              ) : !member ||
                ["declined", "withdrawn"].includes(member.status) ? (
                <form
                  className="flex flex-wrap items-center gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void command("register", { amount });
                  }}
                >
                  <label>
                    Your contribution ($)
                    <input
                      aria-label="Your contribution"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      className={field + " mt-2 block w-full"}
                      value={amount}
                      inputMode="decimal"
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <button
                    className={button}
                    disabled={busy || h.phase !== "collecting" || !amount}
                  >
                    Request to join
                  </button>
                </form>
              ) : member.status === "pending" ? (
                <PendingRegistration
                  key={member.amount}
                  amount={member.amount}
                  busy={busy}
                  closed={h.phase !== "collecting"}
                  save={(action, body) => command(action, body)}
                />
              ) : (
                <p>
                  {member.status === "pending"
                    ? "Your registration is waiting for admin approval."
                    : `You’re approved · ${Math.max(0, h.limit - h.calls.filter((c) => c.userId === me && ["queued", "selected"].includes(c.status)).length)} of ${h.limit} call spaces available · $${Number(member.amount).toFixed(2)} contribution`}
                </p>
              )}
            </div>
          )}
          {!admin && member?.status !== "accepted" && (
            <ol className="join-steps" aria-label="How to join">
              <li>
                <b>1. Request your place</b>
                <span>Sign in with Twitch and enter your contribution.</span>
              </li>
              <li>
                <b>2. Wait for approval</b>
                <span>The streamer confirms your place and bankroll.</span>
              </li>
              <li>
                <b>3. Call your slots</b>
                <span>Choose Rainbet games and follow the results.</span>
              </li>
            </ol>
          )}
          <div className="grid gap-3 rounded-xl border border-purple-300/20 bg-black/75 p-4 sm:grid-cols-4">
            <div>
              <span className="text-xs text-white/50">Approved bankroll</span>
              <p className="text-xl font-bold">${h.startCost.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-xs text-white/50">Recorded returns</span>
              <p className="text-xl font-bold">
                ${h.stats.totalWinnings.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-xs text-white/50">Required average</span>
              <p className="text-xl font-bold">
                {h.stats.averagePayoutRequired?.toFixed(2) ?? "—"}×
              </p>
            </div>
            <div>
              <span className="text-xs text-white/50">Bonuses remaining</span>
              <p className="text-xl font-bold">
                {h.stats.unopenedBonuses} / {h.stats.bonusCount}
              </p>
            </div>
          </div>

          {admin && (
            <section className="rounded-xl border border-white/10 bg-black/75 p-4">
              <h2 className="mb-3 text-lg font-bold">Registration approval</h2>
              {h.members.filter((m) => m.status === "pending").length === 0 && (
                <p className="text-sm text-white/50">
                  All registrations have been reviewed. New requests appear
                  here.
                </p>
              )}
              {h.members
                .filter((m) => m.status === "pending")
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center gap-3 border-t border-white/10 py-3"
                  >
                    <b className="flex-1">{m.name}</b>
                    <span>${Number(m.amount).toFixed(2)}</span>
                    <button
                      className={button}
                      disabled={busy || h.phase !== "collecting"}
                      onClick={() => void command("approve", { userId: m.id })}
                    >
                      Approve
                    </button>
                    <button
                      className={button}
                      disabled={busy || h.phase !== "collecting"}
                      onClick={() => void command("decline", { userId: m.id })}
                    >
                      Decline
                    </button>
                  </div>
                ))}
            </section>
          )}
          {h.phase === "collecting" &&
            (admin || member?.status === "accepted") && (
              <div className="rounded-xl border border-white/10 bg-black/75 p-4">
                <SlotSearch
                  key={reset}
                  endpoint="/api/community"
                  selected={choice}
                  onSelect={setChoice}
                  label={admin ? "Add a host call" : "Choose your slot call"}
                />
                <button
                  className={button + " mt-3"}
                  disabled={busy || !choice}
                  onClick={() =>
                    void command(admin ? "hostCall" : "submit", {
                      identifier: choice?.identifier,
                    })
                  }
                >
                  {admin ? "Queue host call" : "Submit slot call"}
                </button>
              </div>
            )}
          {admin && (
            <div className="rounded-xl border border-purple-300/30 bg-black/85 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex-1 text-lg font-bold">Selected call</h2>
                <button
                  className={button}
                  disabled={busy || !!selected || h.phase !== "collecting"}
                  onClick={() => void command("random")}
                >
                  Random call
                </button>
              </div>
              {selected ? (
                <div className="mt-4 space-y-3">
                  {game(selected)}
                  <p className="text-sm text-white/60">
                    Called by {selected.username}
                  </p>
                  <label className="block text-sm">
                    Bet size
                    <input
                      aria-label="Selected call bet size"
                      className={field + " ml-3 w-24"}
                      inputMode="decimal"
                      value={bet}
                      onChange={(e) => setBet(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-3">
                    <button
                      className={button + " bg-emerald-500/20"}
                      disabled={busy}
                      onClick={() =>
                        void command("result", {
                          callId: selected.id,
                          status: "collected",
                          bet,
                        })
                      }
                    >
                      Passed · got bonus
                    </button>
                    <button
                      className={button + " bg-red-500/20"}
                      disabled={busy}
                      onClick={() =>
                        void command("result", {
                          callId: selected.id,
                          status: "failed",
                        })
                      }
                    >
                      Failed · no bonus
                    </button>
                  </div>
                  <p className="text-xs text-white/50">
                    Opening the artwork only opens Rainbet. Record the result
                    separately.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/50">
                  Select a random call to begin.
                </p>
              )}
            </div>
          )}
          <section className="rounded-xl border border-white/10 bg-black/75 p-4">
            <div className="mb-3 flex gap-2">
              {["queued", "collected", "failed"].map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tab === t}
                  className={
                    button + (tab === t ? " ring-1 ring-purple-300" : "")
                  }
                  onClick={() => setTab(t)}
                >
                  {t === "queued"
                    ? "Calls"
                    : t === "collected"
                      ? "Bonuses collected"
                      : "No bonus"}
                </button>
              ))}
            </div>
            {!h.calls.some((c) =>
              tab === "queued"
                ? ["queued", "selected"].includes(c.status)
                : c.status === tab,
            ) && (
              <p className="empty-list">
                {tab === "queued"
                  ? "No calls waiting. Approved players can choose a Rainbet slot above."
                  : tab === "collected"
                    ? "Collected bonuses will appear here when the streamer records a successful call."
                    : "Calls without a bonus will appear here."}
              </p>
            )}
            {h.calls
              .filter((c) =>
                tab === "queued"
                  ? ["queued", "selected"].includes(c.status)
                  : c.status === tab,
              )
              .map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-3"
                >
                  {game(c)}
                  <span className="text-sm text-white/60">
                    {c.username} ·{" "}
                    {(
                      {
                        queued: "Waiting",
                        selected: "Selected",
                        collected: "Bonus collected",
                        failed: "No bonus",
                      } as Record<string, string>
                    )[c.status] || c.status}
                  </span>
                  {!admin && c.userId === me && c.status === "queued" && (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => void command("withdraw", { callId: c.id })}
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              ))}
          </section>
          <section className="rounded-xl border border-white/10 bg-black/75 p-4">
            <h2 className="font-bold">
              Approved players ·{" "}
              {h.members.filter((m) => m.status === "accepted").length}
            </h2>
            {!h.members.some((m) => m.status === "accepted") && (
              <p className="empty-list">
                Approved players will be listed here after registration is
                reviewed.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {h.members
                .filter((m) => m.status === "accepted")
                .map((m) => (
                  <span
                    key={m.id}
                    className="rounded-full bg-purple-400/10 px-3 py-2 text-sm"
                  >
                    {m.name}
                  </span>
                ))}
            </div>
          </section>
          {admin && (
            <details className="rounded-xl border border-red-400/20 bg-black/75 p-4">
              <summary className="cursor-pointer text-sm text-red-200">
                Delete community hunt
              </summary>
              <p className="my-3 text-xs text-white/50">
                Hides the hunt from the website. Saved records remain
                recoverable by the site owner.
              </p>
              <input
                aria-label="Confirm community hunt deletion"
                className={field}
                placeholder={h.title}
                value={confirmTitle}
                onChange={(e) => setConfirmTitle(e.target.value)}
              />
              <button
                className={button + " ml-3"}
                disabled={busy || confirmTitle !== h.title}
                onClick={() => void command("delete", { confirmTitle })}
              >
                Delete hunt
              </button>
            </details>
          )}
          {admin && (
            <section className="rounded-xl border border-white/10 bg-black/80 p-4">
              <h2 className="mb-3 text-xl font-black">Bonus Hunt Tracker</h2>
              <p className="mb-3 text-xs text-white/50">
                Same tracker, opening sequence and OBS layout. Community data
                stays separate from ordinary wheel hunts.
              </p>
              <TrackerAdmin
                community
                manual
                huntId={id}
                onHunt={(id) => void command("select", { huntId: id })}
                onChange={() => void load()}
              />
            </section>
          )}
        </>
      )}
      {admin && (
        <details className="rounded-xl border border-purple-300/20 bg-black/75 p-4">
          <summary className="cursor-pointer font-bold">
            Rainbet catalogue
          </summary>
          <p className="my-3 text-sm text-white/60">
            Refresh the GB catalogue. Existing hunt records are preserved. If
            Rainbet blocks the request, import its catalogue JSON instead.
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void catalogueAction({ action: "update", country: "GB" })
            }
          >
            Update Rainbet catalogue
          </button>
          <label className="mt-3 block text-sm">
            Import Rainbet JSON
            <input
              className="mt-2 block"
              aria-label="Import Rainbet catalogue JSON"
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10000000) {
                  setMessage("File must be under 10 MB");
                  return;
                }
                try {
                  const records = JSON.parse(await file.text());
                  await catalogueAction({ action: "import", records });
                } catch {
                  setMessage("Could not read JSON file");
                }
                e.target.value = "";
              }}
            />
          </label>
        </details>
      )}
    </section>
  );
}
