import { player } from "./player";

/*
 * Mobile audio unlock.
 *
 * iOS plays Web Audio on the "ambient" channel, which the ring/silent switch mutes: the
 * playhead moves and the app is silent, with nothing on screen to say why. Two fixes, both
 * applied on iOS (neither costs anything elsewhere):
 *
 *  1. `navigator.audioSession.type = "playback"` (Safari 16.4+): the supported way to say
 *     "this page is a music app".
 *  2. For older iOS: a looping, silent <audio> element started inside a user gesture. A
 *     playing media element moves the page's whole audio session onto the media channel,
 *     and Web Audio rides along. (The trick behind feross/unmute-ios-audio.)
 *
 * Every gesture also nudges the AudioContext awake, since iOS suspends ("interrupts") it
 * after a phone call or an app switch, and desktop browsers can suspend background tabs.
 */

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** A short silent 8-bit mono WAV, built in memory (no asset, no network). */
function silentWav(): string {
  const rate = 8000;
  const samples = rate / 2; // half a second, looped
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true); // byte rate
  v.setUint16(32, 1, true); // block align
  v.setUint16(34, 8, true); // bits per sample
  str(36, "data");
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128); // 8-bit silence is the midpoint
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

let installed = false;

export function installAudioUnlock() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const ios = isIOS();

  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (ios && session) {
    try {
      session.type = "playback";
    } catch {
      /* older builds expose the object read-only */
    }
  }

  let el: HTMLAudioElement | null = null;
  if (ios) {
    el = document.createElement("audio");
    el.setAttribute("x-webkit-airplay", "deny"); // keep it off the AirPlay picker
    el.setAttribute("playsinline", "");
    el.preload = "auto";
    el.loop = true;
    el.src = silentWav();
    el.load();
  }

  const onGesture = () => {
    if (el?.paused && document.visibilityState === "visible") void el.play().catch(() => {});
    player.resume();
  };
  for (const type of ["pointerdown", "keydown", "touchend"] as const) window.addEventListener(type, onGesture, { capture: true, passive: true });

  // Don't hold the media session while hidden (it would show up as "playing" on the lock
  // screen); the next tap after coming back restarts it.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") el?.pause();
  });
}
