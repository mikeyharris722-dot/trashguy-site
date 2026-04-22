"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type HuntBonusItem = {
  id: string;
  slotName: string;
  provider: string;
  slotImage?: string;
  betSize: number;
  payout: number;
  multiplier: number;
  note?: string | null;
  order?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type HuntItem = {
  id: string;
  title: string;
  casino: string;
  startCost: number;
  totalWinnings: number;
  profitLoss: number;
  profitLossPercentage: number;
  isOpening: boolean;
  currentOpeningSlot?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  stats?: {
    bonusCount: number;
    openedBonuses: number;
    unopenedBonuses: number;
    totalWinnings: number;
    profitLoss: number;
    profitLossPercentage: number;
    averagePayoutRequired: number;
    currentAverage: number;
    averageBetSize: number;
    currentAverageMultiplier: number;
  };
  bonuses?: HuntBonusItem[];
};

type PredictionItem = {
  id: string;
  username: string;
  guess: number;
  createdAt: string | null;
};

type SortMode = "newest" | "highest";

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatTimeAgo(value?: string | null) {
  if (!value) return "just now";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "just now";

  const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return `${Math.floor(seconds / 86400)}d ago`;
}

function extractTwitchIdentity(user: any) {
  const identityData =
    user?.identities?.[0]?.identity_data as Record<string, unknown> | undefined;

  const login =
    (user?.user_metadata?.preferred_username as string | undefined) ||
    (user?.user_metadata?.user_name as string | undefined) ||
    (identityData?.preferred_username as string | undefined) ||
    (identityData?.user_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (identityData?.name as string | undefined) ||
    (user?.email as string | undefined) ||
    "viewer";

  const displayName =
    (user?.user_metadata?.name as string | undefined) ||
    (identityData?.name as string | undefined) ||
    login;

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    (user?.user_metadata?.profile_image_url as string | undefined) ||
    (identityData?.profile_image_url as string | undefined) ||
    "";

  return {
    login,
    displayName,
    avatarUrl,
  };
}

function Pill({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const shared =
    "rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] transition";

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${shared} ${
          active
            ? "border-white/30 bg-white/10 text-white"
            : "border-white/10 bg-black/30 text-white/65 hover:text-white"
        }`}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className={`${shared} ${
        active
          ? "border-white/30 bg-white/10 text-white"
          : "border-white/10 bg-black/30 text-white/65"
      }`}
    >
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-black/35 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45 whitespace-nowrap">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

export default function PredictionsLivePage() {
  const [viewerName, setViewerName] = useState("viewer");
  const [viewerDisplayName, setViewerDisplayName] = useState("viewer");
  const [viewerAvatar, setViewerAvatar] = useState("");
  const [isTwitchConnected, setIsTwitchConnected] = useState(false);

  const [predictionInput, setPredictionInput] = useState("");
  const [predictionMessage, setPredictionMessage] = useState("");
  const [predictionStatus, setPredictionStatus] = useState<"open" | "locked">("locked");
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const [huntsData, setHuntsData] = useState<HuntItem[]>([]);
  const [huntsLoading, setHuntsLoading] = useState(true);
  const [predictionsLoading, setPredictionsLoading] = useState(true);

  const predictionClockRef = useRef<NodeJS.Timeout | null>(null);

  const activeHunt = useMemo(() => {
    const openHunt = huntsData.find((hunt) => hunt.isOpening);
    return openHunt || huntsData[0] || null;
  }, [huntsData]);

  const sortedPredictions = useMemo(() => {
    const next = [...predictions];

    if (sortMode === "highest") {
      return next.sort((a, b) => b.guess - a.guess);
    }

    return next.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [predictions, sortMode]);

  const yourEntry = useMemo(() => {
    return predictions.find(
      (entry) => entry.username.trim().toLowerCase() === viewerName.trim().toLowerCase()
    );
  }, [predictions, viewerName]);

  const entryCount = predictions.length;
  const bonuses = activeHunt?.bonuses || [];

  const avgX =
    activeHunt?.stats?.currentAverageMultiplier && activeHunt.stats.currentAverageMultiplier > 0
      ? activeHunt.stats.currentAverageMultiplier.toFixed(2)
      : "0.00";

  const reqX =
    activeHunt?.stats?.averagePayoutRequired && activeHunt.stats.averagePayoutRequired > 0
      ? activeHunt.stats.averagePayoutRequired.toFixed(2)
      : "---";

  const bestBonus =
    bonuses.length > 0
      ? [...bonuses].sort((a, b) => b.payout - a.payout)[0]
      : null;

  const highestBonus =
    bonuses.length > 0
      ? [...bonuses].sort((a, b) => b.multiplier - a.multiplier)[0]
      : null;

  const bestSlotName = bestBonus?.slotName || "---";
  const bestSlotWin = bestBonus?.payout || 0;
  const bestSlotMultiplier = bestBonus?.multiplier || 0;

  const highestXText =
    highestBonus?.multiplier && highestBonus.multiplier > 0
      ? `${highestBonus.multiplier.toFixed(2)}x`
      : "---";
  const highestXWin = highestBonus?.payout || 0;
  const highestXMultiplier = highestBonus?.multiplier || 0;

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    return session?.access_token || "";
  }, []);

  const loadHunts = useCallback(async () => {
    try {
      const res = await fetch("/api/hunts", { cache: "no-store" });
      const data = await res.json();

      const rawHunts = Array.isArray(data?.hunts) ? data.hunts : [];

      const normalized: HuntItem[] = rawHunts.map((hunt: any, index: number) => ({
        id: hunt.id || `hunt-${index}`,
        title: hunt.title || `Hunt #${index + 1}`,
        casino: hunt.casino || "Unknown",
        startCost: Number(hunt.startCost || hunt.start_amount || 0),
        totalWinnings: Number(hunt?.stats?.totalWinnings || hunt.totalWinnings || 0),
        profitLoss: Number(hunt?.stats?.profitLoss || hunt.profitLoss || 0),
        profitLossPercentage: Number(
          hunt?.stats?.profitLossPercentage || hunt.profitLossPercentage || 0
        ),
        isOpening: Boolean(hunt.isOpening) || hunt.status === "open",
        currentOpeningSlot: hunt.currentOpeningSlot || null,
        createdAt: hunt.createdAt || null,
        updatedAt: hunt.updatedAt || null,
        stats: hunt.stats || undefined,
        bonuses: Array.isArray(hunt.bonuses)
          ? hunt.bonuses.map((bonus: any) => ({
              id: bonus.id,
              slotName: bonus.slotName || "---",
              provider: bonus.provider || "",
              slotImage: bonus.slotImage || "",
              betSize: Number(bonus.betSize || 0),
              payout: Number(bonus.payout || 0),
              multiplier: Number(bonus.multiplier || 0),
              note: bonus.note || null,
              order: bonus.order ?? 0,
              createdAt: bonus.createdAt || null,
              updatedAt: bonus.updatedAt || null,
            }))
          : [],
      }));

      setHuntsData(normalized);
    } catch (error) {
      console.error("Hunts failed to load", error);
    } finally {
      setHuntsLoading(false);
    }
  }, []);

  const loadPredictions = useCallback(async () => {
    try {
      const res = await fetch("/api/predictions", { cache: "no-store" });
      if (!res.ok) {
        setPredictions([]);
        return;
      }

      const data = await res.json();
      const raw = Array.isArray(data?.predictions)
        ? data.predictions
        : Array.isArray(data)
          ? data
          : [];

      const normalized: PredictionItem[] = raw.map((entry: any, index: number) => ({
        id:
          entry.id?.toString() ||
          entry.profile_id?.toString() ||
          `prediction-${index}`,
        username:
          entry.username ||
          entry.profile_id ||
          entry.user_name ||
          `viewer-${index + 1}`,
        guess: Number(entry.guess ?? entry.guessAmount ?? entry.guess_amount ?? 0),
        createdAt: entry.created_at || entry.updated_at || null,
      }));

      setPredictions(normalized);
      setPredictionStatus("open");
    } catch (error) {
      console.error("Predictions failed to load", error);
      setPredictions([]);
    } finally {
      setPredictionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHunts();
    loadPredictions();

    const loadUser = async () => {
      try {
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          setIsTwitchConnected(false);
          setViewerName("viewer");
          setViewerDisplayName("viewer");
          setViewerAvatar("");
          return;
        }

        const twitchIdentity = extractTwitchIdentity(user);

        setIsTwitchConnected(true);
        setViewerName(twitchIdentity.login);
        setViewerDisplayName(twitchIdentity.displayName);
        setViewerAvatar(twitchIdentity.avatarUrl);
      } catch (error) {
        console.error("loadUser failed", error);
      }
    };

    loadUser();

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (!user) {
        setIsTwitchConnected(false);
        setViewerName("viewer");
        setViewerDisplayName("viewer");
        setViewerAvatar("");
        return;
      }

      const twitchIdentity = extractTwitchIdentity(user);

      setIsTwitchConnected(true);
      setViewerName(twitchIdentity.login);
      setViewerDisplayName(twitchIdentity.displayName);
      setViewerAvatar(twitchIdentity.avatarUrl);
    });

    const huntTimer = setInterval(loadHunts, 20000);
    const predictionTimer = setInterval(loadPredictions, 10000);

    return () => {
      subscription.unsubscribe();
      clearInterval(huntTimer);
      clearInterval(predictionTimer);
    };
  }, [loadHunts, loadPredictions]);

  useEffect(() => {
    if (predictionClockRef.current) {
      clearInterval(predictionClockRef.current);
    }

    predictionClockRef.current = setInterval(() => {
      setPredictions((current) => [...current]);
    }, 30000);

    return () => {
      if (predictionClockRef.current) {
        clearInterval(predictionClockRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel("predictions-live-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions" },
        () => {
          loadPredictions();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hunts" },
        (payload: any) => {
          const nextRow = payload?.new;
          if (nextRow?.status === "open") {
            setPredictionStatus("open");
          } else if (nextRow?.status === "locked" || nextRow?.status === "completed") {
            setPredictionStatus("locked");
          }
          loadPredictions();
          loadHunts();
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [loadPredictions, loadHunts]);

  const handleTwitchLogin = async () => {
    try {
      setPredictionMessage("");

      const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "twitch",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setPredictionMessage(error.message);
        return;
      }

      if (!data?.url) {
        setPredictionMessage("No Twitch redirect URL was returned.");
      }
    } catch (err: any) {
      setPredictionMessage(err?.message || "Twitch login failed.");
    }
  };

  const handleLogout = async () => {
    try {
      await supabaseBrowser.auth.signOut();
      setIsTwitchConnected(false);
      setViewerName("viewer");
      setViewerDisplayName("viewer");
      setViewerAvatar("");
      setPredictionMessage("Logged out.");
    } catch {
      setPredictionMessage("Logout failed.");
    }
  };

  const handlePredictionSubmit = async () => {
    if (!isTwitchConnected || predictionStatus !== "open") return;

    const guess = Number(predictionInput || 0);

    if (!guess || Number.isNaN(guess)) {
      setPredictionMessage("Enter a valid guess.");
      return;
    }

    try {
      const token = await getAccessToken();

      if (!token) {
        setPredictionMessage("Missing auth token. Please reconnect Twitch.");
        return;
      }

      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          guessAmount: guess,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPredictionMessage(data?.error || "Failed to save prediction.");
        return;
      }

      setPredictionInput("");
      setPredictionMessage("Prediction saved.");
      loadPredictions();
    } catch {
      setPredictionMessage("Failed to save prediction.");
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#05010f] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(120,53,255,0.28),transparent_28%),radial-gradient(circle_at_bottom,rgba(147,51,234,0.28),transparent_32%),linear-gradient(to_bottom,#05010f,#09031a)]">
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_70%,rgba(168,85,247,0.20),transparent_18%),radial-gradient(circle_at_82%_35%,rgba(124,58,237,0.18),transparent_16%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />

          <main className="relative mx-auto max-w-[1800px] px-6 py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.34em] text-violet-300/90">
                  Trashguy Live Predictions
                </div>
                <h1 className="mt-2 text-4xl font-black tracking-wide">
                  Live Bonus Hunt Dashboard
                </h1>
              </div>

              {isTwitchConnected ? (
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  {viewerAvatar ? (
                    <img
                      src={viewerAvatar}
                      alt={viewerDisplayName}
                      className="h-10 w-10 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 font-black text-violet-300">
                      {viewerDisplayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-sm">
                    <div className="font-bold text-white">{viewerDisplayName}</div>
                    <div className="text-white/45">@{viewerName}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white/70 hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleTwitchLogin}
                  className="rounded-full border border-violet-300/30 bg-violet-400/10 px-5 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-400/20"
                >
                  Connect Twitch
                </button>
              )}
            </div>

            <section className="grid gap-6 2xl:grid-cols-[1fr_1.35fr]">
              <div className="rounded-[2rem] border border-violet-300/30 bg-[#0b051a]/85 p-5 shadow-[0_0_32px_rgba(139,92,246,0.42)]">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="text-3xl font-black tracking-wide">
                    {activeHunt?.title || "Latest Hunt"}
                  </div>
                  <Pill active={Boolean(activeHunt?.isOpening)}>
                    {activeHunt?.isOpening ? "Open" : "Latest"}
                  </Pill>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
                  <MetricCard
                    label="Start"
                    value={huntsLoading ? "..." : formatMoney(activeHunt?.startCost || 0)}
                  />
                  <MetricCard
                    label="Won"
                    value={
                      huntsLoading
                        ? "..."
                        : formatMoney(
                            activeHunt?.stats?.totalWinnings || activeHunt?.totalWinnings || 0
                          )
                    }
                  />
                  <MetricCard
                    label="Bonuses"
                    value={huntsLoading ? "..." : activeHunt?.stats?.bonusCount || bonuses.length}
                  />
                  <MetricCard label="Avg" value={`${avgX}x`} />
                  <MetricCard label="Req" value={reqX === "---" ? "---" : `${reqX}x`} />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.3rem] border border-white/10 bg-black/35 p-6 min-h-[170px]">
                    <div className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
                      Best Slot
                    </div>
                    <div className="mt-4 text-center text-3xl font-black text-white">
                      {bestSlotName}
                    </div>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <Pill>Win {formatMoney(bestSlotWin)}</Pill>
                      <Pill>X {bestSlotMultiplier ? `${bestSlotMultiplier.toFixed(2)}x` : "0.00x"}</Pill>
                    </div>
                  </div>

                  <div className="rounded-[1.3rem] border border-white/10 bg-black/35 p-6 min-h-[170px]">
                    <div className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
                      Highest X
                    </div>
                    <div className="mt-4 text-center text-3xl font-black text-white">
                      {highestXText}
                    </div>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <Pill>Win {formatMoney(highestXWin)}</Pill>
                      <Pill>X {highestXMultiplier ? `${highestXMultiplier.toFixed(2)}x` : "0.00x"}</Pill>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-black/35 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
                      Live Bonus Feed
                    </div>

                    <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
                      {bonuses.length} Bonus{bonuses.length === 1 ? "" : "es"}
                    </div>
                  </div>

                  <div className="mt-4 max-h-[260px] overflow-y-auto rounded-[1.1rem] border border-white/10 bg-black/20">
                    {huntsLoading ? (
                      <div className="flex h-[180px] items-center justify-center text-white/45">
                        Loading bonus feed...
                      </div>
                    ) : bonuses.length ? (
                      <div className="divide-y divide-white/5">
                        {bonuses.map((bonus, index) => (
                          <div
                            key={bonus.id || index}
                            className="flex items-center justify-between gap-4 px-5 py-4"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xs font-black text-fuchsia-300">
                                  {index + 1}
                                </div>

                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-white">
                                    {bonus.slotName}
                                  </div>
                                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                                    Bet {formatMoney(bonus.betSize)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-black text-emerald-200">
                                {formatMoney(bonus.payout)}
                              </div>
                              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                                {bonus.multiplier.toFixed(2)}x
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-[180px] items-center justify-center text-white/45">
                        No bonuses yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-violet-300/30 bg-[#0b051a]/85 p-6 shadow-[0_0_32px_rgba(139,92,246,0.42)] min-w-0">
                <div className="mb-4 text-center text-4xl font-black tracking-wide">Predictions</div>

                <div className="grid gap-6">
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-6 min-w-0">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Pill active>{entryCount} Entries</Pill>
                      <Pill active={predictionStatus === "open"}>
                        {predictionStatus === "open" ? "Open" : "None"}
                      </Pill>
                    </div>

                    <div className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">
                      Your Entry
                    </div>

                    <div className="mt-4 text-center text-4xl font-black">
                      {yourEntry ? formatMoney(yourEntry.guess) : "--"}
                    </div>

                    <div className="mt-4 rounded-[1.1rem] border border-dashed border-white/10 bg-black/20 p-4 text-white/75">
                      {predictionStatus === "open"
                        ? "Prediction session is open."
                        : "No prediction session is open yet."}
                    </div>

                    <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-black/20 p-6">
                      <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">
                        Submit Prediction
                      </div>

                      <input
                        value={predictionInput}
                        onChange={(e) => setPredictionInput(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Enter final hunt balance"
                        className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-lg text-white outline-none focus:border-emerald-300/40"
                      />

                      <div className="mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2">
                        <button
                          onClick={isTwitchConnected ? handleLogout : handleTwitchLogin}
                          className="rounded-xl min-h-[64px] border border-white/10 bg-black/30 px-4 py-3 font-semibold text-white flex items-center justify-center transition hover:bg-white/5"
                        >
                          {isTwitchConnected ? "Logout" : "Connect Twitch"}
                        </button>

                        <button
                          onClick={handlePredictionSubmit}
                          disabled={!isTwitchConnected || predictionStatus !== "open"}
                          className="rounded-xl min-h-[64px] border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 font-semibold text-emerald-200 flex items-center justify-center transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Save Prediction
                        </button>
                      </div>

                      {predictionMessage && (
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/75">
                          {predictionMessage}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-violet-300/30 bg-black/30 p-6 min-w-0">
                    <div className="mb-4 flex items-center justify-end gap-2">
                      <Pill
                        onClick={() => setSortMode("highest")}
                        active={sortMode === "highest"}
                      >
                        Highest
                      </Pill>
                      <Pill
                        onClick={() => setSortMode("newest")}
                        active={sortMode === "newest"}
                      >
                        Newest
                      </Pill>
                    </div>

                    <div className="h-[560px] overflow-y-auto rounded-[1.1rem] border border-white/10 bg-[#090313]">
                      {predictionsLoading ? (
                        <div className="flex h-full items-center justify-center text-white/55">
                          Loading entries...
                        </div>
                      ) : sortedPredictions.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-white/45">
                          No entries.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {sortedPredictions.map((entry, index) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between gap-4 px-5 py-4"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xs font-black text-violet-300">
                                    {index + 1}
                                  </div>
                                  <div className="truncate font-semibold text-white">
                                    {entry.username}
                                  </div>
                                </div>
                                <div className="mt-1 pl-11 text-xs uppercase tracking-[0.18em] text-white/35">
                                  {formatTimeAgo(entry.createdAt)}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-lg font-black text-violet-200">
                                  {formatMoney(entry.guess)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}