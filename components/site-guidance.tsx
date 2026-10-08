"use client";
import { sectionTitles } from "@/lib/site-navigation";
const guides: Record<string, { description: string; steps: string[] }> = {
  leaderboard: {
    description:
      "Follow the current standings and see how previous competitions finished.",
    steps: [
      "Check the competition end time and current standings.",
      "Check your RouloBets account is linked in Your profile.",
      "Compare your position and the published prize places.",
    ],
  },
  hunts: {
    description:
      "Follow the streamer's bonus hunts and enter an end-balance prediction when entries are open.",
    steps: [
      "Select a hunt.",
      "Sign in before entering a prediction.",
      "Check the entry status and return for the final results. This is separate from joining a Community Hunt.",
    ],
  },
  slotwheel: {
    description:
      "Follow viewer slot calls, the latest selected call and recorded bonus results.",
    steps: [
      "Use !slot followed by the game name in the streamer's Twitch chat.",
      "Your call joins the queue when slot calls are open.",
      "The streamer rolls a call and records whether a bonus was collected.",
    ],
  },
  tournaments: {
    description:
      "Follow the players, teams and match results from the current stream.",
    steps: [
      "Switch between the bracket and team draft views.",
      "Read the current round or team lineup.",
      "Results update when the streamer records them.",
    ],
  },
  slotpicker: {
    description:
      "Pick a game from the RouloBets collection using your preferred providers.",
    steps: [
      "Choose one or more providers, or keep the featured selection.",
      "Search for a game or use the random picker.",
      "View more reveals the rest of the provider collection. Picking a game does not submit a Twitch call.",
    ],
  },
  profile: {
    description:
      "Keep your linked accounts, eligibility and available prizes in one place.",
    steps: [
      "Sign in with Twitch or Kick.",
      "Check the linked RouloBets and Discord account details.",
      "Review your rewards and follow each prize's claim instructions.",
    ],
  },
};
export function PageGuidance({ section }: { section: string }) {
  const g = guides[section];
  if (!g) return null;
  return (
    <section
      className="page-intro"
      aria-label={sectionTitles[section] + " introduction"}
    >
      <div>
        <p className="eyebrow">Trashguy community</p>
        <h1>{sectionTitles[section]}</h1>
        <p className="intro-description">{g.description}</p>
      </div>
      <details className="page-help">
        <summary>How to use this page</summary>
        <ol>
          {g.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
export function HomeGuidance({
  navigate,
  signedIn,
}: {
  navigate: (id: string) => void;
  signedIn: boolean;
}) {
  const cards = [
    {
      id: "community",
      icon: "👻",
      title: "Join a community hunt",
      description:
        "See the date, request a place with your contribution, then call Rainbet slots after approval.",
      action: "View community hunts",
    },
    {
      id: "slotwheel",
      icon: "🎡",
      title: "Follow the viewer wheel",
      description:
        "Call a game in Twitch chat and follow the queue, selected slot and bonus results.",
      action: "See slot calls",
    },
    {
      id: "profile",
      icon: "🎁",
      title: signedIn
        ? "Check your profile & rewards"
        : "Get started with your account",
      description:
        "Link your accounts, check your eligibility and find your available prizes.",
      action: signedIn ? "Open your profile" : "How to get started",
    },
  ];
  return (
    <section className="home-welcome">
      <div className="welcome-copy">
        <p className="eyebrow">Welcome to the Trashguy community</p>
        <h1>Your next stream starts here.</h1>
        <p>
          Hunts, viewer calls, competitions and rewards. Choose what you want to
          do and follow along with the stream.
        </p>
      </div>
      <div className="welcome-cards">
        {cards.map((c) => (
          <button
            type="button"
            key={c.id}
            className="welcome-card"
            onClick={() => navigate(c.id)}
          >
            <span aria-hidden="true" className="welcome-icon">
              {c.icon}
            </span>
            <h2>{c.title}</h2>
            <p>{c.description}</p>
            <span className="welcome-action">
              {c.action} <span aria-hidden="true">→</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
const adminGuides: Record<string, [string, string]> = {
  giveaway: [
    "Giveaways",
    "Create a session, manage entries and draw a winner. Record prizes in the Prize Portal.",
  ],
  trashClaw: [
    "Trash Claw",
    "Set up the prize pool before running the on-stream reveal.",
  ],
  prizePortal: [
    "Prize Portal",
    "Search rewards, check claims and record payment status. Review details before changing a prize.",
  ],
  tournament: [
    "Tournaments",
    "Create and manage the bracket, players and match results.",
  ],
  snakeDraft: [
    "Snake Drafts",
    "Build the teams, manage the draft order and record slot outcomes.",
  ],
  slotWheel: [
    "Slot Call Wheel",
    "Roll viewer calls and record Got in or Didn't get in. Hunt and catalogue controls stay below the on-stream area.",
  ],
  bonusTracker: [
    "Bonus Hunt Tracker",
    "Choose the active hunt, add or reorder bonuses, then open them in order. The selected hunt also drives OBS.",
  ],
  community: [
    "Community Hunt",
    "Schedule a hunt, approve contributions, manage Rainbet calls and record the bonus results.",
  ],
};
export function AdminGuidance({ tab }: { tab: string }) {
  const g = adminGuides[tab];
  return g && tab !== "community" ? (
    <div className="admin-guidance">
      <span className="eyebrow">Current workspace</span>
      <h2>{g[0]}</h2>
      <p>{g[1]}</p>
    </div>
  ) : null;
}
export function LocalReviewBanner() {
  return process.env.NEXT_PUBLIC_LOCAL_REVIEW === "1" ? (
    <aside className="review-banner" aria-label="Local review status">
      <strong>Local review · Not published</strong>
      <span>
        Community Hunt tests save locally. Actions that change other live data
        are blocked.
      </span>
    </aside>
  ) : null;
}
export function SiteNotice({
  message,
  close,
}: {
  message: string;
  close: () => void;
}) {
  return message ? (
    <div className="site-notice" role="alert">
      <p>{message}</p>
      <button type="button" aria-label="Dismiss message" onClick={close}>
        ×
      </button>
    </div>
  ) : null;
}
