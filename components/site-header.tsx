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
  handleLogout,
  liveLoading,
  liveStatus,
}: SiteHeaderProps) {
  const navItems = [
  { id: "home", label: "Home" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "hunts", label: "Bonus Hunts" },
  { id: "giveaways", label: "Giveaways" },
  { id: "monthlyRewards", label: "Monthly Rewards" },
  { id: "tournaments", label: "Tournaments" },
  { id: "slotpicker", label: "Slot Picker" },
  ...(adminAllowed ? [{ id: "admin", label: "Admin" }] : []),
];

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-400/15 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Trashguy"
              className="h-8 w-8 sm:h-11 sm:w-11 rounded-lg object-cover"
            />
            <div>
              <div className="text-2xl font-black tracking-tight text-white sm:text-3xl">
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
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-sm font-black text-cyan-300">
                    {viewerDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="hidden sm:block">
                  <div className="text-sm font-bold text-white">{viewerDisplayName}</div>
                  <div className="text-xs text-white/45">@{viewerName}</div>
                </div>

                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={handleTwitchLogin}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 shadow-[0_0_18px_rgba(0,245,255,0.18)]"
              >
                Login
              </button>
            )}
          </div>
        </div>

        <nav className="mt-4 flex w-full flex-wrap items-center justify-center gap-2">
          {navItems.map((item) => {
            const active = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`rounded-full border px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-semibold transition ${
                  active
                    ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-200 shadow-[0_0_18px_rgba(0,245,255,0.15)]"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}