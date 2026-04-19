"use client";

import React, { useEffect, useMemo, useState } from "react";
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

const fallbackHunts = [
  {
    id: "hunt-1",
    title: "Friday Night Hunt",
    casino: "RouloBets",
    startCost: 25000,
    totalWinnings: 18730,
    profitLoss: -6270,
    profitLossPercentage: -25.08,
    isOpening: true,
  },
];

const initialPredictions = [
  { id: "p1", username: "slotking", guess: 18250, createdAt: "2m ago" },
  { id: "p2", username: "maxchaser", guess: 19100, createdAt: "4m ago" },
  { id: "p3", username: "bonusboss", guess: 17600, createdAt: "7m ago" },
];

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

const ADMIN_USERS = ["trashguy__", "trashguy", "parz"];

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatTimeAgo(value?: string | null) {
  if (!value) return "just now";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return `${Math.floor(seconds / 86400)}d ago`;
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

type LeaderboardPlayer = {
  rank: number;
  username: string;
  wagered: number;
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
};

type PredictionItem = {
  id: string;
  username: string;
  guess: number;
  createdAt: string;
};

type WinnerItem = {
  profile_id: string;
  guess_amount: number;
  distance: number;
  placement: number;
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

export default function Home() {
  const [activeSection, setActiveSection] = useState("home");

  const [viewerName, setViewerName] = useState("viewer");
  const [viewerDisplayName, setViewerDisplayName] = useState("viewer");
  const [viewerAvatar, setViewerAvatar] = useState("");
  const [isTwitchConnected, setIsTwitchConnected] = useState(false);

  const [predictionInput, setPredictionInput] = useState("");
  const [predictionStatus, setPredictionStatus] = useState<"open" | "locked">("open");
  const [predictions, setPredictions] = useState<PredictionItem[]>(initialPredictions);
  const [predictionMessage, setPredictionMessage] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState("Parz");
  const [finalResult, setFinalResult] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [latestWinners, setLatestWinners] = useState<WinnerItem[]>([]);
  const [adminHuntId, setAdminHuntId] = useState("");

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>(fallbackLeaderboard);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const [huntsData, setHuntsData] = useState<HuntItem[]>(fallbackHunts);
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
  const [bracketLoading, setBracketLoading] = useState(true);
  const [bracketMessage, setBracketMessage] = useState("");

  const normalizedViewer = viewerName.trim().toLowerCase();
  const adminAllowed = ADMIN_USERS.includes(normalizedViewer);

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

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    return session?.access_token || "";
  };

  const loadHunts = async () => {
    try {
      const res = await fetch("/api/hunts", { cache: "no-store" });
      const data = await res.json();

      const rawHunts = Array.isArray(data?.hunts) ? data.hunts : [];

      const normalized: HuntItem[] = rawHunts.map((hunt: any, index: number) => ({
        id: hunt.id || `hunt-${index}`,
        title: hunt.title || `Bonus Hunt ${index + 1}`,
        casino: hunt.casino || "Unknown Casino",
        startCost: Number(hunt.startCost || 0),
        totalWinnings: Number(hunt?.stats?.totalWinnings || 0),
        profitLoss: Number(hunt?.stats?.profitLoss || 0),
        profitLossPercentage: Number(hunt?.stats?.profitLossPercentage || 0),
        isOpening: Boolean(hunt.isOpening),
      }));

      if (normalized.length > 0) {
        setHuntsData(normalized);
      }
    } catch (error) {
      console.error("Hunts failed to load", error);
    } finally {
      setHuntsLoading(false);
    }
  };

  const loadLeaderboard = async () => {
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
  .sort(
    (a: LeaderboardPlayer, b: LeaderboardPlayer) => b.wagered - a.wagered
  )
  .slice(0, 10)
  .map(
    (player: LeaderboardPlayer, index: number): LeaderboardPlayer => ({
      ...player,
      rank: index + 1,
    })
  );

      if (normalized.length > 0) {
        setLeaderboardData(normalized);
      }
    } catch (error) {
      console.error("Leaderboard failed to load", error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const loadPredictions = async () => {
    try {
      const res = await fetch("/api/predictions", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      const raw =
        Array.isArray(data?.predictions) ? data.predictions :
        Array.isArray(data) ? data :
        [];

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
        createdAt: formatTimeAgo(entry.created_at || entry.updated_at || "just now"),
      }));

      if (normalized.length > 0) {
        setPredictions(normalized);
      }
    } catch (error) {
      console.error("Predictions failed to load", error);
    }
  };

  const loadLiveStatus = async () => {
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
  };

  const loadBracket = async () => {
    try {
      const res = await fetch("/api/tournaments", { cache: "no-store" });
      if (!res.ok) {
        setBracketLoading(false);
        return;
      }

      const data = await res.json();
      if (data?.bracket?.rounds?.length) {
        setBracket(data.bracket);
      }
    } catch (error) {
      console.error("Bracket failed to load", error);
    } finally {
      setBracketLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    loadHunts();
    loadPredictions();
    loadLiveStatus();
    loadBracket();

    const liveTimer = setInterval(loadLiveStatus, 60000);
    const predictionTimer = setInterval(loadPredictions, 10000);
    const huntTimer = setInterval(loadHunts, 20000);

    return () => {
      clearInterval(liveTimer);
      clearInterval(predictionTimer);
      clearInterval(huntTimer);
    };
  }, []);

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
      setPredictionMessage("Logged out.");
    } catch {
      setPredictionMessage("Logout failed.");
    }
  };

 const handlePredictionSubmit = async () => {
  if (!isTwitchConnected || predictionStatus !== "open") return;

  const guess = Number(predictionInput || 0);
  if (!guess) {
    setPredictionMessage("Enter a valid guess.");
    return;
  }

  try {
    const { data: sessionData } = await supabaseBrowser.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setPredictionMessage("Twitch session missing. Please log in again.");
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

    setPredictions((current) => {
      const existing = current.find(
        (entry) => entry.username.toLowerCase() === savedUsername.toLowerCase()
      );

      if (existing) {
        return current.map((entry) =>
          entry.username.toLowerCase() === savedUsername.toLowerCase()
            ? { ...entry, guess, createdAt: "just now" }
            : entry
        );
      }

      return [
        {
          id: `p-${Date.now()}`,
          username: savedUsername,
          guess,
          createdAt: "just now",
        },
        ...current,
      ];
    });

    setPredictionInput("");
    setPredictionMessage("Prediction saved.");
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
          casino: "Rainbet",
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
      setAdminMessage("New hunt started.");
      loadHunts();
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

  const updateMatch = (
    roundId: string,
    matchId: string,
    field: "player1" | "player2" | "winner",
    value: string
  ) => {
    setBracket((current) => ({
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
    }));
  };

  const saveBracket = async () => {
    try {
      setBracketMessage("");

      const token = await getAccessToken();

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
      return latestWinners.map((winner) => ({
        id: `${winner.profile_id}-${winner.placement}`,
        username: winner.profile_id,
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
                  <p className="mt-4 text-white/65">
                    Live Twitch embed for your site.
                  </p>

                  <div className="mt-6 mb-3 text-xs uppercase tracking-[0.26em] text-emerald-300">
                    {liveStatus.isLive ? "Live stream" : "Channel player"}
                  </div>

                  <div className="aspect-video w-full overflow-hidden rounded-[1.25rem] border border-emerald-300/20">
                    <iframe
  src="https://player.twitch.tv/?channel=trashguy__&parent=localhost&parent=127.0.0.1&parent=trashguy-site.vercel.app"
  height="100%"
  width="100%"
  allowFullScreen
  className="rounded-[1.25rem]"
></iframe>
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
              <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <Panel className="border-emerald-300/25 shadow-[0_0_65px_rgba(16,185,129,0.10)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_28%)]" />
                  <div className="relative z-10">
                    <SectionLabel>Bonus Hunts</SectionLabel>
                    <h2 className="mt-3 text-4xl font-black tracking-wide">LIVE & RECENT HUNTS</h2>

                    <div className="mt-8 grid gap-4">
                      {huntsLoading ? (
                        <div className="text-white/60">Loading hunts...</div>
                      ) : (
                        huntsData.map((hunt) => (
                          <div
                            key={hunt.id}
                            className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5 shadow-[0_0_25px_rgba(16,185,129,0.05)]"
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

                <Panel className="border-fuchsia-300/25 shadow-[0_0_65px_rgba(217,70,239,0.10)]">
                  <SectionLabel color="fuchsia">Prediction Status</SectionLabel>
                  <h2 className="mt-3 text-4xl font-black tracking-wide">
                    {predictionStatus === "open" ? "OPEN NOW" : "LOCKED"}
                  </h2>
                  <p className="mt-4 text-white/65">
                    One entry per Twitch account. Viewers can update their guess until you close
                    predictions.
                  </p>

                  <div className="mt-8 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Top 2 closest guesses win
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Twitch login required
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Entries auto-refresh on the page
                    </div>
                  </div>
                </Panel>
              </section>
            )}

            {activeSection === "predictions" && (
              <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <Panel className="border-fuchsia-300/25 shadow-[0_0_65px_rgba(217,70,239,0.10)]">
                  <SectionLabel color="fuchsia">Predictions</SectionLabel>
                  <h2 className="mt-3 text-4xl font-black tracking-wide">SUBMIT YOUR GUESS</h2>
                  <p className="mt-4 text-white/65">
                    One active entry per Twitch user. You can edit it until predictions are
                    locked.
                  </p>

                  <div className="mt-8 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                        Connected account
                      </div>

                      {isTwitchConnected ? (
                        <div className="mt-3 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                          {viewerAvatar ? (
                            <img
                              src={viewerAvatar}
                              alt={viewerDisplayName}
                              className="h-14 w-14 rounded-full border border-white/10 object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/40 text-lg font-black text-emerald-300">
                              {viewerDisplayName.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <div className="text-lg font-black text-white">{viewerDisplayName}</div>
                            <div className="text-white/45">@{viewerName}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-white/65">
                          Connect Twitch to enter predictions.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                        Prediction
                      </div>
                      <input
                        value={predictionInput}
                        onChange={(e) => setPredictionInput(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Enter final hunt balance"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        onClick={isTwitchConnected ? handleLogout : handleTwitchLogin}
                        className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-4 font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
                      >
                        {isTwitchConnected ? "Logout Twitch" : "Connect Twitch"}
                      </button>
                      <button
                        onClick={handlePredictionSubmit}
                        disabled={!isTwitchConnected || predictionStatus !== "open"}
                        className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-5 py-4 font-semibold text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save Prediction
                      </button>
                    </div>

                    {predictionMessage && (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/75 break-words">
                        {predictionMessage}
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel className="border-emerald-300/25 shadow-[0_0_65px_rgba(16,185,129,0.10)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <SectionLabel>Entries</SectionLabel>
                      <h2 className="mt-3 text-4xl font-black tracking-wide">LIVE ENTRIES</h2>
                    </div>
                    <button
                      onClick={loadPredictions}
                      className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white/70 hover:text-white"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
                    <div className="grid grid-cols-[1fr_160px_120px] border-b border-white/10 bg-white/5 px-5 py-4 text-sm font-bold uppercase tracking-[0.24em] text-white/65">
                      <div>User</div>
                      <div className="text-right">Guess</div>
                      <div className="text-right">Updated</div>
                    </div>

                    {predictions.map((entry) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[1fr_160px_120px] border-b border-white/5 px-5 py-4 last:border-b-0"
                      >
                        <div className="font-semibold text-white/90">{entry.username}</div>
                        <div className="text-right font-black text-emerald-200">
                          {formatMoney(entry.guess)}
                        </div>
                        <div className="text-right text-white/45">{entry.createdAt}</div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </section>
            )}

            {activeSection === "tournaments" && (
              <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Panel className="border-fuchsia-300/25 shadow-[0_0_65px_rgba(217,70,239,0.10)]">
                  <SectionLabel color="fuchsia">Tournaments</SectionLabel>
                  <h2 className="mt-3 text-4xl font-black tracking-wide">
                    {bracket.title}
                  </h2>

                  {bracketLoading ? (
                    <div className="mt-8 text-white/60">Loading bracket...</div>
                  ) : (
                    <div className="mt-8 grid gap-4 xl:grid-cols-3">
                      {bracket.rounds.map((round) => (
                        <div
                          key={round.id}
                          className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5"
                        >
                          <div className="text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-300">
                            {round.name}
                          </div>

                          <div className="mt-4 space-y-4">
                            {round.matches.map((match) => (
                              <div
                                key={match.id}
                                className="rounded-2xl border border-white/10 bg-white/5 p-4"
                              >
                                <div className="space-y-2">
                                  <div
                                    className={`rounded-xl border px-4 py-3 font-semibold ${
                                      match.winner === match.player1
                                        ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                                        : "border-white/10 bg-black/20 text-white"
                                    }`}
                                  >
                                    {match.player1}
                                  </div>

                                  <div className="text-center text-xs uppercase tracking-[0.22em] text-white/30">
                                    vs
                                  </div>

                                  <div
                                    className={`rounded-xl border px-4 py-3 font-semibold ${
                                      match.winner === match.player2
                                        ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                                        : "border-white/10 bg-black/20 text-white"
                                    }`}
                                  >
                                    {match.player2}
                                  </div>
                                </div>

                                {match.winner && (
                                  <div className="mt-3 text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                                    Winner: {match.winner}
                                  </div>
                                )}
                              </div>
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
                    Approved Twitch accounts can edit the bracket in the admin panel and save it live.
                  </p>

                  <div className="mt-8 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Real save/load bracket
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Winner field per matchup
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
                      Updates visible on the tournaments page
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
                              <div className="grid gap-3">
                                <input
                                  value={match.player1}
                                  onChange={(e) =>
                                    updateMatch(round.id, match.id, "player1", e.target.value)
                                  }
                                  disabled={!isAdmin}
                                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none disabled:opacity-40"
                                />
                                <input
                                  value={match.player2}
                                  onChange={(e) =>
                                    updateMatch(round.id, match.id, "player2", e.target.value)
                                  }
                                  disabled={!isAdmin}
                                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none disabled:opacity-40"
                                />
                                <input
                                  value={match.winner}
                                  onChange={(e) =>
                                    updateMatch(round.id, match.id, "winner", e.target.value)
                                  }
                                  placeholder="Winner"
                                  disabled={!isAdmin}
                                  className="rounded-xl border border-emerald-300/20 bg-black/40 px-4 py-3 text-emerald-200 outline-none disabled:opacity-40"
                                />
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
                      {bracketMessage || "Save your bracket changes live from here."}
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