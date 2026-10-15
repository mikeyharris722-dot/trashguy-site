"use client";
import type { ReactNode } from "react";
import { sectionTitles } from "@/lib/site-navigation";
export function PageGuidance({section}:{section:string}) {
 if(!['hunts','tournaments','slotpicker','profile'].includes(section))return null;
 return <header className="simple-page-heading"><h1>{sectionTitles[section].toUpperCase()}</h1></header>;
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
  prizes: ["Prize Settings", "Edit the advertised leaderboard payouts and prediction prize. Totals update automatically; existing rewards keep their recorded amounts."],
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
export function AdminGuidance({ tab, actions }: { tab: string; actions?: ReactNode }) {
  const g = adminGuides[tab];
  return g && !["community", "prizes", "bonusTracker"].includes(tab) ? (
    <div className={"admin-guidance" + (actions ? " admin-guidance-with-actions" : "")}>

      <h2>{g[0].toUpperCase()}</h2>
      {actions}

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
