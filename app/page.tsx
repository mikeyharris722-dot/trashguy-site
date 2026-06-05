"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import SiteHeader from "@/components/site-header";
import { FaDiscord, FaXTwitter, FaYoutube, FaInstagram } from "react-icons/fa6";
import { slotData, providerLogos, type SlotItem } from "./slotData";
import { Russo_One } from "next/font/google";

const russo = Russo_One({
  subsets: ["latin"],
  weight: "400",
});

const socials = [
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

const leaderboardTotal = 1000;

const leaderboardPrizes: Record<number, number> = {
  1: 400,
  2: 250,
  3: 175,
  4: 100,
  5: 75,
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

type MonthlyRewardItem = {
  date: string;
  title: string;
  amount: string;
  note: string;
};

function playUiSound(type: "click" | "success" | "error" = "click") {
  if (typeof window === "undefined") return;

  const file =
    type === "success"
      ? "/click.mp3"
      : type === "error"
      ? "/click.mp3"
      : "/click.mp3";

  const audio = new Audio(file);
  audio.volume = type === "error" ? 0.22 : 0.32;
  audio.play().catch(() => {});
}

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
  const byeCount = bracketSize - safeCount;

  const rounds: BracketRound[] = [];
  let matchCounter = 1;

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const roundName = getRoundName(roundIndex, totalRounds);
    const matchCount = bracketSize / Math.pow(2, roundIndex + 1);

    const matches: BracketMatch[] = Array.from({ length: matchCount }, (_, matchIndex) => {
      if (roundIndex === 0) {
        const hasBye = matchIndex < byeCount;

        return {
          id: `m${matchCounter++}`,
          player1: "",
          player1Amount: "",
          player2: hasBye ? "BYE" : "",
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
        "relative overflow-hidden rounded-[22px]",
        "bg-black/28",
        "backdrop-blur-[6px]",
        "border border-white/[0.04]",
        "shadow-[0_0_30px_rgba(0,0,0,0.18)]",
        className,
      ].join(" ")}
    >
      <div className="relative z-10 p-4 sm:p-5">
        {children}
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  color = "cyan",
}: {
  children: React.ReactNode;
  color?: "cyan" | "fuchsia" | "white";
}) {
  const map = {
    cyan: "text-[#00ffff]",
    fuchsia: "text-[#42f5a7]",
    white: "text-white/60",
  };

  return (
    <div className={`text-[11px] font-black uppercase tracking-[0.34em] drop-shadow-[0_0_10px_rgba(0,245,255,0.25)] ${map[color]}`}>
      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  variant = "green",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "green" | "red" | "purple" | "gold" | "dark";
  className?: string;
}) {
const variants = {
  green:
    "border-cyan-300/35 bg-[linear-gradient(180deg,rgba(0,245,255,0.22),rgba(0,245,255,0.08))] text-cyan-100 shadow-[0_0_22px_rgba(0,245,255,0.12)] hover:border-cyan-200/60 hover:shadow-[0_0_35px_rgba(0,245,255,0.22)]",
  red:
    "border-red-300/30 bg-[linear-gradient(180deg,rgba(248,113,113,0.18),rgba(127,29,29,0.14))] text-red-100 hover:border-red-200/60 hover:shadow-[0_0_28px_rgba(248,113,113,0.18)]",
  purple:
    "border-fuchsia-300/30 bg-[linear-gradient(180deg,rgba(217,70,239,0.18),rgba(88,28,135,0.16))] text-fuchsia-100 hover:border-fuchsia-200/60 hover:shadow-[0_0_28px_rgba(217,70,239,0.20)]",
  gold:
    "border-yellow-300/35 bg-[linear-gradient(180deg,rgba(250,204,21,0.22),rgba(120,53,15,0.14))] text-yellow-100 hover:border-yellow-200/60 hover:shadow-[0_0_30px_rgba(250,204,21,0.22)]",
  dark:
    "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] text-white hover:border-white/25 hover:bg-white/[0.07]",
};

  return (
    <button
      onClick={() => {
        playUiSound("click");
        onClick?.();
      }}
      disabled={disabled}
      className={[
        "group relative min-h-[54px] overflow-hidden rounded-2xl border px-5 py-3",
        "text-sm font-black uppercase tracking-[0.12em]",
        "transition-all duration-200 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        className,
      ].join(" ")}
    >
      <span className="pointer-events-none absolute inset-0 translate-x-[-120%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)] transition-transform duration-700 group-hover:translate-x-[120%]" />
      <span className="relative z-10">{children}</span>
    </button>
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
      className={`rounded-[1.2rem] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(18,18,18,0.96),rgba(8,8,8,0.98))] shadow-[0_0_18px_rgba(0,245,255,0.05)] ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="space-y-2">
        <div
          className={`rounded-xl border px-4 py-3 font-semibold transition ${
            isWinner1
              ? "border-[rgba(0,245,255,0.35)] bg-[rgba(0,245,255,0.10)] text-[#b8ffd8] shadow-[0_0_16px_rgba(0,245,255,0.10)]"
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
              ? "border-[rgba(0,245,255,0.35)] bg-[rgba(0,245,255,0.10)] text-[#b8ffd8] shadow-[0_0_16px_rgba(0,245,255,0.10)]"
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
const [currentGiveawayWinner, setCurrentGiveawayWinner] = useState("");
const [winnerChatMessages, setWinnerChatMessages] = useState<string[]>([]);
const [giveawayPrizeAmount, setGiveawayPrizeAmount] = useState("");
const [giveawayDrawTime, setGiveawayDrawTime] = useState<number | null>(null);
const [giveawayTimerTick, setGiveawayTimerTick] = useState(Date.now());
const [winnerFollowAge, setWinnerFollowAge] = useState("");
const [giveawayRespondedTime, setGiveawayRespondedTime] = useState<number | null>(null);

const [snakeCaptainCount, setSnakeCaptainCount] = useState("2");
const [snakeCaptainsText, setSnakeCaptainsText] = useState("");
const [snakePlayersText, setSnakePlayersText] = useState("");
const [snakeCaptains, setSnakeCaptains] = useState<string[]>([]);
const [snakePlayers, setSnakePlayers] = useState<string[]>([]);
const [snakeTeams, setSnakeTeams] = useState<Record<string, string[]>>({});
const [snakePickOrder, setSnakePickOrder] = useState<string[]>([]);
const [snakeCurrentPickIndex, setSnakeCurrentPickIndex] = useState(0);
const [snakeMessage, setSnakeMessage] = useState("");
const [snakeSlotCalls, setSnakeSlotCalls] = useState<Record<string, string>>({});
const [snakeSlotOrder, setSnakeSlotOrder] = useState<string[]>([]);
const [snakeSlotAmounts, setSnakeSlotAmounts] = useState<Record<string, string>>({});
const [snakeSlotHit, setSnakeSlotHit] = useState<Record<string, boolean>>({});
const [snakeSlotRounds, setSnakeSlotRounds] = useState("5");

async function saveSnakeDraft() {
  const res = await fetch("/api/snake-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      snakeCaptainCount,
      snakeCaptainsText,
      snakePlayersText,
      snakeCaptains,
      snakePlayers,
      snakeTeams,
      snakePickOrder,
      snakeCurrentPickIndex,
      snakeSlotCalls,
      snakeSlotOrder,
      snakeSlotAmounts,
      snakeSlotHit,
      snakeSlotRounds,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    setSnakeMessage(data.error || "Snake draft save failed.");
    return;
  }

  setSnakeMessage("Snake draft saved.");
}

async function handleGenerateVipSnapshot() {
  setAdminMessage("Generating VIP snapshot...");

  const res = await fetch("/api/admin/vip-snapshot", {
    method: "POST",
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    setAdminMessage(data.error || "VIP snapshot failed.");
    return;
  }

  setAdminMessage(`VIP snapshot saved: ${data.saved} VIPs.`);
  await loadViewerRewards?.();
}

async function loadSnakeDraft() {
  const res = await fetch("/api/snake-draft", {
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok || !data.ok || !data.draft) return;

  const draft = data.draft;

  setSnakeCaptainCount(draft.snakeCaptainCount || "2");
  setSnakeCaptainsText(draft.snakeCaptainsText || "");
  setSnakePlayersText(draft.snakePlayersText || "");
  setSnakeCaptains(draft.snakeCaptains || []);
  setSnakePlayers(draft.snakePlayers || []);
  setSnakeTeams(draft.snakeTeams || {});
  setSnakePickOrder(draft.snakePickOrder || []);
  setSnakeCurrentPickIndex(draft.snakeCurrentPickIndex || 0);
  setSnakeSlotCalls(draft.snakeSlotCalls || {});
  setSnakeSlotOrder(draft.snakeSlotOrder || []);
  setSnakeSlotAmounts(draft.snakeSlotAmounts || {});
  setSnakeSlotHit(draft.snakeSlotHit || {});
  setSnakeSlotRounds(draft.snakeSlotRounds || "5");
}

const [tournamentView, setTournamentView] = useState<"bracket" | "snake">("bracket");

const [slotCalls, setSlotCalls] = useState<
  { username: string; slotName: string; createdAt: number }[]
>([]);
const [slotCallMessage, setSlotCallMessage] = useState("");
const [isSlotWheelSpinning, setIsSlotWheelSpinning] = useState(false);
const [pickedSlotCall, setPickedSlotCall] = useState<{
  username: string;
  slotName: string;
  createdAt: number;
} | null>(null);
const [slotWheelRotation, setSlotWheelRotation] = useState(0);

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

const Winner = async (id: string) => {
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
      giveaway: false,
      prizePortal: false,
      predictions: false,
      tournament: false,
      slotWheel: false,
    };
  }

  const saved = localStorage.getItem("admin_dropdowns");

  return saved
    ? JSON.parse(saved)
    : {
      giveaway: false,
      prizePortal: false,
      predictions: false,
      tournament: false,
      slotWheel: false,
      };
});

useEffect(() => {
  if (typeof window === "undefined") return;
  localStorage.setItem("admin_dropdowns", JSON.stringify(adminDropdowns));
}, [adminDropdowns]);

const setAdminDropdown = (
  key: "giveaway" | "prizePortal" | "predictions" | "tournament" | "slotWheel",
  open: boolean
) => {
  setAdminDropdowns((current: Record<
    "giveaway" | "prizePortal" | "predictions" | "tournament" | "slotWheel",
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

  const [calendarDate, setCalendarDate] = useState(() => new Date());

const [monthlyRewards, setMonthlyRewards] = useState<Record<string, MonthlyRewardItem>>({});

const loadMonthlyRewards = useCallback(async () => {
  try {
    const res = await fetch("/api/monthly-rewards", { cache: "no-store" });
    const data = await res.json();

    if (!data.ok) return;

    const mapped: Record<string, MonthlyRewardItem> = {};

    (data.rewards || []).forEach((reward: any) => {
      mapped[reward.reward_date] = {
        date: reward.reward_date,
        title: reward.title || "",
        amount: String(reward.amount || ""),
        note: reward.note || "",
      };
    });

    setMonthlyRewards(mapped);
  } catch (error) {
    console.error("Monthly rewards failed to load", error);
  }
}, []);

const monthlyRewardDays = useMemo(() => {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const blanks = Array.from({ length: firstDayOfWeek }, (_, index) => ({
    blank: true,
    key: `blank-${index}`,
  }));

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;

    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return {
      blank: false,
      key: dateKey,
      day,
      dateKey,
      reward: monthlyRewards[dateKey],
    };
  });

  return [...blanks, ...days];
}, [calendarDate, monthlyRewards]);

const updateMonthlyReward = async (
  dateKey: string,
  field: "title" | "amount" | "note",
  value: string
) => {
  const currentReward = monthlyRewards[dateKey] || {
    date: dateKey,
    title: "",
    amount: "",
    note: "",
  };

  const nextReward = {
    ...currentReward,
    [field]: value,
  };

  setMonthlyRewards((current) => ({
    ...current,
    [dateKey]: nextReward,
  }));

  try {
    await fetch("/api/monthly-rewards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reward_date: dateKey,
        title: nextReward.title,
        amount: nextReward.amount || 0,
        note: nextReward.note,
      }),
    });
  } catch (error) {
    console.error("Monthly reward save failed", error);
  }
};

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

const adminSelectedHunt = useMemo(() => {
  return (
    huntsData.find((hunt) => hunt.id === adminHuntId) ||
    currentPredictionHunt ||
    null
  );
}, [huntsData, adminHuntId, currentPredictionHunt]);
const currentPredictionCount = predictions.length;

const currentPredictionAvgX =
  currentPredictionHunt?.startCost && currentPredictionHunt.startCost > 0
    ? ((currentPredictionHunt.totalWinnings || 0) / currentPredictionHunt.startCost).toFixed(2)
    : "0.00";

    const leaderboardCountdown = useMemo(() => {
  const end = new Date("2026-06-04T19:00:00-04:00").getTime();
  const diff = end - countdownTick;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}, [countdownTick]);

const leaderboardProgress = useMemo(() => {
  const start = new Date("2026-05-05T00:00:00-04:00").getTime();
  const end = new Date("2026-06-05T00:00:00-04:00").getTime();
  const total = end - start;
  const elapsed = countdownTick - start;

  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 100;

  return (elapsed / total) * 100;
}, [countdownTick]);

const giveawayResponseTimer = useMemo(() => {
  if (!giveawayDrawTime) return "0m 00s";

  const endTime = giveawayRespondedTime || giveawayTimerTick;

  const totalSeconds = Math.max(
    0,
    Math.floor((endTime - giveawayDrawTime) / 1000)
  );

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}, [giveawayDrawTime, giveawayRespondedTime, giveawayTimerTick]);

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
  const timer = setInterval(() => {
    setGiveawayTimerTick(Date.now());
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
        activeSection === id ? "text-cyan-300" : "text-white/80 hover:text-white"
      }`}
    >
      {label}
      {activeSection === id && (
        <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(0,245,255,1)]" />
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
  const nextBracket = maybeAutoAdvanceClassic8(data.bracket);

  setBracket(nextBracket);
  setGeneratorTeamCount(String(nextBracket.rounds[0]?.matches?.length * 2 || 8));
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
  loadMonthlyRewards();

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
}, [loadBracket, loadGiveaways, loadHunts, loadLeaderboard, loadLiveStatus, loadMonthlyRewards, loadPredictions, loadViewerRewards]);

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

useEffect(() => {
  if (!currentGiveawayWinner) return;

  let client: any;

  const connectChat = async () => {
    const tmiModule: any = await import("tmi.js");
    const tmi = tmiModule.default || tmiModule;

    client = new tmi.Client({
      channels: ["trashguy__"],
    });

    await client.connect().catch(() => {});

    client.on("message", (_channel: string, tags: any, message: string, self: boolean) => {
      if (self) return;

      const chatter = String(tags.username || tags["display-name"] || "")
        .replace("@", "")
        .trim()
        .toLowerCase();

      if (chatter !== currentGiveawayWinner) return;

      setGiveawayRespondedTime((current) => current || Date.now());

      setWinnerChatMessages((current) =>
        [`${tags["display-name"] || chatter}: ${message}`, ...current].slice(0, 6)
      );
    });
  };

  connectChat();

  return () => {
    if (client) {
      client.disconnect().catch(() => {});
    }
  };
}, [currentGiveawayWinner]);

useEffect(() => {
  loadSnakeDraft();
}, []);

useEffect(() => {
  let client: any;

  const connectSlotChat = async () => {
    const tmiModule: any = await import("tmi.js");
    const tmi = tmiModule.default || tmiModule;

    client = new tmi.Client({
      channels: ["trashguy__"],
    });

    await client.connect().catch(() => {});

    client.on("message", (_channel: string, tags: any, message: string, self: boolean) => {
      if (self) return;

      const text = String(message || "").trim();
      if (!text.toLowerCase().startsWith("!slot ")) return;

      const slotName = text.replace(/^!slot\s+/i, "").trim();
      if (!slotName) return;

      const username = String(tags["display-name"] || tags.username || "viewer");

setSlotCalls((current) => {
  const normalizedUser = username.trim().toLowerCase();
  const normalizedSlot = slotName.trim().toLowerCase();

  const userAlreadyCalled = current.some(
    (call) => call.username.trim().toLowerCase() === normalizedUser
  );

  if (userAlreadyCalled) {
    setSlotCallMessage(`${username} already has a slot on the wheel.`);
    return current;
  }

  const slotAlreadyCalled = current.some(
    (call) => call.slotName.trim().toLowerCase() === normalizedSlot
  );

  if (slotAlreadyCalled) {
    setSlotCallMessage(`${slotName} is already on the wheel.`);
    return current;
  }

  setSlotCallMessage(`${username} added: ${slotName}`);

  return [
    ...current,
    {
      username,
      slotName,
      createdAt: Date.now(),
    },
  ];
});
    });
  };

  connectSlotChat();

  return () => {
    if (client) {
      client.disconnect().catch(() => {});
    }
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
const existingOpenHunt = huntsData.find(
  (hunt) =>
    hunt.id !== adminHuntId &&
    (hunt.prediction_status === "open" || hunt.status === "open" || hunt.isOpening)
);

if (existingOpenHunt && predictionStatus === "open") {
  setAdminMessage("A hunt is already active.");
  setAdminHuntId(existingOpenHunt.id);

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.activeHuntId, existingOpenHunt.id);
    localStorage.setItem(STORAGE_KEYS.predictionStatus, "open");
  }

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

if (data?.hunt) {
  const newHunt: HuntItem = {
    id: data.hunt.id,
    title: data.hunt.title || "Live Hunt",
    casino: data.hunt.casino || "Roulobets",
    startCost: Number(data.hunt.start_amount || data.hunt.startCost || 0),
    totalWinnings: 0,
    profitLoss: 0,
    profitLossPercentage: 0,
    status: "open",
    prediction_status: "open",
    isOpening: true,
    createdAt: data.hunt.created_at || new Date().toISOString(),
    updatedAt: data.hunt.updated_at || new Date().toISOString(),
    bonuses: [],
  };

  setHuntsData((current) => [
    newHunt,
    ...current.filter((hunt) => hunt.id !== newHunt.id),
  ]);
}

setAdminHuntId(newHuntId);
setPredictionStatus("open");
setPredictions([]);
setLatestWinners([]);
setFinalResult("");

if (typeof window !== "undefined" && newHuntId) {
  localStorage.setItem(STORAGE_KEYS.activeHuntId, newHuntId);
  localStorage.setItem(STORAGE_KEYS.predictionStatus, "open");
}

    setLatestWinners([]);
    setFinalResult("");
    setPredictions([]);
    setAdminMessage("New hunt started.");
await loadHunts();
await loadPredictions();
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
await loadHunts();
await loadPredictions();
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
await loadHunts();
await loadPredictions();
  } catch {
    setAdminMessage("Failed to open predictions.");
  }
};

const handleCompleteHunt = async () => {
  if (!adminHuntId) {
    setAdminMessage("Start a new hunt first.");
    return;
  }

  const amount = Number(
    currentPredictionHunt?.stats?.totalWinnings ||
      currentPredictionHunt?.totalWinnings ||
      adminSelectedHunt?.stats?.totalWinnings ||
      adminSelectedHunt?.totalWinnings ||
      0
  );

  if (!amount) {
    setAdminMessage("No final hunt balance found yet.");
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

    setFinalResult(String(amount));
    setPredictionStatus("locked");
    setLatestWinners(Array.isArray(data?.winners) ? data.winners : []);
    setAdminMessage(`Hunt completed at ${formatMoney(amount)}. Winners calculated.`);

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.activeHuntId);
      localStorage.setItem(STORAGE_KEYS.predictionStatus, "locked");
    }

    await loadHunts();
    await loadPredictions();
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

  if (!data?.ok || !data?.winner?.username) {
    setGiveawayMessage(data?.error || "Failed to draw winner.");
    return;
  }

  const winnerName = String(data.winner.username || "")
    .replace("@", "")
    .trim()
    .toLowerCase();

setCurrentGiveawayWinner(winnerName);
setWinnerChatMessages([]);
setGiveawayMessage(winnerName);
setGiveawayDrawTime(Date.now());
setWinnerFollowAge("");
setGiveawayRespondedTime(null);

try {
  const followRes = await fetch(
    `/api/twitch/follow-age?user=${encodeURIComponent(winnerName)}`
  );

  const followData = await followRes.json();

if (followData?.ok) {
  setWinnerFollowAge(followData.followAge || "");
} else {
  console.log("Follow age error:", followData);
  setWinnerFollowAge(followData?.error || "Unknown");
}
} catch {
  setWinnerFollowAge("Unknown");
}

  loadAdminRewards();
};

const handleAwardGiveawayPrize = async () => {
  if (!currentGiveawayWinner) {
    alert("Draw a winner first.");
    return;
  }

  const amount = Number(giveawayPrizeAmount || 0);

  if (!amount || Number.isNaN(amount)) {
    alert("Enter a valid prize amount.");
    return;
  }

  const latestReward = adminRewards.find(
    (reward) =>
      String(reward.twitch_username || reward.display_name || "")
        .toLowerCase()
        .includes(currentGiveawayWinner.toLowerCase())
  );

  if (!latestReward?.id) {
    alert("Reward not found yet. Try clicking Refresh Rewards, then award again.");
    loadAdminRewards();
    return;
  }

  const res = await fetch(`/api/admin/rewards?id=${latestReward.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      status: "pending",
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    alert(data.error || "Award failed.");
    return;
  }

  setGiveawayPrizeAmount("");
  loadAdminRewards();
  loadViewerRewards();

  alert(`Awarded $${amount} to ${currentGiveawayWinner}`);
};

function cleanSnakeNames(text: string) {
  return text
    .split("\n")
    .map((name) => name.replace("@", "").trim())
    .filter(Boolean);
}

function shuffleSnakeList(list: string[]) {
  return [...list].sort(() => Math.random() - 0.5);
}

function buildSnakeOrder(captains: string[], rounds: number) {
  const order: string[] = [];

  for (let round = 0; round < rounds; round++) {
    const roundOrder = round % 2 === 0 ? captains : [...captains].reverse();
    order.push(...roundOrder);
  }

  return order;
}

function handleSetupSnakeDraft() {
  const captainList = cleanSnakeNames(snakeCaptainsText).slice(
    0,
    Number(snakeCaptainCount)
  );

  const playerList = cleanSnakeNames(snakePlayersText);

  if (captainList.length === 0) {
    setSnakeMessage("Add captains first.");
    return;
  }

  const randomizedCaptains = shuffleSnakeList(captainList);

  const teams: Record<string, string[]> = {};
  randomizedCaptains.forEach((captain) => {
    teams[captain] = [];
  });

  const roundsNeeded = Math.ceil(playerList.length / randomizedCaptains.length);
  const order = buildSnakeOrder(randomizedCaptains, roundsNeeded);

  setSnakeCaptains(randomizedCaptains);
  setSnakePlayers(playerList);
  setSnakeTeams(teams);
  setSnakePickOrder(order);
  setSnakeCurrentPickIndex(0);
  setSnakeMessage("Snake draft ready.");
}

function handleSnakePickPlayer(player: string) {
  const captain = snakePickOrder[snakeCurrentPickIndex];

  if (!captain) {
    setSnakeMessage("Draft complete.");
    return;
  }

  setSnakeTeams((current) => ({
    ...current,
    [captain]: [...(current[captain] || []), player],
  }));

  setSnakePlayers((current) => current.filter((name) => name !== player));
  setSnakeCurrentPickIndex((current) => current + 1);

  setSnakeMessage(`${captain} picked ${player}.`);
}

function handleResetSnakeDraft() {
  setSnakeCaptainCount("2");
  setSnakeCaptainsText("");
  setSnakePlayersText("");
  setSnakeCaptains([]);
  setSnakePlayers([]);
  setSnakeTeams({});
  setSnakePickOrder([]);
  setSnakeCurrentPickIndex(0);
  setSnakeMessage("");
}

function buildSnakeSlotOrder() {
  const rounds = Math.max(
    ...snakeCaptains.map(
      (captain) => (snakeTeams[captain] || []).length
    ),
    0
  );

  const baseOrder: string[] = [];

  for (let round = 0; round < rounds + 1; round++) {
    snakeCaptains.forEach((captain) => {
      if (round === 0) {
        baseOrder.push(captain);
      } else {
        const player = snakeTeams[captain]?.[round - 1];
        if (player) baseOrder.push(player);
      }
    });
  }

  const slotRounds = Math.max(1, Number(snakeSlotRounds || 1));
  const snakeOrder: string[] = [];

  for (let round = 0; round < slotRounds; round++) {
    const roundOrder =
      round % 2 === 0 ? baseOrder : [...baseOrder].reverse();

    snakeOrder.push(...roundOrder);
  }

  setSnakeSlotOrder(snakeOrder);

  setSnakeSlotCalls((current) => {
    const next = { ...current };

    snakeOrder.forEach((name, index) => {
      const key = `${name}-${index}`;
      if (!next[key]) next[key] = "";
    });

    return next;
  });

  setSnakeMessage(`Slot call snake order created for ${slotRounds} rounds.`);
}

function getSnakeTeamForName(name: string) {
  const captainMatch = snakeCaptains.find((captain) => captain === name);
  if (captainMatch) return captainMatch;

  return (
    snakeCaptains.find((captain) =>
      (snakeTeams[captain] || []).includes(name)
    ) || ""
  );
}

function getSnakeTeamTotal(captain: string) {
  const teamNames = [captain, ...(snakeTeams[captain] || [])];

  return snakeSlotOrder.reduce((total, name, index) => {
    const key = `${name}-${index}`;
    const teamCaptain = getSnakeTeamForName(name);

    if (teamCaptain !== captain) return total;

    return total + Number(snakeSlotAmounts[key] || 0);
  }, 0);
}

function getSnakeTeamStyle(captain: string) {
  const index = snakeCaptains.indexOf(captain);

  const styles = [
    "border-cyan-300/35 bg-cyan-400/10",
    "border-purple-300/35 bg-purple-400/10",
    "border-yellow-300/35 bg-yellow-400/10",
    "border-emerald-300/35 bg-emerald-400/10",
    "border-pink-300/35 bg-pink-400/10",
    "border-orange-300/35 bg-orange-400/10",
  ];

  return styles[index % styles.length] || styles[0];
}

const handleSpinSlotWheel = () => {
  if (isSlotWheelSpinning || slotCalls.length === 0) return;

  setIsSlotWheelSpinning(true);
  setPickedSlotCall(null);

  const winnerIndex = Math.floor(Math.random() * slotCalls.length);

  if (slotCalls.length < 5) {
    setSlotWheelRotation(0);

    setTimeout(() => {
      setPickedSlotCall(slotCalls[winnerIndex]);
      setIsSlotWheelSpinning(false);
    }, 700);

    return;
  }

  const rowHeight = 58;
  const centerRowOffset = 2;
  const loops = 8;

  const targetIndex = loops * slotCalls.length + winnerIndex;
  const finalOffset = Math.max(0, (targetIndex - centerRowOffset) * rowHeight);

  setSlotWheelRotation(finalOffset);

  setTimeout(() => {
    setPickedSlotCall(slotCalls[winnerIndex]);
    setIsSlotWheelSpinning(false);
  }, 4200);
};

const handleShuffleSlotWheel = () => {
  if (slotCalls.length <= 1 || isSlotWheelSpinning) return;

  setPickedSlotCall(null);

  setSlotCalls((current) => {
    const shuffled = [...current];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  });
};

const handleRemovePickedSlot = () => {
  if (!pickedSlotCall) return;

  setSlotCalls((current) =>
    current.filter(
      (call) =>
        !(
          call.slotName === pickedSlotCall.slotName &&
          call.username === pickedSlotCall.username
        )
    )
  );

  setPickedSlotCall(null);
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

const Reward = async (id: string) => {
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
  if (!id) return;
  if (!confirm("Delete this reward?")) return;

  try {
    const res = await fetch(`/api/admin/rewards?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Delete failed.");
      return;
    }

    setAdminRewards((current) =>
      current.filter((reward) => reward.id !== id)
    );

    setViewerRewards((current) =>
      current.filter((reward) => reward.id !== id)
    );

    await loadAdminRewards();
    await loadViewerRewards();
  } catch {
    alert("Delete failed.");
  }
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

  setGeneratorTeamCount(String(count));
  setBracket(createBracketFromTeamCount(count, bracket.title || "Trashguy Tournament"));
  setBracketMessage(`${count}-team bracket generated locally. Click Save Bracket to keep it.`);
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
<div className="min-h-screen bg-[#020809] text-white">
  <div className="min-h-screen bg-[url('/trashguy-casino.png')] bg-cover bg-center bg-fixed">
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(0,0,0,0.50),rgba(0,0,0,0.82)),radial-gradient(circle_at_center,rgba(0,255,255,0.10),rgba(0,0,0,0.78))]">
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

<main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-10">
{activeSection === "home" && (
  <section className="space-y-1 sm:space-y-3">
    <section className="relative -mx-3 overflow-hidden px-3 py-2 text-center sm:-mx-6 sm:px-6 sm:py-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.14),transparent_58%)]" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <img
          src="/hero-logos.png"
          alt="Trashguy x RouloBets"
          className="mx-auto h-[125px] w-auto object-contain drop-shadow-[0_0_42px_rgba(0,245,255,0.38)] sm:h-[420px] sm:drop-shadow-[0_0_65px_rgba(0,245,255,0.45)]"
        />

        <h1
          className={`${russo.className} mx-auto mt-1 max-w-5xl text-center text-[clamp(0.95rem,4.8vw,4rem)] leading-[1.02] tracking-[-0.03em] text-white`}
          style={{
            textShadow:
              "0 0 14px rgba(0,245,255,0.16), 0 0 34px rgba(0,245,255,0.08)",
          }}
        >
          ONE MAN’S TRASH IS ANOTHER MAN’S MAX WIN
        </h1>

        <p className="mx-auto mt-2 max-w-2xl text-xs font-semibold leading-5 text-white/70 sm:mt-4 sm:text-lg sm:leading-8">
          Sign up on RouloBets under code{" "}
          <span className="font-black text-[#8fffd0]">trashguy</span>{" "}
          to earn monthly prizes, VIP rewards, and daily stream giveaways.
        </p>

        <a
          href="https://roulobets.com/?r=trashguy"
          target="_blank"
          rel="noreferrer"
          className="group relative mt-3 inline-flex min-h-[44px] min-w-[220px] items-center justify-center overflow-hidden rounded-xl border border-cyan-200/60 bg-[linear-gradient(180deg,rgba(0,255,255,0.34),rgba(0,120,255,0.24))] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_0_30px_rgba(0,255,255,0.28)] transition duration-300 hover:scale-[1.04] hover:border-cyan-100 hover:shadow-[0_0_70px_rgba(0,255,255,0.75)] sm:mt-6 sm:min-h-[66px] sm:min-w-[280px] sm:rounded-2xl sm:px-8 sm:py-4 sm:text-sm sm:tracking-[0.22em]"
        >
          <span className="absolute inset-0 translate-x-[-120%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)] transition-transform duration-700 group-hover:translate-x-[120%]" />
          <span className="relative z-10">Claim Rewards On Roulo</span>
        </a>
      </div>
    </section>

<div className="mx-auto mt-4 max-w-6xl px-4">
  <div className="grid gap-4 lg:grid-cols-2">

    <div className="rounded-[1.25rem] border border-cyan-300/20 bg-black/80 p-3 sm:p-5 shadow-[0_0_20px_rgba(0,245,255,0.06)]">
      <div className="text-center text-3xl sm:text-4xl">👑</div>

      <h3 className="mt-2 text-center text-xl font-black text-cyan-100 sm:mt-4 sm:text-3xl">
        VIP REWARDS
      </h3>

      <div className="mt-3 space-y-2 text-center text-sm text-white/80 sm:mt-6 sm:space-y-4 sm:text-lg">
        <div>⭐ $5k+ wagered on previous or current leaderboard</div>
        <div>⭐ Exclusive VIP giveaways</div>
        <div>⭐ Exclusive VIP tournaments</div>
        <div>⭐ Exclusive equity into community hunts</div>
      </div>
    </div>

    <div className="rounded-[1.25rem] border border-cyan-300/20 bg-black/80 p-3 sm:p-5 shadow-[0_0_20px_rgba(0,245,255,0.06)]">
      <div className="text-center text-3xl sm:text-4xl">🎁</div>

      <h3 className="mt-2 text-center text-xl font-black text-cyan-100 sm:mt-4 sm:text-3xl">
        DAILY STREAM GIVEAWAYS
      </h3>

      <div className="mt-3 space-y-3 text-center text-sm text-white/80 sm:mt-6 sm:space-y-4 sm:text-lg">

        <div>
          ⭐ VIP ($5k+ wagered on previous or current leaderboard)
          <div className="font-normal text-cyan-300">
            $80 - $100 bonus buys
          </div>
        </div>

        <div>
          ⭐ Affiliate (signed up under code trashguy)
          <div className="font-normal text-cyan-300">
            $40 - $50 bonus buys
          </div>
        </div>

        <div>
          ⭐ Not under code
          <div className="font-normal text-cyan-300">
            $20 - $30 bonus buys
          </div>
        </div>

      </div>
    </div>

  </div>
</div>

    <section className="relative py-1 sm:py-3">
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2 sm:max-w-5xl sm:grid-cols-4 sm:gap-4">
        {socials.map((social) => {
          const Icon = social.icon;

          return (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={social.name}
              className="group flex min-h-[72px] flex-col items-center justify-center rounded-xl border border-white/10 bg-black/50 p-2 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-400/10 sm:min-h-[110px] sm:rounded-2xl sm:p-4"
            >
              <Icon
                className={`text-2xl transition group-hover:scale-110 sm:text-4xl ${
                  social.name === "Discord"
                    ? "text-[#5865F2]"
                    : social.name === "YouTube"
                    ? "text-[#FF0000]"
                    : social.name === "Instagram"
                    ? "text-[#E1306C]"
                    : social.name === "Twitter / X"
                    ? "text-white"
                    : "text-cyan-200"
                }`}
              />

              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/55 sm:mt-2 sm:text-xs">
                {social.name}
              </div>
            </a>
          );
        })}
      </div>
    </section>

    <section className="relative py-2 sm:py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Live Stream</SectionLabel>
          <h2 className="mt-2 text-xl font-black sm:text-3xl">
            WATCH TRASHGUY LIVE
          </h2>
        </div>
      </div>

      <div className="mt-3 aspect-video overflow-hidden rounded-[1.25rem] border border-cyan-300/20 bg-black sm:rounded-[2rem]">
        {liveStatus.isLive ? (
          <iframe
            src="https://player.twitch.tv/?channel=trashguy__&parent=localhost&parent=127.0.0.1&parent=trashguy-site.vercel.app&parent=trashguy.me"
            height="100%"
            width="100%"
            allowFullScreen
          />
        ) : (
          <a
            href="https://www.twitch.tv/trashguy__"
            target="_blank"
            rel="noreferrer"
            className="relative flex h-full items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('/trashguy-casino.png')] bg-cover bg-center opacity-45" />
            <div className="absolute inset-0 bg-black/45" />

            <div className="relative z-10 text-center">
              <div className="text-3xl font-black text-white sm:text-5xl">
                OFFLINE
              </div>

              <div className="mt-2 text-sm text-white/50 sm:text-base">
                Tap to open Twitch
              </div>
            </div>
          </a>
        )}
      </div>
    </section>
  </section>
)}

{activeSection === "leaderboard" && (
  <section className="space-y-4 sm:space-y-6">
    <div className="mx-auto max-w-5xl text-center">
      <SectionLabel>Leaderboard</SectionLabel>

      <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_0_22px_rgba(0,245,255,0.18)] sm:mt-3 sm:text-[clamp(2.5rem,6vw,4rem)]">
        ${leaderboardTotal} LEADERBOARD
      </h2>

      <div className="mt-4 text-2xl font-black text-cyan-200 sm:text-4xl">
        Ends in: {leaderboardCountdown}
      </div>

      <div className="mx-auto mt-4 h-2 w-full max-w-5xl overflow-hidden rounded-full bg-white/10 sm:h-3">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#00f5ff,#19d3ff)] shadow-[0_0_20px_rgba(0,245,255,0.35)]"
          style={{ width: `${leaderboardProgress}%` }}
        />
      </div>
    </div>

    <div className="mx-auto max-w-5xl space-y-1.5 sm:space-y-2">
      <div className="grid grid-cols-[52px_1fr_100px] rounded-xl bg-black/55 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/55 sm:grid-cols-[80px_1fr_180px_140px] sm:px-5 sm:text-[11px]">
        <div>Rank</div>
        <div>Player</div>
        <div className="text-right">Wagered</div>
        <div className="hidden text-right sm:block">Prize</div>
      </div>

      {leaderboardLoading && leaderboardData.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-6 text-sm text-white/60">
          Loading leaderboard...
        </div>
      ) : (
        leaderboardData.map((player) => {
          const prize = leaderboardPrizes[player.rank] || 0;

          const rankIcons: Record<number, string> = {
            1: "🥇",
            2: "🥈",
            3: "🥉",
          };

const rowBg =
  player.rank === 1
    ? "border-yellow-300/35 bg-[linear-gradient(90deg,rgba(90,60,0,0.96),rgba(15,10,0,0.98))]"
    : player.rank === 2
    ? "border-zinc-200/30 bg-[linear-gradient(90deg,rgba(85,85,95,0.96),rgba(18,18,18,0.98))]"
    : player.rank === 3
    ? "border-amber-500/35 bg-[linear-gradient(90deg,rgba(95,45,10,0.96),rgba(20,10,0,0.98))]"
    : player.rank === 4
    ? "border-cyan-300/25 bg-[linear-gradient(90deg,rgba(0,140,255,0.22),rgba(0,0,0,0.97))]"
    : player.rank === 5
    ? "border-cyan-300/22 bg-[linear-gradient(90deg,rgba(0,180,255,0.18),rgba(0,0,0,0.97))]"
    : "border-white/8 bg-black/95";

const rankBox =
  player.rank === 1
    ? "text-yellow-300"
    : player.rank === 2
    ? "text-zinc-200"
    : player.rank === 3
    ? "text-amber-400"
    : player.rank === 4 || player.rank === 5
    ? "text-cyan-200"
    : "text-white/80";

          return (
            <div
              key={`${player.rank}-${player.username}`}
              className={`grid grid-cols-[52px_1fr_100px] items-center rounded-2xl border px-3 py-2.5 shadow-[0_0_18px_rgba(0,0,0,0.22)] transition hover:bg-white/[0.04] sm:grid-cols-[80px_1fr_180px_140px] sm:px-5 sm:py-3.5 ${rowBg}`}
            >
<div>
  <div
    className={`flex h-9 w-9 items-center justify-center text-base font-black sm:h-11 sm:w-11 sm:text-xl ${rankBox}`}
  >
    {rankIcons[player.rank] || player.rank}
  </div>
</div>

              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white sm:text-xl">
                  {player.username}
                </div>

                <div className="mt-0.5 text-[10px] font-black text-[#f5c451] sm:hidden">
                  {prize > 0 ? `$${prize.toLocaleString()}` : "-"}
                </div>
              </div>

              <div className="text-right text-[11px] font-black text-white/90 sm:text-lg">
                {formatMoney(player.wagered)}
              </div>

              <div className="hidden text-right text-lg font-black text-[#f5c451] sm:block">
                {prize > 0 ? `$${prize.toLocaleString()}` : "-"}
              </div>
            </div>
          );
        })
      )}
    </div>
  </section>
)}

{activeSection === "hunts" && (
  <section className="space-y-2 sm:space-y-8">
    <div className="text-center">
      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-300 sm:text-xs sm:tracking-[0.35em]">
        Bonus Hunts
      </div>

      <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_0_22px_rgba(0,245,255,0.18)] sm:mt-3 sm:text-[clamp(2.5rem,6vw,4rem)]">
        PREDICTIONS
      </h2>
    </div>

    <div className="flex gap-2 overflow-x-auto pb-2 sm:gap-4 sm:pb-4">
      {huntsData.map((hunt) => (
        <button
          key={hunt.id}
          onClick={() => {
            setAdminHuntId(hunt.id);
            setPredictionStatus(
              hunt.prediction_status === "open" ? "open" : "locked"
            );
          }}
          className={`flex min-w-[118px] flex-col items-center justify-center rounded-lg border bg-black/70 p-2 text-center backdrop-blur-md transition hover:-translate-y-1 sm:min-w-[190px] sm:rounded-2xl sm:p-4 ${
            currentPredictionHunt?.id === hunt.id || adminHuntId === hunt.id
              ? "border-cyan-300/45 shadow-[0_0_20px_rgba(0,245,255,0.12)]"
              : "border-white/10 hover:border-cyan-300/25"
          }`}
        >
          <div className="max-w-full truncate text-[11px] font-black text-white sm:text-sm">
            {hunt.title || "Bonus Hunt"}
          </div>

          <div className="mt-1 grid gap-0.5 text-[9px] font-semibold text-white/60 sm:mt-3 sm:text-xs">
            <div>Start: {formatMoney(hunt.startCost)}</div>
            <div>Won: {formatMoney(hunt.totalWinnings)}</div>
            <div
              className={
                hunt.profitLoss >= 0 ? "text-cyan-300" : "text-red-300"
              }
            >
              P/L: {hunt.profitLoss >= 0 ? "+" : ""}
              {formatMoney(hunt.profitLoss)}
            </div>
          </div>
        </button>
      ))}
    </div>

    <div className="overflow-hidden rounded-xl border border-cyan-300/15 bg-black/85 backdrop-blur-sm shadow-[0_0_24px_rgba(0,245,255,0.08)] sm:rounded-[2rem]">
      <div className="grid lg:grid-cols-[1fr_1.05fr]">
        <div className="border-b border-white/10 p-2.5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2 text-sm font-black text-white sm:text-xl">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(0,245,255,0.9)] sm:h-2.5 sm:w-2.5" />
                <span className="truncate">
                  {currentPredictionHunt?.title || "Latest Hunt"}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-white/45 sm:text-sm">
                {currentPredictionHunt?.casino || "RouloBets"}
              </div>
            </div>

            <div
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.2em] ${
                predictionStatus === "open"
                  ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
                  : "border-red-300/25 bg-red-400/10 text-red-200"
              }`}
            >
              {predictionStatus === "open" ? "Open" : "Closed"}
            </div>
          </div>

          <div className="mt-3 space-y-2 sm:mt-8 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="rounded-xl border border-white/10 bg-black/30 p-2.5 sm:rounded-[1.7rem] sm:p-6">
                <div className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35 sm:text-[11px] sm:tracking-[0.22em]">
                  Start
                </div>

                <div className="mt-1 text-xl font-black tracking-tight text-white sm:mt-3 sm:text-5xl">
                  {formatMoney(currentPredictionHunt?.startCost || 0)}
                </div>
              </div>

              <div className="rounded-xl border border-cyan-400/20 bg-[rgba(0,245,255,0.06)] p-2.5 sm:rounded-[1.7rem] sm:p-6">
                <div className="text-[8px] font-black uppercase tracking-[0.14em] text-cyan-100/45 sm:text-[11px] sm:tracking-[0.22em]">
                  Won
                </div>

                <div className="mt-1 text-xl font-black tracking-tight text-cyan-200 sm:mt-3 sm:text-5xl">
                  {formatMoney(
                    currentPredictionHunt?.stats?.totalWinnings ||
                      currentPredictionHunt?.totalWinnings ||
                      0
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
              <div className="rounded-lg border border-white/10 bg-black/30 p-2 sm:rounded-[1.5rem] sm:p-5">
                <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35 sm:text-[11px] sm:tracking-[0.22em]">
                  Bonuses
                </div>

                <div className="mt-1 text-lg font-black text-white sm:mt-3 sm:text-3xl">
                  {currentPredictionHunt?.bonuses?.length || 0}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-2 sm:rounded-[1.5rem] sm:p-5">
                <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35 sm:text-[11px] sm:tracking-[0.22em]">
                  Avg X
                </div>

                <div className="mt-1 text-base font-black text-white sm:mt-3 sm:text-3xl">
                  {currentPredictionHunt?.stats?.currentAverageMultiplier
                    ? `${Number(
                        currentPredictionHunt.stats.currentAverageMultiplier
                      ).toFixed(2)}x`
                    : `${currentPredictionAvgX}x`}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-2 sm:rounded-[1.5rem] sm:p-5">
                <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35 sm:text-[11px] sm:tracking-[0.22em]">
                  Req X
                </div>

                <div className="mt-1 text-base font-black text-white sm:mt-3 sm:text-3xl">
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

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="rounded-xl border border-white/10 bg-black/30 p-2.5 sm:rounded-[1.8rem] sm:p-6">
                <div className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35 sm:text-[11px] sm:tracking-[0.24em]">
                  Highest Win
                </div>

                <div className="mt-2 sm:mt-4">
                  <div className="truncate text-sm font-black leading-tight text-white sm:text-2xl">
                    {currentPredictionHunt?.bonuses?.length
                      ? [...currentPredictionHunt.bonuses].sort(
                          (a: any, b: any) =>
                            Number(b.payout || 0) - Number(a.payout || 0)
                        )[0]?.slotName || "---"
                      : "---"}
                  </div>

                  <div className="mt-1 text-lg font-black text-cyan-300 sm:mt-3 sm:text-3xl">
                    {formatMoney(
                      currentPredictionHunt?.bonuses?.length
                        ? [...currentPredictionHunt.bonuses].sort(
                            (a: any, b: any) =>
                              Number(b.payout || 0) - Number(a.payout || 0)
                          )[0]?.payout || 0
                        : 0
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-2.5 sm:rounded-[1.8rem] sm:p-6">
                <div className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35 sm:text-[11px] sm:tracking-[0.24em]">
                  Highest X
                </div>

                <div className="mt-2 sm:mt-4">
                  <div className="truncate text-sm font-black leading-tight text-white sm:text-2xl">
                    {currentPredictionHunt?.bonuses?.length
                      ? [...currentPredictionHunt.bonuses].sort(
                          (a: any, b: any) =>
                            Number(b.multiplier || 0) -
                            Number(a.multiplier || 0)
                        )[0]?.slotName || "---"
                      : "---"}
                  </div>

                  <div className="mt-1 text-lg font-black text-cyan-300 sm:mt-3 sm:text-3xl">
                    {currentPredictionHunt?.bonuses?.length
                      ? `${Number(
                          [...currentPredictionHunt.bonuses].sort(
                            (a: any, b: any) =>
                              Number(b.multiplier || 0) -
                              Number(a.multiplier || 0)
                          )[0]?.multiplier || 0
                        ).toFixed(2)}x`
                      : "---"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="p-2.5 sm:p-6">
          <div className="text-center">
            <div className="text-sm font-black text-white sm:text-lg">
              Guess the end balance
            </div>
            <div className="mt-0.5 text-[10px] text-white/45 sm:mt-2 sm:text-xs">
              Closest predictions win. One entry per person.
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:mt-4 sm:gap-2">
              <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[9px] font-black text-cyan-100 sm:px-4 sm:py-2 sm:text-xs">
                1st Closest $20
              </div>
              <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[9px] font-black text-cyan-100 sm:px-4 sm:py-2 sm:text-xs">
                2nd $0
              </div>
            </div>
          </div>

<div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-2.5 sm:mt-6 sm:rounded-2xl sm:p-5">
  {isAdmin && (
    <div className="mt-2 rounded-xl border border-cyan-300/15 bg-black/40 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ActionButton
          onClick={handleStartHunt}
          variant="dark"
        >
          Start
        </ActionButton>

        <ActionButton
          onClick={handleOpenPredictions}
          variant="green"
        >
          Open
        </ActionButton>

        <ActionButton
          onClick={handleLockPredictions}
          variant="purple"
        >
          Close
        </ActionButton>

        <ActionButton
          onClick={handleCompleteHunt}
          variant="gold"
        >
          Done
        </ActionButton>
      </div>

      <div className="mt-3 text-center text-xs text-white/60">
        {adminMessage}
      </div>
    </div>
  )}
  
            <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
              {rankedWinners.length === 0 ? (
                <div className="col-span-full py-4 text-center text-xs text-white/45 sm:py-8 sm:text-sm">
                  Winners will appear when the hunt is completed.
                </div>
              ) : (
                rankedWinners.slice(0, 3).map((winner, index) => (
                  <div
                    key={winner.id}
                    className="rounded-lg border border-white/10 bg-black/35 p-2.5 text-center sm:rounded-xl sm:p-4"
                  >
                    <div className="text-[9px] font-black uppercase text-yellow-300 sm:text-xs">
                      {index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"}
                    </div>
                    <div className="mt-1 text-sm font-black text-white">
                      {winner.username}
                    </div>
                    <div className="mt-1 text-base font-black text-cyan-200 sm:text-xl">
                      {formatMoney(winner.guess)}
                    </div>
                    <div className="mt-1 text-[10px] text-white/45 sm:text-xs">
                      Off by {formatMoney(winner.distance)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

<div className="mt-3 sm:mt-6">
  {!isTwitchConnected ? (
    <button
      onClick={handleTwitchLogin}
      className="mx-auto flex rounded-lg border border-[#9146FF]/40 bg-[#9146FF]/25 px-4 py-2 text-xs font-black text-white transition hover:bg-[#9146FF]/35 sm:rounded-xl sm:px-6 sm:py-3 sm:text-sm"
    >
      Sign in with Twitch
    </button>
  ) : (
    <div className="mx-auto max-w-md">
      <input
        value={predictionInput}
        onChange={(e) =>
          setPredictionInput(e.target.value.replace(/[^0-9]/g, ""))
        }
        placeholder="Enter your end balance prediction"
        disabled={predictionStatus !== "open"}
        className="w-full rounded-lg border border-white/10 bg-black/55 px-3 py-2.5 text-center text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:opacity-40 sm:rounded-xl sm:px-5 sm:py-4 sm:text-base"
      />

      <button
        onClick={handlePredictionSubmit}
        disabled={predictionStatus !== "open"}
        className="mt-2 w-full rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-40 sm:mt-3 sm:rounded-xl sm:px-5 sm:py-4 sm:text-sm sm:tracking-[0.18em]"
      >
        Save Prediction
      </button>

      {predictionMessage && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-center text-xs text-white/70 sm:mt-3 sm:rounded-xl sm:p-3 sm:text-sm">
          {predictionMessage}
        </div>
      )}
    </div>
  )}
</div>
</div>
</div>

<div className="border-t border-white/10 p-2.5 sm:p-6">
  <div className="mb-3 flex items-center justify-between">
    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45 sm:text-xs">
      Live Guesses
    </div>

    <div className="text-xs font-black text-cyan-200">
      {currentPredictionCount} Entries
    </div>
  </div>

  <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-black/50">
    {sortedPredictionsForTab.length === 0 ? (
      <div className="p-6 text-center text-sm text-white/40">
        No guesses yet.
      </div>
    ) : (
      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...sortedPredictionsForTab]
          .sort((a, b) => Number(b.guess || 0) - Number(a.guess || 0))
          .map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/70 px-3 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white">
                  #{index + 1} {entry.username}
                </div>

                <div className="text-[10px] text-white/35">
                  {formatTimeAgo(entry.createdAt)}
                </div>
              </div>

              <div className="text-base font-black text-cyan-200">
                {formatMoney(entry.guess)}
              </div>
            </div>
          ))}
      </div>
    )}
  </div>
</div>

{/* BONUS LIST */}
      <div className="border-t border-white/10 p-2.5 sm:p-6">
        <div className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/45 sm:mb-4 sm:text-xs sm:tracking-[0.25em]">
          Slots in this hunt
        </div>

        <div className="max-h-[360px] overflow-y-auto rounded-xl border border-white/10 bg-black/35 sm:max-h-[520px] sm:rounded-2xl">
          {!currentPredictionHunt?.bonuses?.length ? (
            <div className="flex h-[90px] items-center justify-center text-xs text-white/40 sm:h-[160px] sm:text-sm">
              No bonuses in this hunt yet.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {currentPredictionHunt.bonuses.map((bonus: any, index: number) => (
                <div
                  key={bonus.id || index}
                  className="grid grid-cols-[1fr_auto] gap-2 px-2.5 py-2 text-xs sm:grid-cols-[90px_1fr_90px_110px_110px] sm:items-center sm:gap-4 sm:px-5 sm:py-4 sm:text-sm"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-cyan-200 sm:text-white/70">
                      Bonus #{index + 1}
                    </div>

                    <div className="mt-0.5 break-words text-xs font-black text-white sm:hidden">
                      {bonus.slotName}
                    </div>
                  </div>

                  <div className="hidden min-w-0 truncate font-black text-white sm:block">
                    {bonus.slotName}
                  </div>

                  <div className="text-right">
                    <div className="text-[8px] uppercase tracking-[0.12em] text-white/35 sm:text-[10px] sm:tracking-[0.16em]">
                      Bet
                    </div>
                    <div className="text-xs font-black text-white sm:text-base">
                      {formatMoney(Number(bonus.betSize || 0))}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[8px] uppercase tracking-[0.12em] text-white/35 sm:text-[10px] sm:tracking-[0.16em]">
                      X
                    </div>
                    <div className="text-xs font-black text-white sm:text-base">
                      {Number(bonus.multiplier || 0).toFixed(2)}x
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[8px] uppercase tracking-[0.12em] text-white/35 sm:text-[10px] sm:tracking-[0.16em]">
                      Payout
                    </div>
                    <div className="text-xs font-black text-cyan-300 sm:text-base">
                      {formatMoney(Number(bonus.payout || 0))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </section>
)}

{activeSection === "giveaways" && (
  <section className="space-y-4 sm:space-y-6">
    <div className="mx-auto max-w-5xl text-center">
      <SectionLabel>Giveaways</SectionLabel>

      <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_0_22px_rgba(0,245,255,0.18)] sm:mt-3 sm:text-[clamp(2.5rem,6vw,4rem)]">
        TOTAL GIVEN AWAY
      </h2>

      <div className="mt-2 text-[clamp(1.5rem,4vw,3rem)] font-black text-cyan-200">
        ${giveawayTotal.toLocaleString()}
      </div>
    </div>

    {biggestGiveaway && (
      <div className="mx-auto max-w-3xl rounded-2xl border border-yellow-400/35 bg-[linear-gradient(90deg,rgba(90,60,0,0.96),rgba(0,0,0,0.97))] p-4 shadow-[0_0_22px_rgba(250,204,21,0.08)] sm:rounded-[1.5rem] sm:p-5">
        <div className="text-[9px] uppercase tracking-[0.22em] text-yellow-300/75 sm:text-xs sm:tracking-[0.3em]">
          Biggest Giveaway
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-black text-white sm:text-2xl">
              🏆 {biggestGiveaway.winner_name}
            </div>

            {biggestGiveaway.note && (
              <div className="mt-1 truncate text-[10px] text-white/45 sm:text-sm">
                {biggestGiveaway.note}
              </div>
            )}
          </div>

          <div className="shrink-0 text-lg font-black text-[#f5c451] sm:text-2xl">
            ${Number(biggestGiveaway.amount || 0).toLocaleString()}
          </div>
        </div>
      </div>
    )}

    {viewerName.toLowerCase() !== "trashguy__" &&
      viewerName.toLowerCase() !== "trashguy" && (
        <div className="mx-auto max-w-5xl rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] sm:rounded-[1.5rem] sm:p-6">
          <div className="text-center">
<SectionLabel>Prize Portal</SectionLabel>

<h2 className="mt-2 text-2xl font-black leading-[1] tracking-tight text-white sm:mt-4 sm:text-[clamp(2rem,5vw,3.5rem)]">
  MY REWARDS
</h2>
</div>

{isTwitchConnected && (
  <div className="mt-4 rounded-xl border border-cyan-300/20 bg-black/70 p-3 text-left sm:mt-6 sm:rounded-[1.5rem] sm:p-5">
    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80 sm:text-xs sm:tracking-[0.24em]">
      Account Links
    </div>

    <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto] sm:mt-3 sm:gap-3">
      <input
        value={rouloUsernameInput}
        onChange={(e) => setRouloUsernameInput(e.target.value)}
        placeholder="Enter your Roulo username"
        className="w-full rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-sm text-white outline-none sm:rounded-xl sm:px-4 sm:py-3 sm:text-base"
      />

      <button
        onClick={handleLinkRoulo}
        className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-400/20 sm:rounded-xl sm:px-5 sm:py-3 sm:text-base"
      >
        Link Roulo
      </button>
    </div>

    {rouloLink && (
      <>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-5 sm:gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2 sm:rounded-xl sm:p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/35 sm:text-xs">
              Twitch
            </div>
            <div className="mt-1 text-sm font-black text-green-300 sm:text-xl">
              ✅ Linked
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-2 sm:rounded-xl sm:p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/35 sm:text-xs">
              Roulo
            </div>
            <div className="mt-1 text-sm font-black text-green-300 sm:text-xl">
              ✅ Linked
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-2 sm:rounded-xl sm:p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/35 sm:text-xs">
              Discord
            </div>
            <div className="mt-1 text-sm font-black text-indigo-300 sm:text-xl">
              {(rouloLink as any)?.is_in_discord ? "✅ Linked" : "❌ Not Linked"}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-2 sm:rounded-xl sm:p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/35 sm:text-xs">
              Role
            </div>
            <div className="mt-1 truncate text-sm font-black uppercase text-cyan-200 sm:text-xl">
              {rouloLink.role}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-2 sm:rounded-xl sm:p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/35 sm:text-xs">
              Odds
            </div>
            <div className="mt-1 text-sm font-black text-[#f5c451] sm:text-xl">
              {Number(rouloLink.weight || 1).toFixed(1)}x
            </div>
          </div>
        </div>

        {!(rouloLink as any)?.is_in_discord && (
          <button
            onClick={() =>
              (window.location.href = `/api/discord/login?viewer=${viewerName}`)
            }
            className="mt-3 w-full rounded-xl border border-indigo-300/20 bg-indigo-400/10 px-4 py-3 text-sm font-black text-indigo-200 hover:bg-indigo-400/20"
          >
            💬 Link Discord (+0.1 Odds)
          </button>
        )}
      </>
    )}

    {rouloLinkMessage && (
      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/70 sm:mt-4 sm:rounded-xl sm:p-3 sm:text-sm">
        {rouloLinkMessage}
      </div>
    )}
  </div>
)}

{!isTwitchConnected ? (
  <div className="mt-4 text-center sm:mt-6">
    <button
      onClick={handleTwitchLogin}
      className="rounded-xl border border-[#9146FF]/40 bg-[#9146FF]/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-[#9146FF]/30 sm:rounded-2xl sm:px-6 sm:py-4 sm:text-base"
    >
      Connect Twitch to View Rewards
    </button>
  </div>
) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-4">
                <div className="rounded-xl border border-yellow-300/20 bg-yellow-400/10 p-3 sm:rounded-2xl sm:p-5">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-yellow-200/70 sm:text-xs sm:tracking-[0.22em]">
                    Pending
                  </div>
                  <div className="mt-1 text-xl font-black text-yellow-200 sm:mt-2 sm:text-3xl">
                    ${viewerRewardsPending.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3 sm:rounded-2xl sm:p-5">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-200/70 sm:text-xs sm:tracking-[0.22em]">
                    Paid
                  </div>
                  <div className="mt-1 text-xl font-black text-cyan-200 sm:mt-2 sm:text-3xl">
                    ${viewerRewardsPaid.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/60 sm:mt-6 sm:rounded-[1.5rem]">
                {viewerRewards.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-white/45 sm:px-6 sm:py-10">
                    {viewerRewardsMessage || "No rewards yet."}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {viewerRewards.map((reward) => (
                      <div
                        key={reward.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-4"
                      >
                        <div className="min-w-0 text-left">
                          <div className="truncate text-sm font-black text-white sm:text-base">
                            {reward.title || "Chat Giveaway"}
                          </div>
                          <div className="mt-0.5 text-[10px] text-white/35 sm:mt-1 sm:text-xs">
                            {reward.created_at
                              ? new Date(reward.created_at).toLocaleString()
                              : "Recently"}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-base font-black text-cyan-200 sm:text-xl">
                            ${Number(reward.amount || 0).toLocaleString()}
                          </div>
                          <div
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black sm:px-3 sm:py-1 sm:text-xs ${
                              reward.status === "complete"
                                ? "border border-cyan-300/20 bg-cyan-400/10 text-cyan-200"
                                : "border border-yellow-300/20 bg-yellow-400/10 text-yellow-200"
                            }`}
                          >
                            {reward.status === "complete" ? "Done" : "Pending"}
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
      )}

    <div className="mx-auto max-w-5xl rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] sm:rounded-[1.5rem] sm:p-6">
      {giveawayLoading ? (
        <div className="px-4 py-6 text-sm text-white/60 sm:px-6 sm:py-10">
          Loading giveaways...
        </div>
      ) : giveaways.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-white/45 sm:px-6 sm:py-10">
          No giveaways logged yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/60 sm:rounded-[1.5rem]">
          <div
            className={`grid ${
              isAdmin
                ? "grid-cols-[30px_minmax(0,1fr)_56px_50px]"
                : "grid-cols-[30px_minmax(0,1fr)_56px]"
            } border-b border-white/5 px-2.5 py-2 text-[8px] font-bold uppercase tracking-[0.12em] text-white/35 sm:grid-cols-[52px_minmax(0,1fr)_90px_74px] sm:px-5 sm:py-4 sm:text-xs sm:tracking-[0.22em]`}
          >
            <div>#</div>
            <div>Winner</div>
            <div className="text-center">Amount</div>
            <div className="text-right">{isAdmin ? "Edit" : ""}</div>
          </div>

          <div className="max-h-[420px] overflow-y-auto sm:max-h-[520px]">
            {giveaways.map((giveaway, index) => (
              <div
                key={giveaway.id}
                className={`grid ${
                  isAdmin
                    ? "grid-cols-[30px_minmax(0,1fr)_56px_50px]"
                    : "grid-cols-[30px_minmax(0,1fr)_56px]"
                } items-center border-b border-white/5 px-2.5 py-2.5 last:border-b-0 sm:grid-cols-[52px_minmax(0,1fr)_90px_74px] sm:px-5 sm:py-4`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-[9px] font-black text-cyan-200 sm:h-9 sm:w-9 sm:text-xs">
                  {index + 1}
                </div>

                <div className="min-w-0 overflow-hidden">
                  <div className="truncate text-xs font-semibold text-white sm:text-base">
                    {giveaway.winner_name}
                  </div>

                  {giveaway.note && (
                    <div className="mt-0.5 truncate text-[9px] text-white/35 sm:mt-1 sm:text-xs">
                      {giveaway.note}
                    </div>
                  )}
                </div>

                <div className="text-center text-xs font-black text-cyan-200 sm:text-lg">
                  ${Number(giveaway.amount || 0).toLocaleString()}
                </div>

                {isAdmin ? (
                  <div className="flex justify-end gap-1 sm:gap-2">
                    <button
                      onClick={async () => {
                        const newName = prompt("Edit name:", giveaway.winner_name);
                        const newAmount = prompt("Edit winnings:", String(giveaway.amount));
                        const newNote = prompt("Edit note:", giveaway.note || "");

                        if (!newName || !newAmount) return;

                        await fetch(`/api/giveaways?id=${giveaway.id}&key=trashguy92`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            winner_name: newName,
                            amount: Number(newAmount),
                            note: newNote,
                          }),
                        });

                        window.location.reload();
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-yellow-400/30 bg-yellow-400/10 text-[10px] text-yellow-300 transition hover:bg-yellow-400/20 sm:h-8 sm:w-8 sm:rounded-lg sm:text-xs"
                    >
                      ✎
                    </button>

                    <button
                      onClick={async () => {
                        await fetch(`/api/giveaways?id=${giveaway.id}&key=trashguy92`, {
                          method: "DELETE",
                        });
                        window.location.reload();
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-red-400/30 bg-red-400/10 text-[10px] text-red-300 transition hover:bg-red-400/20 sm:h-8 sm:w-8 sm:rounded-lg sm:text-xs"
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
      )}
    </div>
  </section>
)}

{activeSection === "monthlyRewards" && (
  <section className="space-y-4 sm:space-y-6">
    <div className="mx-auto max-w-7xl text-center">
      <SectionLabel>Monthly Rewards</SectionLabel>

      <h2 className="mt-2 text-[clamp(1.5rem,8vw,4rem)] font-black text-white">
        REWARD CALENDAR
      </h2>

      <p className="mx-auto mt-3 max-w-2xl text-xs text-white/55 sm:text-base">
        See what rewards, giveaways, and prize events are happening each day.
      </p>
    </div>

    <div className="mx-auto max-w-7xl">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() =>
            setCalendarDate(
              new Date(
                calendarDate.getFullYear(),
                calendarDate.getMonth() - 1,
                1
              )
            )
          }
          className="rounded-xl border border-white/10 bg-black/85 px-3 py-2 text-xs font-black text-white transition hover:border-cyan-300/35 hover:text-cyan-200 sm:px-5 sm:text-sm"
        >
          ← Prev
        </button>

        <div className="text-center text-lg font-black text-white sm:text-3xl">
          {calendarDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </div>

        <button
          onClick={() =>
            setCalendarDate(
              new Date(
                calendarDate.getFullYear(),
                calendarDate.getMonth() + 1,
                1
              )
            )
          }
          className="rounded-xl border border-white/10 bg-black/85 px-3 py-2 text-xs font-black text-white transition hover:border-cyan-300/35 hover:text-cyan-200 sm:px-5 sm:text-sm"
        >
          Next →
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center sm:mt-8 sm:gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="rounded-lg border border-cyan-300/15 bg-black/85 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-cyan-200 sm:text-xs"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2 lg:grid-cols-7 lg:gap-3">
        {monthlyRewardDays.map((rawItem: any) => {
          const item = rawItem as any;

          if (item.blank) {
            return (
              <div
                key={item.key}
                className="hidden min-h-[120px] rounded-xl border border-white/5 bg-black/40 sm:block sm:min-h-[180px]"
              />
            );
          }

          return (
            <div
              key={item.dateKey}
              className="flex min-h-[185px] flex-col rounded-xl border border-cyan-300/15 bg-black/85 p-2 text-left shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm sm:min-h-[210px] sm:p-3"
            >
              <div className="mb-2 flex justify-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/15 text-[11px] font-black text-cyan-100 shadow-[0_0_14px_rgba(0,245,255,0.16)] sm:h-9 sm:w-9 sm:text-sm">
                  {item.day}
                </div>
              </div>

              {isAdmin && adminAllowed ? (
                <div className="flex flex-1 flex-col gap-1.5">
                  <textarea
                    value={item.reward?.title || ""}
                    onChange={(e) =>
                      updateMonthlyReward(item.dateKey, "title", e.target.value)
                    }
                    placeholder="Event title"
                    rows={2}
                    className="min-h-[42px] w-full resize-none rounded-md border border-white/10 bg-black/80 px-2 py-1.5 text-[9px] font-semibold leading-4 text-white outline-none focus:border-cyan-300/35 sm:min-h-[54px] sm:text-xs"
                  />

                  <textarea
                    value={item.reward?.note || ""}
                    onChange={(e) =>
                      updateMonthlyReward(item.dateKey, "note", e.target.value)
                    }
                    placeholder=""
                    rows={4}
                    className="min-h-[58px] w-full flex-1 resize-none rounded-md border border-white/10 bg-black/80 px-2 py-1.5 text-[8px] leading-4 text-white outline-none focus:border-cyan-300/35 sm:min-h-[80px] sm:text-xs"
                  />

                  <div className="mt-auto rounded-md border border-yellow-300/20 bg-yellow-400/10 px-2 py-1.5 text-center text-[7px] font-black uppercase leading-3 tracking-[0.08em] text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.08)] sm:text-[8px]">
                    Daily Giveaways For All Twitch Viewers
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  <div className="flex flex-1 flex-col justify-center">
                    {item.reward?.title || item.reward?.note ? (
                      <div>
                        <div className="break-words text-[10px] font-black leading-4 text-white sm:text-sm">
                          {item.reward?.title || "Reward Day"}
                        </div>

                        {item.reward?.note && (
                          <div className="mt-2 whitespace-pre-line break-words text-[8px] leading-4 text-white/70 sm:text-xs">
                            {item.reward.note}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-[8px] text-white/25 sm:text-[10px]">
                        No event
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-md border border-yellow-300/20 bg-yellow-400/10 px-2 py-1.5 text-center text-[7px] font-black uppercase leading-3 tracking-[0.08em] text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.08)] sm:text-[8px]">
                    Daily Giveaways For All Twitch Viewers
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </section>
)}

{activeSection === "tournaments" && (
  <section className="space-y-4 sm:space-y-5">
    <div className="mx-auto max-w-7xl text-center">
      <SectionLabel>Tournaments</SectionLabel>

      <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_0_22px_rgba(0,245,255,0.18)] sm:mt-3 sm:text-[clamp(2.5rem,6vw,4rem)]">
        {tournamentView === "bracket"
          ? bracket.title || "Tournament Bracket"
          : "Snake Draft"}
      </h2>

      <div className="mt-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1.5 text-xs font-black text-cyan-100">
        {tournamentView === "bracket" ? "Live Bracket" : "Team Slot Draft"}
      </div>

      <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-2">
        <button
          onClick={() => setTournamentView("bracket")}
          className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition ${
            tournamentView === "bracket"
              ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-100"
              : "border-white/10 bg-black/70 text-white/45 hover:text-white"
          }`}
        >
          Bracket
        </button>

        <button
          onClick={() => setTournamentView("snake")}
          className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition ${
            tournamentView === "snake"
              ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-100"
              : "border-white/10 bg-black/70 text-white/45 hover:text-white"
          }`}
        >
          Snake Draft
        </button>
      </div>
    </div>

    {tournamentView === "bracket" && (
      <>
        {bracketLoading ? (
          <div className="text-center text-sm text-white/55">
            Loading bracket...
          </div>
        ) : (
          <div className="mx-auto max-w-7xl rounded-2xl border border-cyan-300/15 bg-black/85 p-3 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm sm:rounded-[1.5rem] sm:p-4">
            <div
              className="cursor-grab overflow-x-auto active:cursor-grabbing"
              onMouseDown={(e) => {
                const slider = e.currentTarget;
                const startX = e.pageX - slider.offsetLeft;
                const scrollLeft = slider.scrollLeft;

                const onMouseMove = (moveEvent: MouseEvent) => {
                  const x = moveEvent.pageX - slider.offsetLeft;
                  const walk = (x - startX) * 1.4;
                  slider.scrollLeft = scrollLeft - walk;
                };

                const onMouseUp = () => {
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
              }}
            >
              <div className="flex min-w-[760px] items-start gap-4 pb-2 sm:min-w-[1050px] sm:gap-5">
                {bracket.rounds.map((round, roundIndex) => {
                  const topPadding =
                    roundIndex === 0
                      ? "pt-0"
                      : roundIndex === 1
                      ? "pt-8"
                      : roundIndex === 2
                      ? "pt-16"
                      : "pt-24";

                  return (
                    <div
                      key={round.id}
                      className={`w-[220px] shrink-0 sm:w-[300px] ${topPadding}`}
                    >
                      <div className="mb-3 text-center">
                        <div className="inline-flex max-w-full rounded-full border border-cyan-300/15 bg-black/85 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200 sm:text-[10px]">
                          <span className="truncate">{round.name}</span>
                        </div>
                      </div>

                      <div
                        className={`space-y-3 ${
                          roundIndex === 0
                            ? ""
                            : roundIndex === 1
                            ? "pt-4"
                            : roundIndex === 2
                            ? "pt-10"
                            : "pt-16"
                        }`}
                      >
                        {round.matches.map((match) => {
                          const isWinner1 =
                            match.winner && match.winner === match.player1;
                          const isWinner2 =
                            match.winner && match.winner === match.player2;

                          return (
                            <div
                              key={match.id}
                              className="rounded-2xl border border-white/10 bg-black/90 p-3 shadow-[0_0_20px_rgba(0,0,0,0.35)] sm:p-4"
                            >
                              <div
                                className={`rounded-xl border px-3 py-3 text-sm font-black sm:text-base ${
                                  isWinner1
                                    ? "border-cyan-300/35 bg-cyan-400/10 text-white"
                                    : "border-white/10 bg-white/[0.03] text-white/75"
                                }`}
                              >
                                <div className="truncate">
                                  {match.player1 || ""}
                                </div>

                                {match.player1Amount && (
                                  <div className="mt-1 text-xs font-black text-[#f5c451] sm:text-sm">
                                    ${match.player1Amount}
                                  </div>
                                )}
                              </div>

                              <div className="py-1 text-center text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
                                vs
                              </div>

                              <div
                                className={`rounded-xl border px-3 py-3 text-sm font-black sm:text-base ${
                                  isWinner2
                                    ? "border-cyan-300/35 bg-cyan-400/10 text-white"
                                    : "border-white/10 bg-white/[0.03] text-white/75"
                                }`}
                              >
                                <div className="truncate">
                                  {match.player2 || ""}
                                </div>

                                {match.player2Amount && (
                                  <div className="mt-1 text-xs font-black text-[#f5c451] sm:text-sm">
                                    ${match.player2Amount}
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 truncate text-center text-[8px] font-black uppercase tracking-[0.18em] text-white/35">
                                {match.winner
                                  ? `Winner: ${match.winner}`
                                  : "No winner"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Drag left or right to move bracket
            </div>
          </div>
        )}
      </>
    )}

    {tournamentView === "snake" && (
      <div className="mx-auto max-w-7xl rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm sm:rounded-[1.5rem] sm:p-6">
        <div className="text-center">
          <SectionLabel>Snake Draft</SectionLabel>

          <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">
            TEAM SLOT DRAFT
          </h2>

          <div className="mt-2 text-sm text-white/45">
            View-only board
          </div>
        </div>

        {snakeCaptains.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/70 p-8 text-center text-sm text-white/45">
            No snake draft has been created yet.
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {snakeCaptains.map((captain) => (
                <div
                  key={captain}
                  className={`rounded-2xl border p-4 ${getSnakeTeamStyle(
                    captain
                  )}`}
                >
                  <div className="text-lg font-black text-white">
                    {captain}
                  </div>

                  <div className="mt-1 text-sm font-black text-[#f5c451]">
                    Total: ${getSnakeTeamTotal(captain).toLocaleString()}
                  </div>

                  <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/40">
                    Players
                  </div>

                  <div className="mt-2 space-y-1">
                    {(snakeTeams[captain] || []).length === 0 ? (
                      <div className="text-sm text-white/35">
                        Waiting for picks...
                      </div>
                    ) : (
                      snakeTeams[captain].map((player, index) => (
                        <div
                          key={player}
                          className="text-sm font-semibold text-white/75"
                        >
                          {index + 1}. {player}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            {snakeSlotOrder.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
                  Slot Call Board
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {snakeSlotOrder.map((name, index) => {
                    const key = `${name}-${index}`;
                    const teamCaptain = getSnakeTeamForName(name);
                    const hit = snakeSlotHit[key];

                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3 transition ${getSnakeTeamStyle(
                          teamCaptain
                        )} ${
                          hit
                            ? "ring-2 ring-cyan-300 shadow-[0_0_24px_rgba(0,245,255,0.20)]"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-black text-cyan-300">
                            #{index + 1}
                          </div>

                          <div className="truncate text-sm font-black text-white">
                            {name}
                          </div>
                        </div>

                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                          Team {teamCaptain}
                        </div>

                        <div className="mt-3 min-h-[38px] rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-sm font-black text-white">
                          {snakeSlotCalls[key] || "Waiting..."}
                        </div>

                        <div className="mt-2 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-sm font-black text-[#f5c451]">
                          {snakeSlotAmounts[key]
                            ? `$${Number(
                                snakeSlotAmounts[key]
                              ).toLocaleString()}`
                            : "$0"}
                        </div>

                        <div
                          className={`mt-2 rounded-lg border px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em] ${
                            hit
                              ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-100"
                              : "border-white/10 bg-black/60 text-white/35"
                          }`}
                        >
                          {hit ? "Spun Into ✅" : "Not spun yet"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )}
  </section>
)}

{activeSection === "slotpicker" && (
  <section className="space-y-4 sm:space-y-6">
    <div className="mx-auto max-w-5xl text-center">
      <SectionLabel>Slot Picker</SectionLabel>

      <h2 className="mt-2 text-[clamp(1.5rem,7vw,4rem)] font-black leading-[1] tracking-tight text-white">
        RANDOM SLOT PICKER
      </h2>

      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
        Select providers, spin the picker, and let fate decide the next slot.
      </p>
    </div>

    <div className="mx-auto max-w-5xl rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm sm:rounded-[1.5rem] sm:p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40 sm:text-xs sm:tracking-[0.24em]">
        Providers
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {slotProviders.map((provider) => {
          const active = selectedProviders.includes(provider);
          const logo = providerLogos[provider];

          return (
            <button
              key={provider}
              onClick={() => toggleSlotProvider(provider)}
              className={`flex min-h-[72px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-200 sm:min-h-[82px] sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 ${
                active
                  ? "border-cyan-300/40 bg-cyan-400/12 text-white shadow-[0_0_20px_rgba(0,245,255,0.14)]"
                  : "border-white/10 bg-black/70 text-white/65 hover:border-white/20 hover:text-white"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/80 sm:h-11 sm:w-11 sm:rounded-xl">
                {logo ? (
                  <img
                    src={logo}
                    alt={provider}
                    className="h-6 w-6 object-contain sm:h-7 sm:w-7"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-[10px] font-black text-[#8fffd0] sm:text-xs">
                    {provider.charAt(0)}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate text-xs font-black sm:text-base">
                  {provider}
                </div>

                <div className="text-[10px] text-white/35 sm:text-xs">
                  {
                    slotData.filter(
                      (slot) => slot.provider === provider
                    ).length
                  }{" "}
                  slots
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 sm:mt-5 sm:gap-3">
        <div className="text-xs text-white/45 sm:text-sm">
          {selectedProviders.length === 0
            ? `🎲 All Providers Active (${slotData.length} slots)`
            : `${filteredSlots.length} slots from ${selectedProviders.length} provider(s)`}
        </div>

        <button
          onClick={() => {
            setSelectedProviders([]);
            setPickedSlot(null);
          }}
          className="rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55 transition hover:text-white sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.18em]"
        >
          Reset
        </button>
      </div>
    </div>

    <div className="mx-auto max-w-5xl rounded-2xl border border-cyan-300/15 bg-black/85 p-4 text-center shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm sm:rounded-[1.5rem] sm:p-8">
      <button
        onClick={pickRandomSlot}
        disabled={isPickingSlot || filteredSlots.length === 0}
        className="w-full rounded-xl border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(0,245,255,0.22),rgba(0,245,255,0.08))] px-4 py-3 text-xs font-black text-[#b8ffd8] shadow-[0_0_20px_rgba(0,245,255,0.10)] transition hover:border-cyan-300/45 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl sm:px-6 sm:py-4 sm:text-lg"
      >
        {isPickingSlot ? "Spinning..." : "Pick Random Slot"}
      </button>

      <div
        className={`mt-4 rounded-2xl border bg-black/90 p-4 transition-all duration-300 sm:mt-8 sm:p-8 ${
          isPickingSlot
            ? "scale-[1.02] border-cyan-300/40 shadow-[0_0_45px_rgba(0,245,255,0.22)] blur-[0.2px]"
            : "border-white/10 shadow-[0_0_28px_rgba(0,245,255,0.10)]"
        }`}
      >
        {!pickedSlot ? (
          <div className="py-8 text-sm text-white/45 sm:py-12 sm:text-base">
            No slot picked yet.
          </div>
        ) : (
          <>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35 sm:text-xs sm:tracking-[0.3em]">
              Selected Slot
            </div>

            {pickedSlot.image && (
              <img
                src={pickedSlot.image}
                alt={pickedSlot.name}
                className="mx-auto mb-3 mt-4 h-24 object-contain sm:mb-4 sm:mt-6 sm:h-32"
              />
            )}

            <div
              className={`mt-3 text-[clamp(1.2rem,6vw,4rem)] font-black transition-all duration-200 sm:mt-5 ${
                isPickingSlot
                  ? "scale-95 text-white/70 blur-[1px]"
                  : "scale-105 text-[#8fffd0] drop-shadow-[0_0_25px_rgba(0,245,255,0.65)]"
              }`}
            >
              {pickedSlot.name}
            </div>

            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-200 sm:mt-5 sm:gap-3 sm:px-5 sm:text-sm ${
                isPickingSlot
                  ? "scale-95 border-white/10 bg-white/5 text-white/40"
                  : "scale-105 border-cyan-300/20 bg-cyan-400/10 text-[#b8ffd8] shadow-[0_0_20px_rgba(0,245,255,0.35)]"
              }`}
            >
              {providerLogos[pickedSlot.provider] && (
                <img
                  src={providerLogos[pickedSlot.provider]}
                  alt={pickedSlot.provider}
                  className="h-5 w-5 object-contain sm:h-6 sm:w-6"
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
  </section>
)}

{activeSection === "admin" && adminAllowed && (
  <section className="mx-auto grid max-w-6xl gap-2 sm:gap-3">
    <div>
<div className="text-center">
  <SectionLabel>Admin</SectionLabel>

  <h2 className="mt-2 text-[clamp(1.8rem,7vw,4rem)] font-black leading-[1] tracking-tight text-white">
    CONTROL CENTER
  </h2>

  <p className="mx-auto mt-3 max-w-2xl text-sm text-white/55 sm:text-base">
    Admin panel is only shown for approved Twitch accounts.
  </p>
</div>

      <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm sm:mt-6 sm:rounded-[1.5rem] sm:p-5">
        <div className="grid gap-2 sm:gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div className="rounded-xl border border-white/10 bg-black/35 p-2.5 sm:p-4">
            <div className="text-[9px] uppercase tracking-[0.16em] text-white/45 sm:text-xs sm:tracking-[0.22em]">
              Signed in as
            </div>

            <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:gap-3">
              {viewerAvatar && (
                <img
                  src={viewerAvatar}
                  alt={viewerDisplayName}
                  className="h-9 w-9 rounded-full border border-cyan-300/25 object-cover sm:h-12 sm:w-12"
                />
              )}

              <div className="min-w-0">
                <div className="truncate text-base font-black text-white sm:text-xl">
                  {viewerDisplayName}
                </div>
                <div className="truncate text-xs text-white/45 sm:text-sm">
                  @{viewerName}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 p-2.5 sm:p-4">
            <div className="text-[9px] uppercase tracking-[0.16em] text-white/45 sm:text-xs sm:tracking-[0.22em]">
              Admin Name
            </div>

            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/35 sm:mt-3 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base"
            />
          </div>

          <ActionButton
            onClick={() => setIsAdmin((v) => !v)}
            variant={isAdmin ? "green" : "dark"}
            className="min-h-[40px] w-full px-3 py-2 text-[10px] sm:min-h-[86px] sm:text-sm lg:w-[260px]"
          >
            {isAdmin ? `Admin Enabled` : "Enable Admin"}
          </ActionButton>
        </div>

        <div className="mt-2 rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-[11px] font-semibold leading-5 text-cyan-100/75 sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          {isAdmin
            ? `${adminName} control center is active.`
            : "Enable admin mode to use the tools below."}
        </div>
{isAdmin && (
  <div className="mt-3 rounded-xl border border-yellow-300/20 bg-yellow-400/10 p-4">
    <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-200">
      Monthly VIPs
    </div>

<div className="mt-2 text-sm text-white/55">
  {adminMessage || "Saves everyone with $5,000+ wagered from the previous leaderboard as VIP for the next leaderboard."}
</div>

    <ActionButton
      onClick={handleGenerateVipSnapshot}
      variant="gold"
      className="mt-3 w-full"
    >
      Generate VIP Snapshot
    </ActionButton>
  </div>
)}
      </div>

      <div className="mt-3 grid gap-3 sm:mt-6 sm:gap-4">
        <details
          open={adminDropdowns.giveaway}
          onToggle={(e) => setAdminDropdown("giveaway", e.currentTarget.open)}
          className="rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm"
        >
          <summary className="cursor-pointer text-base font-black text-white sm:text-xl">
            Giveaway System
          </summary>

<div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4">
  <div className="grid grid-cols-2 gap-2 sm:gap-3">
    <ActionButton
      onClick={handleStartGiveaway}
      disabled={!isAdmin}
      variant="green"
    >
      Start Giveaway
    </ActionButton>

    <ActionButton
      onClick={handleDrawGiveawayWinner}
      disabled={!isAdmin}
      variant="purple"
    >
      Draw Winner
    </ActionButton>
  </div>

  <div className="rounded-xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(0,245,255,0.10),rgba(0,0,0,0.92))] p-3 sm:rounded-2xl sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 sm:text-xs sm:tracking-[0.25em]">
          🎯 Current Winner
        </div>

        <div className="mt-2 text-xl font-black text-cyan-200 drop-shadow-[0_0_18px_rgba(0,245,255,0.75)] sm:text-3xl">
          {giveawayMessage || "Waiting..."}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">

{currentGiveawayWinner && (() => {
  const winnerEntry = giveawayEntries.find(
    (entry) =>
      String(entry.username || entry.display_name || "")
        .toLowerCase()
        .replace("@", "") === currentGiveawayWinner.toLowerCase()
  );

  const weight = Number(winnerEntry?.weight || 1);
  const role = String(winnerEntry?.role || "viewer").toLowerCase();
  const isVip = role === "vip";
  const isOnCode = !!winnerEntry?.roulo_username || !!winnerEntry?.is_roulo_affiliate;
  const isDiscord = !!winnerEntry?.is_in_discord || !!winnerEntry?.discord_username;

  return (
    <div className="flex flex-wrap gap-1.5">
      <div
        className={`rounded-full border px-3 py-1 text-[10px] font-black sm:text-xs ${
          isVip
            ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-200"
            : isOnCode
            ? "border-yellow-300/25 bg-yellow-400/10 text-yellow-200"
            : "border-white/10 bg-white/5 text-white/70"
        }`}
      >
        {isVip ? "👑 VIP" : isOnCode ? "💎 Code" : "👤 Viewer"}
      </div>

      {isDiscord && (
        <div className="rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-[10px] font-black text-indigo-200 sm:text-xs">
          💬 Discord
        </div>
      )}

      <div className="rounded-full border border-green-300/20 bg-green-400/10 px-3 py-1 text-[10px] font-black text-green-200 sm:text-xs">
        {weight.toFixed(1)}x Odds
      </div>
    </div>
  );
})()}

{winnerFollowAge && (
  <div className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-[10px] font-black text-purple-200 sm:text-xs">
    FOLLOWING {winnerFollowAge}
  </div>
)}
        </div>
      </div>

      <div className="shrink-0 rounded-xl border border-green-300/20 bg-green-400/10 px-3 py-2 text-center">
        <div className="text-[9px] uppercase tracking-[0.14em] text-green-200/70">
          TIMER
        </div>

        <div className="mt-1 text-sm font-black text-green-200 sm:text-lg">
          {giveawayResponseTimer}
        </div>
      </div>
    </div>

    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 sm:text-xs">
        Winner Chat
      </div>

      <div className="mt-3 max-h-[160px] min-h-[100px] space-y-2 overflow-y-auto">
        {!currentGiveawayWinner ? (
          <div className="text-xs text-white/35">
            Draw a winner to track their chat.
          </div>
        ) : winnerChatMessages.length === 0 ? (
          <div className="text-xs text-white/35">
            Waiting for @{currentGiveawayWinner} to type...
          </div>
        ) : (
          winnerChatMessages.map((msg, index) => (
            <div
              key={index}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
            >
              {msg}
            </div>
          ))
        )}
      </div>
    </div>

    <div className="mt-4 flex justify-end">

      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 sm:text-xs">
          Award Prize $
        </div>

<input
  value={giveawayPrizeAmount}
  onChange={(e) =>
    setGiveawayPrizeAmount(
      e.target.value.replace(/[^0-9.]/g, "")
    )
  }
  placeholder="e.g. 50"
  className="mt-3 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm font-black text-white outline-none focus:border-cyan-300/35"
/>

<ActionButton
  onClick={handleAwardGiveawayPrize}
  disabled={!isAdmin || !currentGiveawayWinner}
  className="mt-3 w-full"
  variant="purple"
>
  Award Prize
</ActionButton>
      </div>
    </div>
  </div>

  <div className="rounded-xl border border-white/10 bg-black/30 p-3 sm:rounded-2xl sm:p-4">
    <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45 sm:mb-3 sm:text-xs sm:tracking-[0.22em]">
      Live Entries ({giveawayEntries.length})
    </div>

    <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto sm:max-h-[420px] sm:grid-cols-3 xl:grid-cols-4">
      {giveawayEntries.length === 0 ? (
        <div className="col-span-full text-center text-xs text-white/40 sm:text-sm">
          No entries yet
        </div>
      ) : (
        giveawayEntries.map((entry, index) => (
<div
  key={index}
  className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 py-3 text-center sm:rounded-xl sm:px-3 sm:py-4"
>
  <div className="truncate text-xs font-semibold text-white sm:text-sm">
    {entry.display_name || entry.username}
  </div>

  <div className="mt-2 flex flex-wrap items-center justify-center gap-1">

    {String(entry.role || "").toLowerCase() === "vip" && (
      <div className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black text-cyan-200 sm:text-xs">
        👑 VIP
      </div>
    )}

    {(entry.roulo_username || entry.is_roulo_affiliate) && (
      <div className="rounded-full border border-yellow-300/25 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-black text-yellow-200 sm:text-xs">
        💎 Code
      </div>
    )}

    {(entry.is_in_discord || entry.discord_username) && (
      <div className="rounded-full border border-indigo-300/25 bg-indigo-400/10 px-2 py-0.5 text-[9px] font-black text-indigo-200 sm:text-xs">
        💬 Discord
      </div>
    )}

    <div className="rounded-full border border-green-300/25 bg-green-400/10 px-2 py-0.5 text-[9px] font-black text-green-200 sm:text-xs">
      🎯 {Number(entry.weight || 1).toFixed(1)}x
    </div>

  </div>
</div>
        ))
      )}
    </div>
  </div>
</div>
        </details>

        <details
          open={adminDropdowns.prizePortal}
          onToggle={(e) => setAdminDropdown("prizePortal", e.currentTarget.open)}
          className="rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm"
        >
          <summary className="cursor-pointer text-base font-black text-white sm:text-xl">
            Prize Portal Manager
          </summary>

          <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <SectionLabel>Prize Portal Manager</SectionLabel>
                <h2 className="mt-2 text-xl font-black tracking-wide sm:text-3xl">
                  ALL REWARDS
                </h2>
                <div className="mt-1 text-xs text-white/45 sm:text-sm">
                  Manage viewer rewards and payout status.
                </div>
              </div>

              <ActionButton onClick={loadAdminRewards} variant="dark" className="w-full md:w-auto">
                Refresh
              </ActionButton>
            </div>

            <input
              value={adminRewardsSearch}
              onChange={(e) => setAdminRewardsSearch(e.target.value)}
              placeholder="Search username, status, title..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none sm:px-4 sm:py-3 sm:text-base"
            />

            {adminRewardsMessage && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70 sm:p-4 sm:text-sm">
                {adminRewardsMessage}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 sm:rounded-2xl">
              {filteredAdminRewards.length === 0 ? (
                <div className="p-4 text-center text-sm text-white/45 sm:p-6">
                  No rewards found. Click Refresh Rewards.
                </div>
              ) : (
                <div className="max-h-[520px] overflow-y-auto divide-y divide-white/5 sm:max-h-[650px]">
                  {filteredAdminRewards.map((reward) => {
                    const isComplete = reward.status === "paid";

                    return (
                      <div
                        key={reward.id}
                        className="grid grid-cols-[1fr_auto] gap-3 p-3 sm:p-4 xl:grid-cols-[1fr_120px_140px_360px]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white sm:text-base">
                            {reward.display_name || reward.twitch_username}
                          </div>
                          <div className="mt-1 truncate text-[11px] text-white/40 sm:text-xs">
                            @{reward.twitch_username}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-white/55 sm:mt-2 sm:text-sm">
                            {reward.title || "Chat Giveaway"} •{" "}
                            {reward.created_at
                              ? new Date(reward.created_at).toLocaleString()
                              : "Recently"}
                          </div>
                        </div>

                        <div className="text-right xl:text-left">
                          <div className="text-[10px] text-white/35 sm:text-xs">Amount</div>
                          <div className="mt-1 text-lg font-black text-cyan-200 sm:text-xl">
                            ${Number(reward.amount || 0).toLocaleString()}
                          </div>

                          <div
                            className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black sm:px-3 sm:py-1 sm:text-xs xl:hidden ${
                              isComplete
                                ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"
                                : "border-yellow-300/20 bg-yellow-400/10 text-yellow-200"
                            }`}
                          >
                            {isComplete ? "Paid" : "Pending"}
                          </div>
                        </div>

                        <div className="hidden xl:block">
                          <div className="text-xs text-white/35">Status</div>
                          <div
                            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                              isComplete
                                ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"
                                : "border-yellow-300/20 bg-yellow-400/10 text-yellow-200"
                            }`}
                          >
                            {isComplete ? "Paid" : "Pending"}
                          </div>
                        </div>

                        <div className="col-span-2 grid grid-cols-3 gap-2 xl:col-span-1">
                          {isComplete ? (
                            <ActionButton
                              onClick={() => handleAdminMarkRewardPending(reward.id)}
                              variant="gold"
                              className="min-h-[34px] px-2 py-1 text-[9px] sm:min-h-[46px] sm:text-[10px]"
                            >
                              Pending
                            </ActionButton>
                          ) : (
                            <ActionButton
                              onClick={() => handleAdminMarkRewardPaid(reward.id)}
                              variant="green"
                              className="min-h-[34px] px-2 py-1 text-[9px] sm:min-h-[46px] sm:text-[10px]"
                            >
                              Paid
                            </ActionButton>
                          )}

                          <ActionButton
                            variant="dark"
                            className="min-h-[34px] px-2 py-1 text-[9px] sm:min-h-[46px] sm:text-[10px]"
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

                              setAdminRewards((current) =>
                                current.map((item) => (item.id === reward.id ? { ...item, amount } : item))
                              );

                              setViewerRewards((current) =>
                                current.map((item) => (item.id === reward.id ? { ...item, amount } : item))
                              );

                              loadAdminRewards();
                              loadViewerRewards();
                            }}
                          >
                            Edit
                          </ActionButton>

                          <ActionButton
                            onClick={() => handleAdminDeleteReward(reward.id)}
                            variant="red"
                            className="min-h-[34px] px-2 py-1 text-[9px] sm:min-h-[42px] sm:text-[11px]"
                          >
                            Delete
                          </ActionButton>
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
          className="rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm"
        >
          <summary className="cursor-pointer text-base font-black text-white sm:text-xl">
            Tournament Editor
          </summary>

          <div className="mt-4 sm:mt-6">
            <SectionLabel>Tournament Admin</SectionLabel>
            <h2 className="mt-2 text-2xl font-black tracking-wide sm:mt-3 sm:text-4xl">
              EDIT BRACKET
            </h2>

            <div className="mt-4 grid gap-3 sm:mt-8 sm:gap-5">
              <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(8,8,8,0.98))] p-3 sm:rounded-[1.5rem] sm:p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 sm:text-xs sm:tracking-[0.22em]">
                  Bracket Title
                </div>
                <input
                  value={bracket.title}
                  onChange={(e) => updateBracketTitle(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="Enter tournament title"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/35 disabled:opacity-40 sm:mt-3 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(8,8,8,0.98))] p-3 sm:rounded-[1.5rem] sm:p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 sm:text-xs sm:tracking-[0.22em]">
                  Generate New Bracket
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 sm:mt-4 md:grid-cols-[220px_1fr]">
                  <select
                    value={generatorTeamCount}
                    onChange={(e) => setGeneratorTeamCount(e.target.value)}
                    disabled={!isAdmin}
                    className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none disabled:opacity-40 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base"
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

                  <ActionButton onClick={handleGenerateBracket} disabled={!isAdmin} variant="green">
                    Generate
                  </ActionButton>
                </div>

                <div className="mt-2 text-xs text-white/45 sm:mt-3 sm:text-sm">
                  Odd team counts include BYEs.
                </div>
              </div>

              <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1 sm:max-h-none sm:gap-4 sm:overflow-visible sm:pr-0">
                {bracket.rounds.map((round) => (
                  <div
                    key={round.id}
                    className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(8,8,8,0.98))] p-3 sm:rounded-[1.5rem] sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200 sm:text-xs sm:tracking-[0.22em]">
                        {round.name}
                      </div>

                      <input
                        value={round.name}
                        onChange={(e) => updateRoundName(round.id, e.target.value)}
                        disabled={!isAdmin}
                        className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/35 disabled:opacity-40 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base md:max-w-[220px]"
                      />
                    </div>

                    <div className="mt-3 grid gap-3 sm:mt-5 xl:grid-cols-2">
                      {round.matches.map((match) => (
                        <div
                          key={match.id}
                          className="rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:rounded-2xl"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 sm:text-xs sm:tracking-[0.22em]">
                              {match.id.toUpperCase()}
                            </div>

                            <div className="max-w-[180px] truncate text-[10px] uppercase tracking-[0.16em] text-white/30 sm:text-xs sm:tracking-[0.22em]">
                              {match.winner ? `Winner: ${match.winner}` : "No winner"}
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                            <div className="grid gap-2">
                              <input
                                value={match.player1}
                                onChange={(e) =>
                                  updateMatchField(round.id, match.id, "player1", e.target.value)
                                }
                                disabled={!isAdmin || match.player1 === "BYE"}
                                placeholder="Player"
                                className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/35 disabled:opacity-40 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base"
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
                                placeholder="Amount"
                                className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-300/35 disabled:opacity-40 sm:rounded-xl sm:px-4 sm:py-3"
                              />
                            </div>

                            <div className="grid gap-2">
                              <input
                                value={match.player2}
                                onChange={(e) =>
                                  updateMatchField(round.id, match.id, "player2", e.target.value)
                                }
                                disabled={!isAdmin || match.player2 === "BYE"}
                                placeholder="Player"
                                className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/35 disabled:opacity-40 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base"
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
                                placeholder="Amount"
                                className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-300/35 disabled:opacity-40 sm:rounded-xl sm:px-4 sm:py-3"
                              />
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2">
                            <ActionButton
                              onClick={() => selectMatchWinner(round.id, match.id, match.player1)}
                              disabled={!isAdmin || !match.player1.trim() || match.player1 === "BYE"}
                              variant={match.winner === match.player1 ? "green" : "dark"}
                              className="min-h-[34px] px-2 py-1 text-[9px]"
                            >
                              Pick 1
                            </ActionButton>

                            <ActionButton
                              onClick={() => selectMatchWinner(round.id, match.id, match.player2)}
                              disabled={!isAdmin || !match.player2.trim() || match.player2 === "BYE"}
                              variant={match.winner === match.player2 ? "green" : "dark"}
                              className="min-h-[34px] px-2 py-1 text-[9px]"
                            >
                              Pick 2
                            </ActionButton>

                            <ActionButton
                              onClick={() => clearMatchWinner(round.id, match.id)}
                              disabled={!isAdmin}
                              variant="red"
                              className="min-h-[34px] px-2 py-1 text-[9px]"
                            >
                              Clear
                            </ActionButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2">
                <ActionButton onClick={saveBracket} disabled={!isAdmin} variant="green">
                  Save
                </ActionButton>

                <ActionButton onClick={resetBracket} disabled={!isAdmin} variant="red">
                  Reset
                </ActionButton>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/75 sm:rounded-2xl sm:p-4 sm:text-sm">
                {bracketMessage || "Generate a bracket, enter teams, pick winners, then save it live."}
              </div>
            </div>
          </div>
        </details>

        <details className="rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm">
  <summary className="cursor-pointer text-base font-black text-white sm:text-xl">
    Snake Draft
  </summary>

  <div className="mt-4 grid gap-4">
    <div className="grid gap-3 sm:grid-cols-[180px_1fr_1fr]">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          Captains
        </div>
        <input
          value={snakeCaptainCount}
          onChange={(e) => setSnakeCaptainCount(e.target.value.replace(/[^0-9]/g, ""))}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-white outline-none"
        />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          Captain Names
        </div>
<textarea
  value={snakeCaptainsText}
  onChange={(e) => setSnakeCaptainsText(e.target.value)}
  rows={5}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-white outline-none"
        />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          Player Pool
        </div>
<textarea
  value={snakePlayersText}
  onChange={(e) => setSnakePlayersText(e.target.value)}
  rows={5}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-white outline-none"
        />
      </div>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
<ActionButton onClick={handleSetupSnakeDraft} variant="green">
  Start Snake Draft
</ActionButton>

<ActionButton onClick={saveSnakeDraft} variant="purple">
  Save Draft
</ActionButton>

<ActionButton onClick={loadSnakeDraft} variant="dark">
  Load Draft
</ActionButton>

<ActionButton onClick={handleResetSnakeDraft} variant="red">
  Reset
</ActionButton>
</div>

    {snakeMessage && (
      <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/10 p-3 text-sm text-cyan-100">
        {snakeMessage}
      </div>
    )}

    {snakePickOrder.length > 0 && (
      <div className="rounded-2xl border border-cyan-300/15 bg-black/80 p-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
          Current Pick
        </div>

        <div className="mt-2 text-2xl font-black text-white">
          {snakePickOrder[snakeCurrentPickIndex] || "Draft Complete"}
        </div>

        <div className="mt-1 text-sm text-white/45">
          Pick {Math.min(snakeCurrentPickIndex + 1, snakePickOrder.length)} of{" "}
          {snakePickOrder.length}
        </div>
      </div>
    )}

    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="rounded-2xl border border-white/10 bg-black/80 p-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
          Available Players
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {snakePlayers.length === 0 ? (
            <div className="col-span-full text-sm text-white/35">
              No players available.
            </div>
          ) : (
            snakePlayers.map((player) => (
              <button
                key={player}
                onClick={() => handleSnakePickPlayer(player)}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left text-sm font-black text-white transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
              >
                {player}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/80 p-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
          Teams
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {snakeCaptains.map((captain) => (
            <div
              key={captain}
              className="rounded-xl border border-cyan-300/15 bg-black/70 p-3"
            >
              <div className="text-base font-black text-cyan-200">
                {captain}
              </div>
              <div className="mt-1 text-sm font-black text-[#f5c451]">
  Total: ${getSnakeTeamTotal(captain).toLocaleString()}
</div>

              <div className="mt-2 space-y-1">
                {(snakeTeams[captain] || []).length === 0 ? (
                  <div className="text-xs text-white/35">No picks yet.</div>
                ) : (
                  snakeTeams[captain].map((player, index) => (
                    <div key={player} className="text-sm text-white/80">
                      {index + 1}. {player}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-full rounded-2xl border border-white/10 bg-black/80 p-4">
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
      Slot Call Draft
    </div>

    <div className="mt-1 text-sm text-white/45">
      Builds a snake order from captains and drafted players.
    </div>
  </div>

  <div className="flex items-end gap-3">
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
        Slot Rounds
      </div>

      <input
        value={snakeSlotRounds}
        onChange={(e) =>
          setSnakeSlotRounds(
            e.target.value.replace(/[^0-9]/g, "")
          )
        }
        className="mt-2 w-24 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-white outline-none"
      />
    </div>

    <ActionButton onClick={buildSnakeSlotOrder} variant="purple">
      Build Slot Order
    </ActionButton>
  </div>
</div>

  {snakeSlotOrder.length > 0 && (
<div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
  {snakeSlotOrder.map((name, index) => {
    const key = `${name}-${index}`;
    const teamCaptain = getSnakeTeamForName(name);
    const hit = snakeSlotHit[key];

    return (
      <div
        key={key}
        className={`rounded-xl border p-3 transition ${
          getSnakeTeamStyle(teamCaptain)
        } ${hit ? "ring-2 ring-cyan-300 shadow-[0_0_24px_rgba(0,245,255,0.20)]" : ""}`}
      >
        <div className="flex items-center gap-2">
          <div className="text-xs font-black text-cyan-300">
            #{index + 1}
          </div>

          <div className="truncate text-base font-black text-white">
            {name}
          </div>
        </div>

        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
          Team {teamCaptain}
        </div>

        <input
          value={snakeSlotCalls[key] || ""}
          onChange={(e) =>
            setSnakeSlotCalls((current) => ({
              ...current,
              [key]: e.target.value,
            }))
          }
          placeholder="Slot call"
          className="mt-3 w-full rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/35"
        />

        <input
          value={snakeSlotAmounts[key] || ""}
          onChange={(e) =>
            setSnakeSlotAmounts((current) => ({
              ...current,
              [key]: e.target.value.replace(/[^0-9.]/g, ""),
            }))
          }
          placeholder="Paid amount"
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/35"
        />

        <button
          onClick={() =>
            setSnakeSlotHit((current) => ({
              ...current,
              [key]: !current[key],
            }))
          }
          className={`mt-2 w-full rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
            hit
              ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-100"
              : "border-white/10 bg-black/60 text-white/45 hover:text-white"
          }`}
        >
          {hit ? "Spun Into ✅" : "Mark Spun Into"}
        </button>
      </div>
    );
  })}
</div>
  )}
</div>
  </div>
  </div>
</details>

<details
  open={adminDropdowns.slotWheel}
  onToggle={(e) => setAdminDropdown("slotWheel", e.currentTarget.open)}
  className="rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm"
>
  <summary className="cursor-pointer text-base font-black text-white sm:text-xl">
    Slot Call Wheel
  </summary>

  <div className="pt-4 sm:p-4">
    <div className="mx-auto max-w-4xl rounded-[1.7rem] border border-cyan-300/35 bg-[linear-gradient(180deg,rgba(0,245,255,0.08),rgba(0,0,0,0.94))] p-4 text-center shadow-[0_0_38px_rgba(0,245,255,0.16)] sm:p-6">

      <div className="mt-2 text-3xl font-black uppercase tracking-[0.12em] text-cyan-200 drop-shadow-[0_0_18px_rgba(0,245,255,0.55)] sm:text-5xl">
        Trashguy Wheel
      </div>

      <div className="relative mx-auto mt-5 h-[260px] max-w-3xl overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/90 shadow-[inset_0_0_28px_rgba(0,245,255,0.08)] sm:h-[300px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-black via-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-black via-black/80 to-transparent" />

        <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-30 h-[68px] -translate-y-1/2 border-y border-cyan-300/45 bg-cyan-400/10 shadow-[0_0_28px_rgba(0,245,255,0.18)]" />

        {slotCalls.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-white/40">
            Waiting for slot calls...
          </div>
        ) : (
          <div
            className="transition-transform duration-[4200ms] ease-out"
            style={{
              transform:
                slotCalls.length < 5
                  ? "translateY(118px)"
                  : `translateY(-${slotWheelRotation}px)`,
            }}
          >
            {(
              slotCalls.length < 5
                ? slotCalls
                : Array.from({ length: 8 }).flatMap(() => slotCalls)
            ).map((call, index) => (
              <div
                key={`${call.username}-${call.slotName}-${index}`}
                className="grid h-[60px] grid-cols-[42px_1fr_1fr] items-center gap-4 border-b border-white/5 px-6 leading-none"
              >
                <div className="text-xs font-black text-cyan-300/70">
                  {index + 1}
                </div>

                <div className="truncate text-left text-lg font-black leading-none text-white sm:text-2xl">
                  {call.username}
                </div>

                <div className="truncate text-right text-lg font-black leading-none text-cyan-100 sm:text-2xl">
                  {call.slotName}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white/55">
        Entries
        <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-cyan-200">
          {slotCalls.length}
        </span>
      </div>

      <div className="mx-auto mt-4 max-w-2xl">
        {pickedSlotCall ? (
          <div className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 p-4 shadow-[0_0_30px_rgba(0,245,255,0.14)]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
              Picked Slot
            </div>

            <div className="mt-2 truncate text-3xl font-black text-cyan-300 drop-shadow-[0_0_18px_rgba(0,245,255,0.8)] sm:text-5xl">
              {pickedSlotCall.slotName}
            </div>

            <div className="mt-2 text-sm text-white/45">
              called by {pickedSlotCall.username}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm font-semibold text-white/45">
            {slotCalls.length === 0 ? "Waiting for slot calls..." : "Ready to spin."}
          </div>
        )}
      </div>

      <div className="mx-auto mt-5 grid max-w-2xl gap-3">
        <ActionButton
          onClick={handleSpinSlotWheel}
          disabled={isSlotWheelSpinning || slotCalls.length === 0}
          variant="green"
        >
          {isSlotWheelSpinning ? "Spinning..." : "Spin Wheel"}
        </ActionButton>

        <div className="grid grid-cols-2 gap-3">
          <ActionButton
            onClick={handleShuffleSlotWheel}
            disabled={slotCalls.length <= 1 || isSlotWheelSpinning}
            variant="purple"
          >
            Shuffle
          </ActionButton>

          <ActionButton
            onClick={handleRemovePickedSlot}
            disabled={!pickedSlotCall}
            variant="red"
          >
            Remove
          </ActionButton>
        </div>
      </div>
    </div>

    <div className="mt-5 rounded-xl border border-white/10 bg-black/85 p-4 sm:rounded-[2rem] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80 sm:text-xs sm:tracking-[0.24em]">
          Live Slot Calls
        </div>

        <ActionButton
          onClick={() => setSlotCalls([])}
          variant="red"
          className="min-h-[34px] px-3 py-1 text-[9px] sm:min-h-[42px] sm:text-xs"
        >
          Clear
        </ActionButton>
      </div>

      <div className="mt-4 max-h-[420px] overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-3 sm:rounded-2xl">
        {slotCalls.length === 0 ? (
          <div className="p-6 text-center text-xs text-white/40 sm:text-sm">
            No slot calls yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {slotCalls.map((call, index) => (
              <div
                key={`${call.username}-${call.slotName}-${index}`}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/25 hover:bg-cyan-400/[0.06]"
              >
                <div className="truncate text-sm font-black text-white">
                  {call.slotName}
                </div>

                <div className="mt-1 truncate text-xs text-white/35">
                  by {call.username}
                </div>

                <ActionButton
                  onClick={() =>
                    setSlotCalls((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  variant="red"
                  className="mt-3 min-h-[32px] w-full px-2 py-1 text-[9px]"
                >
                  Remove
                </ActionButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
</details>
      </div>
    </div>
  </section>
)}
          </main>

<footer className="relative mt-24 border-t border-white/10 bg-black/35 backdrop-blur-xl">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.08),transparent_70%)]" />

  <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-10 text-center">
    
    <div className="flex items-center gap-5">
      <a
        href="https://discord.gg/EqjwXzkDMK"
        target="_blank"
        rel="noreferrer"
        className="transition hover:scale-110"
      >
        <FaDiscord className="text-2xl sm:text-3xl text-[#5865F2]" />
      </a>

      <a
        href="https://youtube.com/@Trashguyy"
        target="_blank"
        rel="noreferrer"
        className="transition hover:scale-110"
      >
        <FaYoutube className="text-2xl sm:text-3xl md:text-4xl text-[#FF0000]" />
      </a>

      <a
        href="https://x.com/trashguy__"
        target="_blank"
        rel="noreferrer"
        className="transition hover:scale-110"
      >
        <FaXTwitter className="text-2xl sm:text-3xl md:text-4xl text-white" />
      </a>

      <a
        href="https://instagram.com/trashguy__"
        target="_blank"
        rel="noreferrer"
        className="transition hover:scale-110"
      >
        <FaInstagram className="text-2xl sm:text-3xl md:text-4xl text-[#E1306C]" />
      </a>
    </div>

    <div className="max-w-2xl text-sm leading-7 text-white/45">
      Gamble responsibly. 18+ only.
      A wise man once said "only gamble with what you can afford to lose".
    </div>

    <div className="text-xs uppercase tracking-[0.22em] text-white/25">
      © 2026 Trashguy • All Rights Reserved
    </div>
  </div>
</footer>
        </div>
      </div>
    </div>
  );
}