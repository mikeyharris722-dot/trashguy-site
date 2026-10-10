export const CLAW_MUSIC_KEY = "trashguy:claw-music";
export type MusicState = { volume: number; muted: boolean; status: "starting" | "playing" | "muted" | "waiting" | "blocked" | "error" };

export class ClawMusic {
  private alive = true;
  private pending = false;
  private retryUsed = false;
  private retryListening = false;
  private state: MusicState = { volume: 0.2, muted: false, status: "starting" };
  constructor(private audio: HTMLAudioElement, private notify: (state: MusicState) => void) {
    try {
      const saved = JSON.parse(localStorage.getItem(CLAW_MUSIC_KEY) || "null");
      if (saved && typeof saved.volume === "number" && Number.isFinite(saved.volume))
        this.state.volume = Math.max(0, Math.min(1, saved.volume));
      if (typeof saved?.muted === "boolean") this.state.muted = saved.muted;
    } catch { /* Use safe defaults when storage is unavailable or invalid. */ }
    audio.src = "/audio/trash-claw.mp3";
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = this.state.volume;
    audio.muted = this.state.muted;
    audio.addEventListener("error", this.onError);
  }
  private publish() { if (this.alive) this.notify({ ...this.state }); }
  private save() {
    try { localStorage.setItem(CLAW_MUSIC_KEY, JSON.stringify({ volume: this.state.volume, muted: this.state.muted })); } catch { /* Session controls still work. */ }
  }
  private onError = () => { this.state.status = "error"; this.stopRetry(); this.publish(); };
  private stopRetry() {
    window.removeEventListener("click", this.retry, { capture: true });
    window.removeEventListener("keydown", this.retry, { capture: true });
    this.retryListening = false;
  }
  private retry = (event: Event) => {
    if (event instanceof KeyboardEvent && (event.repeat || ["Shift", "Control", "Alt", "Meta"].includes(event.key))) return;
    this.retryUsed = true;
    this.stopRetry();
    void this.play();
  };
  async play() {
    if (!this.alive || this.pending) return;
    if (this.state.muted) { this.state.status = "muted"; this.publish(); return; }
    this.pending = true;
    try {
      await this.audio.play();
      if (!this.alive || this.state.muted) { this.audio.pause(); return; }
      this.state.status = "playing";
      this.stopRetry();
    } catch (error) {
      if (!this.alive) return;
      if (this.state.muted) { this.state.status = "muted"; return; }
      if (error instanceof Error && error.name === "NotAllowedError") {
        this.state.status = this.retryUsed ? "blocked" : "waiting";
        if (!this.retryUsed && !this.retryListening) {
          window.addEventListener("click", this.retry, { capture: true });
          window.addEventListener("keydown", this.retry, { capture: true });
          this.retryListening = true;
        }
      } else { this.state.status = "error"; this.stopRetry(); }
    } finally { this.pending = false; this.publish(); }
  }
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.state.volume = Math.max(0, Math.min(1, value));
    this.audio.volume = this.state.volume;
    this.save(); this.publish();
    if (this.state.volume > 0 && !this.state.muted && this.audio.paused) void this.play();
  }
  toggleMute() {
    this.state.muted = !this.state.muted;
    this.audio.muted = this.state.muted;
    this.save();
    if (this.state.muted) {
      this.audio.pause(); this.stopRetry(); this.state.status = "muted"; this.publish();
    } else { void this.play(); }
  }
  enable() { this.retryUsed = true; this.stopRetry(); void this.play(); }
  destroy() {
    this.alive = false;
    this.stopRetry();
    this.audio.removeEventListener("error", this.onError);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
