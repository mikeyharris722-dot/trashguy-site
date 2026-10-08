"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import SlotSearch, { type SlotOption } from "./slot-search";
import TrackerAdmin from "./tracker-admin";
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
type Hunt = {
  id: string;
  title: string;
  phase: string;
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
      setMessage(e instanceof Error ? e.message : "Could not load hunts");
    }
  }, [admin, headers]);
  useEffect(() => {
    const initial = setTimeout(load, 0);
    const timer = setInterval(load, 3000);
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
      if (action === "create") setId(d.result);
      if (action === "submit" || action === "hostCall") {
        setChoice(null);
        setReset((n) => n + 1);
      }
      await load();
      setMessage("Saved");
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
    <section className="mx-auto max-w-6xl space-y-5 text-white">
      <div className="rounded-2xl border border-purple-300/20 bg-black/80 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
          Community · Rainbet slots
        </p>
        <h1 className="mt-2 text-3xl font-black">Community Hunt</h1>
        <p className="mt-2 text-sm text-white/60">
          Join with your contribution, wait for approval, then call your
          favourite Rainbet slots. Follow the bonuses and results together.
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
      {admin && (
        <form
          className="flex flex-wrap gap-3 rounded-xl border border-white/10 bg-black/75 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void command("create", { title, limit: Number(limit) });
          }}
        >
          <input
            className={field + " flex-1"}
            aria-label="Community hunt title"
            placeholder="New community hunt name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="text-xs">
            Call spaces
            <input
              className={field + " ml-2 w-16"}
              aria-label="Call spaces per player"
              type="number"
              min="1"
              max="10"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
          <button className={button} disabled={busy || !title.trim()}>
            Create community hunt
          </button>
          <p className="w-full text-xs text-white/50">
            Starting bankroll comes from approved contributions. No recovery
            target needed.
          </p>
        </form>
      )}
      <label className="block text-sm font-bold">
        Hunt
        <select
          className={field + " ml-3"}
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            if (admin) void command("select", { huntId: e.target.value });
          }}
        >
          <option value="">Select a hunt</option>
          {hunts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.title} · {h.phase}
            </option>
          ))}
        </select>
      </label>
      {!h ? (
        <p className="rounded-xl bg-black/70 p-5">
          No community hunt yet. An admin can create one in the Admin hub.
        </p>
      ) : (
        <>
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
          {!admin && (
            <div className="rounded-xl border border-white/10 bg-black/75 p-4">
              {!me ? (
                <p>
                  Sign in with Twitch using the menu to join or submit calls.
                  Everyone can follow the hunt.
                </p>
              ) : !member || member.status === "declined" ? (
                <form
                  className="flex flex-wrap items-center gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void command("register", { amount });
                  }}
                >
                  <label>
                    Your contribution
                    <input
                      aria-label="Your contribution"
                      className={field + " ml-3"}
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
              ) : (
                <p>
                  {member.status === "pending"
                    ? "Your registration is waiting for admin approval."
                    : `You’re in · ${h.limit} active call spaces · $${Number(member.amount).toFixed(2)} contribution`}
                </p>
              )}
            </div>
          )}
          {admin && (
            <section className="rounded-xl border border-white/10 bg-black/75 p-4">
              <h2 className="mb-3 text-lg font-bold">Registration approval</h2>
              {h.members.filter((m) => m.status === "pending").length === 0 && (
                <p className="text-sm text-white/50">
                  No pending registrations.
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
                  className={
                    button + (tab === t ? " ring-1 ring-purple-300" : "")
                  }
                  onClick={() => setTab(t)}
                >
                  {t === "queued"
                    ? "Calls"
                    : t === "collected"
                      ? "Passed"
                      : "Failed"}
                </button>
              ))}
            </div>
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
                    {c.username} · {c.status}
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
            <h2 className="font-bold">Players</h2>
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
