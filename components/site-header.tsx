"use client";
import { useEffect, useRef, useState } from "react";
import UserBadges from "@/components/user-badges";
import Image from "next/image";
type Props = {
  activeSection: string;
  setActiveSection: (section: string) => void;
  adminAllowed: boolean;
  isTwitchConnected: boolean;
  viewerAvatar: string;
  viewerDisplayName: string;
  viewerName: string;
  handleTwitchLogin: () => void;
  handleKickLogin: () => void;
  handleLogout: () => void;
  liveLoading: boolean;
  liveStatus: { isLive: boolean; viewerCount: number };
};
const navigation = [
  {
    id: "home",
    label: "Home",
    icon: "🏠",
    detail: "Stream, rewards and getting started",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    icon: "🏆",
    detail: "Standings and competition prizes",
  },
  {
    id: "hunts",
    label: "Bonus hunt predictions",
    icon: "🎁",
    detail: "Follow the hunt and predict the finish",
  },
  {
    id: "community",
    label: "Community Hunt",
    icon: "👻",
    detail: "Join a hunt and submit Rainbet calls",
  },
  {
    id: "slotwheel",
    label: "Viewer wheel",
    icon: "🎡",
    detail: "Twitch calls and collected bonuses",
  },
  {
    id: "tournaments",
    label: "Tournaments",
    icon: "🏅",
    detail: "Brackets, teams and match results",
  },
  {
    id: "slotpicker",
    label: "Slot picker",
    icon: "🎰",
    detail: "Browse the RouloBets collection",
  },
  {
    id: "stats",
    label: "Community Stats",
    icon: "📊",
    detail: "Viewer calls, slot history and monthly recaps",
  },
  {
    id: "profile",
    label: "Your profile",
    icon: "👤",
    detail: "Linked accounts and your rewards",
  },
];
export default function SiteHeader(props: Props) {
  const details = useRef<HTMLDetailsElement>(null),
    summary = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !details.current?.contains(event.target)
      ) {
        if (details.current) details.current.open = false;
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (details.current) details.current.open = false;
        summary.current?.focus();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const choose = (id: string) => {
    props.setActiveSection(id);
    if (details.current) details.current.open = false;
  };
  const items = props.adminAllowed
    ? [
        ...navigation,
        {
          id: "admin",
          label: "Admin workspace",
          icon: "👑",
          detail: "Manage hunts, calls and stream events",
        },
      ]
    : navigation;
  return (
    <header className="site-header">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
          document.getElementById("main-content")?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <div className="header-inner">
        <button
          type="button"
          aria-label="Go to Home"
          className="header-brand"
          onClick={() => choose("home")}
        >
          <Image src="/trashguy-new-logo.png" alt="" width={48} height={48} />
          <span>
            <strong>
              TRASH<span>GUY</span>
            </strong>
            <small>Code trashguy</small>
          </span>
        </button>
        <div className="header-actions">
          <span
            className={
              "stream-status " + (props.liveStatus.isLive ? "is-live" : "")
            }
          >
            <span aria-hidden="true">●</span>
            {props.liveLoading
              ? "Checking stream…"
              : props.liveStatus.isLive
                ? "Live now"
                : "Stream offline"}
          </span>
          {props.isTwitchConnected ? (
            <button
              type="button"
              className="header-profile"
              aria-label={"Open profile for " + props.viewerDisplayName}
              onClick={() => choose("profile")}
            >
              {props.viewerAvatar ? (
                <Image
                  unoptimized
                  src={props.viewerAvatar}
                  alt=""
                  width={34}
                  height={34}
                />
              ) : (
                <span aria-hidden="true" className="avatar-fallback">
                  {props.viewerDisplayName.charAt(0)}
                </span>
              )}
              <span>
                <b>{props.viewerDisplayName}<UserBadges name={props.viewerName} /></b>
                <small>@{props.viewerName}</small>
              </span>
            </button>
          ) : (
            <div className="header-login">
              <button
                type="button"
                aria-label="Sign in with Twitch"
                onClick={props.handleTwitchLogin}
              >
                Twitch
              </button>
              <button
                type="button"
                className="kick-login"
                aria-label="Sign in with Kick"
                onClick={props.handleKickLogin}
              >
                Kick
              </button>
            </div>
          )}
          <details
            ref={details}
            className="header-menu"
            onToggle={() => setOpen(!!details.current?.open)}
          >
            <summary
              ref={summary}
              aria-label="Open navigation menu"
              aria-controls="site-navigation"
              className="menu-toggle"
            >
              <span aria-hidden="true">☰</span>
              <span className="menu-label">Menu</span>
            </summary>
            <nav
              id="site-navigation"
              className="navigation-panel"
              aria-label="Main navigation"
            >
              <p className="eyebrow">Explore Trashguy</p>
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-label={item.label}
                  aria-current={
                    props.activeSection === item.id ? "page" : undefined
                  }
                  className={
                    "navigation-item " +
                    (props.activeSection === item.id ? "is-active" : "")
                  }
                  onClick={() => choose(item.id)}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>
                    <b>{item.label}</b>
                    <small>{item.detail}</small>
                  </span>
                  <span aria-hidden="true" className="nav-arrow">
                    →
                  </span>
                </button>
              ))}
              {props.isTwitchConnected && (
                <button
                  type="button"
                  className="menu-logout"
                  onClick={() => {
                    props.handleLogout();
                    if (details.current) details.current.open = false;
                  }}
                >
                  Sign out
                </button>
              )}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
