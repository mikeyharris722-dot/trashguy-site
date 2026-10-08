import { createClient as realClient } from "@supabase/supabase-js";

export const reviewMode = () => process.env.NEXT_PUBLIC_LOCAL_REVIEW === "1";
export function reviewFetch(original: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const method = (
      init?.method || (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (
      reviewMode() &&
      !["GET", "HEAD"].includes(method) &&
      /^\/(rest|storage|functions)\/v1(\/|$)/.test(url.pathname)
    ) {
      return new Response(
        JSON.stringify({
          message:
            "Local review: live data changes are blocked. Community Hunt tests are saved locally.",
          code: "LOCAL_REVIEW_READ_ONLY",
          details: null,
          hint: null,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
    return original(input, init);
  };
}
export const createClient: typeof realClient = (url, key, options) =>
  realClient(url, key, {
    ...options,
    global: {
      ...options?.global,
      fetch: reviewFetch(options?.global?.fetch || fetch),
    },
  });
