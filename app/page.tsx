"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import SiteHeader from "@/components/site-header";
import GiveawayAdmin from "./components/admin/giveaways/GiveawayAdmin";
import {
  FaTwitch,
  FaDiscord,
  FaInstagram,
  FaXTwitter,
  FaCrown,
} from "react-icons/fa6";
import { SiKick } from "react-icons/si";
import { slotData, providerLogos, type SlotItem } from "./slotData";
import { Russo_One } from "next/font/google";

const russo = Russo_One({
  subsets: ["latin"],
  weight: "400",
});

const socials = [
  {
    name: "Twitch",
    href: "https://twitch.tv/trashguy__",
    icon: FaTwitch,
  },
  {
    name: "Kick",
    href: "https://kick.com/trashguy",
    icon: SiKick,
  },
  {
    name: "Discord",
    href: "https://discord.gg/FYW4sRZ62e",
    icon: FaDiscord,
  },
  {
    name: "Instagram",
    href: "https://instagram.com/trashguy__",
    icon: FaInstagram,
  },
  {
    name: "Twitter",
    href: "https://x.com/trashguy__",
    icon: FaXTwitter,
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

const leaderboardTotal = 1500;

const leaderboardPrizes: Record<number, number> = {
  1: 450,
  2: 350,
  3: 250,
  4: 200,
  5: 150,
  6: 100,
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
  localId: string;
  externalHuntId: string;
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

function GlowTabTitle({
  label,
}: {
  label: string;
}) {
  return (
    <div className="mb-3 text-center">
<h2 className="text-lg font-black uppercase tracking-[0.2em] text-cyan-300 drop-shadow-[0_0_8px_rgba(0,245,255,0.7)] sm:text-5xl">
  {label}
</h2>
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
"group relative min-h-[40px] overflow-hidden rounded-xl border px-3 py-2",
"text-[11px] font-black uppercase tracking-[0.08em]",
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
  const [slotPickerBelt, setSlotPickerBelt] = useState<SlotItem[]>([]);
  const [slotPickerSliding, setSlotPickerSliding] = useState(false);
  const [slotPickerTransitionMs, setSlotPickerTransitionMs] = useState(70);
  const [slotPickerClawIndex, setSlotPickerClawIndex] = useState<number | null>(null);
  const [slotPickerClawDropping, setSlotPickerClawDropping] = useState(false);
  const [slotPickerWinnerRevealed, setSlotPickerWinnerRevealed] = useState(false);
  const lastPickedRef = useRef<string | null>(null);
  const slotWheelWinnersThisCycleRef = useRef<Set<string>>(new Set());

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
  const [predictionScrollIndex, setPredictionScrollIndex] = useState(0);


  const [adminName, setAdminName] = useState("Trashguy");
  const [finalResult, setFinalResult] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [latestWinners, setLatestWinners] = useState<WinnerItem[]>([]);
  const [activePredictionHuntId, setActivePredictionHuntId] = useState("");
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
  {
    id: string;
    username: string;
    slotName: string;
    createdAt: number;
  }[]
>([]);
const [slotCallResults, setSlotCallResults] = useState<
  {
    id: string;
    username: string;
    slotName: string;
    payout: number;
    createdAt: number;
  }[]
>([]);

const [slotPayoutInput, setSlotPayoutInput] = useState("");
const [slotCallMessage, setSlotCallMessage] = useState("");
const [isSlotWheelSpinning, setIsSlotWheelSpinning] = useState(false);

const [pickedSlotCall, setPickedSlotCall] = useState<{
  id: string;
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

const [viewerOdds, setViewerOdds] = useState({
  baseOdds: 1,
  luckOdds: 0,
  totalOdds: 1,
  nextOdds: 1.1,
  lossCount: 0,
  winCount: 0,
});

const [viewerProfileStats, setViewerProfileStats] = useState({
  lifetimeWagered: 0,
  leaderboardWagered: 0,
  leaderboardWeightedWagered: 0,

  vipRequirement: 5000,
  amountUntilVip: 5000,

  isVip: false,
  previousLeaderboardVip: false,
  currentLeaderboardVip: false,

  hasRoulo: false,
  hasDiscord: false,
});

const [viewerRewardsMessage, setViewerRewardsMessage] = useState("");
const [profileActionMessage, setProfileActionMessage] = useState("");
const [profileActionLoading, setProfileActionLoading] = useState<
  "" | "roulo" | "discord"
>("");

const [viewerPlatform, setViewerPlatform] = useState("twitch");

const [rouloUsernameInput, setRouloUsernameInput] = useState("");
const [rouloLink, setRouloLink] = useState<any>(null);
const [rouloLinkMessage, setRouloLinkMessage] = useState("");

const [discordLink, setDiscordLink] = useState<any>(null);
const [discordLinkMessage, setDiscordLinkMessage] = useState("");

const [isAdmin, setIsAdmin] = useState(false);
const [adminRewards, setAdminRewards] = useState<any[]>([]);
const [adminRewardsSearch, setAdminRewardsSearch] = useState("");
const [adminRewardsMessage, setAdminRewardsMessage] = useState("");
const [manualRewardPlatform, setManualRewardPlatform] =
  useState<"twitch" | "kick">("twitch");

const [manualRewardUsername, setManualRewardUsername] = useState("");
const [manualRewardAmount, setManualRewardAmount] = useState("");
const [manualRewardType, setManualRewardType] = useState("discord_giveaway");

const [activeAdminTab, setActiveAdminTab] = useState<
  "giveaway" | "prizePortal" | "tournament" | "snakeDraft" | "slotWheel"
>(() => {
  if (typeof window === "undefined") return "giveaway";

  const saved = localStorage.getItem("active_admin_tab");

  if (
    saved === "giveaway" ||
    saved === "prizePortal" ||
    saved === "tournament" ||
    saved === "snakeDraft" ||
    saved === "slotWheel"
  ) {
    return saved;
  }

  return "giveaway";
});

useEffect(() => {
  if (typeof window === "undefined") return;
  localStorage.setItem("active_admin_tab", activeAdminTab);
}, [activeAdminTab]);

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
  const predictionRequestRef = useRef(0);
  const predictionRealtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

useEffect(() => {
  if (sortedPredictionsForTab.length <= 5) return;

  const timer = setInterval(() => {
    setPredictionScrollIndex((current) =>
      current + 1 >= sortedPredictionsForTab.length ? 0 : current + 1
    );
  }, 2000);

  return () => clearInterval(timer);
}, [sortedPredictionsForTab.length]);

const visibleScrollingPredictions = useMemo(() => {
  if (!sortedPredictionsForTab.length) return [];

  const items = [];

  for (let i = 0; i < Math.min(5, sortedPredictionsForTab.length); i++) {
    items.push(
      sortedPredictionsForTab[
        (predictionScrollIndex + i) % sortedPredictionsForTab.length
      ]
    );
  }

  return items;
}, [sortedPredictionsForTab, predictionScrollIndex]);

const currentPredictionEntry = useMemo(() => {
  return predictions.find(
    (entry) =>
      entry.username.trim().toLowerCase() ===
      viewerName.trim().toLowerCase()
  );
}, [predictions, viewerName]);

const currentPredictionHunt = useMemo(() => {
  if (!huntsData.length) return null;

  const selected = activePredictionHuntId
    ? huntsData.find((hunt) => hunt.localId === activePredictionHuntId) || null
    : null;

  if (selected) return selected;

  return (
    [...huntsData]
      .filter((hunt) => hunt.prediction_status === "open")
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })[0] || null
  );
}, [huntsData, activePredictionHuntId]);

const adminSelectedHunt = currentPredictionHunt;

const currentPredictionCount = predictions.length;

const currentPredictionAvgX =
  currentPredictionHunt?.startCost && currentPredictionHunt.startCost > 0
    ? ((currentPredictionHunt.totalWinnings || 0) / currentPredictionHunt.startCost).toFixed(2)
    : "0.00";

    const leaderboardCountdown = useMemo(() => {
  const end = new Date("2026-09-04T19:00:00-04:00").getTime();
  const diff = end - countdownTick;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}, [countdownTick]);

const leaderboardProgress = useMemo(() => {
  const start = new Date("2026-08-04T19:00:00-04:00").getTime();
  const end = new Date("2026-09-04T19:00:00-04:00").getTime();
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

const topSlotCallWinner =
  slotCallResults.length > 0
    ? [...slotCallResults].sort(
        (a, b) => b.payout - a.payout
      )[0]
    : null;

const getSlotPickerRandomIndex = (length: number) => {
  if (length <= 1) return 0;

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % length);
  const values = new Uint32Array(1);

  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);

  return values[0] % length;
};

const getRandomSlotFromPool = (pool: SlotItem[]) => {
  return pool[getSlotPickerRandomIndex(pool.length)];
};

const makeSlotPickerBelt = (pool: SlotItem[], count = 6) => {
  if (!pool.length) return [];

  return Array.from({ length: count }, () => getRandomSlotFromPool(pool));
};

useEffect(() => {
  if (isPickingSlot) return;

  setSlotPickerBelt(makeSlotPickerBelt(filteredSlots));
  setPickedSlot(null);
  setSlotPickerClawIndex(null);
  setSlotPickerClawDropping(false);
  setSlotPickerWinnerRevealed(false);
}, [selectedProviders]);

const pickRandomSlot = async () => {
  if (!filteredSlots.length || isPickingSlot) return;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  let winner: SlotItem;

  do {
    winner = getRandomSlotFromPool(filteredSlots);
  } while (
    filteredSlots.length > 1 &&
    winner.name === lastPickedRef.current
  );

  lastPickedRef.current = winner.name;

  const finalCount = Math.min(5, filteredSlots.length);
  const winnerIndex = getSlotPickerRandomIndex(finalCount);

  const finalFive: SlotItem[] = [];
  const availableOthers = filteredSlots.filter(
    (slot) =>
      !(slot.name === winner.name && slot.provider === winner.provider)
  );

  for (let index = 0; index < finalCount; index++) {
    if (index === winnerIndex) {
      finalFive.push(winner);
      continue;
    }

    const source = availableOthers.length ? availableOthers : filteredSlots;
    finalFive.push(getRandomSlotFromPool(source));
  }

  while (finalFive.length < 5) {
    finalFive.push(getRandomSlotFromPool(filteredSlots));
  }

  const finalFeed = [
    ...finalFive,
    getRandomSlotFromPool(filteredSlots),
  ];

  const spinSound = new Audio('/spin.mp3');
  spinSound.loop = true;
  spinSound.volume = 0.28;
  spinSound.playbackRate = 1.15;
  spinSound.play().catch(() => {});

  setIsPickingSlot(true);
  setPickedSlot(null);
  setSlotPickerWinnerRevealed(false);
  setSlotPickerClawDropping(false);
  setSlotPickerClawIndex(null);

  let belt = slotPickerBelt.length === 6
    ? [...slotPickerBelt]
    : makeSlotPickerBelt(filteredSlots);

  setSlotPickerBelt(belt);

  const randomSteps = 24;
  const totalSteps = randomSteps + finalFeed.length;

  for (let step = 0; step < totalSteps; step++) {
    const isFinalFeed = step >= randomSteps;
    const finalFeedIndex = step - randomSteps;

    const progress = step / Math.max(1, totalSteps - 1);
    const eased = progress * progress * progress;
    const transitionMs = Math.round(65 + eased * 355);

    setSlotPickerTransitionMs(transitionMs);

    spinSound.playbackRate = Math.max(0.72, 1.15 - progress * 0.43);
    spinSound.volume = Math.max(0.12, 0.28 - progress * 0.12);

    const nextSlot = isFinalFeed
      ? finalFeed[finalFeedIndex]
      : getRandomSlotFromPool(filteredSlots);

    setSlotPickerSliding(true);
    await sleep(transitionMs);

    belt = [...belt.slice(1), nextSlot];
    setSlotPickerBelt(belt);
    setSlotPickerSliding(false);

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  }

  spinSound.pause();
  spinSound.currentTime = 0;

  setSlotPickerClawIndex(winnerIndex);
  await sleep(500);

  setSlotPickerClawDropping(true);
  await sleep(650);

  setPickedSlot(winner);
  setSlotPickerWinnerRevealed(true);

  const clickSound = new Audio('/click.mp3');
  clickSound.volume = 0.45;
  clickSound.play().catch(() => {});

  await sleep(700);
  setSlotPickerClawDropping(false);
  setIsPickingSlot(false);
};

useEffect(() => {
  if (!authLoaded) return;

  if (adminAllowed) {
    setIsAdmin(true);
  } else {
    setIsAdmin(false);

    if (activeSection === "admin") {
      setActiveSection("home");
    }
  }
}, [
  adminAllowed,
  activeSection,
  authLoaded,
]);

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

    const normalized: HuntItem[] = rawHunts.map((hunt: any, index: number) => ({
      id: hunt.external_hunt_id || hunt.id || `hunt-${index}`,
      localId: hunt.local_id || hunt.db_id || hunt.uuid || hunt.hunt_id || hunt.id,
      externalHuntId: hunt.external_hunt_id || hunt.id,
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
    } else if (!data?.success) {
      console.warn("Hunts API returned no usable data", data?.error || data?.note);
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
  player.weighted_wagered_amount ??
    player.weightedWageredAmount ??
    player.weighted_wagered ??
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
    const viewer = String(viewerName || viewerDisplayName || "")
      .replace("@", "")
      .trim()
      .toLowerCase();

    if (!viewer || viewer === "viewer") {
      setViewerRewards([]);
      setViewerRewardsPending(0);
      setViewerRewardsPaid(0);

      setViewerOdds({
        baseOdds: 1,
        luckOdds: 0,
        totalOdds: 1,
        nextOdds: 1.1,
        lossCount: 0,
        winCount: 0,
      });

      setViewerProfileStats({
        lifetimeWagered: 0,
        leaderboardWagered: 0,
        leaderboardWeightedWagered: 0,
        vipRequirement: 5000,
        amountUntilVip: 5000,
        isVip: false,
        previousLeaderboardVip: false,
        currentLeaderboardVip: false,
        hasRoulo: false,
        hasDiscord: false,
      });

      setViewerRewardsMessage(
        "Connect Twitch or Kick to view rewards."
      );

      return;
    }

    const platform =
      viewerPlatform === "kick" ? "kick" : "twitch";

    const res = await fetch(
      `/api/prize-portal?viewer=${encodeURIComponent(
        viewer
      )}&platform=${encodeURIComponent(platform)}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      setViewerRewards([]);
      setViewerRewardsMessage(
        data.error || "Could not load rewards."
      );
      return;
    }

    setViewerRewards(
      Array.isArray(data.rewards) ? data.rewards : []
    );

    setViewerRewardsPending(
      Number(data.totalPending || 0)
    );

    setViewerRewardsPaid(
      Number(data.totalPaid || 0)
    );

    setViewerOdds({
      baseOdds: Number(data.baseOdds || 1),
      luckOdds: Number(data.luckOdds || 0),
      totalOdds: Number(data.totalOdds || 1),
      nextOdds: Number(data.nextOdds || 1.1),
      lossCount: Number(data.lossCount || 0),
      winCount: Number(data.winCount || 0),
    });

    setViewerProfileStats({
      lifetimeWagered: Number(
        data.lifetimeWagered || 0
      ),

      leaderboardWagered: Number(
        data.leaderboardWagered || 0
      ),

      leaderboardWeightedWagered: Number(
        data.leaderboardWeightedWagered || 0
      ),

      vipRequirement: Number(
        data.vipRequirement || 5000
      ),

      amountUntilVip: Number(
        data.amountUntilVip || 0
      ),

      isVip: Boolean(data.isVip),

      previousLeaderboardVip: Boolean(
        data.previousLeaderboardVip
      ),

      currentLeaderboardVip: Boolean(
        data.currentLeaderboardVip
      ),

      hasRoulo: Boolean(data.hasRoulo),
      hasDiscord: Boolean(data.hasDiscord),
    });

    setViewerRewardsMessage("");
  } catch {
    setViewerRewardsMessage(
      "Could not load rewards."
    );
  }
}, [
  viewerName,
  viewerDisplayName,
  viewerPlatform,
]);

const loadRouloLink = useCallback(async () => {
  if (!viewerName || viewerName === "viewer") {
    setRouloLink(null);
    return;
  }

  try {
    const platform =
      viewerPlatform === "kick" ? "kick" : "twitch";

    const res = await fetch(
      `/api/roulo-link?viewer=${encodeURIComponent(
        viewerName
      )}&platform=${encodeURIComponent(platform)}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      setRouloLink(null);
      setRouloUsernameInput("");
      setRouloLinkMessage(
        data?.error || "Could not load Roulo link."
      );
      return;
    }

    setRouloLink(data.link || null);

    if (data.link?.roulo_username) {
      setRouloUsernameInput(data.link.roulo_username);
    } else {
      setRouloUsernameInput("");
    }

    setRouloLinkMessage("");
  } catch {
    setRouloLink(null);
    setRouloUsernameInput("");
    setRouloLinkMessage("Could not load Roulo link.");
  }
}, [viewerName, viewerPlatform]);

const loadDiscordLink = useCallback(async () => {
  if (!viewerName || viewerName === "viewer") {
    setDiscordLink(null);
    return;
  }

  try {
    const platform =
      viewerPlatform === "kick" ? "kick" : "twitch";

    const res = await fetch(
      `/api/discord-link?viewer=${encodeURIComponent(
        viewerName
      )}&platform=${encodeURIComponent(platform)}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      setDiscordLink(null);
      setDiscordLinkMessage(
        data?.error || "Could not load Discord link."
      );
      return;
    }

    setDiscordLink(data.link || null);
    setDiscordLinkMessage("");
  } catch {
    setDiscordLink(null);
    setDiscordLinkMessage("Could not load Discord link.");
  }
}, [viewerName, viewerPlatform]);

const handleLinkRoulo = async () => {
  setRouloLinkMessage("Checking Roulo account...");

  const res = await fetch("/api/roulo-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: viewerPlatform,
      twitch_username: viewerPlatform === "twitch" ? viewerName : "",
      twitch_display_name: viewerPlatform === "twitch" ? viewerDisplayName : "",
      kick_username: viewerPlatform === "kick" ? viewerName : "",
      kick_display_name: viewerPlatform === "kick" ? viewerDisplayName : "",
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

const handleUnlinkRoulo = async () => {
  if (
    !confirm(
      "Unlink your Roulo account from your profile?"
    )
  ) {
    return;
  }

  try {
    setProfileActionLoading("roulo");
    setProfileActionMessage("Unlinking Roulo...");

    const res = await fetch(
      `/api/roulo-link?viewer=${encodeURIComponent(
        viewerName
      )}&platform=${encodeURIComponent(
        viewerPlatform
      )}`,
      {
        method: "DELETE",
      }
    );

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      setProfileActionMessage(
        data?.error ||
          "Could not unlink Roulo account."
      );
      return;
    }

    setRouloLink(data.link || null);
    setRouloUsernameInput("");

    await Promise.all([
      loadRouloLink(),
      loadViewerRewards(),
    ]);

    setProfileActionMessage(
      "Roulo account unlinked."
    );
  } catch {
    setProfileActionMessage(
      "Could not unlink Roulo account."
    );
  } finally {
    setProfileActionLoading("");
  }
};

const handleUnlinkDiscord = async () => {
  if (
    !confirm(
      "Unlink your Discord account from your profile?"
    )
  ) {
    return;
  }

  try {
    setProfileActionLoading("discord");
    setProfileActionMessage("Unlinking Discord...");

    const res = await fetch(
      `/api/discord-link?viewer=${encodeURIComponent(
        viewerName
      )}&platform=${encodeURIComponent(
        viewerPlatform
      )}`,
      {
        method: "DELETE",
      }
    );

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      setProfileActionMessage(
        data?.error ||
          "Could not unlink Discord account."
      );
      return;
    }

    setDiscordLink(data.link || null);

    await Promise.all([
      loadDiscordLink(),
      loadViewerRewards(),
    ]);

    setProfileActionMessage(
      "Discord account unlinked."
    );
  } catch {
    setProfileActionMessage(
      "Could not unlink Discord account."
    );
  } finally {
    setProfileActionLoading("");
  }
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

const loadPredictions = useCallback(async (huntId: string) => {
  const requestId = ++predictionRequestRef.current;

  if (!huntId) {
    setPredictions([]);
    return;
  }

  try {
    const res = await fetch(
      `/api/predictions?huntId=${encodeURIComponent(huntId)}`,
      { cache: "no-store" }
    );

    if (!res.ok || requestId !== predictionRequestRef.current) return;

    const data = await res.json();
    if (requestId !== predictionRequestRef.current) return;

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
        createdAt: entry.updated_at || entry.created_at || null,
      }))
      .sort((a: PredictionItem, b: PredictionItem) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    setPredictions(normalized);
  } catch (error) {
    if (requestId === predictionRequestRef.current) {
      console.error("Predictions failed to load", error);
    }
  }
}, []);

useEffect(() => {
  const huntId = currentPredictionHunt?.localId || "";

  predictionRequestRef.current += 1;
  setPredictionScrollIndex(0);

  if (!huntId) {
    setPredictions([]);
    return;
  }

  loadPredictions(huntId);

  const timer = window.setInterval(() => {
    loadPredictions(huntId);
  }, 60000);

  return () => window.clearInterval(timer);
}, [currentPredictionHunt?.localId, loadPredictions]);

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
  loadLiveStatus();
  loadBracket();
  loadGiveawayEntries();

  const liveTimer = setInterval(loadLiveStatus, 60000);
  const huntTimer = setInterval(loadHunts, 30000);
  const giveawayTimer = setInterval(loadGiveaways, 5000);
  const giveawayEntriesTimer = setInterval(loadGiveawayEntries, 2000);

  return () => {
    clearInterval(liveTimer);
    clearInterval(huntTimer);
    clearInterval(giveawayTimer);
    clearInterval(giveawayEntriesTimer);
  };
}, [
  loadBracket,
  loadGiveaways,
  loadHunts,
  loadLeaderboard,
  loadLiveStatus,
]);

// LOAD USER SESSION
useEffect(() => {
  let cancelled = false;

  const applyLoggedOutState = () => {
    setIsTwitchConnected(false);
    setViewerName("viewer");
    setViewerDisplayName("viewer");
    setViewerAvatar("");
  };

  const loadUser = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const authError =
        params.get("error_description") ||
        params.get("error") ||
        params.get("kick_error");

      if (authError) {
        setPredictionMessage(decodeURIComponent(authError));
      }

      const preferredPlatform =
        params.get("platform") || localStorage.getItem("viewerPlatform");

      if (preferredPlatform === "kick") {
        const kickResponse = await fetch("/api/kick/session", {
          cache: "no-store",
          credentials: "include",
        });

        if (kickResponse.ok) {
          const kick = await kickResponse.json();
          if (cancelled) return;

          setViewerPlatform("kick");
          localStorage.setItem("viewerPlatform", "kick");
          localStorage.removeItem("kickUsername");
          localStorage.removeItem("kickId");
          setIsTwitchConnected(true);
          setViewerName(String(kick.username || "viewer").toLowerCase());
          setViewerDisplayName(kick.displayName || kick.username || "viewer");
          setViewerAvatar(kick.avatarUrl || "");
          setAuthLoaded(true);
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      }

      const { data: sessionData, error: sessionError } =
        await supabaseBrowser.auth.getSession();

      if (cancelled) return;

      if (sessionError || !sessionData.session?.user) {
        applyLoggedOutState();
        setAuthLoaded(true);
        return;
      }

      const twitchIdentity = extractTwitchIdentity(sessionData.session.user);
      setViewerPlatform("twitch");
      localStorage.setItem("viewerPlatform", "twitch");
      localStorage.removeItem("kickUsername");
      localStorage.removeItem("kickId");
      setIsTwitchConnected(true);
      setViewerName(twitchIdentity.login);
      setViewerDisplayName(twitchIdentity.displayName);
      setViewerAvatar(twitchIdentity.avatarUrl);
      setAuthLoaded(true);
    } catch (error) {
      console.error("loadUser failed", error);
      if (!cancelled) {
        applyLoggedOutState();
        setAuthLoaded(true);
      }
    }
  };

  loadUser();

  const {
    data: { subscription },
  } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
    if (localStorage.getItem("viewerPlatform") === "kick") return;

    const user = session?.user;
    if (!user) {
      applyLoggedOutState();
      return;
    }

    const twitchIdentity = extractTwitchIdentity(user);
    setViewerPlatform("twitch");
    localStorage.setItem("viewerPlatform", "twitch");
    setIsTwitchConnected(true);
    setViewerName(twitchIdentity.login);
    setViewerDisplayName(twitchIdentity.displayName);
    setViewerAvatar(twitchIdentity.avatarUrl);
  });

  return () => {
    cancelled = true;
    subscription.unsubscribe();
  };
}, []);

// RESTORE ACTIVE SECTION AFTER REFRESH
useEffect(() => {
  if (typeof window === "undefined") return;

  const storedSection = localStorage.getItem(
    STORAGE_KEYS.activeSection
  );

  if (storedSection) {
    setActiveSection(storedSection);
  }
}, []);

// SAVE ACTIVE TAB
useEffect(() => {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    STORAGE_KEYS.activeSection,
    activeSection
  );
}, [activeSection]);

useEffect(() => {
  if (typeof window === "undefined" || huntsLoading) return;

  const openHunt = [...huntsData]
    .filter((hunt) => hunt.prediction_status === "open")
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    })[0];

  const storedId = localStorage.getItem(STORAGE_KEYS.activeHuntId) || "";
  const storedHunt = huntsData.find((hunt) => hunt.localId === storedId);
  const resolvedHunt = openHunt || storedHunt || huntsData[0] || null;

  if (!resolvedHunt) {
    setActivePredictionHuntId("");
    setPredictionStatus("locked");
    return;
  }

  setActivePredictionHuntId(resolvedHunt.localId);
  setPredictionStatus(
    resolvedHunt.prediction_status === "open" ? "open" : "locked"
  );

  localStorage.setItem(STORAGE_KEYS.activeHuntId, resolvedHunt.localId);
  localStorage.setItem(
    STORAGE_KEYS.predictionStatus,
    resolvedHunt.prediction_status === "open" ? "open" : "locked"
  );
}, [huntsLoading, huntsData]);

useEffect(() => {
  if (activeSection === "profile") {
    loadViewerRewards();
    loadRouloLink();
    loadDiscordLink();
  }

  if (activeSection === "admin" && adminAllowed) {
    loadAdminRewards();
  }
}, [
  activeSection,
  adminAllowed,
  loadViewerRewards,
  loadRouloLink,
  loadDiscordLink,
]);

// REALTIME UPDATES
useEffect(() => {
  const channel = supabaseBrowser
    .channel("trashguy-live-updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "predictions" },
      () => {
        if (!activePredictionHuntId) return;

        if (predictionRealtimeTimerRef.current) {
          clearTimeout(predictionRealtimeTimerRef.current);
        }

        predictionRealtimeTimerRef.current = setTimeout(() => {
          loadPredictions(activePredictionHuntId);
        }, 500);
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hunts" },
      () => {
        loadHunts();
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
    if (predictionRealtimeTimerRef.current) {
      clearTimeout(predictionRealtimeTimerRef.current);
      predictionRealtimeTimerRef.current = null;
    }
    supabaseBrowser.removeChannel(channel);
  };
}, [activePredictionHuntId, loadBracket, loadHunts, loadPredictions]);

useEffect(() => {
  if (!currentGiveawayWinner) {
    setWinnerChatMessages([]);
    return;
  }

  let cancelled = false;

  const loadWinnerMessages = async () => {
    try {
      const res = await fetch(
        "/api/chat-giveaway/winner-message",
        { cache: "no-store" }
      );

      const data = await res.json();

      if (
        cancelled ||
        !res.ok ||
        !data?.ok ||
        data.winnerUsername !== currentGiveawayWinner
      ) {
        return;
      }

      const messages = Array.isArray(data.messages)
        ? data.messages
        : [];

      setWinnerChatMessages(
        messages.map(
          (item: any) =>
            `${item.display_name || item.username}: ${item.message}`
        )
      );

      if (messages.length > 0) {
        setGiveawayRespondedTime(
          (current) =>
            current ||
            new Date(
              messages[messages.length - 1].created_at
            ).getTime()
        );
      }
    } catch (error) {
      console.error("Winner messages failed to load:", error);
    }
  };

  loadWinnerMessages();

  const timer = window.setInterval(loadWinnerMessages, 1500);

  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
}, [currentGiveawayWinner]);

useEffect(() => {
  loadSnakeDraft();
}, []);

const loadSlotCalls = async () => {
  try {
    const res = await fetch("/api/slot-calls", {
      cache: "no-store",
    });

    const data = await res.json();

    if (Array.isArray(data.calls)) {
      setSlotCalls(
        data.calls.map((call: any) => ({
          id: call.id,
          username: call.username,
          slotName: call.slot_name,
          createdAt: new Date(
            call.created_at
          ).getTime(),
        }))
      );
    }

    if (Array.isArray(data.results)) {
      setSlotCallResults(
        data.results.map((result: any) => ({
          id: result.id,
          username: result.username,
          slotName: result.slot_name,
          payout: Number(result.payout || 0),
          createdAt: new Date(
            result.created_at
          ).getTime(),
        }))
      );
    }
  } catch (err) {
    console.error(
      "Failed to load slot calls",
      err
    );
  }
};

useEffect(() => {
  loadSlotCalls();

  const timer = setInterval(loadSlotCalls, 3000);

  return () => clearInterval(timer);
}, []);

const handleKickLogin = () => {
  localStorage.setItem("viewerPlatform", "kick");
  window.location.href = "/api/kick";
};

const handleTwitchLogin = async () => {
  localStorage.setItem("viewerPlatform", "twitch");
  localStorage.removeItem("kickUsername");
  localStorage.removeItem("kickId");
  setViewerPlatform("twitch");

  try {
    setPredictionMessage("");

    const { data, error } =
      await supabaseBrowser.auth.signInWithOAuth({
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
      setPredictionMessage(
        "No Twitch redirect URL was returned."
      );
    }
  } catch (err: any) {
    console.error("Login crash:", err);
    setPredictionMessage(
      err?.message || "Twitch login failed."
    );
  }
};

  const handleLogout = async () => {
  try {
    await Promise.allSettled([
      supabaseBrowser.auth.signOut(),
      fetch("/api/kick/logout", { method: "POST", credentials: "include" }),
    ]);

    setIsTwitchConnected(false);
    setViewerName("viewer");
    setViewerDisplayName("viewer");
    setViewerAvatar("");
    setViewerPlatform("twitch");
    setIsAdmin(false);
    setActiveSection("home");

    localStorage.removeItem("viewerPlatform");
    localStorage.removeItem("kickUsername");
    localStorage.removeItem("kickId");
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
    let authorizationHeader: Record<string, string> = {};

    if (viewerPlatform === "twitch") {
      const { data: sessionData, error: sessionError } =
        await supabaseBrowser.auth.getSession();

      const token = sessionData.session?.access_token;
      if (sessionError || !token) {
        setPredictionMessage("Not logged in. Please reconnect Twitch.");
        return;
      }

      authorizationHeader = { Authorization: `Bearer ${token}` };
    }

    const res = await fetch("/api/predictions", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authorizationHeader,
      },
body: JSON.stringify({
  guessAmount: guess,
  huntId: currentPredictionHunt.localId,
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
await loadPredictions(currentPredictionHunt.localId);
} catch {
  setPredictionMessage("Failed to save prediction.");
}
};

  const patchPredictionHunt = useCallback(
    async (huntId: string, action: "open" | "lock" | "complete", finalAmount?: number) => {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/hunts/${huntId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, finalAmount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `Failed to ${action} hunt.`);
      }

      return data;
    },
    [getAccessToken]
  );

  const handleSelectPredictionHunt = useCallback(
    async (hunt: HuntItem) => {
      if (!isAdmin) {
        setActivePredictionHuntId(hunt.localId);
        setPredictionStatus(
          hunt.prediction_status === "open" ? "open" : "locked"
        );
        return;
      }

      if (hunt.localId === activePredictionHuntId && predictionStatus === "open") {
        return;
      }

      setAdminMessage(`Opening ${hunt.title}...`);
      setPredictions([]);
      setLatestWinners([]);
      setFinalResult("");

      try {
        const previousOpenHunts = huntsData.filter(
          (item) =>
            item.localId !== hunt.localId &&
            item.prediction_status === "open"
        );

        for (const previousHunt of previousOpenHunts) {
          await patchPredictionHunt(previousHunt.localId, "lock");
        }

        await patchPredictionHunt(hunt.localId, "open");

        setActivePredictionHuntId(hunt.localId);
        setPredictionStatus("open");

        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEYS.activeHuntId, hunt.localId);
          localStorage.setItem(STORAGE_KEYS.predictionStatus, "open");
        }

        setAdminMessage(`${hunt.title} is now open for predictions.`);
        await loadHunts();
        await loadPredictions(hunt.localId);
      } catch (error) {
        setAdminMessage(
          error instanceof Error ? error.message : "Failed to open hunt."
        );
        await loadHunts();
      }
    },
    [
      activePredictionHuntId,
      huntsData,
      isAdmin,
      loadHunts,
      loadPredictions,
      patchPredictionHunt,
      predictionStatus,
    ]
  );

  const handleLockPredictions = async () => {
    if (!currentPredictionHunt?.localId) {
      setAdminMessage("Select a hunt first.");
      return;
    }

    try {
      await patchPredictionHunt(currentPredictionHunt.localId, "lock");
      setPredictionStatus("locked");

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.predictionStatus, "locked");
      }

      setAdminMessage("Predictions closed.");
      await loadHunts();
      await loadPredictions(currentPredictionHunt.localId);
    } catch (error) {
      setAdminMessage(
        error instanceof Error ? error.message : "Failed to close predictions."
      );
    }
  };

const handleCompleteHunt = async () => {
  if (!currentPredictionHunt?.localId) {
    setAdminMessage("Select a hunt first.");
    return;
  }

  const amount = Number(
    currentPredictionHunt.stats?.totalWinnings ||
      currentPredictionHunt.totalWinnings ||
      0
  );

  if (!amount) {
    setAdminMessage("No final hunt balance found yet.");
    return;
  }

  try {
    const data = await patchPredictionHunt(
      currentPredictionHunt.localId,
      "complete",
      amount
    );

    setFinalResult(String(amount));
    setPredictionStatus("locked");
    setLatestWinners(Array.isArray(data?.winners) ? data.winners : []);
    setAdminMessage(
      `Hunt completed at ${formatMoney(amount)}. Winners calculated.`
    );

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.activeHuntId, currentPredictionHunt.localId);
      localStorage.setItem(STORAGE_KEYS.predictionStatus, "locked");
    }

    await loadHunts();
    await loadPredictions(currentPredictionHunt.localId);
  } catch (error) {
    setAdminMessage(
      error instanceof Error ? error.message : "Failed to complete hunt."
    );
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

const SLOT_WHEEL_ITEM_HEIGHT = 44;
const SLOT_WHEEL_VIEWPORT_HEIGHT = 220;
const SLOT_WHEEL_LOOPS = 12;
const SLOT_WHEEL_VISIBLE_ROWS = 5;

const handleSpinSlotWheel = () => {
  if (
    isSlotWheelSpinning ||
    pickedSlotCall ||
    slotCalls.length === 0
  ) {
    return;
  }

  const normalizeUsername = (value: string) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const getRandomIndex = (length: number) => {
    if (length <= 1) return 0;

    const maxUint32 = 0x100000000;
    const limit =
      maxUint32 - (maxUint32 % length);

    const values = new Uint32Array(1);

    do {
      crypto.getRandomValues(values);
    } while (values[0] >= limit);

    return values[0] % length;
  };

  /*
    Only viewers who have NOT already won
    during this cycle are eligible.
  */
  let eligibleCalls = slotCalls.filter(
    (call) =>
      !slotWheelWinnersThisCycleRef.current.has(
        normalizeUsername(call.username)
      )
  );

  /*
    Once everyone currently on the wheel
    has won, start a brand-new cycle.
  */
  if (eligibleCalls.length === 0) {
    slotWheelWinnersThisCycleRef.current.clear();
    eligibleCalls = [...slotCalls];
  }

  /*
    Pick a genuinely random eligible entry.
  */
  const winner =
    eligibleCalls[
      getRandomIndex(eligibleCalls.length)
    ];

  const winnerIndex = slotCalls.findIndex(
    (call) => call.id === winner.id
  );

  if (winnerIndex < 0) {
    console.error(
      "Selected wheel winner was not found."
    );
    return;
  }

  /*
    Randomize how many complete passes the
    visual wheel makes before landing.
  */
  const maximumLoop = Math.max(
    4,
    SLOT_WHEEL_LOOPS - 2
  );

  const minimumLoop = Math.max(
    2,
    maximumLoop - 3
  );

  const targetLoop =
    minimumLoop +
    getRandomIndex(
      maximumLoop - minimumLoop + 1
    );

  const targetIndex =
    targetLoop * slotCalls.length +
    winnerIndex;

  const centerOffset =
    SLOT_WHEEL_VIEWPORT_HEIGHT / 2 -
    SLOT_WHEEL_ITEM_HEIGHT / 2;

  const targetRotation =
    targetIndex * SLOT_WHEEL_ITEM_HEIGHT -
    centerOffset;

  setIsSlotWheelSpinning(true);
  setSlotWheelRotation(0);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setSlotWheelRotation(targetRotation);
    });
  });

  window.setTimeout(() => {
    /*
      Save the USERNAME, not just the slot.

      So if Twanny wins, removes that slot,
      and immediately enters another slot,
      Twanny still cannot win again until
      everybody else in this cycle has won.
    */
    slotWheelWinnersThisCycleRef.current.add(
      normalizeUsername(winner.username)
    );

    setPickedSlotCall(winner);
    setSlotWheelRotation(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsSlotWheelSpinning(false);
      });
    });
  }, 4300);
};

const handleShuffleSlotWheel = () => {
  if (
    slotCalls.length <= 1 ||
    isSlotWheelSpinning ||
    pickedSlotCall
  ) {
    return;
  }

  const getRandomIndex = (length: number) => {
    if (length <= 1) return 0;

    const maxUint32 = 0x100000000;
    const limit =
      maxUint32 - (maxUint32 % length);

    const values = new Uint32Array(1);

    do {
      crypto.getRandomValues(values);
    } while (values[0] >= limit);

    return values[0] % length;
  };

  setSlotCalls((current) => {
    const shuffled = [...current];

    for (
      let index = shuffled.length - 1;
      index > 0;
      index--
    ) {
      const randomIndex =
        getRandomIndex(index + 1);

      [
        shuffled[index],
        shuffled[randomIndex],
      ] = [
        shuffled[randomIndex],
        shuffled[index],
      ];
    }

    return shuffled;
  });
};

const handleRemovePickedSlot = async () => {
  if (!pickedSlotCall) return;

  if (pickedSlotCall.id) {
    await fetch(
      `/api/slot-calls?id=${pickedSlotCall.id}`,
      {
        method: "DELETE",
      }
    );
  }

  setPickedSlotCall(null);
  setSlotWheelRotation(0);

  await loadSlotCalls();
};

const slotWheelLoop = useMemo(() => {
  if (slotCalls.length === 0) return [];

  return Array.from(
    { length: SLOT_WHEEL_LOOPS },
    () => slotCalls
  ).flat();
}, [slotCalls]);

const slotWheelRestingRows = useMemo(() => {
  if (!slotCalls.length) return [];

  const pickedIndex = pickedSlotCall
    ? slotCalls.findIndex(
        (call) => call.id === pickedSlotCall.id
      )
    : 0;

  const centerIndex =
    pickedIndex >= 0 ? pickedIndex : 0;

  const half = Math.floor(
    SLOT_WHEEL_VISIBLE_ROWS / 2
  );

  return Array.from(
    { length: SLOT_WHEEL_VISIBLE_ROWS },
    (_, rowIndex) => {
      const offset = rowIndex - half;

      const callIndex =
        (centerIndex +
          offset +
          slotCalls.length) %
        slotCalls.length;

      return {
        call: slotCalls[callIndex],
        isCenter: rowIndex === half,
        rowKey: `${slotCalls[callIndex].id}-${rowIndex}-${centerIndex}`,
      };
    }
  );
}, [pickedSlotCall, slotCalls]);

const handleCreateManualReward = async () => {
  const username = manualRewardUsername.trim().replace("@", "");
  const amount = Number(manualRewardAmount || 0);

  const rewardTitles: Record<string, string> = {
    discord_giveaway: "🎁 Discord Giveaway",
    twitter_giveaway: "𝕏 Twitter Giveaway",
    instagram_giveaway: "📸 Instagram Giveaway",
    slot_call: "🎰 Slot Call of the Day",
    prediction: "🎯 Predictions Winner",
    vip_tournament: "👑 VIP Tournament",
  };

  const title =
    rewardTitles[manualRewardType] || "🎁 Discord Giveaway";

  if (!username) {
    alert("Enter the viewer's username.");
    return;
  }

  if (!amount || Number.isNaN(amount) || amount <= 0) {
    alert("Enter a valid prize amount.");
    return;
  }

  try {
    setAdminRewardsMessage("Adding prize...");

    const res = await fetch("/api/rewards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: manualRewardPlatform,
        username,
        displayName: username,
        amount,
        type: manualRewardType,
        title,
      }),
    });

    const text = await res.text();

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      alert(`Server returned invalid data: ${text || "Empty response"}`);
      setAdminRewardsMessage("Manual prize failed.");
      return;
    }

    if (!res.ok || !data?.ok) {
      const message =
        data?.error || `Manual prize failed with status ${res.status}.`;

      alert(message);
      setAdminRewardsMessage(message);
      return;
    }

    if (data.reward) {
      setAdminRewards((current) => [data.reward, ...current]);
    }

    setManualRewardUsername("");
    setManualRewardAmount("");
    setManualRewardType("discord_giveaway");

    setAdminRewardsMessage(
      `${title} added for ${username}.`
    );

    alert(`Prize added for ${username}: $${amount}`);

    await loadAdminRewards();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Manual prize failed.";

    console.error("Manual reward error:", error);
    alert(message);
    setAdminRewardsMessage(message);
  }
};

const handleClaimReward = async (rewardId: string) => {
  const res = await fetch("/api/prize-portal/claim", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: rewardId,
      viewer: viewerName,
      platform: viewerPlatform,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    setViewerRewardsMessage(data.error || "Claim failed.");
    return;
  }

  setViewerRewards((current) =>
    current.map((reward) =>
      reward.id === rewardId
        ? { ...reward, claimed: true, paid: false, status: "claimed" }
        : reward
    )
  );

  setViewerRewardsMessage("Prize claimed. Waiting for payout.");
};

const handleMarkRewardPaid = async (id: string) => {
  await fetch(`/api/rewards?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "paid" }),
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
    const res = await fetch("/api/rewards", { cache: "no-store" });
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
  if (!id) return;

  const res = await fetch(`/api/admin/rewards?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "paid" }),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    alert(data.error || "Failed to mark reward paid.");
    return;
  }

  await loadAdminRewards();
  await loadViewerRewards();
};

const handleAdminMarkRewardPending = async (id: string) => {
  if (!id) return;

  const res = await fetch(`/api/admin/rewards?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unpaid" }),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    alert(data.error || "Failed to mark reward unpaid.");
    return;
  }

  await loadAdminRewards();
  await loadViewerRewards();
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
    String(reward.roulo_username || "").toLowerCase().includes(search) ||
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
  return latestWinners.map((winner: any) => ({
    id: `${winner.profile_id}-${winner.placement}`,
    username: winner.username || winner.profile_id,
    guess: winner.guess_amount,
    distance: winner.distance,
  }));
}, [latestWinners]);

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
  handleKickLogin={handleKickLogin}
  handleLogout={handleLogout}
  liveLoading={liveLoading}
  liveStatus={liveStatus}
/>

<main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-10">
{activeSection === "home" && (
  <section className="space-y-1 sm:space-y-3">
<section className="relative -mx-3 overflow-hidden px-3 py-0 text-center sm:-mx-6 sm:px-6">
  <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.14),transparent_58%)]" />

  <div className="relative z-10 mx-auto max-w-5xl">
    <img
      src="/hero-logos.png"
      alt="Trashguy x RouloBets"
      className="mx-auto -mt-10 -mb-8 h-[125px] w-auto object-contain drop-shadow-[0_0_42px_rgba(0,245,255,0.38)] sm:-mt-20 sm:-mb-20 sm:h-[420px] sm:drop-shadow-[0_0_65px_rgba(0,245,255,0.45)]"
    />

    <h1
      className={`${russo.className} mx-auto -mt-8 max-w-5xl text-center text-[clamp(0.95rem,4.8vw,4rem)] leading-[1.02] tracking-[-0.03em] bg-gradient-to-b from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent`}
style={{
  textShadow:
    "0 0 8px rgba(0,245,255,0.25), 0 0 25px rgba(0,245,255,0.35), 0 0 60px rgba(0,245,255,0.18)",
}}
    >
      ONE MAN’S TRASH IS ANOTHER MAN’S MAX WIN
    </h1>

    <p className="mx-auto mt-1 max-w-2xl text-xs font-semibold leading-5 text-white/70 sm:mt-2 sm:text-lg sm:leading-8">
      Sign up on RouloBets under code{" "}
      <span className="font-black text-[#8fffd0]">trashguy</span>{" "}
      to earn monthly prizes, VIP rewards, and daily stream giveaways.
    </p>

    <a
      href="https://roulobets.com/?r=trashguy"
      target="_blank"
      rel="noreferrer"
      className="group relative mt-3 inline-flex min-h-[44px] min-w-[220px] items-center justify-center overflow-hidden rounded-xl border border-cyan-200/60 bg-[linear-gradient(180deg,rgba(0,255,255,0.34),rgba(0,120,255,0.24))] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_0_30px_rgba(0,255,255,0.28)] transition duration-300 hover:scale-[1.04] hover:border-cyan-100 hover:shadow-[0_0_70px_rgba(0,255,255,0.75)] sm:mt-4 sm:min-h-[66px] sm:min-w-[280px] sm:rounded-2xl sm:px-8 sm:py-4 sm:text-sm sm:tracking-[0.22em]"
    >
      <span className="absolute inset-0 translate-x-[-120%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)] transition-transform duration-700 group-hover:translate-x-[120%]" />
      <span className="relative z-10">Join on code trashguy here</span>
    </a>
  </div>
</section>

<div className="mx-auto mt-3 max-w-4xl px-3">

  <div className="mb-3 text-center">
<div className="text-base font-black uppercase tracking-[0.18em] text-cyan-200 sm:text-xl">
  Total Given Away
</div>

    <div className="mt-1 text-4xl font-black text-emerald-300 drop-shadow-[0_0_18px_rgba(52,211,153,0.45)] sm:text-6xl">
      ${giveawayTotal.toLocaleString()}
    </div>
  </div>

  <div className="rounded-2xl border border-cyan-300/15 bg-black/80 p-3 shadow-[0_0_20px_rgba(0,245,255,0.06)]">
    <div className="mb-2 flex items-center justify-between">
      <div className="text-[13px] font-black uppercase tracking-[0.22em] text-cyan-200">
        🏆 Past Winners
      </div>

      <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[13px] font-black text-cyan-100">
        {giveaways.length} Logged
      </div>
    </div>

    {giveawayLoading ? (
      <div className="flex h-[180px] items-center justify-center text-sm text-white/45">
        Loading winners...
      </div>
    ) : giveaways.length === 0 ? (
      <div className="flex h-[180px] items-center justify-center text-sm text-white/45">
        No winners yet.
      </div>
    ) : (
      <div className="max-h-[240px] overflow-y-auto rounded-xl border border-white/10 bg-black/55">
        <div className="divide-y divide-white/5">
          {giveaways.map((giveaway, index) => {
            // Prefer the saved reward/giveaway TYPE first.
            // Some older giveaway rows use a generic title like "Giveaway",
            // while the type still tells us exactly what the prize was.
const giveawayLabelSource = [
  giveaway.title,
  giveaway.reward_title,
  giveaway.rewardTitle,
  giveaway.type,
  giveaway.reward_type,
  giveaway.rewardType,
  giveaway.giveaway_type,
  giveaway.giveawayType,
  giveaway.category,
  giveaway.source,
  giveaway.reward?.title,
  giveaway.reward?.type,
]
  .filter(Boolean)
  .join(" ")
  .trim()
  .toLowerCase();

const giveawayLabel =
  giveawayLabelSource.includes("vip_giveaway") ||
  giveawayLabelSource.includes("vip giveaway")
    ? "👑 VIP Giveaway"

    : giveawayLabelSource.includes("slot_call") ||
      giveawayLabelSource.includes("slot call")
    ? "🎰 Slot Call of the Day"

    : giveawayLabelSource.includes("twitter_giveaway") ||
      giveawayLabelSource.includes("twitter giveaway")
    ? "𝕏 Twitter Giveaway"

    : giveawayLabelSource.includes("instagram_giveaway") ||
      giveawayLabelSource.includes("instagram giveaway")
    ? "📸 Instagram Giveaway"

    : giveawayLabelSource.includes("discord_giveaway") ||
      giveawayLabelSource.includes("discord giveaway")
    ? "🎁 Discord Giveaway"

    : giveawayLabelSource.includes("chat_giveaway") ||
      giveawayLabelSource.includes("chat giveaway")
    ? "💬 Chat Giveaway"

    : giveawayLabelSource.includes("stream_giveaway") ||
      giveawayLabelSource.includes("stream giveaway")
    ? "💬 Stream Giveaway"

    : giveawayLabelSource.includes("prediction")
    ? "🎯 Predictions Winner"

    : giveawayLabelSource.includes("vip_tournament") ||
      giveawayLabelSource.includes("vip tournament")
    ? "👑 VIP Tournament"

    : "🎁 Giveaway";

            return (
              <div
                key={giveaway.id}
                className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-xs font-black text-cyan-200">
                  {index + 1}
                </div>

                <div className="min-w-0">
                  <div className="truncate font-black text-white">
                    {giveaway.winner_name}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] font-black uppercase tracking-[0.08em] text-cyan-200/65 sm:text-[11px]">
                    {giveawayLabel}
                  </div>
                </div>

                <div className="font-black text-emerald-300">
                  ${Number(giveaway.amount || 0).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>

</div>

<div className="mx-auto mt-3 max-w-5xl px-3">
  <div className="grid gap-3 lg:grid-cols-2">

    <div className="rounded-2xl border border-cyan-300/20 bg-black/80 p-3 shadow-[0_0_16px_rgba(0,245,255,0.05)]">
      <div className="text-center text-2xl">👑</div>

      <h3 className="mt-1 text-center text-lg font-black text-cyan-100 sm:text-xl">
        VIP REWARDS
      </h3>

      <div className="mx-auto mt-2 w-fit max-w-full rounded-full border border-yellow-300/25 bg-yellow-300/[0.07] px-3 py-1 text-center">
        <span className="text-[8px] font-black uppercase tracking-[0.12em] text-yellow-200/60 sm:text-[9px]">
          Requirement:
        </span>{" "}
        <span className="text-[10px] font-black text-yellow-100 sm:text-xs">
          $5k+ wagered on previous or current leaderboard
        </span>
      </div>

      <div className="mt-2.5 space-y-2 text-center text-xs text-white/80 sm:text-sm">
        <div>⭐ Daily VIP giveaways</div>
        <div>⭐ Exclusive VIP tournaments</div>
        <div>⭐ Community hunt equity</div>
      </div>
    </div>

    <div className="rounded-2xl border border-cyan-300/20 bg-black/80 p-3 shadow-[0_0_16px_rgba(0,245,255,0.05)]">
      <div className="text-center text-2xl">🎁</div>

      <h3 className="mt-1 text-center text-lg font-black text-cyan-100 sm:text-xl">
        AFFILIATE REWARDS
      </h3>

      <div className="mx-auto mt-2 w-fit max-w-full rounded-full border border-cyan-300/25 bg-cyan-300/[0.07] px-3 py-1 text-center">
        <span className="text-[8px] font-black uppercase tracking-[0.12em] text-cyan-200/60 sm:text-[9px]">
          Requirement:
        </span>{" "}
        <span className="text-[10px] font-black text-cyan-100 sm:text-xs">
          Simply join on code <span className="text-[#8fffd0]">trashguy</span>
        </span>
      </div>

      <div className="mt-2.5 space-y-2 text-center text-xs text-white/80 sm:text-sm">
        <div>⭐ Stream giveaway</div>
        <div>⭐ Slot call of the day</div>
        <div>⭐ Bonus hunt predictions</div>
      </div>
    </div>

  </div>
</div>

<section className="relative py-1 sm:py-3">
  <div className="mx-auto grid max-w-5xl grid-cols-5 gap-1.5 sm:gap-3">
    {socials.map((social) => {
      const Icon = social.icon;

      return (
        <a
          key={social.name}
          href={social.href}
          target="_blank"
          rel="noreferrer"
          aria-label={social.name}
          className="group flex min-h-[64px] min-w-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/50 p-1.5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-400/10 sm:min-h-[100px] sm:rounded-2xl sm:p-3"
        >
          <Icon
            className={`text-xl transition group-hover:scale-110 sm:text-4xl ${
              social.name === "Twitch"
                ? "text-[#9146FF]"
                : social.name === "Kick"
                ? "text-[#53FC18]"
                : social.name === "Discord"
                ? "text-[#5865F2]"
                : social.name === "Instagram"
                ? "text-[#E1306C]"
                : social.name === "Twitter"
                ? "text-white"
                : "text-cyan-200"
            }`}
          />

          <div className="mt-1 truncate text-[7px] font-black uppercase tracking-[0.08em] text-white/55 sm:mt-2 sm:text-xs sm:tracking-[0.14em]">
            {social.name}
          </div>
        </a>
      );
    })}
  </div>
</section>

<section className="relative mx-auto max-w-[850px] py-2 sm:py-4">
  <div className="flex items-end justify-between gap-3">
    <div>
      <SectionLabel>Live Stream</SectionLabel>

      <h2 className="mt-1 text-lg font-black sm:text-2xl">
        WATCH TRASHGUY LIVE
      </h2>
    </div>
  </div>

  <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-cyan-300/20 bg-black shadow-[0_0_24px_rgba(0,245,255,0.06)] sm:rounded-2xl">
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
          <div className="text-2xl font-black text-white sm:text-4xl">
            OFFLINE
          </div>

          <div className="mt-1 text-xs text-white/50 sm:text-sm">
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
  <section className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6">
<div className="mx-auto max-w-5xl">
  <GlowTabTitle label="$1,500 LEADERBOARD" />

  <div className="mt-3 flex justify-center">
    <div className="rounded-full border border-purple-400/30 bg-purple-500/10 px-5 py-2">
      <span className="text-sm font-black text-purple-200 sm:text-lg">
        ⏳ Ends in {leaderboardCountdown}
      </span>
    </div>
  </div>
</div>

<div className="mx-auto w-full min-w-0 max-w-5xl space-y-1.5 overflow-x-hidden sm:space-y-2">
      <div className="grid grid-cols-[42px_minmax(0,1fr)_88px_48px] items-center rounded-xl bg-black/55 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-white/55 sm:grid-cols-[80px_1fr_180px_140px] sm:px-5 sm:text-[11px] sm:tracking-[0.16em]">
        <div>Rank</div>
        <div>Player</div>
        <div className="text-right">Wagered</div>
        <div className="text-right">Prize</div>
      </div>

{leaderboardLoading && leaderboardData.length === 0 ? (
  <div className="rounded-xl border border-white/10 bg-black/35 px-4 py-5 text-sm text-white/60">
    Loading leaderboard...
  </div>
) : (
  <div className="space-y-2">
    {leaderboardData.map((player) => {
      const prize = leaderboardPrizes[player.rank] || 0;

      const isFirst = player.rank === 1;
      const isSecond = player.rank === 2;
      const isThird = player.rank === 3;
      const isTopThree = player.rank <= 3;

const topRowStyle = isFirst
  ? "border-yellow-300/70 bg-[linear-gradient(110deg,rgb(135,92,0),rgb(72,48,0),rgb(18,14,3))] shadow-[0_0_28px_rgba(250,204,21,0.25)]"
  : isSecond
  ? "border-slate-200/65 bg-[linear-gradient(110deg,rgb(95,112,132),rgb(52,64,80),rgb(14,18,25))] shadow-[0_0_26px_rgba(220,230,245,0.18)]"
  : "border-orange-400/65 bg-[linear-gradient(110deg,rgb(130,58,14),rgb(72,31,8),rgb(18,10,4))] shadow-[0_0_26px_rgba(251,146,60,0.20)]";

const rankBadgeStyle = isFirst
  ? "border-yellow-200/70 bg-yellow-300/20 text-yellow-100 shadow-[0_0_16px_rgba(250,204,21,0.30)]"
  : isSecond
  ? "border-slate-100/65 bg-slate-100/15 text-white shadow-[0_0_16px_rgba(226,232,240,0.22)]"
  : isThird
  ? "border-orange-300/65 bg-orange-400/15 text-orange-100 shadow-[0_0_16px_rgba(251,146,60,0.24)]"
  : "border-cyan-300/15 bg-cyan-400/[0.04] text-cyan-100/75";

      const rankLabel = isFirst
        ? "🥇"
        : isSecond
        ? "🥈"
        : isThird
        ? "🥉"
        : `#${player.rank}`;

      if (isTopThree) {
        return (
          <div
            key={`${player.rank}-${player.username}`}
            className={`grid grid-cols-[56px_minmax(0,1fr)_92px_64px] items-center rounded-2xl border px-3 py-3 sm:grid-cols-[82px_minmax(0,1fr)_180px_130px] sm:px-5 sm:py-4 ${topRowStyle}`}
          >
            <div className="flex justify-start">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg font-black sm:h-12 sm:w-12 sm:text-2xl ${rankBadgeStyle}`}
              >
                {rankLabel}
              </div>
            </div>

            <div className="min-w-0 pl-1 sm:pl-3">
              <div className="truncate text-sm font-black text-white sm:text-xl">
                {player.username}
              </div>

              <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white/30 sm:text-[10px]">
                Rank #{player.rank}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/25 sm:text-[9px]">
                Wagered
              </div>

              <div className="mt-0.5 whitespace-nowrap text-[10px] font-black text-white sm:text-base">
                {formatMoney(player.wagered)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/25 sm:text-[9px]">
                Prize
              </div>

              <div className="mt-0.5 whitespace-nowrap text-[10px] font-black text-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,0.30)] sm:text-base">
                {prize > 0 ? `$${prize.toLocaleString()}` : "-"}
              </div>
            </div>
          </div>
        );
      }

      return (
        <div
          key={`${player.rank}-${player.username}`}
          className="grid grid-cols-[48px_minmax(0,1fr)_92px_58px] items-center border-b border-cyan-300/[0.08] bg-[#08111f]/88 px-3 py-2.5 transition hover:bg-[#0b1728] sm:grid-cols-[70px_minmax(0,1fr)_180px_120px] sm:px-5 sm:py-3"
        >
          <div className="flex justify-start">
            <div
              className={`flex h-8 min-w-[40px] items-center justify-center rounded-full border px-2 text-[10px] font-black sm:h-9 sm:min-w-[48px] sm:text-xs ${rankBadgeStyle}`}
            >
              {rankLabel}
            </div>
          </div>

          <div className="min-w-0 pl-2 sm:pl-4">
            <div className="truncate text-[11px] font-black text-white sm:text-base">
              {player.username}
            </div>
          </div>

          <div className="whitespace-nowrap text-right text-[9px] font-black text-white/85 sm:text-sm">
            {formatMoney(player.wagered)}
          </div>

          <div className="whitespace-nowrap text-right text-[9px] font-black text-emerald-300 drop-shadow-[0_0_9px_rgba(110,231,183,0.24)] sm:text-sm">
            {prize > 0 ? `$${prize.toLocaleString()}` : "-"}
          </div>
        </div>
      );
    })}
  </div>
)}

{adminAllowed && (
  <div className="mx-auto mt-4 w-full max-w-xl rounded-xl border border-yellow-300/20 bg-yellow-400/[0.08] px-3 py-3 shadow-[0_0_18px_rgba(250,204,21,0.06)]">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-200 sm:text-xs">
          👑 VIP Snapshot
        </div>

        <div className="mt-1 text-[10px] leading-tight text-white/45 sm:text-xs">
          {adminMessage ||
            "Save $5,000+ wagered players as VIPs for the next leaderboard."}
        </div>
      </div>

      <ActionButton
        onClick={handleGenerateVipSnapshot}
        variant="gold"
        className="shrink-0 px-3 py-2 text-[9px] sm:px-4 sm:text-[10px]"
      >
        Generate Snapshot
      </ActionButton>
    </div>
  </div>
)}
    </div>
  </section>
)}

{activeSection === "hunts" && (
  <section className="space-y-2 sm:space-y-8">
<GlowTabTitle label="BONUS HUNTS" />

<div className="flex gap-2 overflow-x-auto pb-2 sm:gap-4 sm:pb-4">
  {huntsData.map((hunt) => {
    const huntLocalId = (hunt as any)?.localId || hunt.id;

    return (
      <button
        key={hunt.id}
        onClick={() => handleSelectPredictionHunt(hunt)}
        className={`flex min-w-[118px] flex-col items-center justify-center rounded-lg border bg-black/70 p-2 text-center backdrop-blur-md transition hover:-translate-y-1 sm:min-w-[190px] sm:rounded-2xl sm:p-4 ${
          currentPredictionHunt?.localId === huntLocalId
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
    );
  })}
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

<div className="mt-2 space-y-2 sm:mt-3 sm:space-y-2">

  <div className="grid grid-cols-2 gap-2">
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
        Start
      </div>

      <div className="mt-1 text-2xl font-black tracking-tight text-white">
        {formatMoney(currentPredictionHunt?.startCost || 0)}
      </div>
    </div>

    <div className="rounded-xl border border-cyan-400/20 bg-[rgba(0,245,255,0.06)] p-3">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100/45">
        Won
      </div>

      <div className="mt-1 text-2xl font-black tracking-tight text-cyan-200">
        {formatMoney(
          currentPredictionHunt?.stats?.totalWinnings ||
            currentPredictionHunt?.totalWinnings ||
            0
        )}
      </div>
    </div>
  </div>

  <div className="grid grid-cols-3 gap-2">
    <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35">
        Bonuses
      </div>

      <div className="mt-1 text-lg font-black text-white">
        {currentPredictionHunt?.bonuses?.length || 0}
      </div>
    </div>

    <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35">
        Avg X
      </div>

      <div className="mt-1 text-lg font-black text-white">
        {currentPredictionHunt?.stats?.currentAverageMultiplier
          ? `${Number(
              currentPredictionHunt.stats.currentAverageMultiplier
            ).toFixed(2)}x`
          : `${currentPredictionAvgX}x`}
      </div>
    </div>

    <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35">
        Req X
      </div>

      <div className="mt-1 text-lg font-black text-white">
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

  <div className="grid grid-cols-2 gap-2">
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">
        Highest Win
      </div>

      <div className="mt-2">
        <div className="truncate text-sm font-black text-white">
          {currentPredictionHunt?.bonuses?.length
            ? [...currentPredictionHunt.bonuses].sort(
                (a: any, b: any) =>
                  Number(b.payout || 0) - Number(a.payout || 0)
              )[0]?.slotName || "---"
            : "---"}
        </div>

        <div className="mt-1 text-lg font-black text-cyan-300">
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

    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">
        Highest X
      </div>

      <div className="mt-2">
        <div className="truncate text-sm font-black text-white">
          {currentPredictionHunt?.bonuses?.length
            ? [...currentPredictionHunt.bonuses].sort(
                (a: any, b: any) =>
                  Number(b.multiplier || 0) - Number(a.multiplier || 0)
              )[0]?.slotName || "---"
            : "---"}
        </div>

        <div className="mt-1 text-lg font-black text-cyan-300">
          {currentPredictionHunt?.bonuses?.length
            ? `${Number(
                [...currentPredictionHunt.bonuses].sort(
                  (a: any, b: any) =>
                    Number(b.multiplier || 0) - Number(a.multiplier || 0)
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
        <div className="p-2.5 sm:p-4">
          <div className="text-center">
<div className="text-xs font-black uppercase tracking-[0.14em] text-white sm:text-sm">
  Guess the end balance
</div>
            <div className="mt-0.5 text-[10px] text-white/45 sm:mt-2 sm:text-xs">
              Closest predictions win. One entry per person.
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:mt-4 sm:gap-2">
              <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[9px] font-black text-cyan-100 sm:px-3 sm:py-1 sm:text-[13px]">
                1st Closest $15
              </div>
            </div>
          </div>

<div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-2.5 sm:mt-4 sm:rounded-2xl sm:p-2">
  {isAdmin && (
    <div className="mt-2 rounded-xl border border-cyan-300/15 bg-black/40 p-3">
<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">


<ActionButton onClick={handleLockPredictions} variant="purple">
  Close
</ActionButton>

<ActionButton onClick={handleCompleteHunt} variant="gold">
  Complete
</ActionButton>
      </div>

      <div className="mt-2 text-center text-[10px] text-white/55">
        {adminMessage}
      </div>
    </div>
  )}
  
            <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
              {rankedWinners.length === 0 ? (
                <div className="col-span-full py-3 text-center text-[11px] text-white/45 sm:py-4 sm:text-xs">
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

<div className="mt-2 sm:mt-3">
  {!isTwitchConnected ? (
    <div className="mx-auto flex max-w-sm gap-2">
      <button
        onClick={handleTwitchLogin}
        className="flex-1 rounded-lg border border-[#9146FF]/40 bg-[#9146FF]/25 px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#9146FF]/35 sm:text-xs"
      >
        Twitch
      </button>
      <button
        onClick={handleKickLogin}
        className="flex-1 rounded-lg border border-[#53FC18]/40 bg-[#53FC18]/15 px-3 py-2 text-[11px] font-black text-[#baff9f] transition hover:bg-[#53FC18]/25 sm:text-xs"
      >
        Kick
      </button>
    </div>
  ) : (
    <div className="mx-auto max-w-md">
      <input
        value={predictionInput}
        onChange={(e) =>
          setPredictionInput(e.target.value.replace(/[^0-9]/g, ""))
        }
        placeholder="Enter your end balance prediction"
        disabled={predictionStatus !== "open"}
        className="w-full rounded-lg border border-white/10 bg-black/55 px-3 py-2 text-center text-xs text-white outline-none transition focus:border-cyan-300/40 disabled:opacity-40 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
      />

      <button
        onClick={handlePredictionSubmit}
        disabled={predictionStatus !== "open"}
        className="mt-2 w-full rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-40 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
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

<div className="border-t border-white/10 p-2.5 sm:p-4">
  <div className="mb-2 flex items-center justify-between">
    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200 sm:text-xs">
      Live Guesses
    </div>

    <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black text-cyan-100 sm:text-xs">
      {currentPredictionCount} Entries
    </div>
  </div>

<div className="h-[230px] overflow-hidden rounded-xl border border-white/10 bg-black/65 p-2">
  {sortedPredictionsForTab.length === 0 ? (
    <div className="flex h-full items-center justify-center text-xs text-white/40">
      No guesses yet.
    </div>
  ) : (
    <div className="animate-prediction-marquee">
      {[...sortedPredictionsForTab, ...sortedPredictionsForTab].map(
        (entry, index) => (
          <div
            key={`${entry.id}-${index}`}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-7 text-[10px] font-black text-cyan-300">
                #{(index % sortedPredictionsForTab.length) + 1}
              </div>

              <div className="min-w-0">
                <div className="truncate text-[13px] font-black text-white">
                  {entry.username}
                </div>
                <div className="text-[9px] text-white/35">
                  {formatTimeAgo(entry.createdAt)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[13px] font-black text-cyan-200">
              {formatMoney(entry.guess)}
            </div>
          </div>
        )
      )}
    </div>
  )}
</div>
</div>

{/* BONUS LIST */}
<div className="border-t border-white/10 p-2.5 sm:p-4">
  <div className="mb-2 flex items-center justify-between">
    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200 sm:text-xs">
      Slots in this Hunt
    </div>

    <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black text-cyan-100 sm:text-xs">
      {currentPredictionHunt?.bonuses?.length || 0} Slots
    </div>
  </div>

  <div className="max-h-[360px] overflow-y-auto rounded-xl border border-white/10 bg-black/45 sm:max-h-[480px]">
    {!currentPredictionHunt?.bonuses?.length ? (
      <div className="flex h-[90px] items-center justify-center text-xs text-white/40">
        No bonuses in this hunt yet.
      </div>
    ) : (
<div className="space-y-2">
  {currentPredictionHunt.bonuses.map((bonus: any, index: number) => (
    <div
      key={bonus.id || index}
      className="rounded-xl border border-white/10 bg-black/35 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-[11px] font-black text-cyan-200">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-black text-white sm:text-sm">
            {bonus.slotName}
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-bold sm:text-xs">
            <span className="text-white/60">
              Bet{" "}
              <span className="text-white">
                {formatMoney(Number(bonus.betSize || 0))}
              </span>
            </span>

            <span className="text-white/80">
              {Number(bonus.multiplier || 0).toFixed(2)}x
            </span>

            <span className="text-cyan-300">
              {formatMoney(Number(bonus.payout || 0))}
            </span>
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
  </section>
)}

{activeSection === "profile" && (
  <section className="space-y-4 sm:space-y-5">
    <div className="mx-auto max-w-6xl text-center">
      <GlowTabTitle label="PROFILE" />
    </div>

    {!isTwitchConnected ? (
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(0,25,32,0.97),rgba(0,0,0,0.98))] p-6 text-center shadow-[0_0_40px_rgba(0,245,255,0.12)]">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/70">
          Connect Your Account
        </div>

        <div className="mt-2 text-sm text-white/45">
          Sign in to view your profile, wager stats,
          giveaway odds and prizes.
        </div>

        <div className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row">
          <button
            onClick={handleTwitchLogin}
            className="flex-1 rounded-xl border border-[#9146FF]/40 bg-[#9146FF]/20 px-4 py-3 text-xs font-black text-white transition hover:bg-[#9146FF]/30"
          >
            Connect Twitch
          </button>

          <button
            onClick={handleKickLogin}
            className="flex-1 rounded-xl border border-[#53FC18]/40 bg-[#53FC18]/15 px-4 py-3 text-xs font-black text-[#baff9f] transition hover:bg-[#53FC18]/25"
          >
            Connect Kick
          </button>
        </div>
      </div>
    ) : (
      <div className="mx-auto w-full max-w-6xl space-y-4">
{/* =====================================================
    MAIN ACCOUNT
===================================================== */}
<div className="relative overflow-hidden rounded-3xl border border-cyan-300/40 bg-[radial-gradient(circle_at_15%_25%,rgba(0,245,255,0.13),transparent_28%),linear-gradient(135deg,rgba(0,22,27,0.99),rgba(0,0,0,0.99))] shadow-[0_0_42px_rgba(0,245,255,0.14)]">
  <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(103,232,249,0.85),transparent)]" />
  <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/[0.07] blur-3xl" />

  <div className="relative p-4 sm:p-6">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 sm:text-xs">
        <span className="text-cyan-300">♟</span>
        My Profile
      </div>

      <button
        onClick={handleLogout}
        className="rounded-lg border border-red-300/35 bg-red-500/[0.08] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-red-200 shadow-[0_0_14px_rgba(248,113,113,0.08)] transition hover:border-red-300/60 hover:bg-red-500/15 sm:px-4 sm:text-[10px]"
      >
        Log Out ↪
      </button>
    </div>

    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.15fr] lg:items-stretch">
      {/* LEFT - USER */}
      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-full bg-cyan-300/20 blur-md" />

          {viewerAvatar ? (
            <img
              src={viewerAvatar}
              alt={viewerDisplayName || viewerName}
              className="relative h-[92px] w-[92px] rounded-full border-2 border-cyan-300 object-cover shadow-[0_0_28px_rgba(34,211,238,0.42)] sm:h-[125px] sm:w-[125px]"
            />
          ) : (
            <div className="relative flex h-[92px] w-[92px] items-center justify-center rounded-full border-2 border-cyan-300 bg-cyan-400/10 text-3xl font-black text-white shadow-[0_0_28px_rgba(34,211,238,0.42)] sm:h-[125px] sm:w-[125px]">
              {viewerDisplayName?.charAt(0)?.toUpperCase() || "T"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black text-white sm:text-3xl">
            {viewerDisplayName || viewerName}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg border sm:h-9 sm:w-9 ${
                viewerPlatform === "kick"
                  ? "border-[#53FC18]/45 bg-[#53FC18]/10 text-[#53FC18]"
                  : "border-[#9146FF]/50 bg-[#9146FF]/15 text-purple-300"
              }`}
            >
              {viewerPlatform === "kick" ? (
                <SiKick className="text-base sm:text-lg" />
              ) : (
                <FaTwitch className="text-base sm:text-lg" />
              )}
            </div>

            <div className="text-[10px] font-bold text-white/30">
              /
            </div>

            <div className="text-xs font-bold text-white/55 sm:text-sm">
              @{viewerName}
            </div>
          </div>

          <div className="mt-3">
            <div
              className={`inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg border px-4 py-2 text-base font-black uppercase tracking-[0.10em] sm:min-w-[140px] sm:text-xl ${
                viewerProfileStats.isVip
                  ? "border-cyan-300/50 bg-[linear-gradient(180deg,rgba(0,245,255,0.22),rgba(0,150,170,0.12))] text-cyan-100 shadow-[0_0_22px_rgba(0,245,255,0.18)]"
                  : rouloLink?.roulo_username
                  ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 bg-white/[0.04] text-white/60"
              }`}
            >
{viewerProfileStats.isVip ? (
  <>
    <FaCrown className="text-yellow-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.55)]" />
    VIP
  </>
) : rouloLink?.roulo_username ? (
                "Affiliate"
              ) : (
                "Viewer"
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.10em] sm:text-[10px]">
            <span
              className={`h-2 w-2 rounded-full ${
                rouloLink?.roulo_username
                  ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"
                  : "bg-white/20"
              }`}
            />

            <span
              className={
                rouloLink?.roulo_username
                  ? "text-green-300"
                  : "text-white/35"
              }
            >
              {rouloLink?.roulo_username
                ? "On Code"
                : "Not On Code"}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT - ODDS + PAID */}
      <div className="border-t border-cyan-300/10 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <div className="text-[10px] font-black uppercase tracking-[0.17em] text-cyan-200 sm:text-xs">
          Giveaway Odds
        </div>

        <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-cyan-300/20 bg-black/45">
          <div className="px-2 py-3 text-center sm:px-3 sm:py-4">
            <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/45 sm:text-[9px]">
              Base
            </div>

            <div className="mt-1 text-lg font-black text-white sm:text-2xl">
              {viewerOdds.baseOdds.toFixed(2)}x
            </div>
          </div>

          <div className="border-x border-cyan-300/10 px-2 py-3 text-center sm:px-3 sm:py-4">
            <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/45 sm:text-[9px]">
              Luck
            </div>

            <div className="mt-1 text-lg font-black text-green-300 sm:text-2xl">
              +{viewerOdds.luckOdds.toFixed(2)}x
            </div>
          </div>

          <div className="px-2 py-3 text-center sm:px-3 sm:py-4">
            <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/45 sm:text-[9px]">
              Total
            </div>

            <div className="mt-1 text-lg font-black text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)] sm:text-2xl">
              {viewerOdds.totalOdds.toFixed(2)}x
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 border-t border-cyan-300/15 pt-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-400/10 text-xl font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.18)] sm:h-14 sm:w-14 sm:text-2xl">
            $
          </div>

          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/50 sm:text-[10px]">
              Total Paid Out
            </div>

            <div className="mt-0.5 text-2xl font-black text-green-300 drop-shadow-[0_0_12px_rgba(74,222,128,0.25)] sm:text-4xl">
              ${viewerRewardsPaid.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

{/* =====================================================
    LINKED ACCOUNTS
===================================================== */}
<div className="overflow-hidden rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(0,17,22,0.98),rgba(0,0,0,0.99))] shadow-[0_0_28px_rgba(0,245,255,0.07)]">
  <div className="border-b border-cyan-300/10 px-4 py-3">
    <div className="flex items-center gap-2">
      <span className="text-sm text-cyan-300">🔗</span>

      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 sm:text-xs">
        Linked Accounts
      </div>
    </div>
  </div>

  <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
    {/* DISCORD */}
    <div className="rounded-xl border border-[#5865F2]/35 bg-[linear-gradient(135deg,rgba(88,101,242,0.13),rgba(0,0,0,0.90))] p-3.5 shadow-[inset_0_0_20px_rgba(88,101,242,0.04)] sm:p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#7289da]/55 bg-[#5865F2]/25 text-2xl text-white shadow-[0_0_18px_rgba(88,101,242,0.18)] sm:h-14 sm:w-14">
          <FaDiscord />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/70">
            Discord
          </div>

          <div className="mt-0.5 truncate text-sm font-black text-white sm:text-base">
            {discordLink?.is_in_discord
              ? discordLink?.discord_username || "Linked"
              : "Not linked"}
          </div>

          {discordLink?.is_in_discord && (
            <div className="mt-1 inline-flex rounded bg-green-400/10 px-2 py-0.5 text-[7px] font-black uppercase text-green-300">
              Linked
            </div>
          )}
        </div>

        {discordLink?.is_in_discord ? (
          <button
            type="button"
            disabled={profileActionLoading === "discord"}
            onClick={handleUnlinkDiscord}
            className="shrink-0 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-red-300 shadow-[0_0_14px_rgba(248,113,113,0.08)] transition hover:border-red-300 hover:bg-red-500/20 sm:px-4 sm:text-[10px]"
          >
            {profileActionLoading === "discord"
              ? "Unlinking..."
              : "⛓ Unlink"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              (window.location.href = `/api/discord/login?viewer=${encodeURIComponent(
                viewerName
              )}&platform=${encodeURIComponent(
                viewerPlatform
              )}`)
            }
            className="shrink-0 rounded-lg border border-[#5865F2]/45 bg-[#5865F2]/15 px-3 py-2 text-[9px] font-black text-[#c5c9ff] transition hover:bg-[#5865F2]/25"
          >
            Link
          </button>
        )}
      </div>
    </div>

    {/* ROULO */}
    <div className="rounded-xl border border-cyan-300/35 bg-[linear-gradient(135deg,rgba(0,215,235,0.10),rgba(0,0,0,0.90))] p-3.5 shadow-[inset_0_0_20px_rgba(0,245,255,0.04)] sm:p-4">
      {rouloLink?.roulo_username ? (
        <div className="flex items-center gap-3">
<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-300/45 bg-black/80 p-1.5 shadow-[0_0_18px_rgba(0,245,255,0.15)] sm:h-14 sm:w-14">
  <img
    src="/roulo-logo.png"
    alt="Roulo"
    className="h-full w-full object-contain"
  />
</div>

          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/70">
              Roulo
            </div>

            <div className="mt-0.5 truncate text-sm font-black text-white sm:text-base">
              {rouloLink.roulo_username}
            </div>

            <div className="mt-1 inline-flex rounded bg-green-400/10 px-2 py-0.5 text-[7px] font-black uppercase text-green-300">
              Linked
            </div>
          </div>

          <button
            type="button"
            disabled={profileActionLoading === "roulo"}
            onClick={handleUnlinkRoulo}
            className="shrink-0 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-red-300 shadow-[0_0_14px_rgba(248,113,113,0.08)] transition hover:border-red-300 hover:bg-red-500/20 sm:px-4 sm:text-[10px]"
          >
            {profileActionLoading === "roulo"
              ? "Unlinking..."
              : "⛓ Unlink"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-300/45 bg-black/80 p-1.5 shadow-[0_0_18px_rgba(0,245,255,0.15)] sm:h-14 sm:w-14">
  <img
    src="/roulo-logo.png"
    alt="Roulo"
    className="h-full w-full object-contain"
  />
</div>

          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/70">
              Roulo
            </div>

            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                value={rouloUsernameInput}
                onChange={(e) =>
                  setRouloUsernameInput(e.target.value)
                }
                placeholder="Roulo username"
                className="min-w-0 rounded-lg border border-cyan-300/15 bg-black/70 px-3 py-2 text-xs text-white outline-none transition focus:border-cyan-300/45"
              />

              <button
                onClick={handleLinkRoulo}
                className="rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-[9px] font-black text-cyan-200 transition hover:bg-cyan-400/20"
              >
                Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>

  {(profileActionMessage || rouloLinkMessage) && (
    <div className="border-t border-white/[0.05] px-4 py-2 text-center text-[9px] font-bold text-cyan-200/60">
      {profileActionMessage || rouloLinkMessage}
    </div>
  )}
</div>

        {/* =====================================================
            WAGER STATS
        ===================================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-300/30 bg-[radial-gradient(circle_at_top_left,rgba(0,245,255,0.07),transparent_32%),linear-gradient(135deg,rgba(0,18,23,0.99),rgba(0,0,0,0.99))] shadow-[0_0_34px_rgba(0,245,255,0.10)]">
<div className="border-b border-cyan-300/15 px-4 py-3.5">
<div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.20em] text-cyan-200 sm:text-xs">
  <span>📊</span>
  <span>Wager Stats</span>
</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3">
            <div className="m-3 rounded-xl border border-cyan-300/20 bg-black/45 px-4 py-5 text-center shadow-[inset_0_0_18px_rgba(0,245,255,0.025)]">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">
                Lifetime Wagered
              </div>

              <div className="mt-2 text-2xl font-black text-white">
                $
                {viewerProfileStats.lifetimeWagered.toLocaleString()}
              </div>

              <div className="mt-1 text-[9px] text-white/25">
                Total wagered on code
              </div>
            </div>

            <div className="m-3 rounded-xl border border-cyan-300/20 bg-black/45 px-4 py-5 text-center shadow-[inset_0_0_18px_rgba(0,245,255,0.025)]">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200/50">
                LB Wagered
              </div>

              <div className="mt-2 text-2xl font-black text-cyan-200">
                $
                {viewerProfileStats.leaderboardWagered.toLocaleString()}
              </div>

              <div className="mt-1 text-[9px] text-white/25">
                Regular leaderboard wager
              </div>
            </div>

            <div className="relative m-3 rounded-xl border border-yellow-300/25 bg-[linear-gradient(135deg,rgba(250,204,21,0.05),rgba(0,0,0,0.55))] px-4 py-5 text-center shadow-[inset_0_0_18px_rgba(250,204,21,0.025)]">
              {viewerProfileStats.isVip && (
                <div className="absolute right-2 top-2 rounded-full border border-yellow-300/25 bg-yellow-400/10 px-2 py-0.5 text-[7px] font-black text-yellow-200">
                  VIP ✓
                </div>
              )}

              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-yellow-200/60">
                LB Weighted Wager
              </div>

              <div className="mt-2 text-2xl font-black text-yellow-200 drop-shadow-[0_0_10px_rgba(253,224,71,0.15)]">
                $
                {viewerProfileStats.leaderboardWeightedWagered.toLocaleString()}
              </div>

              <div className="mt-1 text-[9px] text-white/30">
                VIP requirement: $
                {viewerProfileStats.vipRequirement.toLocaleString()}
              </div>
            </div>
          </div>

          {rouloLink?.roulo_username && (
            <div className="border-t border-cyan-300/10 px-4 py-3">
              <div className="mx-auto max-w-3xl">
                <div className="mb-1.5 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.12em]">
                  <span className="text-white/35">
                    VIP Progress
                  </span>

                  <span
                    className={
                      viewerProfileStats.isVip
                        ? "text-green-300"
                        : "text-yellow-200"
                    }
                  >
                    {viewerProfileStats.isVip
                      ? "QUALIFIED ✓"
                      : `$${viewerProfileStats.amountUntilVip.toLocaleString()} TO GO`}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(250,204,21,0.95))] shadow-[0_0_12px_rgba(34,211,238,0.25)] transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          (viewerProfileStats.leaderboardWeightedWagered /
                            Math.max(
                              1,
                              viewerProfileStats.vipRequirement
                            )) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =====================================================
            PRIZE PORTAL
        ===================================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-300/30 bg-[radial-gradient(circle_at_top_left,rgba(0,245,255,0.06),transparent_30%),linear-gradient(135deg,rgba(0,17,22,0.99),rgba(0,0,0,0.99))] shadow-[0_0_34px_rgba(0,245,255,0.10)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/15 px-4 py-3.5">
            <div>
<div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.20em] text-cyan-200 sm:text-xs">
  <span>🎁</span>
  <span>Prize Portal</span>
</div>
            </div>

            <div className="flex gap-2">
              <div className="rounded-lg border border-yellow-300/15 bg-yellow-400/[0.06] px-3 py-1.5 text-center">
                <div className="text-[7px] font-black uppercase text-yellow-200/45">
                  Pending
                </div>
                <div className="text-xs font-black text-yellow-200">
                  ${viewerRewardsPending.toLocaleString()}
                </div>
              </div>

              <div className="rounded-lg border border-green-300/15 bg-green-400/[0.06] px-3 py-1.5 text-center">
                <div className="text-[7px] font-black uppercase text-green-200/45">
                  Paid
                </div>
                <div className="text-xs font-black text-green-300">
                  ${viewerRewardsPaid.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {viewerRewards.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-sm font-black text-white/45">
                No prizes yet
              </div>
              <div className="mt-1 text-[10px] text-white/25">
                {viewerRewardsMessage ||
                  "Your winnings will appear here."}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {viewerRewards.map((reward: any) => {
                const isPaid = Boolean(reward.paid);
                const isClaimed =
                  Boolean(reward.claimed) && !isPaid;

                return (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.025]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-xs font-black text-white sm:text-sm">
                          {reward.title ||
                            reward.reward_title ||
                            "Giveaway Prize"}
                        </div>

                        <div
                          className={`rounded-full border px-2 py-0.5 text-[7px] font-black uppercase ${
                            isPaid
                              ? "border-green-300/20 bg-green-400/10 text-green-300"
                              : isClaimed
                              ? "border-orange-300/20 bg-orange-400/10 text-orange-200"
                              : "border-yellow-300/20 bg-yellow-400/10 text-yellow-200"
                          }`}
                        >
                          {isPaid
                            ? "Paid"
                            : isClaimed
                            ? "Waiting"
                            : "Ready"}
                        </div>
                      </div>

                      <div className="mt-1 text-[9px] text-white/30">
                        {reward.created_at
                          ? new Date(
                              reward.created_at
                            ).toLocaleString()
                          : "Recently"}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div
                        className={`text-base font-black sm:text-lg ${
                          isPaid
                            ? "text-green-300"
                            : isClaimed
                            ? "text-orange-200"
                            : "text-cyan-200"
                        }`}
                      >
                        $
                        {Number(
                          reward.amount || 0
                        ).toLocaleString()}
                      </div>

                      {!reward.claimed && !reward.paid ? (
                        <button
                          onClick={() =>
                            handleClaimReward(reward.id)
                          }
                          className="mt-1 rounded-md border border-yellow-300/30 bg-yellow-400/10 px-3 py-1 text-[8px] font-black uppercase tracking-wide text-yellow-200 transition hover:bg-yellow-400/20"
                        >
                          Claim Prize
                        </button>
                      ) : isPaid ? (
                        <div className="mt-1 text-[8px] font-black text-green-300">
                          PAID ✓
                        </div>
                      ) : (
                        <div className="mt-1 text-[8px] font-black text-orange-200">
                          PAYMENT PENDING
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )}
  </section>
)}

{activeSection === "slotwheel" && (
  <section className="space-y-4 sm:space-y-6">
    {/* TITLE */}
    <div className="mx-auto max-w-5xl text-center">
      <GlowTabTitle label="SLOT CALL OF THE DAY" />
    </div>

    {/* IDLE SCROLL ANIMATION */}
    <style>{`
      @keyframes viewerWheelIdleScroll {
        from {
          transform: translateY(0);
        }

        to {
          transform: translateY(-${slotCalls.length * SLOT_WHEEL_ITEM_HEIGHT}px);
        }
      }
    `}</style>

    {/* MAIN WHEEL CARD */}
    <div className="mx-auto max-w-5xl rounded-2xl border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(0,18,24,0.96),rgba(0,0,0,0.98))] p-3 shadow-[0_0_35px_rgba(0,245,255,0.12)] sm:rounded-[1.5rem] sm:p-5">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/60 sm:text-xs">
            Live Viewer Wheel
          </div>

          <div className="mt-1 text-sm font-black text-white sm:text-lg">
            Slot Calls
          </div>
        </div>

        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black text-cyan-100 sm:text-xs">
          {slotCalls.length} entries
        </div>
      </div>

      {/* WHEEL */}
      <div
        className="relative mx-auto mt-3 overflow-hidden rounded-xl border border-cyan-300/30 bg-black/90 shadow-[inset_0_0_30px_rgba(0,245,255,0.08),0_0_24px_rgba(0,245,255,0.10)]"
        style={{
          height: `${SLOT_WHEEL_VIEWPORT_HEIGHT}px`,
        }}
      >
        {/* TOP FADE */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-black via-black/85 to-transparent" />

        {/* BOTTOM FADE */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-black via-black/85 to-transparent" />

        {/* CENTER SELECTOR */}
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-30 h-11 -translate-y-1/2 rounded-lg border border-cyan-200/50 bg-cyan-400/12 shadow-[0_0_26px_rgba(0,245,255,0.22)]" />

        {/* LEFT ARROW */}
        <div className="pointer-events-none absolute left-0 top-1/2 z-40 -translate-y-1/2 border-y-[8px] border-l-[12px] border-y-transparent border-l-cyan-300" />

        {/* RIGHT ARROW */}
        <div className="pointer-events-none absolute right-0 top-1/2 z-40 -translate-y-1/2 border-y-[8px] border-r-[12px] border-y-transparent border-r-cyan-300" />

        {/* WHEEL CONTENT */}
        {slotCalls.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-white/35 sm:text-sm">
            No entries yet
          </div>
        ) : isSlotWheelSpinning ? (
          /* ACTUAL SPIN */
          <div
            className="transition-transform duration-[4200ms] ease-[cubic-bezier(0.12,0.72,0.08,1)]"
            style={{
              transform: `translateY(-${slotWheelRotation}px)`,
            }}
          >
            {slotWheelLoop.map((call, index) => (
              <div
                key={`spin-${call.id || call.username}-${call.slotName}-${index}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-white/5 px-3"
                style={{
                  height: `${SLOT_WHEEL_ITEM_HEIGHT}px`,
                }}
              >
                <div className="truncate text-[11px] font-black text-white sm:text-xs">
                  {call.username}
                </div>

                <div className="truncate text-right text-[11px] font-black text-cyan-100 sm:text-xs">
                  {call.slotName}
                </div>
              </div>
            ))}
          </div>
        ) : pickedSlotCall ? (
          /* LOCKED WINNER */
          <div>
            {slotWheelRestingRows.map(
              ({ call, isCenter, rowKey }) => (
                <div
                  key={rowKey}
                  className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-white/5 px-3 ${
                    isCenter
                      ? "bg-cyan-400/12 opacity-100"
                      : "opacity-50"
                  }`}
                  style={{
                    height: `${SLOT_WHEEL_ITEM_HEIGHT}px`,
                  }}
                >
                  <div className="truncate text-[11px] font-black text-white sm:text-xs">
                    {call.username}
                  </div>

                  <div className="truncate text-right text-[11px] font-black text-cyan-100 sm:text-xs">
                    {call.slotName}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          /* SLOW CONTINUOUS IDLE SCROLL */
          <div
            style={{
              animation: `viewerWheelIdleScroll ${Math.max(
                slotCalls.length * 2.5,
                8
              )}s linear infinite`,
              willChange: "transform",
            }}
          >
            {slotWheelLoop.map((call, index) => (
              <div
                key={`idle-main-${call.id || call.username}-${call.slotName}-${index}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-white/5 px-3"
                style={{
                  height: `${SLOT_WHEEL_ITEM_HEIGHT}px`,
                }}
              >
                <div className="truncate text-[11px] font-black text-white sm:text-xs">
                  {call.username}
                </div>

                <div className="truncate text-right text-[11px] font-black text-cyan-100 sm:text-xs">
                  {call.slotName}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TOP WINNER */}
      <div className="mx-auto mt-3 max-w-5xl overflow-hidden rounded-2xl border border-yellow-300/25 bg-[linear-gradient(135deg,rgba(120,85,0,0.28),rgba(0,0,0,0.92))] p-3 shadow-[0_0_28px_rgba(250,204,21,0.10)] sm:mt-4 sm:p-4">
        {topSlotCallWinner ? (
          <div className="grid grid-cols-[auto_minmax(0,0.8fr)_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
            <div className="text-lg sm:text-2xl">
              👑
            </div>

            <div className="min-w-0">
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-yellow-200/60 sm:text-[10px]">
                Top Winner
              </div>

              <div className="truncate text-[10px] font-black text-white sm:text-sm">
                {topSlotCallWinner.username}
              </div>
            </div>

            <div className="min-w-0 truncate text-right text-[9px] text-white/55 sm:text-xs">
              {topSlotCallWinner.slotName}
            </div>

            <div className="whitespace-nowrap text-right text-[11px] font-black text-yellow-300 sm:text-base">
              $
              {topSlotCallWinner.payout.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        ) : (
          <div className="py-2 text-center text-xs text-white/35">
            No top winner yet.
          </div>
        )}
      </div>

      {/* STATUS */}
      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.14em] sm:text-xs">
        <div className="text-white/45">
          Entries{" "}
          <span className="ml-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-cyan-100">
            {slotCalls.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_7px_rgba(110,231,183,1)]" />
          Live
        </div>
      </div>
    </div>

    {/* ENTRIES */}
    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/80 shadow-[0_0_24px_rgba(0,245,255,0.08)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3 sm:px-4">
        <div className="text-sm font-black uppercase tracking-[0.12em] text-white sm:text-base">
          Entries
        </div>

        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black text-cyan-100 sm:text-xs">
          {slotCalls.length}
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto p-2 sm:p-3">
        {slotCalls.length === 0 ? (
          <div className="py-6 text-center text-xs text-white/35 sm:text-sm">
            No entries yet.
          </div>
        ) : (
          <div className="grid gap-1">
            {slotCalls.map((call, index) => (
              <div
                key={`${call.id}-${index}`}
                className="grid grid-cols-[28px_minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 sm:grid-cols-[40px_minmax(0,1fr)_minmax(0,1.3fr)] sm:px-3"
              >
                <div className="truncate text-[9px] font-black text-cyan-300/55 sm:text-[10px]">
                  {index + 1}.
                </div>

                <div className="truncate text-[10px] font-black text-white sm:text-xs">
                  {call.username}
                </div>

                <div className="truncate text-right text-[10px] text-white/55 sm:text-xs">
                  {call.slotName}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* ROLLED / PAYOUT */}
    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/80 shadow-[0_0_24px_rgba(0,245,255,0.08)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3 sm:px-4">
        <div className="text-sm font-black uppercase tracking-[0.12em] text-white sm:text-base">
          Rolled / Payout
        </div>

        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black text-cyan-100 sm:text-xs">
          {slotCallResults.length}
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto p-2 sm:p-3">
        {slotCallResults.length === 0 ? (
          <div className="py-6 text-center text-xs text-white/35 sm:text-sm">
            No rolled slots yet.
          </div>
        ) : (
          <div className="grid gap-1">
            {slotCallResults.map((result, index) => (
              <div
                key={`${result.id}-${index}`}
                className="grid grid-cols-[24px_minmax(0,0.75fr)_minmax(0,1fr)_70px] items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-2 sm:grid-cols-[40px_minmax(0,0.9fr)_minmax(0,1.3fr)_100px] sm:px-3"
              >
                <div className="truncate text-[8px] font-black text-cyan-300/55 sm:text-[10px]">
                  {index + 1}.
                </div>

                <div className="truncate text-[9px] font-black text-white sm:text-xs">
                  {result.username}
                </div>

                <div className="truncate text-[9px] text-white/55 sm:text-xs">
                  {result.slotName}
                </div>

                <div className="truncate text-right text-[9px] font-black text-emerald-300 sm:text-xs">
                  $
                  {result.payout.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>
)}

{activeSection === "tournaments" && (
  <section className="space-y-4 sm:space-y-5">
<div className="mx-auto max-w-7xl text-center">
  <GlowTabTitle label="TOURNAMENTS" />

  <div className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-cyan-200/80 sm:text-base">
    {tournamentView === "bracket"
      ? bracket.title || "Tournament Bracket"
      : "Snake Draft"}
  </div>

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
          <div className="mx-auto max-w-7xl">
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
                      className={`w-[190px] shrink-0 sm:w-[260px] ${topPadding}`}
                    >
                      <div className="mb-3 text-center">
                        <div className="inline-flex max-w-full rounded-full border border-cyan-300/15 bg-black/85 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200 sm:text-[10px]">
                          <span className="truncate">{round.name}</span>
                        </div>
                      </div>

                      <div
                        className={`space-y-2 ${
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
                              className="rounded-xl border border-white/10 bg-black/90 p-2.5 shadow-[0_0_12px_rgba(0,0,0,0.25)] sm:p-3"
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
          </div>
        )}
      </>
    )}

    {tournamentView === "snake" && (
      <div className="mx-auto max-w-7xl rounded-2xl border border-cyan-300/15 bg-black/85 p-4 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm sm:rounded-[1.5rem] sm:p-6">
        <div className="text-center">
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
  <section className="space-y-2 sm:space-y-3">
    <div className="mx-auto max-w-6xl text-center">
      <GlowTabTitle label="SLOT PICKER" />
    </div>

    {/* COMPACT PROVIDERS */}
    <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-cyan-300/15 bg-black/85 shadow-[0_0_20px_rgba(0,245,255,0.07)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-5 sm:py-3.5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/75 sm:text-[13px]">
            Providers
          </div>
          <div className="text-[10px] font-bold text-white/45 sm:text-[12px]">
            Select any combination
          </div>
        </div>

        <div className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-100/80 sm:text-[11px]">
          {filteredSlots.length} Slots
        </div>
      </div>

      <div className="p-2.5 sm:p-3.5">
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-2.5">
          {slotProviders.map((provider) => {
            const active = selectedProviders.includes(provider);
            const logo = providerLogos[provider];
            const providerSlotCount = slotData.filter(
              (slot) => slot.provider === provider
            ).length;

            return (
              <button
                key={provider}
                onClick={() => toggleSlotProvider(provider)}
                disabled={isPickingSlot}
                className={`group relative flex min-h-[46px] items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition-all duration-200 sm:min-h-[56px] sm:px-3 sm:py-2 ${
                  active
                    ? "border-cyan-300/45 bg-cyan-400/[0.10] text-white shadow-[0_0_9px_rgba(0,245,255,0.10)]"
                    : "border-white/[0.07] bg-black/70 text-white/50 hover:border-cyan-300/20 hover:text-white/80"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-black/75 sm:h-11 sm:w-11 ${
                    active ? "border-cyan-300/25" : "border-white/10"
                  }`}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt={provider}
                      className={`h-6 w-6 object-contain sm:h-8 sm:w-8 ${
                        active ? "opacity-100" : "opacity-50"
                      }`}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-[10px] font-black text-cyan-200">
                      {provider.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-[9px] font-black leading-tight sm:text-[13px]">
                    {provider}
                  </div>
                  <div className="mt-0.5 text-[8px] leading-none text-white/40 sm:text-[10px]">
                    {providerSlotCount}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.05] pt-2.5">
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-white/55 sm:text-[11px]">
            {selectedProviders.length === 0
              ? "All providers active"
              : `${selectedProviders.length} selected`}
          </span>

          <button
            onClick={() => {
              setSelectedProviders([]);
              setPickedSlot(null);
              setSlotPickerClawIndex(null);
              setSlotPickerClawDropping(false);
              setSlotPickerWinnerRevealed(false);
            }}
            disabled={isPickingSlot}
            className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/65 transition hover:border-cyan-300/25 hover:text-cyan-100 disabled:opacity-40 sm:text-[11px]"
          >
            Reset
          </button>
        </div>
      </div>
    </div>

    {/* COMPACT CLAW MACHINE */}
    <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(0,18,22,0.97),rgba(0,0,0,0.99))] shadow-[0_0_30px_rgba(0,245,255,0.10)]">
      <div className="flex items-center justify-between border-b border-cyan-300/10 px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-cyan-200/65 sm:text-[11px]">
            Random Slot Machine
          </div>
          <div className="mt-1 text-sm font-black tracking-[0.08em] text-white sm:text-lg">
            {isPickingSlot
              ? slotPickerClawDropping
                ? "GRABBING..."
                : slotPickerClawIndex !== null
                ? "LOCKED ON..."
                : "SPINNING..."
              : slotPickerWinnerRevealed
              ? "WINNER SELECTED"
              : "READY"}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.1em] text-white/50 sm:text-[11px]">
          <span
            className={`h-2 w-2 rounded-full ${
              isPickingSlot
                ? "animate-pulse bg-yellow-300 shadow-[0_0_7px_rgba(253,224,71,1)]"
                : "bg-emerald-300 shadow-[0_0_7px_rgba(110,231,183,1)]"
            }`}
          />
          {filteredSlots.length} eligible
        </div>
      </div>

      <div className="p-2.5 sm:p-4">
        <div className="relative overflow-hidden rounded-lg border border-cyan-300/15 bg-black/95 shadow-[inset_0_0_40px_rgba(0,245,255,0.04)] [--slot-gap:8px] sm:[--slot-gap:10px]">
          {/* CLAW RAIL */}
          <div className="relative h-[70px] border-b border-white/[0.05] bg-[linear-gradient(180deg,rgba(0,245,255,0.035),transparent)] sm:h-[82px]">
            <div className="absolute left-[4%] right-[4%] top-3 h-[3px] rounded-full border border-cyan-300/20 bg-black/80 sm:top-4" />

            <div
              className="absolute top-1.5 z-30 transition-[left] duration-500 ease-in-out sm:top-2"
              style={{
                left:
                  slotPickerClawIndex === null
                    ? "50%"
                    : `calc(${slotPickerClawIndex} * (((100% - (4 * var(--slot-gap))) / 5) + var(--slot-gap)) + (((100% - (4 * var(--slot-gap))) / 5) / 2))`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="mx-auto h-5 w-8 rounded border border-cyan-200/40 bg-[#071619] shadow-[0_0_10px_rgba(0,245,255,0.20)] sm:h-6 sm:w-10">
                <div className="mx-auto mt-1 h-1 w-4 rounded-full bg-cyan-300/65 sm:w-5" />
              </div>

              <div
                className={`mx-auto w-[2px] bg-cyan-100/65 transition-all duration-500 ${
                  slotPickerClawDropping ? "h-[145px] sm:h-[185px]" : "h-[13px] sm:h-[16px]"
                }`}
              />

              <div className="relative mx-auto h-5 w-9 sm:h-6 sm:w-10">
                <div
                  className={`absolute left-1 top-0 h-5 w-[2px] origin-top rounded bg-cyan-100/75 transition-transform duration-300 ${
                    slotPickerClawDropping ? "rotate-[16deg]" : "rotate-[28deg]"
                  }`}
                />
                <div
                  className={`absolute right-1 top-0 h-5 w-[2px] origin-top rounded bg-cyan-100/75 transition-transform duration-300 ${
                    slotPickerClawDropping ? "-rotate-[16deg]" : "-rotate-[28deg]"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* BELT VIEWPORT - exactly 5 full cards visible, 6th stays off screen */}
          <div className="relative overflow-hidden px-2 py-3 sm:px-2.5 sm:py-3.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-5 bg-gradient-to-r from-black to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-5 bg-gradient-to-l from-black to-transparent" />

            <div
              className="flex gap-[var(--slot-gap)]"
              style={{
                transform: slotPickerSliding
                  ? "translateX(calc(-1 * ((((100% - (4 * var(--slot-gap))) / 5)) + var(--slot-gap))))"
                  : "translateX(0)",
                transition: slotPickerSliding
                  ? `transform ${slotPickerTransitionMs}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                  : "none",
              }}
            >
              {slotPickerBelt.map((slot, index) => {
                const visibleIndex = index;
                const isWinner =
                  slotPickerWinnerRevealed &&
                  slotPickerClawIndex === visibleIndex &&
                  visibleIndex < 5;

                return (
                  <div
                    key={`${slot.provider}-${slot.name}-${index}`}
                    className={`relative shrink-0 overflow-hidden rounded-lg border bg-black transition-all duration-500 ${
                      isWinner
                        ? "-translate-y-4 scale-[1.045] border-emerald-300 shadow-[0_0_28px_rgba(110,231,183,0.58)]"
                        : "border-white/10"
                    }`}
                    style={{
                      flexBasis: "calc((100% - (4 * var(--slot-gap))) / 5)",
                    }}
                  >
                    <div className="aspect-[4/5] overflow-hidden bg-[#060606]">
                      {slot.image ? (
                        <img
                          src={slot.image}
                          alt={slot.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-lg opacity-30">
                          🎰
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/[0.05] bg-black/95 px-1.5 py-1.5 text-center">
                      <div className="truncate text-[8px] font-black text-white sm:text-[11px]">
                        {slot.name}
                      </div>
                      <div className="mt-0.5 truncate text-[7px] font-bold uppercase text-cyan-100/45 sm:text-[9px]">
                        {slot.provider}
                      </div>
                    </div>

                    {isWinner && (
                      <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full border border-emerald-200/50 bg-black/90 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-emerald-200 sm:text-[9px]">
                        Winner
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-1.5 h-1.5 rounded-full border border-cyan-300/10 bg-[repeating-linear-gradient(90deg,#071315_0px,#071315_12px,#0d2a2f_12px,#0d2a2f_15px)]" />
          </div>
        </div>

        {pickedSlot && slotPickerWinnerRevealed && (
          <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.035] px-3 py-2 text-center">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200/60 sm:text-[11px]">
              Selected
            </span>
            <span className="truncate text-[11px] font-black text-[#9fffd7] sm:text-[14px]">
              {pickedSlot.name}
            </span>
            <span className="hidden text-[9px] font-bold uppercase text-white/45 sm:inline">
              {pickedSlot.provider}
            </span>
          </div>
        )}

        <button
          onClick={pickRandomSlot}
          disabled={isPickingSlot || filteredSlots.length === 0}
          className={`mt-2 w-full rounded-lg border px-4 py-3 text-sm font-black uppercase tracking-[0.16em] transition-all duration-200 sm:py-3.5 sm:text-base ${
            isPickingSlot
              ? "cursor-wait border-cyan-300/20 bg-cyan-400/[0.07] text-cyan-100/50"
              : "border-cyan-300/45 bg-[linear-gradient(180deg,rgba(0,245,255,0.23),rgba(0,110,130,0.16))] text-[#baffdf] shadow-[0_0_20px_rgba(0,245,255,0.12)] hover:border-cyan-200/70 hover:bg-cyan-400/20"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isPickingSlot ? "SPINNING..." : "SPIN"}
        </button>
      </div>
    </div>
  </section>
)}

{activeSection === "admin" && adminAllowed && (
  <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-2 overflow-x-hidden px-0 sm:gap-3 [&_input]:max-w-full [&_select]:max-w-full [&_textarea]:max-w-full">
    <div>
      <div className="min-w-0 px-1 text-center">
        <GlowTabTitle label="ADMIN CONTROL CENTER" />
      </div>

      <div className="mt-3 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/85 p-2.5 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-sm sm:mt-6 sm:rounded-[1.5rem] sm:p-5">
        <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-[11px] font-semibold leading-5 text-cyan-100/75 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          {viewerDisplayName} control center is active.
        </div>
      </div>

      <div className="mt-3 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-cyan-300/15 bg-black/70 p-1.5 sm:mt-4">
        <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { id: "giveaway", label: "Giveaways" },
            { id: "prizePortal", label: "Prize Portal" },
            { id: "tournament", label: "Tournaments" },
            { id: "snakeDraft", label: "Snake Drafts" },
            { id: "slotWheel", label: "Slot Call Wheel" },
          ].map((tab) => {
            const active = activeAdminTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveAdminTab(
                    tab.id as
                      | "giveaway"
                      | "prizePortal"
                      | "tournament"
                      | "snakeDraft"
                      | "slotWheel"
                  )
                }
                className={`min-w-0 whitespace-normal break-words rounded-lg border px-1.5 py-2 text-[9px] font-black uppercase leading-tight tracking-[0.04em] transition sm:px-3 sm:text-xs sm:tracking-[0.08em] ${
                  active
                    ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100 shadow-[0_0_16px_rgba(0,245,255,0.12)]"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:border-cyan-300/20 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 grid w-full min-w-0 max-w-full gap-2 overflow-x-hidden sm:mt-3 sm:gap-3">
        <details
          open={activeAdminTab === "giveaway"}
          className={`${activeAdminTab === "giveaway" ? "block" : "hidden"} min-w-0 rounded-xl border border-cyan-300/15 bg-black/85 p-2 shadow-[0_0_20px_rgba(0,245,255,0.07)] backdrop-blur-sm sm:p-4`}
        >
          <summary className="hidden">Giveaway System</summary>
          <GiveawayAdmin isAdmin={isAdmin} />
        </details>

<details
  open={activeAdminTab === "prizePortal"}
  className={`${activeAdminTab === "prizePortal" ? "block" : "hidden"} min-w-0 max-w-full overflow-hidden rounded-xl border border-cyan-300/15 bg-black/85 p-3 shadow-[0_0_20px_rgba(0,245,255,0.07)] backdrop-blur-sm sm:p-4`}
>
  <summary className="hidden">Prize Portal Manager</summary>

  <div className="mt-4 grid gap-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <SectionLabel>Prize Claims</SectionLabel>
        <h2 className="mt-2 text-xl font-black tracking-wide sm:text-3xl">
          CLAIMED PRIZES
        </h2>
        <div className="mt-1 text-xs text-white/45 sm:text-sm">
          Pay claimed prizes and view paid history.
        </div>
      </div>

      <ActionButton onClick={loadAdminRewards} variant="dark" className="w-full md:w-auto">
        Refresh
      </ActionButton>
    </div>

    <input
      value={adminRewardsSearch}
      onChange={(e) => setAdminRewardsSearch(e.target.value)}
      placeholder="Search username, platform, title..."
      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
    />

    {adminRewardsMessage && (
      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
        {adminRewardsMessage}
      </div>
    )}

    {/* MANUAL DISCORD GIVEAWAY */}
<div className="rounded-xl border border-cyan-300/15 bg-black/45 p-3">
  <div className="mb-3 flex items-center justify-between">
    <div>
      <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
        GIVEAWAYS
      </div>
      <div className="mt-1 text-xs text-white/40">
        Manually add a prize to someone’s Prize Portal.
      </div>
    </div>
  </div>

  <div className="grid gap-2 sm:grid-cols-[120px_1fr_120px_1fr_auto]">
    <select
      value={manualRewardPlatform}
      onChange={(e) =>
        setManualRewardPlatform(e.target.value as "twitch" | "kick")
      }
      className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white outline-none"
    >
      <option value="twitch">Twitch</option>
      <option value="kick">Kick</option>
    </select>

    <input
      value={manualRewardUsername}
      onChange={(e) => setManualRewardUsername(e.target.value)}
      placeholder="username"
      className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none"
    />

    <input
      value={manualRewardAmount}
      onChange={(e) => setManualRewardAmount(e.target.value)}
      placeholder="$ amount"
      type="number"
      className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none"
    />

<select
  value={manualRewardType}
  onChange={(e) => setManualRewardType(e.target.value)}
  className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs font-black text-white outline-none"
>
  <option value="discord_giveaway">
    🎁 Discord Giveaway
  </option>

  <option value="twitter_giveaway">
    𝕏 Twitter Giveaway
  </option>

  <option value="instagram_giveaway">
    📸 Instagram Giveaway
  </option>

  <option value="slot_call">
    🎰 Slot Call of the Day
  </option>

  <option value="prediction">
    🎯 Predictions Winner
  </option>

  <option value="vip_tournament">
    👑 VIP Tournament
  </option>
</select>

    <ActionButton
      onClick={handleCreateManualReward}
      variant="green"
      className="min-h-[36px] px-4 text-[10px]"
    >
      Add Prize
    </ActionButton>
  </div>
</div>

{/* UNCLAIMED REWARDS */}
<div className="overflow-hidden rounded-xl border border-yellow-300/20 bg-black/45">
  <div className="flex items-center justify-between border-b border-yellow-300/10 px-3 py-2">
    <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-200">
      Unclaimed Rewards
    </div>

    <div className="rounded-full border border-yellow-300/20 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-black text-yellow-200">
      {
        filteredAdminRewards.filter(
          (reward) => !reward.claimed && !reward.paid
        ).length
      }
    </div>
  </div>

  {filteredAdminRewards.filter(
    (reward) => !reward.claimed && !reward.paid
  ).length === 0 ? (
    <div className="p-4 text-center text-xs text-white/40">
      No unclaimed rewards.
    </div>
  ) : (
    <div className="divide-y divide-white/5">
      {filteredAdminRewards
        .filter((reward) => !reward.claimed && !reward.paid)
        .map((reward) => (
          <div
            key={reward.id}
            className="flex items-start justify-between gap-4 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-black text-white">
                  {reward.display_name ||
                    reward.twitch_username ||
                    reward.kick_username}
                </div>

                <div
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${
                    reward.platform === "kick"
                      ? "border-green-300/25 bg-green-400/10 text-green-200"
                      : "border-purple-300/25 bg-purple-400/10 text-purple-200"
                  }`}
                >
                  {reward.platform === "kick" ? "Kick" : "Twitch"}
                </div>
              </div>

              <div className="mt-1 text-[10px] text-white/40">
                Roulo: {reward.roulo_username || "Not linked"}
              </div>

              <div className="mt-1 text-[10px] text-white/35">
                {reward.title || "Prize"} •{" "}
                {reward.created_at
                  ? new Date(reward.created_at).toLocaleString()
                  : "Recently"}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="text-base font-black text-cyan-200">
                ${Number(reward.amount || 0).toLocaleString()}
              </div>

              <ActionButton
                onClick={() => handleAdminDeleteReward(reward.id)}
                variant="red"
                className="h-8 px-3 text-[9px]"
              >
                Delete
              </ActionButton>
            </div>
          </div>
        ))}
    </div>
  )}
</div>

    {/* CLAIMED / UNPAID */}
    <div className="overflow-hidden rounded-xl border border-orange-300/20 bg-black/45">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-orange-200">
          Claimed / Unpaid
        </div>
        <div className="rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-0.5 text-[10px] font-black text-orange-200">
          {filteredAdminRewards.filter((r) => r.claimed && !r.paid).length}
        </div>
      </div>

      {filteredAdminRewards.filter((r) => r.claimed && !r.paid).length === 0 ? (
        <div className="p-4 text-center text-xs text-white/40">
          No claimed prizes waiting for payment.
        </div>
      ) : (
<div className="divide-y divide-white/5">
  {filteredAdminRewards
    .filter((reward) => reward.claimed && !reward.paid)
    .map((reward) => (
      <div
        key={reward.id}
        className="flex items-start justify-between gap-4 p-3"
      >
        {/* LEFT SIDE */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-black text-white">
              {reward.display_name ||
                reward.twitch_username ||
                reward.kick_username}
            </div>

            <div
              className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${
                reward.platform === "kick"
                  ? "border-green-300/25 bg-green-400/10 text-green-200"
                  : "border-purple-300/25 bg-purple-400/10 text-purple-200"
              }`}
            >
              {reward.platform === "kick" ? "Kick" : "Twitch"}
            </div>
          </div>

          <div className="mt-1 text-[11px] text-white/45">
            Roulo: {reward.roulo_username || "Not linked"}
          </div>

          <div className="mt-1 text-[10px] text-white/35">
            {reward.title || "Chat Giveaway"} •{" "}
            {reward.claimed_at
              ? new Date(reward.claimed_at).toLocaleString()
              : "Just claimed"}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex flex-col items-end justify-between">
          <div className="text-base font-black text-cyan-200">
            ${Number(reward.amount || 0).toLocaleString()}
          </div>

<div className="mt-2 flex items-center gap-2">
  <ActionButton
    onClick={() => handleAdminMarkRewardPaid(reward.id)}
    variant="green"
    className="h-8 px-4 text-[9px]"
  >
    Mark Paid
  </ActionButton>

  <ActionButton
    onClick={() => handleAdminDeleteReward(reward.id)}
    variant="red"
    className="h-8 px-3 text-[9px]"
  >
    Delete
  </ActionButton>
</div>
        </div>
      </div>
    ))}
</div>
      )}
    </div>

    {/* PAID HISTORY */}
    <div className="overflow-hidden rounded-xl border border-cyan-300/15 bg-black/35">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
          Paid History
        </div>
        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black text-cyan-200">
          {filteredAdminRewards.filter((r) => r.paid).length}
        </div>
      </div>

      {filteredAdminRewards.filter((r) => r.paid).length === 0 ? (
        <div className="p-4 text-center text-xs text-white/40">
          No paid prizes yet.
        </div>
      ) : (
        <div className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
          {filteredAdminRewards
            .filter((reward) => reward.paid)
            .map((reward) => (
              <div key={reward.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">
                    {reward.display_name || reward.twitch_username || reward.kick_username}
                  </div>
                  <div className="mt-1 text-[11px] text-white/40">
                    {reward.title || "Chat Giveaway"} •{" "}
                    {reward.paid_at
                      ? new Date(reward.paid_at).toLocaleString()
                      : "Paid"}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-black text-cyan-200">
                    ${Number(reward.amount || 0).toLocaleString()}
                  </div>
                  <button
                    onClick={() => handleAdminMarkRewardPending(reward.id)}
                    className="mt-1 text-[10px] font-black text-white/40 hover:text-white"
                  >
                    Undo
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  </div>
</details>

        <details
          open={activeAdminTab === "tournament"}
          className={`${activeAdminTab === "tournament" ? "block" : "hidden"} min-w-0 max-w-full overflow-hidden rounded-xl border border-cyan-300/15 bg-black/85 p-2.5 shadow-[0_0_20px_rgba(0,245,255,0.07)] backdrop-blur-sm sm:p-3`}
        >
          <summary className="hidden">Tournament Editor</summary>

          <div className="grid gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <SectionLabel>Tournament</SectionLabel>
                <h2 className="mt-1 text-lg font-black tracking-wide text-white sm:text-xl">
                  EDIT BRACKET
                </h2>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-2">
                <label className="min-w-[170px] flex-1 sm:max-w-[280px]">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Title
                  </span>
                  <input
                    value={bracket.title}
                    onChange={(e) => updateBracketTitle(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="Tournament title"
                    className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/45 px-2.5 text-xs text-white outline-none focus:border-cyan-300/35 disabled:opacity-40"
                  />
                </label>

                <label className="w-[110px]">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Teams
                  </span>
                  <select
                    value={generatorTeamCount}
                    onChange={(e) => setGeneratorTeamCount(e.target.value)}
                    disabled={!isAdmin}
                    className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/45 px-2 text-xs text-white outline-none disabled:opacity-40"
                  >
                    {Array.from({ length: 15 }, (_, index) => index + 2).map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </select>
                </label>

                <ActionButton
                  onClick={handleGenerateBracket}
                  disabled={!isAdmin}
                  variant="green"
                  className="min-h-[36px] px-3 py-1.5 text-[9px]"
                >
                  Generate
                </ActionButton>
              </div>
            </div>

            <div className="max-h-[560px] overflow-y-auto rounded-xl border border-white/8 bg-black/35 p-2">
              <div className="grid gap-2 xl:grid-cols-2">
                {bracket.rounds.map((round) => (
                  <div
                    key={round.id}
                    className="rounded-lg border border-white/10 bg-white/[0.025] p-2"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">
                        {round.name}
                      </div>
                      <input
                        value={round.name}
                        onChange={(e) => updateRoundName(round.id, e.target.value)}
                        disabled={!isAdmin}
                        className="h-7 w-[130px] rounded-md border border-white/10 bg-black/45 px-2 text-[10px] text-white outline-none focus:border-cyan-300/35 disabled:opacity-40"
                      />
                    </div>

                    <div className="grid gap-1.5">
                      {round.matches.map((match) => (
                        <div
                          key={match.id}
                          className="rounded-lg border border-white/8 bg-black/35 p-2"
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                              {match.id.toUpperCase()}
                            </span>
                            <span className="max-w-[150px] truncate text-[9px] text-cyan-200/70">
                              {match.winner ? `Winner: ${match.winner}` : "No winner"}
                            </span>
                          </div>

                          <div className="grid grid-cols-[1fr_72px] gap-1.5 sm:grid-cols-[1fr_80px_1fr_80px]">
                            <input
                              value={match.player1}
                              onChange={(e) => updateMatchField(round.id, match.id, "player1", e.target.value)}
                              disabled={!isAdmin || match.player1 === "BYE"}
                              placeholder="Player 1"
                              className="h-8 min-w-0 rounded-md border border-white/10 bg-black/45 px-2 text-[11px] text-white outline-none focus:border-cyan-300/35 disabled:opacity-40"
                            />
                            <input
                              value={match.player1Amount || ""}
                              onChange={(e) => updateMatchField(round.id, match.id, "player1Amount", e.target.value.replace(/[^0-9.]/g, ""))}
                              disabled={!isAdmin || match.player1 === "BYE"}
                              placeholder="$"
                              className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-[11px] text-white outline-none focus:border-yellow-300/35 disabled:opacity-40"
                            />
                            <input
                              value={match.player2}
                              onChange={(e) => updateMatchField(round.id, match.id, "player2", e.target.value)}
                              disabled={!isAdmin || match.player2 === "BYE"}
                              placeholder="Player 2"
                              className="h-8 min-w-0 rounded-md border border-white/10 bg-black/45 px-2 text-[11px] text-white outline-none focus:border-cyan-300/35 disabled:opacity-40"
                            />
                            <input
                              value={match.player2Amount || ""}
                              onChange={(e) => updateMatchField(round.id, match.id, "player2Amount", e.target.value.replace(/[^0-9.]/g, ""))}
                              disabled={!isAdmin || match.player2 === "BYE"}
                              placeholder="$"
                              className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-[11px] text-white outline-none focus:border-yellow-300/35 disabled:opacity-40"
                            />
                          </div>

                          <div className="mt-1.5 grid grid-cols-3 gap-1">
                            <ActionButton
                              onClick={() => selectMatchWinner(round.id, match.id, match.player1)}
                              disabled={!isAdmin || !match.player1.trim() || match.player1 === "BYE"}
                              variant={match.winner === match.player1 ? "green" : "dark"}
                              className="min-h-[28px] px-1.5 py-1 text-[8px]"
                            >
                              Pick 1
                            </ActionButton>
                            <ActionButton
                              onClick={() => selectMatchWinner(round.id, match.id, match.player2)}
                              disabled={!isAdmin || !match.player2.trim() || match.player2 === "BYE"}
                              variant={match.winner === match.player2 ? "green" : "dark"}
                              className="min-h-[28px] px-1.5 py-1 text-[8px]"
                            >
                              Pick 2
                            </ActionButton>
                            <ActionButton
                              onClick={() => clearMatchWinner(round.id, match.id)}
                              disabled={!isAdmin}
                              variant="red"
                              className="min-h-[28px] px-1.5 py-1 text-[8px]"
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
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton onClick={saveBracket} disabled={!isAdmin} variant="green" className="min-h-[34px] px-4 py-1.5 text-[9px]">
                Save
              </ActionButton>
              <ActionButton onClick={resetBracket} disabled={!isAdmin} variant="red" className="min-h-[34px] px-4 py-1.5 text-[9px]">
                Reset
              </ActionButton>
              <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-white/60">
                {bracketMessage || "Generate, edit, pick winners, then save."}
              </div>
            </div>
          </div>
        </details>
        <details
          open={activeAdminTab === "snakeDraft"}
          className={`${activeAdminTab === "snakeDraft" ? "block" : "hidden"} min-w-0 max-w-full overflow-hidden rounded-xl border border-cyan-300/15 bg-black/85 p-3 shadow-[0_0_20px_rgba(0,245,255,0.07)] backdrop-blur-sm sm:p-4`}
        >
  <summary className="hidden">Snake Draft</summary>

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
  open={activeAdminTab === "slotWheel"}
  className={`${
    activeAdminTab === "slotWheel" ? "block" : "hidden"
  } min-w-0 max-w-full overflow-hidden rounded-xl border border-cyan-300/15 bg-black/85 p-2.5 shadow-[0_0_20px_rgba(0,245,255,0.07)] backdrop-blur-sm sm:p-3`}
>
  <summary className="hidden">Slot Call Wheel</summary>

  {/* SAME SMOOTH IDLE SCROLL AS VIEWER WHEEL */}
  <style>{`
    @keyframes adminWheelIdleScroll {
      from {
        transform: translateY(0);
      }

      to {
        transform: translateY(-${slotCalls.length * SLOT_WHEEL_ITEM_HEIGHT}px);
      }
    }
  `}</style>

  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
    {/* LEFT SIDE */}
    <div className="rounded-xl border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(0,245,255,0.07),rgba(0,0,0,0.94))] p-3 shadow-[0_0_28px_rgba(0,245,255,0.10)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionLabel>Slot Call Wheel</SectionLabel>

          <div className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-cyan-100 sm:text-xl">
            Pick A Winner
          </div>
        </div>

        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black text-cyan-100">
          {slotCalls.length} entries
        </div>
      </div>

      {/* WHEEL */}
      <div
        className="relative mx-auto mt-3 overflow-hidden rounded-xl border border-cyan-300/25 bg-black/90 shadow-[inset_0_0_24px_rgba(0,245,255,0.08)]"
        style={{
          height: `${SLOT_WHEEL_VIEWPORT_HEIGHT}px`,
        }}
      >
        {/* TOP FADE */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-black via-black/85 to-transparent" />

        {/* BOTTOM FADE */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-black via-black/85 to-transparent" />

        {/* CENTER SELECTOR */}
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-30 h-11 -translate-y-1/2 rounded-lg border border-cyan-200/50 bg-cyan-400/12 shadow-[0_0_26px_rgba(0,245,255,0.22)]" />

        {/* LEFT ARROW */}
        <div className="pointer-events-none absolute left-0 top-1/2 z-40 -translate-y-1/2 border-y-[8px] border-l-[12px] border-y-transparent border-l-cyan-300" />

        {/* RIGHT ARROW */}
        <div className="pointer-events-none absolute right-0 top-1/2 z-40 -translate-y-1/2 border-y-[8px] border-r-[12px] border-y-transparent border-r-cyan-300" />

        {/* WHEEL CONTENT */}
        {slotCalls.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-white/40">
            Waiting for slot calls...
          </div>
        ) : isSlotWheelSpinning ? (
          /* ACTUAL SPIN */
          <div
            className="transition-transform duration-[4200ms] ease-[cubic-bezier(0.12,0.72,0.08,1)]"
            style={{
              transform: `translateY(-${slotWheelRotation}px)`,
            }}
          >
            {slotWheelLoop.map((call, index) => (
              <div
                key={`admin-spin-${call.id || call.username}-${call.slotName}-${index}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-white/5 px-3"
                style={{
                  height: `${SLOT_WHEEL_ITEM_HEIGHT}px`,
                }}
              >
                <div className="truncate text-[11px] font-black text-white sm:text-xs">
                  {call.username}
                </div>

                <div className="truncate text-right text-[11px] font-black text-cyan-100 sm:text-xs">
                  {call.slotName}
                </div>
              </div>
            ))}
          </div>
        ) : pickedSlotCall ? (
          /* LOCKED WINNER */
          <div>
            {slotWheelRestingRows.map(
              ({ call, isCenter, rowKey }) => (
                <div
                  key={rowKey}
                  className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-white/5 px-3 ${
                    isCenter
                      ? "bg-cyan-400/12 opacity-100"
                      : "opacity-55"
                  }`}
                  style={{
                    height: `${SLOT_WHEEL_ITEM_HEIGHT}px`,
                  }}
                >
                  <div className="truncate text-[11px] font-black text-white sm:text-xs">
                    {call.username}
                  </div>

                  <div className="truncate text-right text-[11px] font-black text-cyan-100 sm:text-xs">
                    {call.slotName}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          /* SMOOTH CONTINUOUS IDLE SCROLL */
          <div
            style={{
              animation: `adminWheelIdleScroll ${Math.max(
                slotCalls.length * 2.5,
                8
              )}s linear infinite`,
              willChange: "transform",
            }}
          >
            {slotWheelLoop.map((call, index) => (
              <div
                key={`admin-idle-${call.id || call.username}-${call.slotName}-${index}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-white/5 px-3"
                style={{
                  height: `${SLOT_WHEEL_ITEM_HEIGHT}px`,
                }}
              >
                <div className="truncate text-[11px] font-black text-white sm:text-xs">
                  {call.username}
                </div>

                <div className="truncate text-right text-[11px] font-black text-cyan-100 sm:text-xs">
                  {call.slotName}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONTROLS */}
      <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
        <ActionButton
          onClick={handleSpinSlotWheel}
          disabled={
            isSlotWheelSpinning ||
            Boolean(pickedSlotCall) ||
            slotCalls.length === 0
          }
          variant="green"
          className="min-h-[38px] text-[10px]"
        >
          {isSlotWheelSpinning ? "Spinning..." : "Spin Wheel"}
        </ActionButton>

        <ActionButton
          onClick={handleShuffleSlotWheel}
          disabled={
            slotCalls.length <= 1 ||
            isSlotWheelSpinning ||
            Boolean(pickedSlotCall)
          }
          variant="purple"
          className="min-h-[38px] px-3 text-[9px]"
        >
          Shuffle
        </ActionButton>

        <ActionButton
          onClick={handleRemovePickedSlot}
          disabled={!pickedSlotCall || isSlotWheelSpinning}
          variant="red"
          className="min-h-[38px] px-3 text-[9px]"
        >
          Remove Winner
        </ActionButton>
      </div>

      {/* WINNER / PAYOUT */}
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
        {pickedSlotCall ? (
          <>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300/70">
              Winner
            </div>

            <div className="mt-1 truncate text-xl font-black text-cyan-200 drop-shadow-[0_0_12px_rgba(0,245,255,0.65)] sm:text-2xl">
              {pickedSlotCall.slotName}
            </div>

            <div className="mt-0.5 truncate text-[11px] text-white/45">
              called by {pickedSlotCall.username}
            </div>

            <div className="mx-auto mt-4 max-w-sm">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
                Payout
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center rounded-lg border border-cyan-300/15 bg-black/60 px-3">
                  <span className="mr-1 text-sm font-black text-cyan-200/60">
                    $
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={slotPayoutInput}
                    onChange={(e) =>
                      setSlotPayoutInput(e.target.value)
                    }
                    placeholder="0.00"
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm font-black text-white outline-none placeholder:text-white/20"
                  />
                </div>

                <ActionButton
                  onClick={async () => {
                    const payout = Number(slotPayoutInput);

                    if (
                      !Number.isFinite(payout) ||
                      payout < 0
                    ) {
                      alert("Enter a valid payout amount.");
                      return;
                    }

                    const res = await fetch(
                      "/api/slot-calls",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type":
                            "application/json",
                        },
                        body: JSON.stringify({
                          action: "saveResult",
                          username:
                            pickedSlotCall.username,
                          slotName:
                            pickedSlotCall.slotName,
                          payout,
                        }),
                      }
                    );

                    const data = await res.json();

                    if (!res.ok || !data.ok) {
                      alert(
                        data.error ||
                          "Failed to save payout."
                      );
                      return;
                    }

                    setSlotPayoutInput("");

                    await loadSlotCalls();

                    alert("Rolled slot saved.");
                  }}
                  variant="green"
                  className="min-h-[36px] shrink-0 px-3 text-[9px]"
                >
                  Save Payout
                </ActionButton>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[48px] items-center justify-center text-xs font-semibold text-white/40">
            {slotCalls.length === 0
              ? "No entries yet."
              : "Ready to spin."}
          </div>
        )}
      </div>
    </div>

    {/* RIGHT SIDE */}
    <div className="space-y-3">
      {/* LIVE CALLS */}
      <div className="rounded-xl border border-white/10 bg-black/75 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
              Live Calls
            </div>

            <div className="mt-0.5 text-[11px] text-white/35">
              Names update automatically from chat.
            </div>
          </div>

          <ActionButton
            onClick={async () => {
              if (
                !confirm(
                  "Clear every slot call from the wheel?"
                )
              )
                return;

              const res = await fetch(
                "/api/slot-calls?clearAll=true",
                {
                  method: "DELETE",
                }
              );

              const data = await res.json();

              if (!res.ok || !data.ok) {
                alert(
                  data.error ||
                    "Failed to clear slot calls."
                );
                return;
              }

              setSlotCalls([]);
              setPickedSlotCall(null);
              setSlotWheelRotation(0);
              slotWheelWinnersThisCycleRef.current.clear();
            }}
            disabled={
              slotCalls.length === 0 ||
              isSlotWheelSpinning
            }
            variant="red"
            className="min-h-[32px] px-3 py-1 text-[8px]"
          >
            Clear All
          </ActionButton>
        </div>

        <div className="mt-3 max-h-[354px] overflow-y-auto rounded-lg border border-white/8 bg-black/50 p-2">
          {slotCalls.length === 0 ? (
            <div className="p-5 text-center text-xs text-white/35">
              No slot calls yet.
            </div>
          ) : (
            <div className="grid gap-1.5">
              {slotCalls.map((call, index) => (
                <div
                  key={`${call.id || call.username}-${call.slotName}-${index}`}
                  className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-2 py-1.5"
                >
                  <div className="text-[9px] font-black text-cyan-300/60">
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-black text-white">
                      {call.slotName}
                    </div>

                    <div className="truncate text-[9px] text-white/35">
                      {call.username}
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (call.id) {
                        await fetch(
                          `/api/slot-calls?id=${call.id}`,
                          {
                            method: "DELETE",
                          }
                        );
                      }

                      setSlotCalls((current) =>
                        current.filter(
                          (item) => item.id !== call.id
                        )
                      );

                      await loadSlotCalls();
                    }}
                    disabled={isSlotWheelSpinning}
                    className="rounded-md border border-red-300/15 bg-red-500/10 px-2 py-1 text-[8px] font-black uppercase text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROLLED RESULTS */}
      <div className="rounded-xl border border-white/10 bg-black/75 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
              Rolled Results
            </div>

            <div className="mt-0.5 text-[11px] text-white/35">
              Remove old rolled winners and payouts.
            </div>
          </div>

          <ActionButton
            onClick={async () => {
              if (
                !confirm(
                  "Clear all rolled winners and payouts?"
                )
              )
                return;

              const res = await fetch(
                "/api/slot-calls?clearResults=true",
                {
                  method: "DELETE",
                }
              );

              const data = await res.json();

              if (!res.ok || !data.ok) {
                alert(
                  data.error ||
                    "Failed to clear rolled results."
                );
                return;
              }

              setSlotCallResults([]);
              await loadSlotCalls();
            }}
            disabled={slotCallResults.length === 0}
            variant="red"
            className="min-h-[32px] px-3 py-1 text-[8px]"
          >
            Clear All
          </ActionButton>
        </div>

        <div className="mt-3 max-h-[300px] overflow-y-auto rounded-lg border border-white/8 bg-black/50 p-2">
          {slotCallResults.length === 0 ? (
            <div className="p-5 text-center text-xs text-white/35">
              No rolled results yet.
            </div>
          ) : (
            <div className="grid gap-1.5">
              {slotCallResults.map(
                (result, index) => (
                  <div
                    key={result.id}
                    className="grid grid-cols-[24px_minmax(0,0.8fr)_minmax(0,1fr)_70px_auto] items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-2 py-1.5"
                  >
                    <div className="text-[8px] font-black text-cyan-300/60">
                      {index + 1}
                    </div>

                    <div className="truncate text-[9px] font-black text-white">
                      {result.username}
                    </div>

                    <div className="truncate text-[9px] text-white/45">
                      {result.slotName}
                    </div>

                    <div className="truncate text-right text-[9px] font-black text-emerald-300">
                      $
                      {result.payout.toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </div>

                    <button
                      onClick={async () => {
                        const res = await fetch(
                          `/api/slot-calls?resultId=${result.id}`,
                          {
                            method: "DELETE",
                          }
                        );

                        const data =
                          await res.json();

                        if (!res.ok || !data.ok) {
                          alert(
                            data.error ||
                              "Failed to remove rolled result."
                          );
                          return;
                        }

                        setSlotCallResults(
                          (current) =>
                            current.filter(
                              (item) =>
                                item.id !== result.id
                            )
                        );

                        await loadSlotCalls();
                      }}
                      className="rounded-md border border-red-300/15 bg-red-500/10 px-2 py-1 text-[8px] font-black uppercase text-red-200 transition hover:bg-red-500/20"
                    >
                      Remove
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
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
    
<div className="flex items-center gap-4 sm:gap-5">
  <a
    href="https://twitch.tv/trashguy__"
    target="_blank"
    rel="noreferrer"
    aria-label="Twitch"
    className="transition hover:scale-110"
  >
    <FaTwitch className="text-2xl text-[#9146FF] sm:text-3xl md:text-4xl" />
  </a>

  <a
    href="https://kick.com/trashguy"
    target="_blank"
    rel="noreferrer"
    aria-label="Kick"
    className="transition hover:scale-110"
  >
    <SiKick className="text-2xl text-[#53FC18] sm:text-3xl md:text-4xl" />
  </a>

  <a
    href="https://discord.gg/EqjwXzkDMK"
    target="_blank"
    rel="noreferrer"
    aria-label="Discord"
    className="transition hover:scale-110"
  >
    <FaDiscord className="text-2xl text-[#5865F2] sm:text-3xl md:text-4xl" />
  </a>

  <a
    href="https://instagram.com/trashguy__"
    target="_blank"
    rel="noreferrer"
    aria-label="Instagram"
    className="transition hover:scale-110"
  >
    <FaInstagram className="text-2xl text-[#E1306C] sm:text-3xl md:text-4xl" />
  </a>

  <a
    href="https://x.com/trashguy__"
    target="_blank"
    rel="noreferrer"
    aria-label="Twitter"
    className="transition hover:scale-110"
  >
    <FaXTwitter className="text-2xl text-white sm:text-3xl md:text-4xl" />
  </a>
</div>

    <div className="max-w-2xl text-sm leading-7 text-white/45">
      Gamble responsibly. 18+ only.
      Only gamble with what you can afford to lose.
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