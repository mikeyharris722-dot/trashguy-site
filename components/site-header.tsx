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
  { id: "slotwheel", label: "Viewer Wheel" },
  { id: "tournaments", label: "Tournaments" },
  { id: "slotpicker", label: "Slot Picker" },
  { id: "prizeportal", label: "Profile" },
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

<img
  src="/trashguy-chrome.png"
  alt="TRASHGUY"
  className="h-12 w-auto object-contain select-none sm:h-14 lg:h-16"
  draggable={false}
/>
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
    {/* MENU BUTTON */}
    <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-cyan-300/25 bg-black/75 text-xl text-cyan-100 shadow-[0_0_18px_rgba(0,245,255,0.12)] transition hover:border-cyan-300/45 hover:bg-cyan-400/10">
      ☰
    </summary>

    {/* DROPDOWN */}
    <div className="absolute right-0 z-50 mt-3 w-[280px] overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,17,24,0.98),rgba(2,7,10,0.99))] p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.65),0_0_35px_rgba(0,245,255,0.14)] backdrop-blur-xl">

      {/* MENU LABEL */}
      <div className="mb-2 px-2 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.25em] text-cyan-100/35">
        Navigation
      </div>

      {/* NAV ITEMS */}
      <div className="grid gap-1.5">
        {navItems.map((item) => {
          const active = activeSection === item.id;

const icons: Record<string, string> = {
  home: "🏠",
  leaderboard: "🏆",
  hunts: "🎁",
  slotwheel: "🎡",
  tournaments: "🏅",
  slotpicker: "🎰",
  profile: "👤",
  admin: "👑",
};

          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);

                const details = document.querySelector("details");
                if (details) details.removeAttribute("open");
              }}
              className={`group/item flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                active
                  ? "border-cyan-300/40 bg-[linear-gradient(90deg,rgba(0,245,255,0.16),rgba(0,245,255,0.05))] text-cyan-100 shadow-[0_0_16px_rgba(0,245,255,0.12)]"
                  : "border-white/[0.07] bg-white/[0.025] text-white/65 hover:border-cyan-300/20 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              {/* ICON */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-base ${
                  active
                    ? "border-cyan-300/25 bg-cyan-400/10"
                    : "border-white/[0.07] bg-black/40"
                }`}
              >
                {icons[item.id] || "•"}
              </div>

              {/* LABEL */}
              <span className="min-w-0 flex-1 text-[11px] font-black uppercase tracking-[0.09em]">
                {item.label}
              </span>

              {/* ACTIVE INDICATOR */}
              {active && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(0,245,255,1)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* LOGOUT - MOBILE */}
      {isTwitchConnected && (
        <>
          <div className="my-2.5 h-px bg-white/[0.07] sm:hidden" />

          <button
            onClick={() => {
              handleLogout();

              const details = document.querySelector("details");
              if (details) details.removeAttribute("open");
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-red-300/15 bg-red-500/[0.07] px-3 py-2.5 text-left text-red-200/80 transition hover:border-red-300/30 hover:bg-red-500/10 sm:hidden"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/10 bg-red-500/5 text-base">
              🚪
            </div>

            <span className="text-[11px] font-black uppercase tracking-[0.09em]">
              Logout
            </span>
          </button>
        </>
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