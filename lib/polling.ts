/** Serial polling: hidden tabs pause, requests never overlap, failures back off.
 * OBS callers may opt out of visibility checks because browser sources can be hidden.
 */
export function startPolling(task: () => Promise<unknown>, interval: number, options: { immediate?: boolean; visibleOnly?: boolean } = {}) {
  let stopped = false, running = false, failures = 0;
  let timer: ReturnType<typeof setTimeout>;
  const visible = () => options.visibleOnly === false || typeof document === "undefined" || document.visibilityState === "visible";
  const run = async () => {
    if (stopped || running) return;
    if (!visible()) { timer = setTimeout(run, interval); return; }
    running = true;
    try { const result = await task(); failures = result === false ? Math.min(failures + 1, 4) : 0; }
    catch { failures = Math.min(failures + 1, 4); }
    finally { running = false; if (!stopped) timer = setTimeout(run, Math.min(interval * 2 ** failures, 60_000)); }
  };
  const resume = () => { if (!stopped && !running && visible()) { clearTimeout(timer); void run(); } };
  if (options.visibleOnly !== false && typeof document !== "undefined") document.addEventListener("visibilitychange", resume);
  if (options.immediate === false) timer = setTimeout(run, interval); else void run();
  return () => { stopped = true; clearTimeout(timer); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", resume); };
}
