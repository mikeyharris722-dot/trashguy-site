"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type GiveawayType = "regular" | "vip";

type GiveawayViewState = {
  giveaway: any | null;
  entries: any[];
  recentWinners: any[];
  winnerCounts: Record<string, number>;
  message: string;
  winnerUsername: string;
  winnerMessages: string[];
  prizeAmount: string;
  drawTime: number | null;
  respondedTime: number | null;
  followAge: string;
  loading: boolean;
};

const emptyState = (): GiveawayViewState => ({
  giveaway: null,
  entries: [],
  recentWinners: [],
  winnerCounts: {},
  message: "",
  winnerUsername: "",
  winnerMessages: [],
  prizeAmount: "",
  drawTime: null,
  respondedTime: null,
  followAge: "",
  loading: false,
});

function normalize(value: unknown) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

function SmallButton({
  children,
  onClick,
  disabled = false,
  variant = "cyan",
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "cyan" | "purple" | "dark";
  className?: string;
}) {
  const variants = {
    cyan: "border-cyan-300/35 bg-cyan-400/15 text-cyan-100 hover:border-cyan-200/60",
    purple: "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-100 hover:border-fuchsia-200/60",
    dark: "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[42px] min-w-0 max-w-full rounded-xl border px-2 py-2 text-[10px] sm:px-3 sm:text-[11px] font-black uppercase tracking-[0.08em] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export default function GiveawayAdmin({ isAdmin }: { isAdmin: boolean }) {
  const [activeType, setActiveType] = useState<GiveawayType>("regular");
  const [tick, setTick] = useState(Date.now());
  const [states, setStates] = useState<Record<GiveawayType, GiveawayViewState>>({
    regular: emptyState(),
    vip: emptyState(),
  });

  const updateState = useCallback(
    (type: GiveawayType, patch: Partial<GiveawayViewState> | ((current: GiveawayViewState) => Partial<GiveawayViewState>)) => {
      setStates((current) => {
        const currentType = current[type];
        const nextPatch = typeof patch === "function" ? patch(currentType) : patch;
        return { ...current, [type]: { ...currentType, ...nextPatch } };
      });
    },
    []
  );

  const loadGiveaway = useCallback(async (type: GiveawayType) => {
    try {
      const res = await fetch(`/api/chat-giveaway?type=${type}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        updateState(type, { message: data?.error || `Could not load ${type} giveaway.` });
        return;
      }

      const winnerUsername = normalize(data?.giveaway?.winner_username);
      updateState(type, (current) => ({
        giveaway: data.giveaway || null,
        entries: Array.isArray(data.entries) ? data.entries : [],
        recentWinners: Array.isArray(data.recentWinners) ? data.recentWinners : [],
        winnerCounts: data.winnerCounts || {},
        winnerUsername: winnerUsername || current.winnerUsername,
        message: winnerUsername || (data?.giveaway?.status === "live" ? "Giveaway live." : current.message),
      }));
    } catch (error) {
      console.error(`${type} giveaway failed to load`, error);
    }
  }, [updateState]);

  const loadWinnerMessages = useCallback(async (type: GiveawayType) => {
    const current = states[type];
    if (!current.winnerUsername) return;

    try {
      const res = await fetch(`/api/chat-giveaway/winner-message?type=${type}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok || normalize(data.winnerUsername) !== current.winnerUsername) return;

      const messages = Array.isArray(data.messages) ? data.messages : [];
      updateState(type, (old) => ({
        winnerMessages: messages.map((item: any) => `${item.display_name || item.username}: ${item.message}`),
        respondedTime:
          old.respondedTime ||
          (messages.length
            ? new Date(messages[messages.length - 1].created_at).getTime()
            : null),
      }));
    } catch (error) {
      console.error(`${type} winner messages failed to load`, error);
    }
  }, [states, updateState]);

  useEffect(() => {
    loadGiveaway("regular");
    loadGiveaway("vip");

    const giveawayTimer = window.setInterval(() => {
      loadGiveaway("regular");
      loadGiveaway("vip");
    }, 2000);

    const clockTimer = window.setInterval(() => setTick(Date.now()), 1000);

    return () => {
      window.clearInterval(giveawayTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadGiveaway]);

  useEffect(() => {
    loadWinnerMessages(activeType);
    const timer = window.setInterval(() => loadWinnerMessages(activeType), 1500);
    return () => window.clearInterval(timer);
  }, [activeType, loadWinnerMessages]);

  const state = states[activeType];

  const responseTimer = useMemo(() => {
    if (!state.drawTime) return "0m 00s";
    const end = state.respondedTime || tick;
    const total = Math.max(0, Math.floor((end - state.drawTime) / 1000));
    return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
  }, [state.drawTime, state.respondedTime, tick]);

  const winnerEntry = useMemo(
    () => state.entries.find((entry) => normalize(entry.username || entry.display_name) === state.winnerUsername),
    [state.entries, state.winnerUsername]
  );

  const handleStart = async () => {
    updateState(activeType, { loading: true, message: `Starting ${activeType} giveaway...` });
    try {
      const res = await fetch(`/api/chat-giveaway?type=${activeType}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        updateState(activeType, { loading: false, message: data?.error || "Failed to start giveaway." });
        return;
      }
      updateState(activeType, {
        giveaway: data.giveaway,
        entries: [],
        winnerUsername: "",
        winnerMessages: [],
        prizeAmount: "",
        drawTime: null,
        respondedTime: null,
        followAge: "",
        message: `${activeType === "vip" ? "VIP" : "Regular"} giveaway started.`,
        loading: false,
      });
      await loadGiveaway(activeType);
    } catch {
      updateState(activeType, { loading: false, message: "Failed to start giveaway." });
    }
  };

  const handleDraw = async () => {
    updateState(activeType, { loading: true, message: "Drawing winner..." });
    try {
      const res = await fetch(`/api/chat-giveaway/draw?type=${activeType}&amount=0`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.winner?.username) {
        updateState(activeType, { loading: false, message: data?.error || "Failed to draw winner." });
        return;
      }

      const winnerUsername = normalize(data.winner.username);
      const platform = data.winner.platform === "kick" ? "kick" : "twitch";
      updateState(activeType, {
        winnerUsername,
        winnerMessages: [],
        message: winnerUsername,
        drawTime: Date.now(),
        respondedTime: null,
        followAge: platform === "kick" ? "Kick viewer" : "",
        loading: false,
      });

      if (platform === "twitch") {
        try {
          const followRes = await fetch(`/api/twitch/follow-age?user=${encodeURIComponent(winnerUsername)}`);
          const followData = await followRes.json();
          updateState(activeType, { followAge: followData?.ok ? followData.followAge || "" : followData?.error || "Unknown" });
        } catch {
          updateState(activeType, { followAge: "Unknown" });
        }
      }

      await loadGiveaway(activeType);
    } catch {
      updateState(activeType, { loading: false, message: "Failed to draw winner." });
    }
  };

  const handleAward = async () => {
    const amount = Number(state.prizeAmount || 0);
    if (!state.winnerUsername) return alert("Draw a winner first.");
    if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid prize amount.");

    const rewardsRes = await fetch("/api/rewards", { cache: "no-store" });
    const rewardsData = await rewardsRes.json();
    const rewards = Array.isArray(rewardsData?.rewards) ? rewardsData.rewards : [];
    const reward = rewards.find((item: any) => String(item.giveaway_id || "") === String(state.giveaway?.id || ""));

    if (!reward?.id) {
      alert("Reward not found yet. Wait a second and try again.");
      return;
    }

    const res = await fetch(`/api/admin/rewards?id=${encodeURIComponent(reward.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, status: "pending" }),
    });
    const data = await res.json();

    if (!res.ok || !data?.ok) {
      alert(data?.error || "Award failed.");
      return;
    }

    updateState(activeType, { prizeAmount: "" });
    alert(`Awarded $${amount} to ${state.winnerUsername}`);
  };

  const winnerWeight = Number(winnerEntry?.weight || winnerEntry?.total_odds || 1);
  const winnerRole = String(winnerEntry?.role || "viewer").toLowerCase();
  const isWinnerVip = winnerRole === "vip";
  const isWinnerOnCode = Boolean(winnerEntry?.roulo_username || winnerEntry?.is_roulo_affiliate);
  const isWinnerDiscord = Boolean(winnerEntry?.is_in_discord || winnerEntry?.discord_username);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-black/40 p-1 sm:gap-2 sm:p-1.5">
        {(["regular", "vip"] as GiveawayType[]).map((type) => {
          const active = activeType === type;
          const live = states[type].giveaway?.status === "live";
          return (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(type)}
              className={`min-w-0 rounded-lg border px-1 py-2 text-[9px] font-black uppercase leading-tight tracking-[0.03em] transition sm:px-2 sm:text-xs sm:tracking-[0.07em] ${
                active
                  ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                  : "border-transparent bg-white/[0.03] text-white/55"
              }`}
            >
              <span className="block truncate">{type === "vip" ? "VIP Giveaway" : "Regular Giveaway"}</span>
              <span className={`mt-0.5 block text-[8px] ${live ? "text-green-300" : "text-white/30"}`}>
                {live ? "LIVE" : "NOT LIVE"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid w-full min-w-0 max-w-full gap-2.5 sm:mt-3 sm:gap-3">
        <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
          <SmallButton onClick={handleStart} disabled={!isAdmin || state.loading}>Start Giveaway</SmallButton>
          <SmallButton onClick={handleDraw} disabled={!isAdmin || state.loading} variant="purple">Draw Winner</SmallButton>
        </div>

        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(0,245,255,0.10),rgba(0,0,0,0.92))] p-2.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">Current Winner</div>
              <div className="mt-2 break-words text-xl font-black text-cyan-200 sm:text-3xl">
                {state.message || "Waiting..."}
              </div>

              {state.winnerUsername && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black text-white/70">
                    {isWinnerVip ? "👑 VIP" : isWinnerOnCode ? "💎 Code" : "👤 Viewer"}
                  </span>
                  {isWinnerDiscord && <span className="rounded-full border border-indigo-300/20 bg-indigo-400/10 px-2 py-1 text-[9px] font-black text-indigo-200">💬 Discord</span>}
                  <span className="rounded-full border border-green-300/20 bg-green-400/10 px-2 py-1 text-[9px] font-black text-green-200">{winnerWeight.toFixed(1)}x Odds</span>
                  {state.followAge && <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-2 py-1 text-[9px] font-black text-purple-200">{state.followAge}</span>}
                </div>
              )}
            </div>

            <div className="w-full rounded-xl border border-green-300/20 bg-green-400/10 px-3 py-2 text-center sm:w-auto sm:min-w-[100px]">
              <div className="text-[9px] uppercase tracking-[0.14em] text-green-200/70">Timer</div>
              <div className="mt-1 text-sm font-black text-green-200 sm:text-lg">{responseTimer}</div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Winner Chat</div>
            <div className="mt-2 max-h-[160px] min-h-[88px] space-y-2 overflow-y-auto">
              {!state.winnerUsername ? (
                <div className="text-xs text-white/35">Draw a winner to track their chat.</div>
              ) : state.winnerMessages.length === 0 ? (
                <div className="text-xs text-white/35">Waiting for @{state.winnerUsername} to type...</div>
              ) : (
                state.winnerMessages.map((message, index) => (
                  <div key={`${message}-${index}`} className="break-words rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white">
                    {message}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block min-w-0">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">Award Prize $</span>
              <input
                value={state.prizeAmount}
                onChange={(event) => updateState(activeType, { prizeAmount: event.target.value.replace(/[^0-9.]/g, "") })}
                inputMode="decimal"
                placeholder="e.g. 50"
                className="mt-2 w-full min-w-0 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm font-black text-white outline-none focus:border-cyan-300/35"
              />
            </label>
            <SmallButton onClick={handleAward} disabled={!isAdmin || !state.winnerUsername} variant="purple" className="w-full sm:w-auto">Award Prize</SmallButton>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/35">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Live Entries</div>
            <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black text-cyan-200">{state.entries.length}</div>
          </div>

          {state.entries.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-white/40">No entries yet.</div>
          ) : (
            <div className={state.entries.length > 10 ? "max-h-[340px] divide-y divide-white/5 overflow-y-auto" : "divide-y divide-white/5"}>
              {state.entries.map((entry, index) => {
                const isVip = String(entry.role || "").toLowerCase() === "vip";
                const isOnCode = Boolean(entry.roulo_username || entry.is_roulo_affiliate);
                const isInDiscord = Boolean(entry.is_in_discord || entry.discord_username);
                const baseOdds = Number(entry.base_odds ?? entry.base_weight ?? entry.weight ?? 1);
                const luckOdds = Number(entry.luck_odds || 0);
                const totalOdds = Number(entry.total_odds ?? entry.weight ?? baseOdds + luckOdds);

                return (
                  <div key={entry.id || `${entry.platform}-${entry.username}-${index}`} className="grid min-w-0 gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-sm font-black text-white">{entry.display_name || entry.username}</div>
                      <div className="flex shrink-0 gap-1 text-[11px]">{isVip && <span>👑</span>}{isOnCode && <span>💎</span>}{isInDiscord && <span>💬</span>}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center text-[9px] font-black sm:flex sm:items-center sm:gap-2 sm:text-[10px]">
                      <span className="rounded-md bg-white/[0.03] px-1.5 py-1 text-white/55">Base {baseOdds.toFixed(1)}x</span>
                      <span className="rounded-md bg-green-400/5 px-1.5 py-1 text-green-300">Luck +{luckOdds.toFixed(1)}x</span>
                      <span className="rounded-md border border-red-300/25 bg-red-400/10 px-1.5 py-1 text-red-200">Total {totalOdds.toFixed(1)}x</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
