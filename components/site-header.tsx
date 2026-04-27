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
  { id: "predictions", label: "Predictions" },
  { id: "giveaways", label: "Giveaways" },
  { id: "slotpicker", label: "Slot Picker" },
  { id: "tournaments", label: "Tournaments" },
  ...(adminAllowed ? [{ id: "admin", label: "Admin" }] : []),
];

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-400/15 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Trashguy"
              className="h-11 w-11 rounded-lg object-cover"
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-sm font-black text-emerald-300">
                    {viewerDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="hidden sm:block">
                  <div className="text-sm font-bold text-white">{viewerDisplayName}</div>
                  <div className="text-xs text-white/45">@{viewerName}</div>
                </div>

                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={handleTwitchLogin}
                className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.18)]"
              >
                Login
              </button>
            )}
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap items-center gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.15)]"
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