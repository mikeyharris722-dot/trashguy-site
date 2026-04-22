"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const socials = [
  { name: "RouloBets", href: "https://roulobets.com/?r=trashguy" },
  { name: "Discord", href: "https://discord.gg/EqjwXzkDMK" },
  { name: "Twitter / X", href: "https://x.com/trashguy__" },
  { name: "YouTube", href: "https://www.youtube.com/@Trashguyy" },
];

const fallbackLeaderboard = [
  { rank: 1, username: "PlayerOne", wagered: 12450 },
  { rank: 2, username: "BigSpinner", wagered: 10920 },
  { rank: 3, username: "MaxChaser", wagered: 9775 },
  { rank: 4, username: "SlotKing", wagered: 7610 },
  { rank: 5, username: "BonusBoss", wagered: 6980 },
  { rank: 6, username: "RTPHunter", wagered: 6440 },
  { rank: 7, username: "SpinSniper", wagered: 5990 },
  { rank: 8, username: "WildDrop", wagered: 5420 },
  { rank: 9, username: "DiceMode", wagered: 4980 },
  { rank: 10, username: "ClipFarmer", wagered: 4520 },
];

const fallbackHunts: HuntItem[] = [];

const defaultBracket = {
  title: "Trashguy Tournament",
  rounds: [
    {
      id: "round-1",
      name: "Quarterfinals",
      matches: [
        { id: "m1", player1: "Player A", player2: "Player B", winner: "" },
        { id: "m2", player1: "Player C", player2: "Player D", winner: "" },
        { id: "m3", player1: "Player E", player2: "Player F", winner: "" },
        { id: "m4", player1: "Player G", player2: "Player H", winner: "" },
      ],
    },
    {
      id: "round-2",
      name: "Semifinals",
      matches: [
        { id: "m5", player1: "Winner QF1", player2: "Winner QF2", winner: "" },
        { id: "m6", player1: "Winner QF3", player2: "Winner QF4", winner: "" },
      ],
    },
    {
      id: "round-3",
      name: "Final",
      matches: [{ id: "m7", player1: "Winner SF1", player2: "Winner SF2", winner: "" }],
    },
  ],
};

const ADMIN_USERS = ["trashguy__", "trashguy", "parz", "parzwz"];

type LeaderboardPlayer = {
  rank: number;
  username: string;
  wagered: number;
};

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
  status?: string;
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

type WinnerItem = {
  profile_id: string;
  guess_amount: number;
  distance: number;
  placement: number;
  username?: string;
};

type LiveStatus = {
  isLive: boolean;
  title: string;
  gameName: string;
  viewerCount: number;
  startedAt: string;
};

type BracketMatch = {
  id: string;
  player1: string;
  player2: string;
  winner: string;
};

type BracketRound = {
  id: string;
  name: string;
  matches: BracketMatch[];
};

type BracketData = {
  title: string;
  rounds: BracketRound[];
};

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

function nextPowerOfTwo(value: number) {
  let power = 1;
  while (power < value) {
    power *= 2;
  }
  return power;
}

function getRoundName(roundIndex: number, totalRounds: number) {
  const roundsFromEnd = totalRounds - roundIndex;

  if (roundsFromEnd === 1) return "Final";
  if (roundsFromEnd === 2) return "Semifinals";
  if (roundsFromEnd === 3) return "Quarterfinals";
  if (roundsFromEnd === 4) return "Round of 16";

  return `Round ${roundIndex + 1}`;
}

function createBracketFromTeamCount(teamCount: number, title: string): BracketData {
  const safeCount = Math.max(2, Math.floor(teamCount));
  const bracketSize = nextPowerOfTwo(safeCount);
  const totalRounds = Math.log2(bracketSize);

  const teamNames = Array.from({ length: bracketSize }, (_, index) =>
    index < safeCount ? `Team ${index + 1}` : "BYE"
  );

  const rounds: BracketRound[] = [];
  let matchCounter = 1;

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const roundName = getRoundName(roundIndex, totalRounds);
    const matchCount = bracketSize / Math.pow(2, roundIndex + 1);

    const matches: BracketMatch[] = Array.from({ length: matchCount }, (_, matchIndex) => {
      if (roundIndex === 0) {
        return {
          id: `m${matchCounter++}`,
          player1: teamNames[matchIndex * 2] || "",
          player2: teamNames[matchIndex * 2 + 1] || "",
          winner: "",
        };
      }

      return {
        id: `m${matchCounter++}`,
        player1: "",
        player2: "",
        winner: "",
      };
    });

    rounds.push({
      id: `round-${roundIndex + 1}`,
      name: roundName,
      matches,
    });
  }

  return {
    title: title.trim() || "Trashguy Tournament",
    rounds,
  };
}

function cloneBracket(bracket: BracketData): BracketData {
  return {
    ...bracket,
    rounds: bracket.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => ({ ...match })),
    })),
  };
}

function maybeAutoAdvanceClassic8(bracket: BracketData): BracketData {
  const next = cloneBracket(bracket);

  if (
    next.rounds.length !== 3 ||
    next.rounds[0].matches.length !== 4 ||
    next.rounds[1].matches.length !== 2 ||
    next.rounds[2].matches.length !== 1
  ) {
    return next;
  }

  const qf = next.rounds[0].matches;
  const sf = next.rounds[1].matches;
  const final = next.rounds[2].matches[0];

  sf[0].player1 = qf[0].winner || "Winner QF1";
  sf[0].player2 = qf[1].winner || "Winner QF2";
  sf[1].player1 = qf[2].winner || "Winner QF3";
  sf[1].player2 = qf[3].winner || "Winner QF4";

  if (![sf[0].player1, sf[0].player2].includes(sf[0].winner)) {
    sf[0].winner = "";
  }
  if (![sf[1].player1, sf[1].player2].includes(sf[1].winner)) {
    sf[1].winner = "";
  }

  final.player1 = sf[0].winner || "Winner SF1";
  final.player2 = sf[1].winner || "Winner SF2";

  if (![final.player1, final.player2].includes(final.winner)) {
    final.winner = "";
  }

  return next;
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function SectionLabel({
  children,
  color = "emerald",
}: {
  children: React.ReactNode;
  color?: "emerald" | "fuchsia" | "white";
}) {
  const map = {
    emerald: "text-emerald-300",
    fuchsia: "text-fuchsia-300",
    white: "text-white/60",
  };

  return (
    <div className={`text-sm font-bold uppercase tracking-[0.28em] ${map[color]}`}>
      {children}
    </div>
  );
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

function MatchCard({
  match,
  compact = false,
}: {
  match: BracketMatch;
  compact?: boolean;
}) {
  const isWinner1 = match.winner && match.winner === match.player1;
  const isWinner2 = match.winner && match.winner === match.player2;

  return (
    <div
      className={`rounded-[1.35rem] border border-white/10 bg-black/35 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="space-y-2">
        <div
          className={`rounded-xl border px-4 py-3 font-semibold ${
            isWinner1
              ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
              : "border-white/10 bg-black/20 text-white"
          }`}
        >
          {match.player1 || "TBD"}
        </div>

        <div className="text-center text-[10px] uppercase tracking-[0.24em] text-white/30">
          vs
        </div>

        <div
          className={`rounded-xl border px-4 py-3 font-semibold ${
            isWinner2
              ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
              : "border-white/10 bg-black/20 text-white"
          }`}
        >
          {match.player2 || "TBD"}
        </div>
      </div>

      <div className="mt-3 text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
        {match.winner ? `Winner: ${match.winner}` : "No winner yet"}
      </div>
    </div>
  );
}

export default function Home() {
  const [activeSection, setActiveSection] = useState("home");

  const [viewerName, setViewerName] = useState("viewer");
  const [viewerDisplayName, setViewerDisplayName] = useState("viewer");
  const [viewerAvatar, setViewerAvatar] = useState("");
  const [isTwitchConnected, setIsTwitchConnected] = useState(false);

  const [predictionSortMode, setPredictionSortMode] = useState<"newest" | "highest">("newest");
  const [predictionInput, setPredictionInput] = useState("");
  const [predictionStatus, setPredictionStatus] = useState<"open" | "locked">("locked");
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [predictionMessage, setPredictionMessage] = useState("");

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("trashguy_admin_mode") === "true";
});

  const [adminName, setAdminName] = useState("Trashguy");
  const [finalResult, setFinalResult] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [latestWinners, setLatestWinners] = useState<WinnerItem[]>([]);
  const [adminHuntId, setAdminHuntId] = useState("");

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>(fallbackLeaderboard);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const [huntsData, setHuntsData] = useState<HuntItem[]>([]);
  const [huntsLoading, setHuntsLoading] = useState(true);

  const [liveStatus, setLiveStatus] = useState<LiveStatus>({
    isLive: false,
    title: "",
    gameName: "",
    viewerCount: 0,
    startedAt: "",
  });
  const [liveLoading, setLiveLoading] = useState(true);

  const [bracket, setBracket] = useState<BracketData>(defaultBracket);
  const [generatorTeamCount, setGeneratorTeamCount] = useState("8");
  const [bracketLoading, setBracketLoading] = useState(true);
  const [bracketMessage, setBracketMessage] = useState("");

  const predictionClockRef = useRef<NodeJS.Timeout | null>(null);

  const normalizedViewer = viewerName.trim().toLowerCase();
  const adminAllowed = ADMIN_USERS.includes(normalizedViewer);

  const sortedPredictionsForTab = useMemo(() => {
  const next = [...predictions];

  if (predictionSortMode === "highest") {
    return next.sort((a, b) => b.guess - a.guess);
  }

  return next.sort((a: any, b: any) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}, [predictions, predictionSortMode]);

const currentPredictionEntry = useMemo(() => {
  if (predictionStatus !== "open") return null;

  return predictions.find(
    (entry) =>
      entry.username.trim().toLowerCase() ===
      viewerName.trim().toLowerCase()
  );
}, [predictions, viewerName, predictionStatus]);

const currentPredictionHunt = useMemo(() => {
  const sorted = [...huntsData].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });

  return sorted[0] || null;
}, [huntsData]);

const currentPredictionCount = predictions.length;

const currentPredictionAvgX =
  currentPredictionHunt?.startCost && currentPredictionHunt.startCost > 0
    ? ((currentPredictionHunt.totalWinnings || 0) / currentPredictionHunt.startCost).toFixed(2)
    : "0.00";

  useEffect(() => {
    if (!adminAllowed) {
      setIsAdmin(false);
      if (activeSection === "admin") {
        setActiveSection("home");
      }
    }
  }, [adminAllowed, activeSection]);

  const navButton = (id: string, label: string) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`relative px-2 py-2 text-base font-semibold tracking-wide transition ${
        activeSection === id ? "text-emerald-300" : "text-white/80 hover:text-white"
      }`}
    >
      {label}
      {activeSection === id && (
        <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,1)]" />
      )}
    </button>
  );

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
      status: hunt.status || "",
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

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      const data = await res.json();

      const affiliates = Array.isArray(data?.affiliates) ? data.affiliates : [];

      const normalized: LeaderboardPlayer[] = affiliates
        .map((player: any, index: number): LeaderboardPlayer => ({
          rank: index + 1,
          username:
            player.username ||
            player.name ||
            player.display_name ||
            `Player ${index + 1}`,
          wagered: Number(
            player.wagered_amount ||
              player.wagered ||
              player.amount_wagered ||
              player.total_wagered ||
              0
          ),
        }))
        .sort((a: LeaderboardPlayer, b: LeaderboardPlayer) => b.wagered - a.wagered)
        .slice(0, 10)
        .map((player: LeaderboardPlayer, index: number): LeaderboardPlayer => ({
          ...player,
          rank: index + 1,
        }));

      if (normalized.length > 0) {
        setLeaderboardData(normalized);
      }
    } catch (error) {
      console.error("Leaderboard failed to load", error);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const loadPredictions = useCallback(async () => {
  try {
    if (!currentPredictionHunt?.id) {
      setPredictions([]);
      return;
    }

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

    const normalized: PredictionItem[] = raw
      .map((entry: any, index: number) => ({
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
      }))
      .sort((a: any, b: any) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    setPredictions(normalized);
  } catch (error) {
    console.error("Predictions failed to load", error);
    setPredictions([]);
  }
}, [currentPredictionHunt?.id]);

  const loadLiveStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/twitch/live", { cache: "no-store" });
      if (!res.ok) {
        setLiveLoading(false);
        return;
      }

      const data = await res.json();

      setLiveStatus({
        isLive: Boolean(data?.isLive),
        title: data?.title || "",
        gameName: data?.gameName || "",
        viewerCount: Number(data?.viewerCount || 0),
        startedAt: data?.startedAt || "",
      });
    } catch (error) {
      console.error("Live status failed to load", error);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const loadBracket = useCallback(async () => {
    try {
      const res = await fetch("/api/tournaments", { cache: "no-store" });
      if (!res.ok) {
        setBracketLoading(false);
        return;
      }

      const data = await res.json();
      if (data?.bracket?.rounds?.length) {
        setBracket(maybeAutoAdvanceClassic8(data.bracket));
      }
    } catch (error) {
      console.error("Bracket failed to load", error);
    } finally {
      setBracketLoading(false);
    }
  }, []);

 // INITIAL LOAD + POLLING
useEffect(() => {
  loadLeaderboard();
  loadHunts();
  loadPredictions();
  loadLiveStatus();
  loadBracket();

  const liveTimer = setInterval(loadLiveStatus, 60000);
  const predictionTimer = setInterval(loadPredictions, 5000);
  const huntTimer = setInterval(loadHunts, 5000);

  return () => {
    clearInterval(liveTimer);
    clearInterval(predictionTimer);
    clearInterval(huntTimer);
  };
}, [loadBracket, loadHunts, loadLeaderboard, loadLiveStatus, loadPredictions]);

// LOAD USER SESSION
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("error_description") || params.get("error");

  if (authError) {
    setPredictionMessage(decodeURIComponent(authError));
  }

  const loadUser = async () => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabaseBrowser.auth.getSession();

      if (sessionError) {
        console.error("getSession error", sessionError);
        return;
      }

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

  return () => {
    subscription.unsubscribe();
  };
}, []);

// FORCE UI REFRESH TIMER
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

// REALTIME UPDATES (FIXED)
useEffect(() => {
  const channel = supabaseBrowser
    .channel("trashguy-live-updates")

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

    if (nextRow?.id) {
      setAdminHuntId(nextRow.id);
    }

    const activeHuntId = adminHuntId || currentPredictionHunt?.id;

    // 🚫 Ignore updates from OTHER hunts
    if (nextRow?.id !== activeHuntId) {
      loadHunts();
      return;
    }

    if (nextRow?.status === "open") {
      setPredictionStatus("open");
    } else if (nextRow?.status === "locked" || nextRow?.status === "completed") {
      setPredictionStatus("locked");
    }

    loadHunts();
    loadPredictions();
  }
)

    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournaments" },
      () => {
        loadBracket();
      }
    )

    .subscribe();

  return () => {
    supabaseBrowser.removeChannel(channel);
  };
}, [loadBracket, loadPredictions, loadHunts, adminHuntId, currentPredictionHunt?.id]);

// ADMIN MODE PERSISTENCE (FIXED POSITION)
useEffect(() => {
  if (typeof window === "undefined") return;
  localStorage.setItem("trashguy_admin_mode", String(isAdmin));
}, [isAdmin]);

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
      console.error("OAuth error:", error);
      setPredictionMessage(error.message);
      return;
    }

    if (!data?.url) {
      setPredictionMessage("No Twitch redirect URL was returned.");
    }
  } catch (err: any) {
    console.error("Login crash:", err);
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
    setIsAdmin(false);
    setActiveSection("home");

    localStorage.removeItem("trashguy_admin_mode"); // 👈 ADD THIS

    setPredictionMessage("Logged out.");
  } catch {
    setPredictionMessage("Logout failed.");
  }
};

  const handlePredictionSubmit = async () => {
  if (!isTwitchConnected || predictionStatus !== "open" || !currentPredictionHunt?.id) return

    const guess = Number(predictionInput || 0);

    if (!guess || Number.isNaN(guess)) {
      setPredictionMessage("Enter a valid guess.");
      return;
    }

    try {
      const { data: sessionData, error: sessionError } =
        await supabaseBrowser.auth.getSession();

      if (sessionError || !sessionData.session) {
        setPredictionMessage("Not logged in. Please reconnect Twitch.");
        return;
      }

      const token = sessionData.session.access_token;

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

      const savedUsername = data?.username || viewerName;
      const savedId =
        data?.prediction?.id?.toString() || `${savedUsername.toLowerCase()}-${Date.now()}`;
      const savedAt =
        data?.prediction?.updated_at ||
        data?.prediction?.created_at ||
        new Date().toISOString();

      setPredictions((current) => {
        const existingIndex = current.findIndex(
          (entry) =>
            entry.id === savedId ||
            entry.username.toLowerCase() === savedUsername.toLowerCase()
        );

        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = {
            ...next[existingIndex],
            id: savedId,
            username: savedUsername,
            guess,
            createdAt: savedAt,
          };
          return next;
        }

        return [
          {
            id: savedId,
            username: savedUsername,
            guess,
            createdAt: savedAt,
          },
          ...current,
        ];
      });

      setPredictionInput("");
      setPredictionMessage("Prediction saved.");
      loadPredictions();
    } catch {
      setPredictionMessage("Failed to save prediction.");
    }
  };

  const handleStartHunt = async () => {
    try {
      const token = await getAccessToken();

      const res = await fetch("/api/admin/hunts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Live Hunt",
          casino: "Roulobets",
          startAmount: 10000,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAdminMessage(data?.error || "Failed to start hunt.");
        return;
      }

      setAdminHuntId(data?.hunt?.id || "");
      setPredictionStatus("open");
      setLatestWinners([]);
      setFinalResult("");
      setAdminMessage("New hunt started.");
      loadHunts();
      loadPredictions();
    } catch {
      setAdminMessage("Failed to start hunt.");
    }
  };

  const handleLockPredictions = async () => {
    if (!adminHuntId) {
      setAdminMessage("Start a new hunt first.");
      return;
    }

    try {
      const token = await getAccessToken();

      const res = await fetch(`/api/admin/hunts/${adminHuntId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "lock",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAdminMessage(data?.error || "Failed to lock predictions.");
        return;
      }

      setPredictionStatus("locked");
      setAdminMessage("Predictions locked.");
      loadPredictions();
    } catch {
      setAdminMessage("Failed to lock predictions.");
    }
  };

  const handleOpenPredictions = async () => {
    if (!adminHuntId) {
      setAdminMessage("Start a new hunt first.");
      return;
    }

    try {
      const token = await getAccessToken();

      const res = await fetch(`/api/admin/hunts/${adminHuntId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "open",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAdminMessage(data?.error || "Failed to open predictions.");
        return;
      }

      setPredictionStatus("open");
      setAdminMessage("Predictions opened.");
      loadPredictions();
    } catch {
      setAdminMessage("Failed to open predictions.");
    }
  };

  const handleCompleteHunt = async () => {
    if (!adminHuntId) {
      setAdminMessage("Start a new hunt first.");
      return;
    }

    const amount = Number(finalResult || 0);
    if (!amount) {
      setAdminMessage("Enter a final result first.");
      return;
    }

    try {
      const token = await getAccessToken();

      const res = await fetch(`/api/admin/hunts/${adminHuntId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "complete",
          finalAmount: amount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAdminMessage(data?.error || "Failed to complete hunt.");
        return;
      }

      setPredictionStatus("locked");
      setLatestWinners(Array.isArray(data?.winners) ? data.winners : []);
      setAdminMessage("Hunt completed and winners calculated.");
      loadHunts();
      loadPredictions();
    } catch {
      setAdminMessage("Failed to complete hunt.");
    }
  };

  const updateBracketTitle = (value: string) => {
    setBracket((current) => ({
      ...current,
      title: value,
    }));
  };

  const updateRoundName = (roundId: string, value: string) => {
    setBracket((current) => ({
      ...current,
      rounds: current.rounds.map((round) =>
        round.id === roundId ? { ...round, name: value } : round
      ),
    }));
  };

  const updateMatchField = (
    roundId: string,
    matchId: string,
    field: "player1" | "player2",
    value: string
  ) => {
    setBracket((current) =>
      maybeAutoAdvanceClassic8({
        ...current,
        rounds: current.rounds.map((round) =>
          round.id !== roundId
            ? round
            : {
                ...round,
                matches: round.matches.map((match) =>
                  match.id === matchId ? { ...match, [field]: value } : match
                ),
              }
        ),
      })
    );
  };

  const selectMatchWinner = (
    roundId: string,
    matchId: string,
    winner: string
  ) => {
    setBracket((current) =>
      maybeAutoAdvanceClassic8({
        ...current,
        rounds: current.rounds.map((round) =>
          round.id !== roundId
            ? round
            : {
                ...round,
                matches: round.matches.map((match) =>
                  match.id === matchId ? { ...match, winner } : match
                ),
              }
        ),
      })
    );
  };

  const clearMatchWinner = (roundId: string, matchId: string) => {
    setBracket((current) =>
      maybeAutoAdvanceClassic8({
        ...current,
        rounds: current.rounds.map((round) =>
          round.id !== roundId
            ? round
            : {
                ...round,
                matches: round.matches.map((match) =>
                  match.id === matchId ? { ...match, winner: "" } : match
                ),
              }
        ),
      })
    );
  };

  const handleGenerateBracket = () => {
    const count = Number(generatorTeamCount);

    if (!count || Number.isNaN(count) || count < 2) {
      setBracketMessage("Enter at least 2 teams.");
      return;
    }

    setBracket(createBracketFromTeamCount(count, bracket.title || "Trashguy Tournament"));
    setBracketMessage("Bracket generated locally. Click Save Bracket to keep it.");
  };

  const saveBracket = async () => {
    try {
      setBracketMessage("");

      const { data: sessionData, error: sessionError } =
        await supabaseBrowser.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        setBracketMessage("Missing Twitch session. Please log in again.");
        return;
      }

      const token = sessionData.session.access_token;

      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bracket }),
      });

      const data = await res.json();

      if (!res.ok) {
        setBracketMessage(data?.error || "Failed to save bracket.");
        return;
      }

      if (data?.bracket) {
        setBracket(maybeAutoAdvanceClassic8(data.bracket));
      }

      setBracketMessage("Bracket saved.");
    } catch {
      setBracketMessage("Failed to save bracket.");
    }
  };

  const resetBracket = async () => {
    setBracket(defaultBracket);
    setBracketMessage("Bracket reset locally. Click Save Bracket to keep it.");
  };

  const rankedWinners = useMemo(() => {
    if (latestWinners.length > 0) {
      return latestWinners.map((winner: any) => ({
        id: `${winner.profile_id}-${winner.placement}`,
        username: winner.username || winner.profile_id,
        guess: winner.guess_amount,
        distance: winner.distance,
      }));
    }

    const result = Number(finalResult || 0);
    if (!result) return [];

    return [...predictions]
      .map((entry) => ({
        ...entry,
        distance: Math.abs(result - Number(entry.guess)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
  }, [predictions, finalResult, latestWinners]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(20,184,166,0.12),transparent_30%)]">
        <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(0,0,0,0.82),rgba(0,0,0,0.96))]">
          <header className="relative overflow-hidden border-b border-white/10 bg-black/80 backdrop-blur-md">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-emerald-300/30 shadow-[0_0_18px_rgba(110,231,183,0.7)]" />

            <div className="relative mx-auto max-w-7xl px-6 py-10">
              <div className="flex flex-col items-center gap-7">
                <div className="relative">
                  <div className="absolute inset-0 scale-125 rounded-full bg-emerald-300/10 blur-2xl" />
                  <img
                    src="/logo.png"
                    alt="Trashguy"
                    className="relative max-h-32 w-auto object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.08)]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div
                    className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] ${
                      liveStatus.isLive
                        ? "border-red-400/40 bg-red-500/15 text-red-200"
                        : "border-white/10 bg-white/5 text-white/60"
                    }`}
                  >
                    {liveLoading ? "Checking stream..." : liveStatus.isLive ? "Live now" : "Offline"}
                  </div>

                  {liveStatus.isLive && liveStatus.viewerCount > 0 && (
                    <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-emerald-200">
                      {liveStatus.viewerCount.toLocaleString()} watching
                    </div>
                  )}

                  {isTwitchConnected ? (
                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                      {viewerAvatar ? (
                        <img
                          src={viewerAvatar}
                          alt={viewerDisplayName}
                          className="h-9 w-9 rounded-full border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm font-black text-emerald-300">
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
                      className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
                    >
                      Connect Twitch
                    </button>
                  )}
                </div>

                <nav className="relative flex flex-wrap items-center justify-center gap-8 rounded-full border border-white/10 bg-white/5 px-7 py-3 shadow-[0_0_35px_rgba(16,185,129,0.08)]">
                  {navButton("home", "Home")}
                  {navButton("leaderboard", "Leaderboard")}
                  {navButton("hunts", "Bonus Hunts")}
                  {navButton("predictions", "Predictions")}
                  {navButton("tournaments", "Tournaments")}
                  {adminAllowed && navButton("admin", "Admin")}
                </nav>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-10">
            {activeSection === "home" && (
              <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <Panel className="border-emerald-300/20 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
                  <SectionLabel>Home</SectionLabel>
                  <h1 className="mt-3 text-4xl font-black tracking-wide">TRASHGUY</h1>
                  <p className="mt-4 max-w-xl text-white/65">
                    Your stream hub for socials, live content, bonus hunts, predictions,
                    and tournaments.
                  </p>

                  <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                          Stream status
                        </div>
                        <div className="mt-2 text-2xl font-black">
                          {liveLoading ? "Checking..." : liveStatus.isLive ? "TRASHGUY IS LIVE" : "Currently offline"}
                        </div>
                        {liveStatus.title && (
                          <div className="mt-2 text-white/60">{liveStatus.title}</div>
                        )}
                        {liveStatus.gameName && (
                          <div className="mt-2 text-sm uppercase tracking-[0.22em] text-emerald-300">
                            {liveStatus.gameName}
                          </div>
                        )}
                      </div>

                      <a
                        href="https://www.twitch.tv/trashguy__"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-200"
                      >
                        Open Twitch
                      </a>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-3">
                    {socials.map((social) => (
                      <a
                        key={social.name}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-5 py-4 transition hover:border-emerald-300/40 hover:bg-black/45"
                      >
                        <span className="font-semibold">{social.name}</span>
                        <span className="text-sm text-emerald-300">Visit</span>
                      </a>
                    ))}
                  </div>
                </Panel>

                <Panel className="border-fuchsia-300/20 shadow-[0_0_40px_rgba(217,70,239,0.08)]">
                  <SectionLabel color="fuchsia">Live Stream</SectionLabel>
                  <h2 className="mt-3 text-3xl font-black">WATCH TRASHGUY LIVE</h2>
                  <p className="mt-4 text-white/65">Live Twitch embed for your site.</p>

                  <div className="mt-6 mb-3 text-xs uppercase tracking-[0.26em] text-emerald-300">
                    {liveStatus.isLive ? "Live stream" : "Channel player"}
                  </div>

                  <div className="aspect-video w-full overflow-hidden rounded-[1.25rem] border border-emerald-300/20">
                    <iframe
                      src="https://player.twitch.tv/?channel=trashguy__&parent=localhost&parent=127.0.0.1&parent=trashguy-site.vercel.app&parent=trashguy.me"
                      height="100%"
                      width="100%"
                      allowFullScreen
                      className="rounded-[1.25rem]"
                    />
                  </div>
                </Panel>
              </section>
            )}

            {activeSection === "leaderboard" && (
              <section className="relative overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-white/5 p-8 shadow-[0_0_70px_rgba(16,185,129,0.10)] backdrop-blur-xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_28%)]" />
                <div className="relative z-10">
                  <SectionLabel>Leaderboard</SectionLabel>
                  <h2 className="mt-3 text-4xl font-black tracking-wide">TOP 10 PLAYERS</h2>

                  <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-emerald-300/35 bg-black/40 shadow-[0_0_65px_rgba(16,185,129,0.16)] ring-1 ring-emerald-300/10">
                    <div className="grid grid-cols-[90px_1fr_160px] border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm font-bold uppercase tracking-[0.24em] text-white/70">
                      <div>#</div>
                      <div>Username</div>
                      <div className="text-right">Wagered</div>
                    </div>

                    {leaderboardLoading ? (
                      <div className="px-5 py-8 text-white/60">Loading leaderboard...</div>
                    ) : (
                      leaderboardData.map((player) => (
                        <div
                          key={`${player.rank}-${player.username}`}
                          className="grid grid-cols-[90px_1fr_160px] items-center border-b border-white/5 px-5 py-4 text-lg transition hover:bg-white/[0.03] last:border-b-0"
                        >
                          <div className="font-black text-emerald-300">{player.rank}</div>
                          <div className="font-semibold text-white/95">{player.username}</div>
                          <div className="text-right font-black text-emerald-200">
                            {formatMoney(player.wagered)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeSection === "hunts" && (
              <section className="flex justify-center">
                <Panel className="w-full max-w-6xl border-emerald-300/25 shadow-[0_0_65px_rgba(16,185,129,0.10)]">
                  <div className="relative z-10">
                    <SectionLabel>Bonus Hunts</SectionLabel>
                    <h2 className="mt-3 text-4xl font-black tracking-wide">LIVE & RECENT HUNTS</h2>

                    <div className="mt-8 grid gap-6">
                      {huntsLoading ? (
                        <div className="text-white/60">Loading hunts...</div>
                      ) : (
                        huntsData.map((hunt) => (
                          <div
                            key={hunt.id}
                            className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="text-xl font-black text-white">{hunt.title}</div>
                                <div className="mt-1 text-sm text-white/50">{hunt.casino}</div>
                              </div>
                              <div
                                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${
                                  hunt.isOpening
                                    ? "bg-emerald-400 text-black"
                                    : "bg-white/10 text-white/80"
                                }`}
                              >
                                {hunt.isOpening ? "Opening" : "Completed"}
                              </div>
                            </div>

                            <div className="mt-5 grid gap-3 md:grid-cols-3">
                              <div className="rounded-2xl bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/45">
                                  Start
                                </div>
                                <div className="mt-2 text-xl font-black">
                                  {formatMoney(hunt.startCost)}
                                </div>
                              </div>

                              <div className="rounded-2xl bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/45">
                                  Winnings
                                </div>
                                <div className="mt-2 text-xl font-black">
                                  {formatMoney(hunt.totalWinnings)}
                                </div>
                              </div>

                              <div className="rounded-2xl bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/45">
                                  P/L
                                </div>
                                <div
                                  className={`mt-2 text-xl font-black ${
                                    hunt.profitLoss >= 0 ? "text-emerald-300" : "text-red-300"
                                  }`}
                                >
                                  {hunt.profitLoss >= 0 ? "+" : ""}
                                  {formatMoney(hunt.profitLoss)}
                                </div>
                                <div className="mt-1 text-sm text-white/45">
                                  {hunt.profitLossPercentage}%
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Panel>
              </section>
            )}

           {activeSection === "predictions" && (
  <section className="grid gap-6 2xl:grid-cols-[1fr_1.35fr]">
    <Panel className="border-fuchsia-300/25 shadow-[0_0_65px_rgba(217,70,239,0.10)]">
  <SectionLabel color="fuchsia">Live Bonus Hunt</SectionLabel>

  <div className="mt-3 flex items-center justify-between gap-4">
    <h2 className="text-4xl font-black tracking-wide">
      {currentPredictionHunt?.title || "Latest Hunt"}
    </h2>

    <div
      className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] ${
        predictionStatus === "open"
          ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-black/30 text-white/65"
      }`}
    >
      {predictionStatus === "open" ? "Open" : "Locked"}
    </div>
  </div>

  <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
    <div className="rounded-[1.1rem] border border-white/10 bg-black/35 px-5 py-4">
      <div className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        Start
      </div>
      <div className="mt-2 text-2xl font-black text-white">
        {formatMoney(currentPredictionHunt?.startCost || 0)}
      </div>
    </div>

    <div className="rounded-[1.1rem] border border-white/10 bg-black/35 px-5 py-4">
      <div className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        Won
      </div>
      <div className="mt-2 text-2xl font-black text-white">
        {formatMoney(
          currentPredictionHunt?.stats?.totalWinnings ||
            currentPredictionHunt?.totalWinnings ||
            0
        )}
      </div>
    </div>

    <div className="rounded-[1.1rem] border border-white/10 bg-black/35 px-5 py-4">
      <div className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        Bonuses
      </div>
      <div className="mt-2 text-2xl font-black text-white">
        {currentPredictionHunt?.bonuses?.length || 0}
      </div>
    </div>

    <div className="rounded-[1.1rem] border border-white/10 bg-black/35 px-5 py-4">
      <div className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
        Avg
      </div>
      <div className="mt-2 text-2xl font-black text-white">
        {currentPredictionHunt?.stats?.currentAverageMultiplier
          ? `${Number(currentPredictionHunt.stats.currentAverageMultiplier).toFixed(2)}x`
          : `${currentPredictionAvgX}x`}
      </div>
    </div>

    <div className="rounded-[1.1rem] border border-white/10 bg-black/35 px-5 py-4">
  <div className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
    Req
  </div>
 <div className="mt-2 text-2xl font-black text-white">
  {currentPredictionHunt?.stats?.averagePayoutRequired &&
  currentPredictionHunt?.stats?.averageBetSize
    ? `${(
        Number(currentPredictionHunt.stats.averagePayoutRequired) /
        Number(currentPredictionHunt.stats.averageBetSize)
      ).toFixed(2)}x`
    : "---"}
</div>
</div>
  </div>

  <div className="mt-4 grid gap-4 lg:grid-cols-2">
    <div className="rounded-[1.3rem] border border-white/10 bg-black/35 p-6 min-h-[170px]">
      <div className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
        Best Slot
      </div>
      <div className="mt-4 text-center text-3xl font-black text-white">
        {currentPredictionHunt?.bonuses?.length
          ? [...currentPredictionHunt.bonuses].sort(
              (a: any, b: any) => Number(b.payout || 0) - Number(a.payout || 0)
            )[0]?.slotName || "---"
          : "---"}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
          Win{" "}
          {formatMoney(
            currentPredictionHunt?.bonuses?.length
              ? [...currentPredictionHunt.bonuses].sort(
                  (a: any, b: any) => Number(b.payout || 0) - Number(a.payout || 0)
                )[0]?.payout || 0
              : 0
          )}
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
          X{" "}
          {currentPredictionHunt?.bonuses?.length
            ? `${Number(
                [...currentPredictionHunt.bonuses].sort(
                  (a: any, b: any) => Number(b.payout || 0) - Number(a.payout || 0)
                )[0]?.multiplier || 0
              ).toFixed(2)}x`
            : "0.00x"}
        </div>
      </div>
    </div>

    <div className="rounded-[1.3rem] border border-white/10 bg-black/35 p-6 min-h-[170px]">
      <div className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
        Highest X
      </div>
      <div className="mt-4 text-center text-3xl font-black text-white">
        {currentPredictionHunt?.bonuses?.length
          ? `${Number(
              [...currentPredictionHunt.bonuses].sort(
                (a: any, b: any) =>
                  Number(b.multiplier || 0) - Number(a.multiplier || 0)
              )[0]?.multiplier || 0
            ).toFixed(2)}x`
          : "---"}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
          Win{" "}
          {formatMoney(
            currentPredictionHunt?.bonuses?.length
              ? [...currentPredictionHunt.bonuses].sort(
                  (a: any, b: any) =>
                    Number(b.multiplier || 0) - Number(a.multiplier || 0)
                )[0]?.payout || 0
              : 0
          )}
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
          X{" "}
          {currentPredictionHunt?.bonuses?.length
            ? `${Number(
                [...currentPredictionHunt.bonuses].sort(
                  (a: any, b: any) =>
                    Number(b.multiplier || 0) - Number(a.multiplier || 0)
                )[0]?.multiplier || 0
              ).toFixed(2)}x`
            : "0.00x"}
        </div>
      </div>
    </div>
  </div>

  <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-black/35 p-6">
    <div className="flex items-center justify-between gap-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
        Live Bonus Feed
      </div>

      <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
        {currentPredictionHunt?.bonuses?.length || 0} Bonus
        {(currentPredictionHunt?.bonuses?.length || 0) === 1 ? "" : "es"}
      </div>
    </div>

    <div className="mt-4 max-h-[260px] overflow-y-auto rounded-[1.1rem] border border-white/10 bg-black/20">
      {!currentPredictionHunt?.bonuses?.length ? (
        <div className="flex h-[180px] items-center justify-center text-white/45">
          No bonuses yet.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {currentPredictionHunt.bonuses.map((bonus: any, index: number) => (
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
                      Bet {formatMoney(Number(bonus.betSize || 0))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-black text-emerald-200">
                  {formatMoney(Number(bonus.payout || 0))}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                  {Number(bonus.multiplier || 0).toFixed(2)}x
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
</Panel>

    <Panel className="border-emerald-300/25 shadow-[0_0_65px_rgba(16,185,129,0.10)]">
      <div className="mb-4 text-center text-4xl font-black tracking-wide">Predictions</div>

      <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.15fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white/65">
              {currentPredictionCount} Entries
            </div>
            <div
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] ${
                predictionStatus === "open"
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-black/30 text-white/65"
              }`}
            >
              {predictionStatus === "open" ? "Open" : "None"}
            </div>
          </div>

          <div className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">
            Your Entry
          </div>

          <div className="mt-4 text-center text-4xl font-black">
            {predictionStatus === "open" && currentPredictionEntry
  ? formatMoney(currentPredictionEntry.guess)
  : "--"}
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
  disabled={predictionStatus !== "open"}
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

        <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-6">
          <div className="mb-4 flex items-center justify-end gap-2">
            <button
              onClick={() => setPredictionSortMode("highest")}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] transition ${
                predictionSortMode === "highest"
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 bg-black/30 text-white/65 hover:text-white"
              }`}
            >
              Highest
            </button>
            <button
              onClick={() => setPredictionSortMode("newest")}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] transition ${
                predictionSortMode === "newest"
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 bg-black/30 text-white/65 hover:text-white"
              }`}
            >
              Newest
            </button>
          </div>

          <div className="h-[520px] overflow-y-auto rounded-[1.1rem] border border-white/10 bg-black/20">
            {predictionStatus !== "open" || sortedPredictionsForTab.length === 0 ? (
  <div className="flex h-full items-center justify-center text-white/45">
    No entries.
  </div>
) : (
  <div className="divide-y divide-white/5">
    {sortedPredictionsForTab.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xs font-black text-emerald-300">
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
                      <div className="text-lg font-black text-emerald-200">
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
    </Panel>
  </section>
)}

            {activeSection === "tournaments" && (
              <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Panel className="border-fuchsia-300/25 shadow-[0_0_65px_rgba(217,70,239,0.10)]">
                  <SectionLabel color="fuchsia">Tournaments</SectionLabel>
                  <h2 className="mt-3 text-4xl font-black tracking-wide">{bracket.title}</h2>

                  {bracketLoading ? (
                    <div className="mt-8 text-white/60">Loading bracket...</div>
                  ) : (
                    <div className="mt-8 grid gap-4 xl:grid-cols-3">
                      {bracket.rounds.map((round) => (
                        <div
                          key={round.id}
                          className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5"
                        >
                          <div className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-300">
                            {round.name}
                          </div>

                          <div className="space-y-4">
                            {round.matches.map((match) => (
                              <MatchCard key={match.id} match={match} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel className="border-emerald-300/25 shadow-[0_0_65px_rgba(16,185,129,0.10)]">
                  <SectionLabel>Bracket Status</SectionLabel>
                  <h2 className="mt-3 text-4xl font-black tracking-wide">
                    {adminAllowed ? "EDITABLE" : "VIEW ONLY"}
                  </h2>
                  <p className="mt-4 text-white/65">
                    Generate a new bracket, edit teams, and save it live from the admin panel.
                  </p>

                  <div className="mt-8 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Generate 4 / 8 / 16 team brackets
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Edit team names after generating
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Classic 8-team bracket auto-advances winners
                    </div>
                  </div>
                </Panel>
              </section>
            )}

            {activeSection === "admin" && adminAllowed && (
              <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <Panel className="border-emerald-300/25 shadow-[0_0_65px_rgba(16,185,129,0.10)]">
                  <SectionLabel>Admin</SectionLabel>
                  <h2 className="mt-3 text-4xl font-black tracking-wide">CONTROL PANEL</h2>
                  <p className="mt-4 text-white/65">
                    Admin panel is only shown for approved Twitch accounts.
                  </p>

                  <div className="mt-8 grid gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                        Signed in as
                      </div>
                      <div className="mt-2 text-xl font-black text-white">{viewerDisplayName}</div>
                      <div className="mt-1 text-white/45">@{viewerName}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                        Admin Name
                      </div>
                      <input
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                      />
                    </div>

                    <button
                      onClick={() => setIsAdmin((v) => !v)}
                      className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-4 font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
                    >
                      {isAdmin ? `Admin Enabled (${adminName})` : "Enable Admin Mode"}
                    </button>

                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        onClick={handleStartHunt}
                        disabled={!isAdmin}
                        className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-semibold text-white disabled:opacity-40"
                      >
                        Start New Hunt
                      </button>
                      <button
                        onClick={handleOpenPredictions}
                        disabled={!isAdmin}
                        className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-semibold text-white disabled:opacity-40"
                      >
                        Open Predictions
                      </button>
                      <button
                        onClick={handleLockPredictions}
                        disabled={!isAdmin}
                        className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-semibold text-white disabled:opacity-40"
                      >
                        Close Predictions
                      </button>
                      <button
                        onClick={handleCompleteHunt}
                        disabled={!isAdmin}
                        className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-semibold text-white disabled:opacity-40"
                      >
                        Complete Hunt
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                        Final Hunt Result
                      </div>
                      <input
                        value={finalResult}
                        onChange={(e) => setFinalResult(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Enter final balance"
                        disabled={!isAdmin}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none disabled:opacity-40"
                      />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                      {adminMessage || `Current internal hunt ID: ${adminHuntId || "none yet"}`}
                    </div>
                  </div>

                  <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
                    <div className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
                      Top 2 Winners
                    </div>
                    <div className="mt-4 space-y-3">
                      {rankedWinners.length === 0 && (
                        <div className="text-white/50">Set a final result to rank winners.</div>
                      )}
                      {rankedWinners.map((winner, index) => (
                        <div
                          key={winner.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div className="font-semibold text-white">
                            #{index + 1} {winner.username}
                          </div>
                          <div className="mt-1 text-sm text-white/55">
                            Guess: {formatMoney(winner.guess)} • Off by{" "}
                            {formatMoney(winner.distance)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>

                <Panel className="border-fuchsia-300/25 shadow-[0_0_65px_rgba(217,70,239,0.10)]">
                  <SectionLabel color="fuchsia">Tournament Admin</SectionLabel>
                  <h2 className="mt-3 text-4xl font-black tracking-wide">EDIT BRACKET</h2>

                  <div className="mt-8 grid gap-4">
                    <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
                        Bracket title
                      </div>
                      <input
                        value={bracket.title}
                        onChange={(e) => updateBracketTitle(e.target.value)}
                        disabled={!isAdmin}
                        className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none disabled:opacity-40"
                      />
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
                        Generate bracket
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
                        <input
                          value={generatorTeamCount}
                          onChange={(e) => setGeneratorTeamCount(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="How many teams?"
                          disabled={!isAdmin}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none disabled:opacity-40"
                        />

                        <button
                          onClick={handleGenerateBracket}
                          disabled={!isAdmin}
                          className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
                        >
                          Generate Bracket
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {[4, 8, 16].map((count) => (
                          <button
                            key={count}
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => {
                              setGeneratorTeamCount(String(count));
                              setBracket(createBracketFromTeamCount(count, bracket.title || "Trashguy Tournament"));
                              setBracketMessage("Bracket generated locally. Click Save Bracket to keep it.");
                            }}
                            className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                          >
                            {count} Teams
                          </button>
                        ))}
                      </div>
                    </div>

                    {bracket.rounds.map((round) => (
                      <div
                        key={round.id}
                        className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5"
                      >
                        <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
                          Round name
                        </div>
                        <input
                          value={round.name}
                          onChange={(e) => updateRoundName(round.id, e.target.value)}
                          disabled={!isAdmin}
                          className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none disabled:opacity-40"
                        />

                        <div className="mt-5 grid gap-4">
                          {round.matches.map((match) => (
                            <div
                              key={match.id}
                              className="rounded-2xl border border-white/10 bg-white/5 p-4"
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-300">
                                  {match.id.toUpperCase()}
                                </div>
                                <div className="text-xs uppercase tracking-[0.22em] text-white/35">
                                  {match.winner ? `Winner: ${match.winner}` : "No winner selected"}
                                </div>
                              </div>

                              <div className="grid gap-3">
                                <input
                                  value={match.player1}
                                  onChange={(e) =>
                                    updateMatchField(round.id, match.id, "player1", e.target.value)
                                  }
                                  disabled={!isAdmin}
                                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none disabled:opacity-40"
                                />
                                <input
                                  value={match.player2}
                                  onChange={(e) =>
                                    updateMatchField(round.id, match.id, "player2", e.target.value)
                                  }
                                  disabled={!isAdmin}
                                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none disabled:opacity-40"
                                />
                              </div>

                              <div className="mt-4 grid gap-2 md:grid-cols-3">
                                <button
                                  onClick={() => selectMatchWinner(round.id, match.id, match.player1)}
                                  disabled={!isAdmin || !match.player1.trim()}
                                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-40 ${
                                    match.winner === match.player1
                                      ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                                      : "border-white/10 bg-black/30 text-white"
                                  }`}
                                >
                                  Pick {match.player1 || "Player 1"}
                                </button>

                                <button
                                  onClick={() => selectMatchWinner(round.id, match.id, match.player2)}
                                  disabled={!isAdmin || !match.player2.trim()}
                                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-40 ${
                                    match.winner === match.player2
                                      ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                                      : "border-white/10 bg-black/30 text-white"
                                  }`}
                                >
                                  Pick {match.player2 || "Player 2"}
                                </button>

                                <button
                                  onClick={() => clearMatchWinner(round.id, match.id)}
                                  disabled={!isAdmin}
                                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                                >
                                  Clear Winner
                                </button>
                              </div>

                              <div className="mt-4">
                                <MatchCard match={match} compact />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        onClick={saveBracket}
                        disabled={!isAdmin}
                        className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-4 font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
                      >
                        Save Bracket
                      </button>
                      <button
                        onClick={resetBracket}
                        disabled={!isAdmin}
                        className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-semibold text-white disabled:opacity-40"
                      >
                        Reset Bracket
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
                      {bracketMessage || "Generate a bracket, edit it, then save it live."}
                    </div>
                  </div>
                </Panel>
              </section>
            )}
          </main>

          <footer className="relative overflow-hidden border-t border-white/10 bg-black/60 px-6 py-8">
            <div className="absolute inset-x-0 top-0 h-px bg-emerald-300/20 shadow-[0_0_14px_rgba(110,231,183,0.55)]" />
            <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-white/45 md:flex-row md:items-center md:justify-between">
              <div>© 2026 Trashguy</div>
              <div className="flex flex-wrap gap-4">
                {socials.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white"
                  >
                    {social.name}
                  </a>
                ))}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}