"use client";

import React from "react";

type SiteHeaderProps = {
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
  liveStatus: {
    isLive: boolean;
    viewerCount: number;
  };
};

export default function SiteHeader({
  activeSection,
  setActiveSection,
  adminAllowed,
  isTwitchConnected,
  viewerAvatar,
  viewerDisplayName,
  viewerName,
  handleTwitchLogin,
  handleKickLogin,
  handleLogout,
  liveLoading,
  liveStatus,
}: SiteHeaderProps) {
const navItems = [
  { id: "home", label: "Home" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "hunts", label: "Bonus Hunts" },
  { id: "wagerRewards", label: "Wager Rewards" },
  { id: "tournaments", label: "Tournaments" },
  { id: "slotpicker", label: "Slot Picker" },
  { id: "prizeportal", label: "Prize Portal" },
  ...(adminAllowed ? [{ id: "admin", label: "Admin" }] : []),
];

return (
  <header className="sticky top-0 z-50 border-b border-cyan-400/15 bg-black/85 backdrop-blur-xl">
    <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/logo.png"
            alt="Trashguy"
            className="h-8 w-8 rounded-lg object-cover sm:h-11 sm:w-11"
          />

<div className="relative shrink-0">
  <div
    className="
      bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_28%,#94a3b8_52%,#ffffff_68%,#38bdf8_100%)]
      bg-clip-text
      text-xl
      font-black
      italic
      tracking-[-0.04em]
      text-transparent
      drop-shadow-[0_3px_0_rgba(0,0,0,0.95)]
      sm:text-4xl
    "
    style={{
      WebkitTextStroke: "1px rgba(15,23,42,0.95)",
      textShadow:
        "0 1px 0 #ffffff, 0 3px 0 #334155, 0 5px 0 #020617, 0 0 10px rgba(56,189,248,0.45)",
    }}
  >
    TRASHGUY
  </div>
</div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`hidden rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] sm:block ${
              liveStatus.isLive
                ? "border-red-400/30 bg-red-500/10 text-red-200"
                : "border-white/10 bg-white/[0.03] text-white/50"
            }`}
          >
            {liveLoading ? "Checking..." : liveStatus.isLive ? "Live" : "Offline"}
          </div>

          {isTwitchConnected ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-2 sm:px-3">
              {viewerAvatar ? (
                <img
                  src={viewerAvatar}
                  alt={viewerDisplayName}
                  className="h-8 w-8 rounded-full object-cover sm:h-9 sm:w-9"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-sm font-black text-cyan-300 sm:h-9 sm:w-9">
                  {viewerDisplayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="hidden sm:block">
                <div className="text-sm font-bold text-white">
                  {viewerDisplayName}
                </div>
                <div className="text-xs text-white/45">@{viewerName}</div>
              </div>

              <button
                onClick={handleLogout}
                className="hidden rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 sm:block"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleTwitchLogin}
                className="rounded-lg border border-[#9146FF]/40 bg-[#9146FF]/20 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-[#9146FF]/30 sm:px-3 sm:py-2 sm:text-xs"
              >
                Twitch
              </button>
              <button
                onClick={handleKickLogin}
                className="rounded-lg border border-[#53FC18]/40 bg-[#53FC18]/15 px-2.5 py-1.5 text-[10px] font-black text-[#baff9f] transition hover:bg-[#53FC18]/25 sm:px-3 sm:py-2 sm:text-xs"
              >
                Kick
              </button>
            </div>
          )}

          <div className="relative">
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center justify-center rounded-xl border border-cyan-300/25 bg-black/70 px-3 py-2 text-sm font-black text-cyan-200 shadow-[0_0_18px_rgba(0,245,255,0.12)] transition hover:bg-cyan-400/10 sm:px-4">
                ☰
              </summary>

              <div className="absolute right-0 z-50 mt-3 w-[245px] overflow-hidden rounded-2xl border border-cyan-300/20 bg-black/95 p-2 shadow-[0_0_35px_rgba(0,245,255,0.18)] backdrop-blur-xl">
                {navItems.map((item) => {
                  const active = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);

                        const details = document.querySelector("details");
                        if (details) details.removeAttribute("open");
                      }}
                      className={`mb-1 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] transition last:mb-0 sm:text-sm ${
                        active
                          ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-200"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-cyan-300/20 hover:text-white"
                      }`}
                    >
                      <span>{item.label}</span>
                      {active && <span className="text-cyan-300">●</span>}
                    </button>
                  );
                })}

                {isTwitchConnected && (
                  <button
                    onClick={() => {
                      handleLogout();

                      const details = document.querySelector("details");
                      if (details) details.removeAttribute("open");
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/15 sm:hidden"
                  >
                    <span>Logout</span>
                  </button>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  </header>
);
}