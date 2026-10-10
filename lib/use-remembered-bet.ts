"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

const key = "trashguy:last-slot-bet";
const changeEvent = "trashguy:slot-bet-changed";
let remembered = "1.00";

function readBet() {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved && Number.isFinite(Number(saved)) && Number(saved) > 0)
      remembered = saved;
  } catch { /* Storage can be unavailable in private browsers. */ }
  return remembered;
}

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", notify);
  };
}

// Both entry forms share the last positive amount on this browser.
export function useRememberedBet(): [string, (value: string) => void] {
  const saved = useSyncExternalStore(subscribe, readBet, () => "1.00");
  const [draft, setDraft] = useState<string | null>(null);
  const setBet = useCallback((value: string) => {
    if (value.trim() && Number.isFinite(Number(value)) && Number(value) > 0) {
      remembered = value;
      try { window.localStorage.setItem(key, value); } catch { /* Keep session memory. */ }
      setDraft(null);
      window.dispatchEvent(new Event(changeEvent));
    } else {
      setDraft(value);
    }
  }, []);
  return [draft ?? saved, setBet];
}
