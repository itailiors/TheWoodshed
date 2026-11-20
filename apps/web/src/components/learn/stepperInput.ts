import type { LessonStep } from "@reharm/theory-core";
import { player } from "../../audio/player";
import { noteBus } from "../../midi/noteBus";

/*
 * Where the stepper's own keys go. The one rule that keeps a lesson away from every other note
 * listener (Study's improv heatmap saves what it hears): a key reaches the note bus only while
 * an ask is open, and an ask is open only when asks are enabled. Pure decision + one emitter,
 * so the guard is unit-tested (`heatmapGuard.test.ts`).
 */

/** An unanswered ask is showing: asks are on, this step has one, and it hasn't been answered or shown. */
export const askIsOpen = (step: LessonStep, asksEnabled: boolean, revealed: unknown) => !!step.ask && asksEnabled && !revealed;

/** How long an on-screen key's note-on lasts before its guaranteed note-off. */
export const TAP_MS = 150;

/** An on-screen key: sounded by the app's piano; out on the note bus (with a note-off) only when `toBus`. */
export function pressKey(m: number, toBus: boolean) {
  void player.playNotes([m], 0.5);
  if (!toBus) return;
  noteBus.emit({ type: "on", note: m, velocity: 0.7, source: "virtual" });
  setTimeout(() => noteBus.emit({ type: "off", note: m, velocity: 0, source: "virtual" }), TAP_MS);
}
