"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
export const sectionTitles: Record<string, string> = {
  home: "Home",
  leaderboard: "Leaderboard",
  hunts: "Bonus hunt predictions",
  community: "Community Hunt",
  slotwheel: "Slot calls",
  tournaments: "Tournaments",
  slotpicker: "Slot picker",
  stats: "Community Stats",
  profile: "Your profile",
  admin: "Admin workspace",
};
const valid = (value: string) => Object.hasOwn(sectionTitles, value);
function subscribe(change: () => void) {
  window.addEventListener("hashchange", change);
  window.addEventListener("popstate", change);
  window.addEventListener("trashguy:navigate", change);
  return () => {
    window.removeEventListener("hashchange", change);
    window.removeEventListener("popstate", change);
    window.removeEventListener("trashguy:navigate", change);
  };
}
export function useSiteNavigation(storageKey: string) {
  const read = useCallback(() => {
    if (window.location.hash) {
      const hash = window.location.hash.slice(1);
      return valid(hash) ? hash : "home";
    }
    try {
      const saved = localStorage.getItem(storageKey) || "home";
      return valid(saved) ? saved : "home";
    } catch {
      return "home";
    }
  }, [storageKey]);
  useEffect(() => {
    if (!window.location.hash)
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search + "#" + read(),
      );
  }, [read]);
  const section = useSyncExternalStore(subscribe, read, () => "home");
  const navigate = useCallback(
    (next: string) => {
      const value = valid(next) ? next : "home";
      try {
        localStorage.setItem(storageKey, value);
      } catch {}
      if (window.location.hash !== "#" + value)
        window.history.pushState(
          null,
          "",
          window.location.pathname + window.location.search + "#" + value,
        );
      window.dispatchEvent(new Event("trashguy:navigate"));
    },
    [storageKey],
  );
  useEffect(() => {
    document.title = sectionTitles[section] + " | Trashguy";
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [section]);
  return [section, navigate] as const;
}
