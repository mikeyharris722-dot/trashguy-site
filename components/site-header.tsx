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
    { id: "home", label: "Home", icon: "🏠" },
    { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
    { id: "hunts", label: "Bonus Hunts", icon: "🎁" },
    { id: "slotwheel", label: "Viewer Wheel", icon: "🎡" },
    { id: "tournaments", label: "Tournaments", icon: "🏅" },
    { id: "slotpicker", label: "Slot Picker", icon: "🎰" },
    { id: "profile", label: "Profile", icon: "👤" },
    ...(adminAllowed
      ? [{ id: "admin", label: "Admin", icon: "👑" }]
      : []),
  ];

  const closeMenu = () => {
    const details =
      document.querySelector<HTMLDetailsElement>("#trashguy-main-menu");

    if (details) {
      details.removeAttribute("open");
    }
  };

  return (
    <header
      className="
        sticky top-0 z-50
        border-b border-purple-300/[0.14]
        bg-[#050208]/82
        shadow-[0_12px_45px_rgba(0,0,0,0.32)]
        backdrop-blur-xl
      "
    >
      {/* PURPLE TOP GLOW */}
      <div
        className="
          pointer-events-none absolute inset-x-0 top-0 h-px
          bg-gradient-to-r
          from-transparent
          via-purple-300/55
          to-transparent
        "
      />

      <div className="mx-auto max-w-7xl px-3 py-2 sm:px-6 sm:py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* =========================
              BRAND
          ========================= */}

          <button
            type="button"
            onClick={() => setActiveSection("home")}
            className="
              group flex min-w-0 items-center gap-2
              rounded-xl outline-none
              sm:gap-3
            "
          >
            {/* LOGO */}
            <img
              src="/trashguy-new-logo.png"
              alt="TrashGuy"
              draggable={false}
              className="
                h-10 w-10
                shrink-0
                select-none
                rounded-lg
                object-cover
                drop-shadow-[0_0_10px_rgba(168,85,247,0.32)]
                transition-all duration-300
                group-hover:drop-shadow-[0_0_18px_rgba(192,132,252,0.58)]
                sm:h-12 sm:w-12
              "
            />

            {/* TRASHGUY WORDMARK */}
            <div className="flex min-w-0 flex-col items-start">
              <div
                className="
                  whitespace-nowrap
                  text-[17px] font-black
                  uppercase italic
                  leading-none
                  tracking-[-0.045em]
                  text-white
                  drop-shadow-[0_0_7px_rgba(255,255,255,0.16)]
                  sm:text-[25px]
                  lg:text-[28px]
                "
              >
                TRASH
                <span
                  className="
                    text-purple-300
                    drop-shadow-[0_0_9px_rgba(192,132,252,0.52)]
                  "
                >
                  GUY
                </span>
              </div>

              <div
                className="
                  mt-1 hidden
                  text-[6px] font-black uppercase
                  tracking-[0.32em]
                  text-purple-200/50
                  sm:block
                  sm:text-[7px]
                "
              >
                CODE TRASHGUY
              </div>
            </div>
          </button>

          {/* =========================
              RIGHT SIDE
          ========================= */}

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* LIVE STATUS */}
            <div
              className={`
                hidden items-center gap-2
                rounded-full border
                px-3 py-1.5
                text-[9px] font-black uppercase
                tracking-[0.2em]
                sm:flex
                ${
                  liveStatus.isLive
                    ? `
                      border-red-400/35
                      bg-red-500/[0.10]
                      text-red-200
                      shadow-[0_0_18px_rgba(248,113,113,0.10)]
                    `
                    : `
                      border-white/[0.08]
                      bg-black/30
                      text-white/35
                    `
                }
              `}
            >
              <span
                className={`
                  h-1.5 w-1.5 rounded-full
                  ${
                    liveStatus.isLive
                      ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]"
                      : "bg-white/20"
                  }
                `}
              />

              {liveLoading
                ? "Checking"
                : liveStatus.isLive
                  ? "Live"
                  : "Offline"}
            </div>

            {/* =========================
                CONNECTED USER
            ========================= */}

            {isTwitchConnected ? (
              <div
                className="
                  flex items-center gap-2
                  rounded-xl
                  border border-purple-300/[0.14]
                  bg-black/35
                  p-1
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]
                  backdrop-blur-md
                  sm:gap-2.5
                  sm:rounded-2xl
                  sm:py-1.5
                  sm:pl-1.5
                  sm:pr-2
                "
              >
                {viewerAvatar ? (
                  <img
                    src={viewerAvatar}
                    alt={viewerDisplayName}
                    className="
                      h-8 w-8 rounded-lg
                      border border-purple-300/20
                      object-cover
                      shadow-[0_0_12px_rgba(168,85,247,0.10)]
                      sm:h-9 sm:w-9 sm:rounded-xl
                    "
                  />
                ) : (
                  <div
                    className="
                      flex h-8 w-8 items-center justify-center
                      rounded-lg
                      border border-purple-300/20
                      bg-purple-400/[0.08]
                      text-xs font-black text-purple-200
                      sm:h-9 sm:w-9
                      sm:rounded-xl
                    "
                  >
                    {viewerDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="hidden min-w-0 sm:block">
                  <div
                    className="
                      max-w-[130px] truncate
                      text-[11px] font-black
                      text-white
                    "
                  >
                    {viewerDisplayName}
                  </div>

                  <div
                    className="
                      max-w-[130px] truncate
                      text-[9px] font-semibold
                      text-purple-200/45
                    "
                  >
                    @{viewerName}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    hidden
                    rounded-lg
                    border border-purple-300/15
                    bg-purple-400/[0.07]
                    px-3 py-1.5
                    text-[9px] font-black uppercase
                    tracking-[0.08em]
                    text-purple-100/80
                    transition
                    hover:border-purple-300/35
                    hover:bg-purple-400/[0.13]
                    hover:text-white
                    sm:block
                  "
                >
                  Logout
                </button>
              </div>
            ) : (
              /* LOGIN BUTTONS */
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTwitchLogin}
                  className="
                    rounded-lg
                    border border-[#a970ff]/35
                    bg-[#9146FF]/20
                    px-2.5 py-1.5
                    text-[9px] font-black
                    text-white
                    shadow-[0_0_12px_rgba(145,70,255,0.08)]
                    transition
                    hover:border-[#b98aff]/55
                    hover:bg-[#9146FF]/30
                    sm:px-3
                    sm:py-2
                    sm:text-[10px]
                  "
                >
                  Twitch
                </button>

                <button
                  type="button"
                  onClick={handleKickLogin}
                  className="
                    rounded-lg
                    border border-[#53FC18]/35
                    bg-[#53FC18]/10
                    px-2.5 py-1.5
                    text-[9px] font-black
                    text-[#c8ffb5]
                    shadow-[0_0_12px_rgba(83,252,24,0.06)]
                    transition
                    hover:border-[#53FC18]/55
                    hover:bg-[#53FC18]/18
                    sm:px-3
                    sm:py-2
                    sm:text-[10px]
                  "
                >
                  Kick
                </button>
              </div>
            )}

            {/* =========================
                MENU
            ========================= */}

            <div className="relative">
              <details
                id="trashguy-main-menu"
                className="group relative"
              >
                <summary
                  className="
                    flex h-10 w-10 cursor-pointer
                    list-none items-center justify-center
                    rounded-xl
                    border border-purple-300/25
                    bg-purple-400/[0.07]
                    text-lg text-purple-100
                    shadow-[0_0_18px_rgba(168,85,247,0.10)]
                    transition-all duration-200
                    hover:border-purple-300/45
                    hover:bg-purple-400/[0.13]
                    hover:shadow-[0_0_22px_rgba(168,85,247,0.18)]
                    sm:h-11 sm:w-11
                  "
                >
                  <span className="relative h-4 w-5">
                    <span className="absolute left-0 top-0 h-[1.5px] w-5 rounded-full bg-current" />

                    <span className="absolute left-0 top-[7px] h-[1.5px] w-5 rounded-full bg-current" />

                    <span className="absolute left-0 top-[14px] h-[1.5px] w-5 rounded-full bg-current" />
                  </span>
                </summary>

                {/* DROPDOWN */}
                <div
                  className="
                    absolute right-0 z-50
                    mt-2.5
                    w-[250px]
                    overflow-hidden
                    rounded-2xl
                    border border-purple-300/[0.18]
                    bg-[linear-gradient(180deg,rgba(17,7,25,0.97),rgba(5,2,9,0.985))]
                    p-2
                    shadow-[0_22px_65px_rgba(0,0,0,0.68),0_0_40px_rgba(168,85,247,0.10)]
                    backdrop-blur-2xl
                    sm:w-[280px]
                    sm:p-2.5
                  "
                >
                  {/* TOP PURPLE LINE */}
                  <div
                    className="
                      pointer-events-none absolute inset-x-8 top-0 h-px
                      bg-gradient-to-r
                      from-transparent
                      via-purple-300/65
                      to-transparent
                    "
                  />

                  <div
                    className="
                      px-2 pb-2 pt-1
                      text-[8px] font-black uppercase
                      tracking-[0.28em]
                      text-purple-200/35
                    "
                  >
                    Navigation
                  </div>

                  {/* NAV ITEMS */}
                  <div className="grid gap-1">
                    {navItems.map((item) => {
                      const active = activeSection === item.id;

                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            setActiveSection(item.id);
                            closeMenu();
                          }}
                          className={`
                            group/item
                            flex w-full items-center gap-2.5
                            rounded-xl border
                            px-2.5 py-2
                            text-left
                            transition-all duration-200
                            sm:px-3
                            sm:py-2.5
                            ${
                              active
                                ? `
                                  border-purple-300/35
                                  bg-[linear-gradient(90deg,rgba(168,85,247,0.17),rgba(126,34,206,0.05))]
                                  text-purple-100
                                  shadow-[0_0_17px_rgba(168,85,247,0.10)]
                                `
                                : `
                                  border-white/[0.055]
                                  bg-white/[0.018]
                                  text-white/55
                                  hover:border-purple-300/18
                                  hover:bg-purple-400/[0.045]
                                  hover:text-white
                                `
                            }
                          `}
                        >
                          {/* COLOR EMOJI */}
                          <div
                            className={`
                              flex h-8 w-8 shrink-0
                              items-center justify-center
                              rounded-lg border
                              text-base
                              ${
                                active
                                  ? `
                                    border-purple-300/25
                                    bg-purple-400/[0.10]
                                    shadow-[0_0_10px_rgba(168,85,247,0.10)]
                                  `
                                  : `
                                    border-white/[0.06]
                                    bg-black/30
                                  `
                              }
                            `}
                          >
                            {item.icon}
                          </div>

                          {/* LABEL */}
                          <span
                            className="
                              min-w-0 flex-1
                              text-[10px] font-black uppercase
                              tracking-[0.09em]
                              sm:text-[11px]
                            "
                          >
                            {item.label}
                          </span>

                          {/* ACTIVE DOT */}
                          {active && (
                            <span
                              className="
                                h-1.5 w-1.5 shrink-0
                                rounded-full
                                bg-purple-300
                                shadow-[0_0_9px_rgba(192,132,252,1)]
                              "
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* MOBILE LOGOUT */}
                  {isTwitchConnected && (
                    <>
                      <div className="my-2 h-px bg-white/[0.06] sm:hidden" />

                      <button
                        type="button"
                        onClick={() => {
                          handleLogout();
                          closeMenu();
                        }}
                        className="
                          flex w-full items-center gap-2.5
                          rounded-xl
                          border border-red-300/[0.14]
                          bg-red-500/[0.055]
                          px-2.5 py-2
                          text-left text-red-200/75
                          transition
                          hover:border-red-300/30
                          hover:bg-red-500/[0.10]
                          sm:hidden
                        "
                      >
                        <div
                          className="
                            flex h-8 w-8 items-center justify-center
                            rounded-lg
                            border border-red-300/10
                            bg-red-500/[0.05]
                            text-base
                          "
                        >
                          🚪
                        </div>

                        <span
                          className="
                            text-[10px] font-black uppercase
                            tracking-[0.09em]
                          "
                        >
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