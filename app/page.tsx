"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import SiteHeader from "@/components/site-header";
import { FaDiscord, FaXTwitter, FaYoutube, FaInstagram } from "react-icons/fa6";
import { slotData, providerLogos, type SlotItem } from "./slotData";

const socials = [
  {
    name: "RouloBets",
    href: "https://roulobets.com/?r=trashguy",
    image: "/roulobets.png",
  },
  {
    name: "Discord",
    href: "https://discord.gg/EqjwXzkDMK",
    icon: FaDiscord,
  },
  {
    name: "Twitter / X",
    href: "https://x.com/trashguy__",
    icon: FaXTwitter,
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@Trashguyy",
    icon: FaYoutube,
  },
  {
  name: "Instagram",
  href: "https://instagram.com/trashguy__",
  icon: FaInstagram,
},
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

const leaderboardTotal = 150;

const leaderboardPrizes: Record<number, number> = {
  1: 75,
  2: 50,
  3: 25,
};

const fallbackHunts: HuntItem[] = [];

const defaultBracket: BracketData = {
  title: "Tournament Bracket",
  rounds: [
    {
      id: "round-1",
      name: "Quarterfinals",
      matches: [
        { id: "m1", player1: "", player1Amount: "", player2: "", player2Amount: "", winner: "" },
        { id: "m2", player1: "", player1Amount: "", player2: "", player2Amount: "", winner: "" },
        { id: "m3", player1: "", player1Amount: "", player2: "", player2Amount: "", winner: "" },
        { id: "m4", player1: "", player1Amount: "", player2: "", player2Amount: "", winner: "" },
      ],
    },
    {
      id: "round-2",
      name: "Semifinals",
      matches: [
        { id: "m5", player1: "", player1Amount: "", player2: "", player2Amount: "", winner: "" },
        { id: "m6", player1: "", player1Amount: "", player2: "", player2Amount: "", winner: "" },
      ],
    },
    {
      id: "round-3",
      name: "Final",
      matches: [
        { id: "m7", player1: "", player1Amount: "", player2: "", player2Amount: "", winner: "" }],
    },
  ],
};

const STORAGE_KEYS = {
  adminMode: "trashguy_admin_mode",
  activeHuntId: "trashguy_active_hunt_id",
  predictionStatus: "trashguy_prediction_status",
  activeSection: "trashguy_active_section",
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
  prediction_status?: string;
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
  player1Amount?: string;
  player2: string;
  player2Amount?: string;
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
    index < safeCount ? "" : "BYE"
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
  player1Amount: "",
  player2: teamNames[matchIndex * 2 + 1] || "",
  player2Amount: "",
  winner: "",
};
      }

      return {
  id: `m${matchCounter++}`,
  player1: "",
  player1Amount: "",
  player2: "",
  player2Amount: "",
  winner: "",
};
    });

    rounds.push({
      id: `round-${roundIndex + 1}`,
      name: roundName,
      matches,
    });
  }

  return autoAdvanceByes({
    title: title.trim() || "Tournament Bracket",
    rounds,
  });
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

function autoAdvanceByes(bracket: BracketData): BracketData {
  const next = cloneBracket(bracket);

  for (let roundIndex = 0; roundIndex < next.rounds.length - 1; roundIndex++) {
    const currentRound = next.rounds[roundIndex];
    const nextRound = next.rounds[roundIndex + 1];

    currentRound.matches.forEach((match, matchIndex) => {
      const p1 = match.player1?.trim();
      const p2 = match.player2?.trim();

      let autoWinner = "";

      if (p1 && p2 === "BYE") autoWinner = p1;
      if (p2 && p1 === "BYE") autoWinner = p2;

      if (autoWinner) {
        match.winner = autoWinner;

        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextSlot = matchIndex % 2 === 0 ? "player1" : "player2";

        if (nextRound.matches[nextMatchIndex]) {
          nextRound.matches[nextMatchIndex][nextSlot] = autoWinner;
        }
      }
    });
  }

  return next;
}

function autoAdvanceBracket(bracket: BracketData): BracketData {
  const next = cloneBracket(bracket);

  for (let roundIndex = 0; roundIndex < next.rounds.length - 1; roundIndex++) {
    const currentRound = next.rounds[roundIndex];
    const nextRound = next.rounds[roundIndex + 1];

    currentRound.matches.forEach((match, matchIndex) => {
      const nextMatchIndex = Math.floor(matchIndex / 2);
      const nextSlot = matchIndex % 2 === 0 ? "player1" : "player2";

      if (nextRound.matches[nextMatchIndex]) {
        nextRound.matches[nextMatchIndex][nextSlot] = match.winner || "";
      }
    });
  }

  return autoAdvanceByes(next);
}

function maybeAutoAdvanceClassic8(bracket: BracketData): BracketData {
  return autoAdvanceBracket(bracket);
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
      className={[
        "relative overflow-hidden rounded-[30px]",
        "border border-[rgba(0,255,136,0.16)]",
        "bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(8,8,8,0.96))]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_35px_rgba(0,255,136,0.08),inset_0_1px_0_rgba(255,255,255,0.03)]",
        "backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,136,0.10),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[rgba(255,255,255,0.07)]" />
      <div className="relative z-10 p-5 sm:p-7">{children}</div>
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
    emerald: "text-[#42f5a7]",
    fuchsia: "text-[#42f5a7]",
    white: "text-white/60",
  };

  return (
    <div className={`text-[11px] font-black uppercase tracking-[0.34em] drop-shadow-[0_0_10px_rgba(0,255,136,0.25)] ${map[color]}`}>
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
      className={`rounded-[1.2rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(18,18,18,0.96),rgba(8,8,8,0.98))] shadow-[0_0_18px_rgba(0,255,136,0.05)] ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="space-y-2">
        <div
          className={`rounded-xl border px-4 py-3 font-semibold transition ${
            isWinner1
              ? "border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.10)] text-[#b8ffd8] shadow-[0_0_16px_rgba(0,255,136,0.10)]"
              : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-white"
          }`}
        >
          <div className="truncate">{match.player1 || ""}</div>
{match.player1Amount && (
  <div
  className={`mt-1 text-xs font-semibold ${
    match.winner === match.player1
      ? "text-[#f5c451] drop-shadow-[0_0_6px_rgba(245,196,81,0.4)]"
      : "text-white/45"
  }`}
>
  ${match.player1Amount}
</div>
)}
        </div>

        <div className="text-center text-[10px] uppercase tracking-[0.24em] text-white/25">
          vs
        </div>

        <div
          className={`rounded-xl border px-4 py-3 font-semibold transition ${
            isWinner2
              ? "border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.10)] text-[#b8ffd8] shadow-[0_0_16px_rgba(0,255,136,0.10)]"
              : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-white"
          }`}
        >
          <div className="truncate">{match.player2 || ""}</div>
{match.player2Amount && (
  <div
  className={`mt-1 text-xs font-semibold ${
    match.winner === match.player2
      ? "text-[#f5c451] drop-shadow-[0_0_6px_rgba(245,196,81,0.4)]"
      : "text-white/45"
  }`}
>
  ${match.player2Amount}
</div>
)}
        </div>
      </div>

      <div className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-white/30">
        {match.winner ? `Winner: ${match.winner}` : "No winner yet"}
      </div>
    </div>
  );
}

export default function Home() {

  const [activeSection, setActiveSection] = useState("home");

  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [pickedSlot, setPickedSlot] = useState<SlotItem | null>(null);
  const [isPickingSlot, setIsPickingSlot] = useState(false);
  const lastPickedRef = useRef<string | null>(null);

  const [viewerName, setViewerName] = useState("viewer");
  const [viewerDisplayName, setViewerDisplayName] = useState("viewer");
  const [viewerAvatar, setViewerAvatar] = useState("");
  const [isTwitchConnected, setIsTwitchConnected] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [predictionSortMode, setPredictionSortMode] = useState<"newest" | "highest">("newest");
  const [predictionInput, setPredictionInput] = useState("");
  const [predictionStatus, setPredictionStatus] = useState<"open" | "locked">("locked");
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [predictionMessage, setPredictionMessage] = useState("");

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEYS.adminMode) === "true";
});

  const [adminName, setAdminName] = useState("Trashguy");
  const [finalResult, setFinalResult] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [latestWinners, setLatestWinners] = useState<WinnerItem[]>([]);
  const [adminHuntId, setAdminHuntId] = useState("");
const [giveawayMessage, setGiveawayMessage] = useState("");

const [giveawayEntries, setGiveawayEntries] = useState<any[]>([]);
const [recentGiveawayWinners, setRecentGiveawayWinners] = useState<any[]>([]);
const [giveawayWinnerCounts, setGiveawayWinnerCounts] = useState<Record<string, number>>({});

const loadGiveawayEntries = async () => {
  try {
    const res = await fetch("/api/chat-giveaway");
    const data = await res.json();

    if (Array.isArray(data?.entries)) {
      setGiveawayEntries(data.entries);
    }

    if (Array.isArray(data?.recentWinners)) {
      setRecentGiveawayWinners(data.recentWinners);
    }

    if (data?.winnerCounts) {
      setGiveawayWinnerCounts(data.winnerCounts);
    }
  } catch (err) {
    console.error("Failed to load entries", err);
  }
};

const handleDeleteWinner = async (id: string) => {
  if (!confirm("Delete this winner?")) return;

  await fetch(`/api/chat-giveaway/delete?id=${id}`, {
    method: "DELETE",
  });

  loadGiveawayEntries(); // refresh list
};

const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>(fallbackLeaderboard);
const [leaderboardLoading, setLeaderboardLoading] = useState(true);

const [giveaways, setGiveaways] = useState<any[]>([]);
const [giveawayTotal, setGiveawayTotal] = useState(0);
const [giveawayLoading, setGiveawayLoading] = useState(true);

const [viewerRewards, setViewerRewards] = useState<any[]>([]);
const [viewerRewardsPending, setViewerRewardsPending] = useState(0);
const [viewerRewardsPaid, setViewerRewardsPaid] = useState(0);
const [viewerRewardsMessage, setViewerRewardsMessage] = useState("");

const [rouloUsernameInput, setRouloUsernameInput] = useState("");
const [rouloLink, setRouloLink] = useState<any>(null);
const [rouloLinkMessage, setRouloLinkMessage] = useState("");

const [adminRewards, setAdminRewards] = useState<any[]>([]);
const [adminRewardsSearch, setAdminRewardsSearch] = useState("");
const [adminRewardsMessage, setAdminRewardsMessage] = useState("");

const [adminDropdowns, setAdminDropdowns] = useState(() => {
  if (typeof window === "undefined") {
    return {
      predictions: true,
      giveaway: false,
      prizePortal: false,
      tournament: false,
    };
  }

  const saved = localStorage.getItem("admin_dropdowns");

  return saved
    ? JSON.parse(saved)
    : {
        predictions: true,
        giveaway: false,
        prizePortal: false,
        tournament: false,
      };
});

useEffect(() => {
  if (typeof window === "undefined") return;
  localStorage.setItem("admin_dropdowns", JSON.stringify(adminDropdowns));
}, [adminDropdowns]);

const setAdminDropdown = (
  key: "predictions" | "giveaway" | "prizePortal" | "tournament",
  open: boolean
) => {
  setAdminDropdowns((current: Record<
    "predictions" | "giveaway" | "prizePortal" | "tournament",
    boolean
  >) => ({
    ...current,
    [key]: open,
  }));
};

  const [huntsData, setHuntsData] = useState<HuntItem[]>([]);
  const [huntsLoading, setHuntsLoading] = useState(true);
  const [currentHuntState, setCurrentHuntState] = useState<any>(null);

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
  const [countdownTick, setCountdownTick] = useState(Date.now());

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
  return predictions.find(
    (entry) =>
      entry.username.trim().toLowerCase() ===
      viewerName.trim().toLowerCase()
  );
}, [predictions, viewerName]);

const currentPredictionHunt = useMemo(() => {
  if (!huntsData.length) return null;

  const openHunts = huntsData
    .filter(
      (hunt) =>
        hunt.prediction_status === "open" ||
        hunt.status === "open" ||
        hunt.isOpening
    )
    .sort((a, b) => {
      const aTime = a.updatedAt || a.createdAt ? new Date(a.updatedAt || a.createdAt || "").getTime() : 0;
      const bTime = b.updatedAt || b.createdAt ? new Date(b.updatedAt || b.createdAt || "").getTime() : 0;
      return bTime - aTime;
    });

  if (openHunts.length) return openHunts[0];

  const sorted = [...huntsData].sort((a, b) => {
    const aTime = a.updatedAt || a.createdAt ? new Date(a.updatedAt || a.createdAt || "").getTime() : 0;
    const bTime = b.updatedAt || b.createdAt ? new Date(b.updatedAt || b.createdAt || "").getTime() : 0;
    return bTime - aTime;
  });

  return sorted[0] || null;
}, [huntsData]);

const currentPredictionCount = predictions.length;

const currentPredictionAvgX =
  currentPredictionHunt?.startCost && currentPredictionHunt.startCost > 0
    ? ((currentPredictionHunt.totalWinnings || 0) / currentPredictionHunt.startCost).toFixed(2)
    : "0.00";

    const leaderboardCountdown = useMemo(() => {
  const end = new Date("2026-05-05T00:00:00-04:00").getTime();
  const diff = end - countdownTick;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}, [countdownTick]);

const leaderboardProgress = useMemo(() => {
  const start = new Date("2026-04-21T00:00:00-04:00").getTime();
  const end = new Date("2026-05-05T00:00:00-04:00").getTime();
  const total = end - start;
  const elapsed = countdownTick - start;

  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 100;

  return (elapsed / total) * 100;
}, [countdownTick]);

const biggestGiveaway = useMemo(() => {
  if (!giveaways.length) return null;

  return [...giveaways].sort(
    (a, b) => Number(b.amount || 0) - Number(a.amount || 0)
  )[0];
}, [giveaways]);

const slotProviders = useMemo(() => {
  return Array.from(new Set(slotData.map((slot) => slot.provider)));
}, []);

const filteredSlots = useMemo(() => {
  if (selectedProviders.length === 0) return slotData;

  return slotData.filter((slot) =>
    selectedProviders.includes(slot.provider)
  );
}, [selectedProviders]);

const toggleSlotProvider = (provider: string) => {
  setSelectedProviders((current) =>
    current.includes(provider)
      ? current.filter((item) => item !== provider)
      : [...current, provider]
  );
};

const pickRandomSlot = () => {
  if (!filteredSlots.length || isPickingSlot) return;

  const spinSound = new Audio("/spin.mp3");
  spinSound.loop = true;
  spinSound.volume = 0.25;
  spinSound.play().catch(() => {});

  setIsPickingSlot(true);

  let spins = 0;
  const maxSpins = 24;
  let speed = 45;

  const spinLoop = () => {
    const randomSlot =
      filteredSlots[Math.floor(Math.random() * filteredSlots.length)];

    // this MUST be the full slot object
    setPickedSlot(randomSlot);

    spins += 1;
    speed += spins > 14 ? 18 : 6;

    if (spins >= maxSpins) {
      spinSound.pause();
      spinSound.currentTime = 0;

      let finalSlot: SlotItem;

      do {
        finalSlot =
          filteredSlots[Math.floor(Math.random() * filteredSlots.length)];
      } while (
        filteredSlots.length > 1 &&
        finalSlot.name === lastPickedRef.current
      );

      lastPickedRef.current = finalSlot.name;
      setPickedSlot(finalSlot);
      setIsPickingSlot(false);

      const clickSound = new Audio("/click.mp3");
      clickSound.volume = 0.45;
      clickSound.play().catch(() => {});

      return;
    }

    setTimeout(spinLoop, speed);
  };

  spinLoop();
};

  useEffect(() => {
  if (!authLoaded) return;
  if (!isTwitchConnected) return;

  if (!adminAllowed) {
    setIsAdmin(false);
    localStorage.removeItem(STORAGE_KEYS.adminMode);

    if (activeSection === "admin") {
      setActiveSection("home");
    }
  }
}, [adminAllowed, activeSection, authLoaded, isTwitchConnected]);

useEffect(() => {
  const timer = setInterval(() => {
    setCountdownTick(Date.now());
  }, 1000);

  return () => clearInterval(timer);
}, []);

useEffect(() => {
  if (typeof window === "undefined") return;

  const storedAdminMode = localStorage.getItem(STORAGE_KEYS.adminMode);

  if (storedAdminMode === "true") {
    setIsAdmin(true);
  }
}, []);

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
    setCurrentHuntState(data?.currentHuntState || null);

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
      prediction_status: hunt.prediction_status || "locked",
      isOpening: Boolean(hunt.isOpening) || hunt.status === "open",
      currentOpeningSlot: hunt.currentOpeningSlot || null,
      createdAt: hunt.createdAt || hunt.created_at || null,
      updatedAt: hunt.updatedAt || hunt.updated_at || null,
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

    if (normalized.length > 0) {
  setHuntsData(normalized);
}
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

const loadViewerRewards = useCallback(async () => {
  try {
    const viewer = viewerName || viewerDisplayName;

    if (!viewer || viewer === "viewer") {
      setViewerRewards([]);
      setViewerRewardsPending(0);
      setViewerRewardsPaid(0);
      setViewerRewardsMessage("Connect Twitch to view rewards.");
      return;
    }

    const res = await fetch(
      `/api/prize-portal?viewer=${encodeURIComponent(viewer)}`,
      { cache: "no-store" }
    );

    const data = await res.json();

    if (!data.ok) {
      setViewerRewardsMessage(data.error || "Could not load rewards.");
      return;
    }

    setViewerRewards(data.rewards || []);
    setViewerRewardsPending(Number(data.totalPending || 0));
    setViewerRewardsPaid(Number(data.totalPaid || 0));
    setViewerRewardsMessage("");
  } catch {
    setViewerRewardsMessage("Could not load rewards.");
  }
}, [viewerName, viewerDisplayName]);

const loadRouloLink = useCallback(async () => {
  if (!viewerName || viewerName === "viewer") return;

  try {
    const res = await fetch(`/api/roulo-link?twitch=${encodeURIComponent(viewerName)}`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (data?.ok) {
      setRouloLink(data.link || null);
      if (data.link?.roulo_username) {
        setRouloUsernameInput(data.link.roulo_username);
      }
    }
  } catch {
    setRouloLinkMessage("Could not load Roulo link.");
  }
}, [viewerName]);

const handleLinkRoulo = async () => {
  setRouloLinkMessage("Checking Roulo account...");

  const res = await fetch("/api/roulo-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      twitch_username: viewerName,
      twitch_display_name: viewerDisplayName,
      roulo_username: rouloUsernameInput,
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    setRouloLinkMessage(data.error || "Could not link Roulo account.");
    return;
  }

  setRouloLink(data.link);
  setRouloLinkMessage("Roulo account linked.");
};

  const loadGiveaways = useCallback(async () => {
  try {
    const res = await fetch("/api/giveaways", { cache: "no-store" });
    const data = await res.json();

    setGiveaways(Array.isArray(data?.giveaways) ? data.giveaways : []);
    setGiveawayTotal(Number(data?.total || 0));
  } catch (error) {
    console.error("Giveaways failed to load", error);
  } finally {
    setGiveawayLoading(false);
  }
}, []);

  const loadPredictions = useCallback(async () => {
  try {
    const res = await fetch("/api/predictions", { cache: "no-store" });
    if (!res.ok) return;

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
  }
}, []);

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
  loadGiveaways();
  loadHunts();
  loadPredictions();
  loadLiveStatus();
  loadBracket();
  loadGiveawayEntries();

  const liveTimer = setInterval(loadLiveStatus, 60000);
  const predictionTimer = setInterval(loadPredictions, 5000);
  const huntTimer = setInterval(loadHunts, 30000);
  const giveawayTimer = setInterval(loadGiveaways, 5000);
  const giveawayEntriesTimer = setInterval(loadGiveawayEntries, 2000);

return () => {
  clearInterval(liveTimer);
  clearInterval(predictionTimer);
  clearInterval(huntTimer);
  clearInterval(giveawayTimer);
  clearInterval(giveawayEntriesTimer);
};
}, [loadBracket, loadGiveaways, loadHunts, loadLeaderboard, loadLiveStatus, loadPredictions, loadViewerRewards]);

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
      setAuthLoaded(true);
      return;
    }

    const user = sessionData.session?.user;
    if (!user) {
      setIsTwitchConnected(false);
      setViewerName("viewer");
      setViewerDisplayName("viewer");
      setViewerAvatar("");
      setAuthLoaded(true);
      return;
    }

    const twitchIdentity = extractTwitchIdentity(user);

    setIsTwitchConnected(true);
    setViewerName(twitchIdentity.login);
    setViewerDisplayName(twitchIdentity.displayName);
    setViewerAvatar(twitchIdentity.avatarUrl);
    setAuthLoaded(true);
  } catch (error) {
    console.error("loadUser failed", error);
    setAuthLoaded(true);
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

// RESTORE ADMIN + SECTION AFTER REFRESH
useEffect(() => {
  if (typeof window === "undefined") return;

  const storedAdminMode = localStorage.getItem(STORAGE_KEYS.adminMode);
  const storedSection = localStorage.getItem(STORAGE_KEYS.activeSection);

  if (storedAdminMode === "true") {
    setIsAdmin(true);
  }

  if (storedSection) {
    setActiveSection(storedSection);
  }
}, []);

// SAVE ADMIN + ACTIVE TAB
useEffect(() => {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEYS.adminMode, String(isAdmin));
  localStorage.setItem(STORAGE_KEYS.activeSection, activeSection);
}, [isAdmin, activeSection]);

useEffect(() => {
  if (typeof window === "undefined") return;
  if (huntsLoading) return;

  const storedHuntId = localStorage.getItem(STORAGE_KEYS.activeHuntId);
  const storedPredictionStatus = localStorage.getItem(STORAGE_KEYS.predictionStatus);

  let resolvedHunt: HuntItem | null = null;

  if (currentHuntState?.id) {
    resolvedHunt =
      huntsData.find((hunt) => hunt.id === currentHuntState.id) || null;
  }

  if (!resolvedHunt && storedHuntId) {
    resolvedHunt = huntsData.find((hunt) => hunt.id === storedHuntId) || null;
  }

  if (!resolvedHunt) {
    resolvedHunt =
      huntsData.find(
        (hunt) =>
          hunt.prediction_status === "open" ||
          hunt.status === "open" ||
          hunt.isOpening
      ) || null;
  }

  if (!resolvedHunt) {
    if (
      storedPredictionStatus &&
      (storedPredictionStatus === "open" || storedPredictionStatus === "locked")
    ) {
      setPredictionStatus(storedPredictionStatus);
    }
    return;
  }

  const nextStatus =
    resolvedHunt.prediction_status === "open"
      ? "open"
      : storedPredictionStatus === "open"
      ? "open"
      : "locked";

  setAdminHuntId(resolvedHunt.id);
  setPredictionStatus(nextStatus);

  localStorage.setItem(STORAGE_KEYS.activeHuntId, resolvedHunt.id);
  localStorage.setItem(STORAGE_KEYS.predictionStatus, nextStatus);
}, [currentHuntState, huntsLoading, huntsData]);

useEffect(() => {
  if (activeSection === "giveaways") {
    loadViewerRewards();
    loadRouloLink();
  }

  if (activeSection === "admin" && adminAllowed) {
    loadAdminRewards();
  }
}, [activeSection, adminAllowed, loadViewerRewards, loadRouloLink]);

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
  () => {
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
}, [loadBracket, loadPredictions, loadHunts]);

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

    localStorage.removeItem(STORAGE_KEYS.adminMode);
    localStorage.removeItem(STORAGE_KEYS.activeHuntId);
    localStorage.removeItem(STORAGE_KEYS.predictionStatus);
    localStorage.removeItem(STORAGE_KEYS.activeSection);

    setPredictionMessage("Logged out.");
  } catch {
    setPredictionMessage("Logout failed.");
  }
};

  const handlePredictionSubmit = async () => {
  if (!isTwitchConnected || predictionStatus !== "open" || !currentPredictionHunt?.id) {
    setPredictionMessage("No active hunt found.");
    return;
  }

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
  const existingHuntId =
    adminHuntId ||
    currentPredictionHunt?.id ||
    (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEYS.activeHuntId) || ""
      : "");

  if (existingHuntId && predictionStatus === "open") {
    setAdminMessage("A hunt is already active.");
    return;
  }

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

    const newHuntId = data?.hunt?.id || "";

    setAdminHuntId(newHuntId);
    setPredictionStatus("open");

    if (typeof window !== "undefined" && newHuntId) {
      localStorage.setItem(STORAGE_KEYS.activeHuntId, newHuntId);
      localStorage.setItem(STORAGE_KEYS.predictionStatus, "open");
    }

    setLatestWinners([]);
    setFinalResult("");
    setPredictions([]);
    setAdminMessage("New hunt started.");
    loadHunts();
    loadPredictions();
  } catch {
    setAdminMessage("Failed to start hunt.");
  }
};

  const handleLockPredictions = async () => {
  const activeHuntId =
    adminHuntId ||
    currentPredictionHunt?.id ||
    (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEYS.activeHuntId) || ""
      : "");

  if (!activeHuntId) {
    setAdminMessage("Start a new hunt first.");
    return;
  }

  try {
    const token = await getAccessToken();

    const res = await fetch(`/api/admin/hunts/${activeHuntId}`, {
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
    setAdminHuntId(activeHuntId);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.predictionStatus, "locked");
      localStorage.setItem(STORAGE_KEYS.activeHuntId, activeHuntId);
    }

    setAdminMessage("Predictions locked.");
    loadPredictions();
    loadHunts();
  } catch {
    setAdminMessage("Failed to lock predictions.");
  }
};

  const handleOpenPredictions = async () => {
  const activeHuntId =
    adminHuntId ||
    currentPredictionHunt?.id ||
    (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEYS.activeHuntId) || ""
      : "");

  if (!activeHuntId) {
    setAdminMessage("Start a new hunt first.");
    return;
  }

  try {
    const token = await getAccessToken();

    const res = await fetch(`/api/admin/hunts/${activeHuntId}`, {
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
    setAdminHuntId(activeHuntId);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.predictionStatus, "open");
      localStorage.setItem(STORAGE_KEYS.activeHuntId, activeHuntId);
    }

    setAdminMessage("Predictions opened.");
    loadPredictions();
    loadHunts();
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

if (typeof window !== "undefined") {
  localStorage.removeItem(STORAGE_KEYS.activeHuntId);
  localStorage.setItem(STORAGE_KEYS.predictionStatus, "locked");
}
      loadHunts();
      loadPredictions();
    } catch {
      setAdminMessage("Failed to complete hunt.");
    }
  };

const handleStartGiveaway = async () => {
  setGiveawayMessage("Starting giveaway...");

  const res = await fetch("/api/chat-giveaway", { method: "POST" });
  const data = await res.json();

  setGiveawayMessage(data?.ok ? "Giveaway started." : data?.error || "Failed to start giveaway.");
};

const handleAddTestEntry = async () => {
  setGiveawayMessage("Adding test entry...");

  const res = await fetch("/api/chat-giveaway/enter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: `testuser${Date.now()}` }),
  });

  const data = await res.json();

  setGiveawayMessage(data?.ok ? `Entry added: ${data.entry.username}` : data?.error || "Failed to add entry.");
};

const handleDrawGiveawayWinner = async () => {
  setGiveawayMessage("Drawing winner...");

  const res = await fetch(`/api/chat-giveaway/draw?amount=0`, {
    method: "POST",
  });

  const data = await res.json();

  setGiveawayMessage(
    data?.ok
      ? `Winner: ${data.winner.username} — set winnings after bonus.`
      : data?.error || "Failed to draw winner."
  );

  loadAdminRewards();
};

const handleMarkRewardPaid = async (id: string) => {
  await fetch(`/api/rewards?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "complete" }),
  });

  loadViewerRewards();
};

const handleMarkRewardPending = async (id: string) => {
  await fetch(`/api/rewards?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "pending" }),
  });

  loadViewerRewards();
};

const handleDeleteReward = async (id: string) => {
  if (!confirm("Delete this reward?")) return;

  await fetch(`/api/rewards?id=${id}`, {
    method: "DELETE",
  });

  loadViewerRewards();
};

const loadAdminRewards = async () => {
  try {
    const res = await fetch("/api/admin/rewards", { cache: "no-store" });
    const data = await res.json();

    if (!data.ok) {
      setAdminRewardsMessage(data.error || "Could not load rewards.");
      return;
    }

    setAdminRewards(data.rewards || []);
    setAdminRewardsMessage("");
  } catch {
    setAdminRewardsMessage("Could not load rewards.");
  }
};

const handleAdminMarkRewardPaid = async (id: string) => {
  await fetch(`/api/admin/rewards?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "complete" }),
  });

  loadAdminRewards();
  loadViewerRewards();
};

const handleAdminMarkRewardPending = async (id: string) => {
  await fetch(`/api/admin/rewards?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "pending" }),
  });

  loadAdminRewards();
  loadViewerRewards();
};

const handleAdminDeleteReward = async (id: string) => {
  if (!confirm("Delete this reward?")) return;

  const res = await fetch(`/api/admin/rewards?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete" }),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    alert(data.error || "Delete failed.");
    return;
  }

  setAdminRewards((current) => current.filter((r) => r.id !== id));
  setViewerRewards((current) => current.filter((r) => r.id !== id));
};

const filteredAdminRewards = adminRewards.filter((reward) => {
  const search = adminRewardsSearch.trim().toLowerCase();

  if (!search) return true;

  return (
    String(reward.twitch_username || "").toLowerCase().includes(search) ||
    String(reward.display_name || "").toLowerCase().includes(search) ||
    String(reward.title || "").toLowerCase().includes(search) ||
    String(reward.status || "").toLowerCase().includes(search)
  );
});

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
  field: "player1" | "player2" | "player1Amount" | "player2Amount",
  value: string
) => {
  setBracket((current) => {
    const updated = {
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
    };

    return autoAdvanceBracket(updated);
  });
};

  const selectMatchWinner = (
  roundId: string,
  matchId: string,
  winner: string
) => {
  setBracket((current) => {
    const updated = {
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
    };

    return autoAdvanceBracket(updated);
  });
};

  const clearMatchWinner = (roundId: string, matchId: string) => {
  setBracket((current) => {
    const updated = {
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
    };

    return autoAdvanceBracket(updated);
  });
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
    <div className="min-h-screen bg-[#050505] text-white">
  <div className="min-h-screen bg-[url('/bg-tunnel.png')] bg-cover bg-center bg-fixed brightness-110 contrast-110">
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(0,0,0,0.72),rgba(0,0,0,0.88)),radial-gradient(circle_at_center,rgba(0,0,0,0.35),rgba(0,0,0,0.82))]">
          <SiteHeader
  activeSection={activeSection}
  setActiveSection={setActiveSection}
  adminAllowed={adminAllowed}
  isTwitchConnected={isTwitchConnected}
  viewerAvatar={viewerAvatar}
  viewerDisplayName={viewerDisplayName}
  viewerName={viewerName}
  handleTwitchLogin={handleTwitchLogin}
  handleLogout={handleLogout}
  liveLoading={liveLoading}
  liveStatus={liveStatus}
/>

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
            {activeSection === "home" && (
              <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <Panel className="border-[rgba(0,255,136,0.16)] shadow-[0_0_40px_rgba(0,255,136,0.08)]">
                  <SectionLabel>Home</SectionLabel>
                  <h1 className="mt-3 text-4xl font-black tracking-wide">TRASHGUY</h1>
                  <p className="mt-4 max-w-xl text-white/65">
  Sign up with code{" "}
  <span className="font-bold text-[#8fffd0]">
    trashguy
  </span>{" "}
  on Roulobets to earn rewards
</p>

                  <div className="mt-6 flex items-center gap-3">
  <div className={`h-2 w-2 rounded-full ${
    liveStatus.isLive ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" : "bg-red-400"
  }`} />

  <div className="text-sm font-semibold text-white/70">
    {liveLoading
      ? "Checking stream..."
      : liveStatus.isLive
      ? "Live now"
      : "Offline"}
  </div>
</div>

                  <div className="mt-8 grid gap-3">
  {socials.map((social) => {
    const Icon = social.icon;

    return (
      <a
  key={social.name}
  href={social.href}
  target="_blank"
  rel="noreferrer"
  className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(14,14,14,0.92),rgba(8,8,8,0.96))] px-5 py-4 transition hover:border-[rgba(0,255,136,0.28)] hover:bg-[linear-gradient(180deg,rgba(18,18,18,0.96),rgba(10,10,10,0.98))] hover:shadow-[0_0_24px_rgba(0,255,136,0.06)]"
>
  <div className="flex items-center gap-4">
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 shadow-[0_0_16px_rgba(0,255,136,0.08)]">
      {social.image ? (
        <img
          src={social.image}
          alt={social.name}
          className="h-8 w-8 object-contain"
        />
      ) : Icon ? (
        <Icon
  className={`text-2xl ${
    social.name === "Discord"
      ? "text-[#5865F2]"
      : social.name === "YouTube"
      ? "text-[#FF0000]"
      : social.name === "Twitter / X"
      ? "text-white"
      : social.name === "Instagram"
      ? "text-[#E1306C]"
      : "text-[#8fffd0]"
  }`}
/>
      ) : null}
    </div>

    <div className="text-lg font-black text-white">
      {social.name}
    </div>
  </div>

  <span className="text-sm font-semibold text-white/45 transition hover:text-[#8fffd0]">
    Visit
  </span>
</a>
    );
  })}
</div>
                </Panel>

                <Panel className="border-[rgba(0,255,136,0.16)] shadow-[0_0_40px_rgba(0,255,136,0.08)]">
  <SectionLabel>Live Stream</SectionLabel>
  <h2 className="mt-3 text-3xl font-black">WATCH TRASHGUY LIVE</h2>

  <div className="mt-6 mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.26em] text-emerald-300">
  {liveStatus.isLive && (
    <>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
      </span>
      <span>Live stream</span>
    </>
  )}
</div>

  <div className="aspect-video w-full overflow-hidden rounded-[1.25rem] border border-emerald-300/20">
    {liveStatus.isLive ? (
      <iframe
        src="https://player.twitch.tv/?channel=trashguy__&parent=localhost&parent=127.0.0.1&parent=trashguy-site.vercel.app&parent=trashguy.me"
        height="100%"
        width="100%"
        allowFullScreen
        className="rounded-[1.25rem]"
      />
    ) : (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(180deg,rgba(10,10,10,0.92),rgba(3,3,3,0.98))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,136,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[url('/bg-tunnel.png')] bg-cover bg-center opacity-20" />

        <div className="relative z-10 text-center">
          <div className="text-4xl font-black tracking-wide text-white">
            OFFLINE
          </div>

          <div className="mt-2 text-white/50">
            Catch the next stream live
          </div>

          <a
            href="https://www.twitch.tv/trashguy__"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex rounded-full border border-[#9146FF]/40 bg-[#9146FF]/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-[#9146FF]/30"
          >
            Follow on Twitch
          </a>
        </div>
      </div>
    )}
  </div>
</Panel>
              </section>
            )}

            {activeSection === "leaderboard" && (
  <section className="space-y-6">
    <Panel className="mx-auto max-w-5xl border-[rgba(0,255,136,0.16)] shadow-[0_0_50px_rgba(0,255,136,0.10)]">
      <div className="text-center">
        <SectionLabel>Leaderboard</SectionLabel>

        <h2 className="mt-4 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[1.05] tracking-tight text-white">
          ${leaderboardTotal}
<br />
LEADERBOARD
        </h2>

        <div className="mt-4 text-sm text-white/50">
          Updated 15 mins ago
        </div>

        <div className="mt-4 text-[clamp(2rem,5vw,3.8rem)] font-black leading-none text-[#8fffd0]">
  Ends in: {leaderboardCountdown}
</div>

        <div className="mx-auto mt-6 h-3 w-full max-w-4xl overflow-hidden rounded-full border border-[rgba(0,255,136,0.18)] bg-[rgba(255,255,255,0.03)]">
          <div
  className="h-full rounded-full bg-[linear-gradient(90deg,#00ff88,#19d38a)] shadow-[0_0_20px_rgba(0,255,136,0.35)]"
  style={{ width: `${leaderboardProgress}%` }}
/>
        </div>
      </div>
    </Panel>

    <Panel className="mx-auto max-w-5xl overflow-hidden border-[rgba(0,255,136,0.16)] shadow-[0_0_55px_rgba(0,255,136,0.10)]">
      <div className="grid grid-cols-[82px_1fr_150px] border-b border-[rgba(0,255,136,0.12)] bg-[linear-gradient(180deg,rgba(0,255,136,0.08),rgba(0,255,136,0.03))] px-4 py-4 text-[11px] font-bold uppercase tracking-[0.24em] text-white/45 sm:grid-cols-[100px_1fr_190px_170px] sm:px-6">
        <div>Rank</div>
        <div>Player</div>
        <div className="text-right">Wagered</div>
        <div className="hidden text-right sm:block">Prize</div>
      </div>

      {leaderboardLoading && leaderboardData.length === 0 ? (
  <div className="px-6 py-10 text-white/60">Loading leaderboard...</div>
) : (
        <div className="divide-y divide-white/5">
          {leaderboardData.map((player) => {
            const prize = leaderboardPrizes[player.rank] || 0;

            return (
              <div
                key={`${player.rank}-${player.username}`}
                className="grid grid-cols-[82px_1fr_150px] items-center px-4 py-4 transition hover:bg-white/[0.02] sm:grid-cols-[100px_1fr_190px_170px] sm:px-6 sm:py-5"
              >
                <div className="flex items-center">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-black ${
                      player.rank === 1
                        ? "border-yellow-400/55 text-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.22)]"
                        : player.rank === 2
                        ? "border-zinc-300/40 text-zinc-200"
                        : player.rank === 3
                        ? "border-amber-500/50 text-amber-300"
                        : "border-[rgba(0,255,136,0.28)] text-[#8fffd0]"
                    }`}
                  >
                    {player.rank}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate text-xl font-bold text-white sm:text-2xl">
                    {player.username}
                  </div>

                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/28 sm:hidden">
                    Prize ${prize.toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black text-white sm:text-xl">
                    {formatMoney(player.wagered)}
                  </div>
                </div>

                <div className="hidden text-right sm:block">
                  <div className="text-lg font-black text-[#f5c451] sm:text-xl">
                    ${prize.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  </section>
)}

{activeSection === "giveaways" && (
  <section className="space-y-6">
    <Panel className="mx-auto max-w-5xl border-[rgba(0,255,136,0.16)] shadow-[0_0_55px_rgba(0,255,136,0.10)]">
      <div className="text-center">
        <SectionLabel>Giveaways</SectionLabel>

        <h2 className="mt-4 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[1.05] tracking-tight text-white">
          TOTAL
          <br />
          GIVEN AWAY
        </h2>

        <div className="mt-6 text-[clamp(2.4rem,7vw,5rem)] font-black leading-none text-[#8fffd0]">
          ${giveawayTotal.toLocaleString()}
        </div>
      </div>
    </Panel>

    {viewerName.toLowerCase() !== "trashguy__" && viewerName.toLowerCase() !== "trashguy" && (
    <Panel className="mx-auto max-w-5xl border-fuchsia-300/20 shadow-[0_0_55px_rgba(217,70,239,0.10)]">

  <div className="text-center">
    <SectionLabel>Prize Portal</SectionLabel>

    <h2 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-tight text-white">
      MY REWARDS
    </h2>

    {isTwitchConnected && (
  <div className="mt-6 rounded-[1.5rem] border border-emerald-300/20 bg-black/30 p-5 text-left">
    <div className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">
      Roulo Account
    </div>

    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
      <input
        value={rouloUsernameInput}
        onChange={(e) => setRouloUsernameInput(e.target.value)}
        placeholder="Enter your Roulo username"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
      />

      <button
        onClick={handleLinkRoulo}
        className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 font-bold text-emerald-200 hover:bg-emerald-400/20"
      >
        Link Roulo
      </button>
    </div>

    {rouloLink && (
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/35">
            Wagered
          </div>
          <div className="mt-1 text-xl font-black text-white">
            ${Number(rouloLink.wagered || 0).toLocaleString()}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/35">
            Role
          </div>
          <div className="mt-1 text-xl font-black text-[#8fffd0] uppercase">
            {rouloLink.role}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/35">
            Giveaway Chance
          </div>
          <div className="mt-1 text-xl font-black text-[#f5c451]">
            x{rouloLink.weight || 1}
          </div>
        </div>
      </div>
    )}

    {rouloLinkMessage && (
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
        {rouloLinkMessage}
      </div>
    )}
  </div>
)}

    {!isTwitchConnected ? (
      <div className="mt-6">
        <button
          onClick={handleTwitchLogin}
          className="rounded-2xl border border-[#9146FF]/40 bg-[#9146FF]/20 px-6 py-4 font-bold text-white transition hover:bg-[#9146FF]/30"
        >
          Connect Twitch to View Rewards
        </button>
      </div>
    ) : (
      <>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-yellow-300/20 bg-yellow-400/10 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-yellow-200/70">
              Pending
            </div>
            <div className="mt-2 text-3xl font-black text-yellow-200">
              ${viewerRewardsPending.toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">
              Paid
            </div>
            <div className="mt-2 text-3xl font-black text-emerald-200">
              ${viewerRewardsPaid.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
          {viewerRewards.length === 0 ? (
            <div className="px-6 py-10 text-center text-white/45">
              {viewerRewardsMessage || "No rewards yet."}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {viewerRewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0 text-left">
                    <div className="truncate font-black text-white">
                      {reward.title || "Chat Giveaway"}
                    </div>
                    <div className="mt-1 text-xs text-white/35">
                      {reward.created_at
                        ? new Date(reward.created_at).toLocaleString()
                        : "Recently"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-black text-[#8fffd0]">
                      ${Number(reward.amount || 0).toLocaleString()}
                    </div>
                    <div
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-black ${
                       reward.status === "complete"
                          ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                          : "border border-yellow-300/20 bg-yellow-400/10 text-yellow-200"
                      }`}
                    >
                      {reward.status === "complete" ? "Completed" : "Pending"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )}
  </div>
</Panel>
)}

    <Panel className="mx-auto max-w-5xl border-[rgba(0,255,136,0.16)] shadow-[0_0_55px_rgba(0,255,136,0.10)]">
      {giveawayLoading ? (
        <div className="px-6 py-10 text-white/60">Loading giveaways...</div>
      ) : giveaways.length === 0 ? (
        <div className="px-6 py-10 text-center text-white/45">
          No giveaways logged yet.
        </div>
      ) : (
        <>
          {biggestGiveaway && (
  <div className="mb-6 rounded-[1.5rem] border border-yellow-400/25 bg-[linear-gradient(180deg,rgba(250,204,21,0.10),rgba(0,255,136,0.04))] p-5 shadow-[0_0_28px_rgba(250,204,21,0.08)]">
    <div className="text-xs uppercase tracking-[0.3em] text-yellow-300/70">
      Biggest Giveaway
    </div>

    <div className="mt-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="truncate text-2xl font-black text-white">
          🏆 {biggestGiveaway.winner_name}
        </div>

        {biggestGiveaway.note && (
          <div className="mt-1 truncate text-sm text-white/40">
            {biggestGiveaway.note}
          </div>
        )}
      </div>

      <div className="shrink-0 text-2xl font-black text-[#f5c451]">
        ${Number(biggestGiveaway.amount || 0).toLocaleString()}
      </div>
    </div>
  </div>
)}

          <div className="overflow-hidden rounded-[1.5rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)]">
  {/* HEADER */}
  <div className={`grid ${isAdmin ? "grid-cols-[52px_minmax(0,1fr)_90px_74px]" : "grid-cols-[52px_minmax(0,1fr)_90px]"} border-b border-white/5 px-4 py-4 text-xs font-bold uppercase tracking-[0.18em] text-white/35 sm:px-5 sm:tracking-[0.22em]`}>
    <div>#</div>
    <div>Winner</div>
    <div className="text-center">Amount</div>
    <div className="text-right">{isAdmin ? "Edit" : ""}</div>
  </div>

  {/* BODY */}
  <div className="max-h-[520px] overflow-y-auto">
    {giveaways.map((giveaway, index) => (
      <div
        key={giveaway.id}
        className={`grid ${isAdmin ? "grid-cols-[52px_minmax(0,1fr)_90px_74px]" : "grid-cols-[52px_minmax(0,1fr)_90px]"} items-center border-b border-white/5 px-4 py-4 last:border-b-0 sm:px-5`}
      >
        {/* RANK */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(0,255,136,0.20)] bg-[rgba(0,255,136,0.08)] text-xs font-black text-[#8fffd0]">
          {index + 1}
        </div>

        {/* NAME */}
        <div className="min-w-0 overflow-hidden">
  <div className="truncate text-sm font-semibold text-white sm:text-base">
    {giveaway.winner_name}
  </div>

          {giveaway.note && (
            <div className="mt-1 truncate text-xs text-white/35">
              {giveaway.note}
            </div>
          )}
        </div>

        {/* AMOUNT */}
        <div className="text-center text-lg font-black text-[#b8ffd8]">
  ${Number(giveaway.amount || 0).toLocaleString()}
</div>

        {/* BUTTONS */}
        {isAdmin ? (
          <div className="flex justify-end gap-2">
            {/* EDIT */}
            <button
              onClick={async () => {
                const newName = prompt("Edit name:", giveaway.winner_name);
                const newAmount = prompt("Edit winnings:", String(giveaway.amount));
                const newNote = prompt("Edit note:", giveaway.note || "");

                if (!newName || !newAmount) return;

                await fetch(
                  `/api/giveaways?id=${giveaway.id}&key=trashguy92`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      winner_name: newName,
                      amount: Number(newAmount),
                      note: newNote,
                    }),
                  }
                );

                window.location.reload();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-yellow-400/30 bg-yellow-400/10 text-yellow-300 transition hover:bg-yellow-400/20 hover:shadow-[0_0_12px_rgba(250,204,21,0.45)]"
            >
              ✎
            </button>

            {/* DELETE */}
            <button
              onClick={async () => {
                await fetch(
                  `/api/giveaways?id=${giveaway.id}&key=trashguy92`,
                  { method: "DELETE" }
                );
                window.location.reload();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/30 bg-red-400/10 text-red-300 transition hover:bg-red-400/20 hover:shadow-[0_0_12px_rgba(248,113,113,0.45)]"
            >
              ×
            </button>
          </div>
        ) : (
          <div />
        )}
      </div>
    ))}
  </div>
</div>
        </>
      )}
    </Panel>
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
  <section className="grid gap-6 2xl:grid-cols-[1.02fr_1.18fr]">
    <Panel className="border-[rgba(0,255,136,0.16)] shadow-[0_0_65px_rgba(0,255,136,0.10)]">
      <SectionLabel>Live Bonus Hunt</SectionLabel>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[clamp(2rem,5vw,3.6rem)] font-black leading-[0.95] tracking-tight text-white">
            {currentPredictionHunt?.title || "Latest Hunt"}
          </h2>
          <div className="mt-3 text-sm text-white/45">
            Live prediction hub for the current hunt.
          </div>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] ${
            predictionStatus === "open"
              ? "border-[rgba(0,255,136,0.24)] bg-[rgba(0,255,136,0.10)] text-[#b8ffd8]"
              : "border-white/10 bg-[rgba(255,255,255,0.03)] text-white/55"
          }`}
        >
          {predictionStatus === "open" ? "Open" : "Locked"}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
        <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(16,16,16,0.92),rgba(8,8,8,0.96))] px-5 py-5 min-h-[90px] flex flex-col justify-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
            Start
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatMoney(currentPredictionHunt?.startCost || 0)}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(16,16,16,0.92),rgba(8,8,8,0.96))] px-5 py-5 min-h-[90px] flex flex-col justify-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
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

        <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(16,16,16,0.92),rgba(8,8,8,0.96))] px-5 py-5 min-h-[90px] flex flex-col justify-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
            Bonuses
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {currentPredictionHunt?.bonuses?.length || 0}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(16,16,16,0.92),rgba(8,8,8,0.96))] px-5 py-5 min-h-[90px] flex flex-col justify-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
            Avg
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {currentPredictionHunt?.stats?.currentAverageMultiplier
              ? `${Number(currentPredictionHunt.stats.currentAverageMultiplier).toFixed(2)}x`
              : `${currentPredictionAvgX}x`}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(16,16,16,0.92),rgba(8,8,8,0.96))] px-5 py-5 min-h-[90px] flex flex-col justify-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
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

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(16,16,16,0.92),rgba(8,8,8,0.96))] p-6 min-h-[185px]">
          <div className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-white/40">
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
            <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
              Win{" "}
              {formatMoney(
                currentPredictionHunt?.bonuses?.length
                  ? [...currentPredictionHunt.bonuses].sort(
                      (a: any, b: any) => Number(b.payout || 0) - Number(a.payout || 0)
                    )[0]?.payout || 0
                  : 0
              )}
            </div>
            <div className="rounded-full border border-[rgba(0,255,136,0.18)] bg-[rgba(0,255,136,0.08)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b8ffd8]">
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

        <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(16,16,16,0.92),rgba(8,8,8,0.96))] p-6 min-h-[185px]">
          <div className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-white/40">
            Highest X
          </div>

          <div className="mt-4 text-center text-3xl font-black text-white">
            {currentPredictionHunt?.bonuses?.length
              ? `${Number(
                  [...currentPredictionHunt.bonuses].sort(
                    (a: any, b: any) => Number(b.multiplier || 0) - Number(a.multiplier || 0)
                  )[0]?.multiplier || 0
                ).toFixed(2)}x`
              : "---"}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/65">
              Win{" "}
              {formatMoney(
                currentPredictionHunt?.bonuses?.length
                  ? [...currentPredictionHunt.bonuses].sort(
                      (a: any, b: any) => Number(b.multiplier || 0) - Number(a.multiplier || 0)
                    )[0]?.payout || 0
                  : 0
              )}
            </div>
            <div className="rounded-full border border-[rgba(0,255,136,0.18)] bg-[rgba(0,255,136,0.08)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b8ffd8]">
              X{" "}
              {currentPredictionHunt?.bonuses?.length
                ? `${Number(
                    [...currentPredictionHunt.bonuses].sort(
                      (a: any, b: any) => Number(b.multiplier || 0) - Number(a.multiplier || 0)
                    )[0]?.multiplier || 0
                  ).toFixed(2)}x`
                : "0.00x"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(14,14,14,0.92),rgba(8,8,8,0.96))] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/40">
            Live Bonus Feed
          </div>

          <div className="rounded-full border border-[rgba(0,255,136,0.18)] bg-[rgba(0,255,136,0.08)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b8ffd8]">
            {currentPredictionHunt?.bonuses?.length || 0} Bonus
            {(currentPredictionHunt?.bonuses?.length || 0) === 1 ? "" : "es"}
          </div>
        </div>

        <div className="mt-4 max-h-[280px] overflow-y-auto rounded-[1.1rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
          {!currentPredictionHunt?.bonuses?.length ? (
            <div className="flex h-[180px] items-center justify-center text-white/42">
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(0,255,136,0.20)] bg-[rgba(0,255,136,0.08)] text-xs font-black text-[#8fffd0]">
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
                    <div className="font-black text-[#b8ffd8]">
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

    <Panel className="border-[rgba(0,255,136,0.16)] shadow-[0_0_65px_rgba(0,255,136,0.10)]">
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>
      <SectionLabel>Predictions</SectionLabel>
      <h2 className="mt-3 text-[clamp(2.2rem,5vw,4rem)] font-black leading-[0.95] tracking-tight text-white">
        Community
        <br />
        Entries
      </h2>
    </div>

    <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] text-white/60">
      {currentPredictionCount} Entries
    </div>
  </div>

  <div className="mt-8 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
    <div className="rounded-[1.75rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(8,8,8,0.98))] p-7 flex flex-col justify-between">
      <div className="flex flex-wrap gap-2">
        <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs font-bold uppercase tracking-[0.20em] text-white/65">
          {currentPredictionCount} Entries
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.20em] ${
            predictionStatus === "open"
              ? "border-[rgba(0,255,136,0.22)] bg-[rgba(0,255,136,0.08)] text-[#b8ffd8]"
              : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white/55"
          }`}
        >
          {predictionStatus === "open" ? "Open" : "None"}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center">
  <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">
    Your Entry
  </div>

  <div className="mt-3 text-4xl font-black text-white tracking-tight">
    {currentPredictionEntry ? formatMoney(currentPredictionEntry.guess) : "--"}
  </div>
</div>

      <div className="mt-5 rounded-[1.2rem] border border-dashed border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] p-4 text-white/70">
        {predictionStatus === "open"
          ? "Prediction session is open."
          : "No prediction session is open yet."}
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] p-6 flex flex-col gap-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">
          Submit Prediction
        </div>

        <input
          value={predictionInput}
          onChange={(e) => setPredictionInput(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Enter final hunt balance"
          disabled={predictionStatus !== "open"}
          className="mt-4 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] px-5 py-4 text-base text-white outline-none transition focus:border-[rgba(0,255,136,0.28)] sm:text-lg"
        />

        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={isTwitchConnected ? handleLogout : handleTwitchLogin}
            className="w-full rounded-xl min-h-[60px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-base font-semibold text-white transition hover:bg-white/[0.05]"
          >
            {isTwitchConnected ? "Logout" : "Connect Twitch"}
          </button>

          <button
            onClick={handlePredictionSubmit}
            disabled={!isTwitchConnected || predictionStatus !== "open"}
            className="w-full rounded-xl min-h-[60px] border border-[rgba(0,255,136,0.22)] bg-[linear-gradient(180deg,rgba(0,255,136,0.18),rgba(0,255,136,0.08))] px-4 py-3 text-base font-semibold text-[#b8ffd8] shadow-[0_0_20px_rgba(0,255,136,0.10)] transition hover:border-[rgba(0,255,136,0.34)] hover:bg-[linear-gradient(180deg,rgba(0,255,136,0.22),rgba(0,255,136,0.10))] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Prediction
          </button>
        </div>

        {predictionMessage && (
          <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3 text-sm text-white/75">
            {predictionMessage}
          </div>
        )}
      </div>
    </div>

    <div className="rounded-[1.75rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(8,8,8,0.98))] p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          onClick={() => setPredictionSortMode("highest")}
          className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] transition ${
            predictionSortMode === "highest"
              ? "border-[rgba(0,255,136,0.22)] bg-[rgba(0,255,136,0.08)] text-[#b8ffd8]"
              : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white/60 hover:text-white"
          }`}
        >
          Highest
        </button>

        <button
          onClick={() => setPredictionSortMode("newest")}
          className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] transition ${
            predictionSortMode === "newest"
              ? "border-[rgba(0,255,136,0.22)] bg-[rgba(0,255,136,0.08)] text-[#b8ffd8]"
              : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white/60 hover:text-white"
          }`}
        >
          Newest
        </button>
      </div>

      <div className="h-[560px] overflow-y-auto rounded-[1.25rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
        {sortedPredictionsForTab.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white/42">
  <div className="text-lg font-semibold">No entries</div>
  <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/25">
    Waiting for predictions
  </div>
</div>
        ) : (
          <div className="divide-y divide-white/5">
            {sortedPredictionsForTab.map((entry, index) => (
              <div
  key={entry.id}
  className="px-5 py-4"
>
  <div className="flex items-start gap-3">
    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(0,255,136,0.20)] bg-[rgba(0,255,136,0.08)] text-xs font-black text-[#8fffd0]">
      {index + 1}
    </div>

    <div className="min-w-0 flex-1">
      <div className="truncate font-semibold text-white" title={entry.username}>
        {entry.username}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-white/35">
          {formatTimeAgo(entry.createdAt)}
        </div>

        <div className="text-lg font-black text-[#b8ffd8]">
          {formatMoney(entry.guess)}
        </div>
      </div>
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

{activeSection === "slotpicker" && (
  <section className="space-y-6">
    <Panel className="mx-auto max-w-5xl border-[rgba(0,255,136,0.16)] shadow-[0_0_55px_rgba(0,255,136,0.10)]">
      <div className="text-center">
        <SectionLabel>Slot Picker</SectionLabel>

        <h2 className="mt-4 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[1.05] tracking-tight text-white">
          RANDOM
          <br />
          SLOT PICKER
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-white/55">
          Select providers, spin the picker, and let fate choose the next slot.
        </p>
      </div>

      <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
        <div className="text-xs font-bold uppercase tracking-[0.24em] text-white/40">
          Providers
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slotProviders.map((provider) => {
            const active = selectedProviders.includes(provider);
            const logo = providerLogos[provider];

            return (
              <button
                key={provider}
                onClick={() => toggleSlotProvider(provider)}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                  active
                    ? "border-[#00ff88]/45 bg-[#00ff88]/15 text-white shadow-[0_0_20px_rgba(0,255,136,0.14)]"
                    : "border-white/10 bg-white/5 text-white/65 hover:border-white/20 hover:text-white"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/35">
                  {logo ? (
                    <img
                      src={logo}
                      alt={provider}
                      className="h-7 w-7 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-xs font-black text-[#8fffd0]">
                      {provider.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate font-bold">{provider}</div>
                  <div className="text-xs text-white/35">
                    {slotData.filter((slot) => slot.provider === provider).length} slots
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-white/45">
  {selectedProviders.length === 0
    ? `🎲 All Providers Active (${slotData.length} slots)`
    : `${filteredSlots.length} slots from ${selectedProviders.length} provider(s)`}
</div>

          <button
            onClick={() => {
              setSelectedProviders([]);
              setPickedSlot(null);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[2rem] border border-[rgba(0,255,136,0.16)] bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(6,6,6,0.98))] p-8 text-center shadow-[0_0_45px_rgba(0,255,136,0.08)]">
        <button
          onClick={pickRandomSlot}
          disabled={isPickingSlot || filteredSlots.length === 0}
          className="w-full rounded-2xl border border-[#00ff88]/25 bg-[linear-gradient(180deg,rgba(0,255,136,0.22),rgba(0,255,136,0.08))] px-6 py-4 text-lg font-black text-[#b8ffd8] shadow-[0_0_25px_rgba(0,255,136,0.12)] transition hover:border-[#00ff88]/45 hover:bg-[#00ff88]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPickingSlot ? "Spinning..." : "Pick Random Slot"}
        </button>

        <div
  className={`mt-8 rounded-[1.75rem] border bg-black/35 p-8 transition-all duration-300 ${
    isPickingSlot
      ? "scale-[1.03] border-[#00ff88]/40 shadow-[0_0_60px_rgba(0,255,136,0.28)] blur-[0.2px]"
      : "border-white/10 shadow-[0_0_35px_rgba(0,255,136,0.14)]"
  }`}
>
          {!pickedSlot ? (
            <div className="py-12 text-white/45">
              No slot picked yet.
            </div>
          ) : (
            <>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/35">
  Selected Slot
</div>

{pickedSlot.image && (
  <img
    src={pickedSlot.image}
    alt={pickedSlot.name}
    className="mx-auto mt-6 mb-4 h-32 object-contain"
  />
)}

<div
  className={`mt-5 text-[clamp(2rem,5vw,4rem)] font-black transition-all duration-200 ${
    isPickingSlot
      ? "scale-95 text-white/70 blur-[1px]"
      : "scale-105 text-[#8fffd0] drop-shadow-[0_0_25px_rgba(0,255,136,0.65)]"
  }`}
>
  {pickedSlot.name}
</div>

<div
  className={`mt-5 inline-flex items-center gap-3 rounded-full border px-5 py-2 text-sm font-bold transition-all duration-200 ${
    isPickingSlot
      ? "border-white/10 bg-white/5 text-white/40 scale-95"
      : "border-[#00ff88]/20 bg-[#00ff88]/10 text-[#b8ffd8] scale-105 shadow-[0_0_20px_rgba(0,255,136,0.35)]"
  }`}
>
  {providerLogos[pickedSlot.provider] && (
    <img
      src={providerLogos[pickedSlot.provider]}
      alt={pickedSlot.provider}
      className="h-6 w-6 object-contain"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  )}
  {pickedSlot.provider}
</div>
            </>
          )}
        </div>
      </div>
    </Panel>
  </section>
)}

            {activeSection === "tournaments" && (
  <section className="space-y-6">
    <Panel className="border-[rgba(0,255,136,0.16)] shadow-[0_0_65px_rgba(0,255,136,0.10)]">
      <div className="text-center">
        <SectionLabel>Tournaments</SectionLabel>

        <h2 className="mt-4 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[1.05] tracking-tight text-white">
          {bracket.title || "Tournament Bracket"}
        </h2>

        <div className="mt-4 inline-flex rounded-full border border-[rgba(0,255,136,0.20)] bg-[rgba(0,255,136,0.08)] px-5 py-2 text-sm font-semibold text-[#b8ffd8]">
          Live Bracket
        </div>
      </div>

      {bracketLoading ? (
        <div className="mt-10 text-center text-white/55">Loading bracket...</div>
      ) : (
        <div className="mt-10 overflow-x-auto pb-2">
          <div className="mx-auto flex min-w-[980px] items-start justify-center gap-6">
            {bracket.rounds.map((round, roundIndex) => {
              const topPadding =
                roundIndex === 0
                  ? "pt-2"
                  : roundIndex === 1
                  ? "pt-14"
                  : roundIndex === 2
                  ? "pt-28"
                  : "pt-40";

              return (
                <div key={round.id} className={`w-[290px] shrink-0 ${topPadding}`}>
                  <div className="mb-4 text-center">
                    <div className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-5 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8fffd0]">
                      {round.name}
                    </div>
                  </div>

                  <div
                    className={`space-y-6 ${
                      roundIndex === 0
                        ? ""
                        : roundIndex === 1
                        ? "pt-8"
                        : roundIndex === 2
                        ? "pt-16"
                        : "pt-24"
                    }`}
                  >
                    {round.matches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  </section>
)}

{activeSection === "admin" && adminAllowed && (
  <section className="grid gap-6">
    <Panel className="border-emerald-300/25 shadow-[0_0_65px_rgba(16,185,129,0.10)]">
      <SectionLabel>Admin</SectionLabel>
      <h2 className="mt-3 text-4xl font-black tracking-wide">CONTROL CENTER</h2>
      <p className="mt-4 text-white/65">
        Admin panel is only shown for approved Twitch accounts.
      </p>

      <div className="mt-8 grid gap-4">
        <details
  open={adminDropdowns.predictions}
  onToggle={(e) => setAdminDropdown("predictions", e.currentTarget.open)}
  className="rounded-2xl border border-white/10 bg-black/30 p-5"
>
          <summary className="cursor-pointer text-xl font-black text-white">
            Predictions / Hunt
          </summary>

          <div className="mt-6 grid gap-4">
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

            <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
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
          </div>
        </details>

        <details
  open={adminDropdowns.giveaway}
  onToggle={(e) => setAdminDropdown("giveaway", e.currentTarget.open)}
  className="rounded-2xl border border-fuchsia-300/20 bg-black/30 p-5"
>
          <summary className="cursor-pointer text-xl font-black text-white">
            Giveaway System
          </summary>

          <div className="mt-6 grid gap-4">
            <button
              onClick={handleStartGiveaway}
              disabled={!isAdmin}
              className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-4 font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
            >
              Start Giveaway
            </button>

            <button
              onClick={handleAddTestEntry}
              disabled={!isAdmin}
              className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-semibold text-white transition hover:bg-white/5 disabled:opacity-40"
            >
              Add Test Entry
            </button>

            <button
              onClick={handleDrawGiveawayWinner}
              disabled={!isAdmin}
              className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-5 py-4 font-semibold text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:opacity-40"
            >
              Draw Winner
            </button>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/75">
              {giveawayMessage || "Start a giveaway, add entries, then draw a winner."}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.22em] text-white/45">
                Live Entries ({giveawayEntries.length})
              </div>

              <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto md:grid-cols-3 xl:grid-cols-4">
                {giveawayEntries.length === 0 ? (
                  <div className="text-sm text-white/40">No entries yet</div>
                ) : (
                  giveawayEntries.map((entry, index) => (
                    <div
                      key={index}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div className="font-semibold text-white"><span className="truncate text-sm">
  {entry.display_name || entry.username}
</span></div>

                      <div
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          Number(entry.weight || 1) >= 1.5
                            ? "border border-cyan-300/25 bg-cyan-400/10 text-cyan-200"
                            : Number(entry.weight || 1) >= 1.25
                            ? "border border-yellow-300/25 bg-yellow-400/10 text-yellow-200"
                            : "border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                        }`}
                      >
                        {Number(entry.weight || 1) >= 1.5
                          ? `💎 VIP x${entry.weight}`
                          : Number(entry.weight || 1) >= 1.25
                          ? `⭐ Affiliate x${entry.weight}`
                          : `Viewer x${entry.weight || 1}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.22em] text-white/45">
                Recent Winners
              </div>

              <div className="grid max-h-[420px] grid-cols-2 gap-1 overflow-y-auto md:grid-cols-4 xl:grid-cols-6">
                {recentGiveawayWinners.length === 0 ? (
                  <div className="text-sm text-white/40">No winners yet</div>
                ) : (
                  recentGiveawayWinners
  .filter((winner) => winner.status === "active" || !winner.finished_at)
  .slice(0, 1)
  .map((winner, index) => {
                    const username = String(winner.winner_username || "").toLowerCase();
                    const winCount = giveawayWinnerCounts[username] || 1;

                    return (
                      <div
                        key={winner.id || index}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            #{index + 1} {winner.winner_username}
                          </div>
                          <div className="text-xs text-white/35">
                            {winner.finished_at
                              ? new Date(winner.finished_at).toLocaleString()
                              : "Recently"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              winCount > 1
                                ? "border border-red-300/20 bg-red-400/15 text-red-300"
                                : "border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                            }`}
                          >
                            {winCount > 1 ? `Repeat x${winCount}` : "New"}
                          </div>

                          <button
                            onClick={() => handleDeleteWinner(winner.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </details>

        <details
  open={adminDropdowns.prizePortal}
  onToggle={(e) => setAdminDropdown("prizePortal", e.currentTarget.open)}
  className="rounded-2xl border border-cyan-300/20 bg-black/30 p-5"
>
          <summary className="cursor-pointer text-xl font-black text-white">
            Prize Portal Manager
          </summary>

<div className="mt-6 grid gap-4">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <SectionLabel>Prize Portal Manager</SectionLabel>
      <h2 className="mt-2 text-3xl font-black tracking-wide">ALL REWARDS</h2>
      <div className="mt-1 text-sm text-white/45">
        Manage every viewer reward, payout status, and mistakes.
      </div>
    </div>

    <button
      onClick={loadAdminRewards}
      className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 font-bold text-cyan-200 hover:bg-cyan-400/20"
    >
      Refresh Rewards
    </button>
  </div>

  <input
    value={adminRewardsSearch}
    onChange={(e) => setAdminRewardsSearch(e.target.value)}
    placeholder="Search username, status, title..."
    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
  />

  {adminRewardsMessage && (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
      {adminRewardsMessage}
    </div>
  )}

  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
    {filteredAdminRewards.length === 0 ? (
      <div className="p-6 text-center text-white/45">
        No rewards found. Click Refresh Rewards.
      </div>
    ) : (
      <div className="max-h-[650px] overflow-y-auto divide-y divide-white/5">
        {filteredAdminRewards.slice(0, 1).map((reward) => {
          const isComplete =
            reward.status === "complete"

          return (
            <div
              key={reward.id}
              className="grid gap-4 p-4 md:grid-cols-[1fr_120px_140px_190px]"
            >
              <div>
                <div className="font-black text-white">
                  {reward.display_name || reward.twitch_username}
                </div>
                <div className="mt-1 text-xs text-white/40">
                  @{reward.twitch_username}
                </div>
                <div className="mt-2 text-sm text-white/60">
                  {reward.title || "Chat Giveaway"} •{" "}
                  {reward.created_at
                    ? new Date(reward.created_at).toLocaleString()
                    : "Recently"}
                </div>
              </div>

              <div>
                <div className="text-xs text-white/35">Amount</div>
                <div className="mt-1 text-xl font-black text-[#8fffd0]">
                  ${Number(reward.amount || 0).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs text-white/35">Status</div>
                <div
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                    isComplete
                      ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                      : "border-yellow-300/20 bg-yellow-400/10 text-yellow-200"
                  }`}
                >
                  {isComplete ? "Completed" : "Pending"}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                {isComplete ? (
                  <button
                    onClick={() => handleAdminMarkRewardPending(reward.id)}
                    className="rounded-lg border border-yellow-300/30 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-200"
                  >
                    Set Pending
                  </button>
                ) : (
                  <button
                    onClick={() => handleAdminMarkRewardPaid(reward.id)}
                    className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200"
                  >
                    Mark Paid
                  </button>
                )}

                <button
  onClick={async () => {
    const newAmount = prompt("Edit giveaway winnings:", String(reward.amount || 0));

    if (newAmount === null) return;

    const amount = Number(newAmount);

    if (Number.isNaN(amount) || amount < 0) {
      alert("Enter a valid amount.");
      return;
    }

    const res = await fetch(`/api/admin/rewards?id=${reward.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Amount update failed.");
      return;
    }
    alert(JSON.stringify(data.reward, null, 2));

    setAdminRewards((current) =>
      current.map((item) =>
        item.id === reward.id
          ? { ...item, amount }
          : item
      )
    );

    setViewerRewards((current) =>
      current.map((item) =>
        item.id === reward.id
          ? { ...item, amount }
          : item
      )
    );

    loadAdminRewards();
    loadViewerRewards();
  }}
  className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200"
>
  Edit Amount
</button>

                <button
                  onClick={() => handleAdminDeleteReward(reward.id)}
                  className="rounded-lg border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
</div>
        </details>

        <details
  open={adminDropdowns.tournament}
  onToggle={(e) => setAdminDropdown("tournament", e.currentTarget.open)}
  className="rounded-2xl border border-emerald-300/20 bg-black/30 p-5"
>
          <summary className="cursor-pointer text-xl font-black text-white">
            Tournament Editor
          </summary>

          <div className="mt-6">
<SectionLabel>Tournament Admin</SectionLabel>
<h2 className="mt-3 text-4xl font-black tracking-wide">EDIT BRACKET</h2>

<div className="mt-8 grid gap-5">
  <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(8,8,8,0.98))] p-5">
    <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
      Bracket Title
    </div>
    <input
      value={bracket.title}
      onChange={(e) => updateBracketTitle(e.target.value)}
      disabled={!isAdmin}
      placeholder="Enter tournament title"
      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] px-4 py-3 text-white outline-none transition focus:border-[rgba(0,255,136,0.28)] disabled:opacity-40"
    />
  </div>

  <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(8,8,8,0.98))] p-5">
    <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
      Generate New Bracket
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
      <select
        value={generatorTeamCount}
        onChange={(e) => setGeneratorTeamCount(e.target.value)}
        disabled={!isAdmin}
        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] px-4 py-3 text-white outline-none disabled:opacity-40"
      >
        <option value="2">2 Teams</option>
        <option value="3">3 Teams</option>
        <option value="4">4 Teams</option>
        <option value="5">5 Teams</option>
        <option value="6">6 Teams</option>
        <option value="7">7 Teams</option>
        <option value="8">8 Teams</option>
        <option value="9">9 Teams</option>
        <option value="10">10 Teams</option>
        <option value="11">11 Teams</option>
        <option value="12">12 Teams</option>
        <option value="13">13 Teams</option>
        <option value="14">14 Teams</option>
        <option value="15">15 Teams</option>
        <option value="16">16 Teams</option>
      </select>

      <button
        onClick={handleGenerateBracket}
        disabled={!isAdmin}
        className="rounded-xl border border-[rgba(0,255,136,0.22)] bg-[linear-gradient(180deg,rgba(0,255,136,0.18),rgba(0,255,136,0.08))] px-5 py-3 font-semibold text-[#b8ffd8] shadow-[0_0_20px_rgba(0,255,136,0.10)] transition hover:border-[rgba(0,255,136,0.34)] disabled:opacity-40"
      >
        Generate Bracket
      </button>
    </div>

    <div className="mt-3 text-sm text-white/45">
      Blank team slots are created automatically. Odd team counts will include BYEs.
    </div>
  </div>

  <div className="grid gap-4">
    {bracket.rounds.map((round) => (
      <div
        key={round.id}
        className="rounded-[1.5rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(8,8,8,0.98))] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#8fffd0]">
            {round.name}
          </div>

          <input
            value={round.name}
            onChange={(e) => updateRoundName(round.id, e.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] px-4 py-3 text-white outline-none transition focus:border-[rgba(0,255,136,0.28)] disabled:opacity-40 md:max-w-[220px]"
          />
        </div>

        <div className="mt-5 grid gap-4">
          {round.matches.map((match) => (
            <div
              key={match.id}
              className="rounded-[1.25rem] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                  {match.id.toUpperCase()}
                </div>

                <div className="text-xs uppercase tracking-[0.22em] text-white/30">
                  {match.winner ? `Winner: ${match.winner}` : "No winner selected"}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <input
                    value={match.player1}
                    onChange={(e) =>
                      updateMatchField(round.id, match.id, "player1", e.target.value)
                    }
                    disabled={!isAdmin || match.player1 === "BYE"}
                    placeholder="Player / Provider"
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] px-4 py-3 text-white outline-none transition focus:border-[rgba(0,255,136,0.28)] disabled:opacity-40"
                  />

                  <input
                    value={match.player1Amount || ""}
                    onChange={(e) =>
                      updateMatchField(
                        round.id,
                        match.id,
                        "player1Amount",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    disabled={!isAdmin || match.player1 === "BYE"}
                    placeholder="Amount won"
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.25)] px-4 py-3 text-sm text-white outline-none transition focus:border-[rgba(245,196,81,0.35)] disabled:opacity-40"
                  />
                </div>

                <div className="grid gap-2">
                  <input
                    value={match.player2}
                    onChange={(e) =>
                      updateMatchField(round.id, match.id, "player2", e.target.value)
                    }
                    disabled={!isAdmin || match.player2 === "BYE"}
                    placeholder="Player / Provider"
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] px-4 py-3 text-white outline-none transition focus:border-[rgba(0,255,136,0.28)] disabled:opacity-40"
                  />

                  <input
                    value={match.player2Amount || ""}
                    onChange={(e) =>
                      updateMatchField(
                        round.id,
                        match.id,
                        "player2Amount",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    disabled={!isAdmin || match.player2 === "BYE"}
                    placeholder="Amount won"
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.25)] px-4 py-3 text-sm text-white outline-none transition focus:border-[rgba(245,196,81,0.35)] disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <button
                  onClick={() => selectMatchWinner(round.id, match.id, match.player1)}
                  disabled={!isAdmin || !match.player1.trim() || match.player1 === "BYE"}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-40 ${
                    match.winner === match.player1
                      ? "border-[rgba(0,255,136,0.30)] bg-[rgba(0,255,136,0.10)] text-[#b8ffd8]"
                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white"
                  }`}
                >
                  Pick {match.player1 || ""}
                </button>

                <button
                  onClick={() => selectMatchWinner(round.id, match.id, match.player2)}
                  disabled={!isAdmin || !match.player2.trim() || match.player2 === "BYE"}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-40 ${
                    match.winner === match.player2
                      ? "border-[rgba(0,255,136,0.30)] bg-[rgba(0,255,136,0.10)] text-[#b8ffd8]"
                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white"
                  }`}
                >
                  Pick {match.player2 || ""}
                </button>

                <button
                  onClick={() => clearMatchWinner(round.id, match.id)}
                  disabled={!isAdmin}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
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
  </div>

  <div className="grid gap-3 md:grid-cols-2">
    <button
      onClick={saveBracket}
      disabled={!isAdmin}
      className="rounded-2xl border border-[rgba(0,255,136,0.22)] bg-[linear-gradient(180deg,rgba(0,255,136,0.18),rgba(0,255,136,0.08))] px-5 py-4 font-semibold text-[#b8ffd8] shadow-[0_0_20px_rgba(0,255,136,0.10)] transition hover:border-[rgba(0,255,136,0.34)] disabled:opacity-40"
    >
      Save Bracket
    </button>

    <button
      onClick={resetBracket}
      disabled={!isAdmin}
      className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-5 py-4 font-semibold text-white disabled:opacity-40"
    >
      Reset Bracket
    </button>
  </div>

  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-white/75">
    {bracketMessage || "Generate a bracket, enter teams, pick winners, then save it live."}
  </div>
</div>
</div>
        </details>
      </div>
    </Panel>
  </section>
)}
          </main>

          <footer className="relative overflow-hidden border-t border-[rgba(0,255,136,0.14)] bg-[linear-gradient(180deg,rgba(8,8,8,0.88),rgba(4,4,4,0.96))] px-6 py-8">
  <div className="absolute inset-x-0 top-0 h-px bg-[rgba(0,255,136,0.22)] shadow-[0_0_14px_rgba(0,255,136,0.25)]" />
  
  <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-white/45 md:flex-row md:items-center md:justify-between">
    <div>© 2026 Trashguy</div>

    <div className="flex flex-wrap gap-4">
      {socials.map((social) => (
        <a
          key={social.name}
          href={social.href}
          target="_blank"
          rel="noreferrer"
          className="transition hover:text-[#8fffd0]"
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