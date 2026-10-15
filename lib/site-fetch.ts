"use client";
import { supabaseBrowser } from "./supabase/client";
export const siteFetch: typeof fetch = async (input, init) => {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const base =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(raw, base);
  if (url.origin !== base || !url.pathname.startsWith("/api/"))
    return fetch(input, init);
  const headers = new Headers(
    init?.headers || (input instanceof Request ? input.headers : undefined),
  );
  if (!headers.get("Authorization")) {
    const { data } = await supabaseBrowser.auth.getSession();
    if (data.session?.access_token)
      headers.set("Authorization", "Bearer " + data.session.access_token);
  }
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const caller = init?.signal || (input instanceof Request ? input.signal : undefined);
  const signal = ["GET", "HEAD"].includes(method)
    ? (caller ? AbortSignal.any([caller, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000))
    : caller;
  return fetch(input, { ...init, headers, signal });
};
