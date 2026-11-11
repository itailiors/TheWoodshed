// Generates apps/web/src/library/demoHistory.json: three weeks of plausible practice on the
// reference tune, with times stored relative to "now" (days ago / days until due) so the
// demo never goes stale. Run from the repo root:
//   npx tsx apps/web/scripts/gen-demo-history.ts apps/web/src/library/demoHistory.json
// It refuses to write if a passport "place" isn't a move the engine accepts on the reference
// tune, so "Practise →" in the demo always lands on a real move.
import { writeFileSync } from "node:fs";
import { BUNDLED_TUNES, generateMoves, referenceTune } from "@reharm/theory-core";
const out = process.argv[2];
if (!out) throw new Error("usage: tsx gen-demo-history.ts <out.json>");
let s = 20261111;
const rnd = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const r1 = (x: number) => Math.round(x * 10) / 10;

// SM-2 as the API runs it: reps 1 → 1 day, reps 2 → 3 days, then interval × ease.
const interval = (reps: number, ease: number) => (reps === 0 ? 10 / 1440 : reps === 1 ? 1 : reps === 2 ? 3 : Math.round(3 * ease ** (reps - 2) * 100) / 100);

// [key, reps, ease, daysSinceReview, attempts, cleanRuns, lastGrade]
const plan: Record<string, [string, number, number, number, number, number, number][]> = {
  "dominant.tritoneSub": [
    ["Bb", 4, 2.6, 2.5, 6, 5, 5], ["F", 4, 2.5, 6.2, 5, 4, 5], ["Eb", 3, 2.5, 4.1, 4, 3, 4], ["C", 3, 2.4, 8.0, 5, 3, 4],
    ["Ab", 3, 2.36, 1.2, 4, 3, 5], ["G", 2, 2.5, 2.1, 3, 2, 4], ["Db", 2, 2.36, 0.8, 4, 2, 4], ["D", 1, 2.5, 0.6, 2, 1, 4], ["A", 1, 2.36, 0.4, 3, 1, 3],
  ],
  "functional.secondaryTwoFive": [
    ["Bb", 4, 2.5, 3.7, 5, 4, 5], ["F", 3, 2.5, 2.2, 4, 3, 5], ["Eb", 3, 2.36, 8.9, 4, 3, 4], ["C", 2, 2.5, 1.3, 3, 2, 5],
    ["G", 2, 2.36, 1.5, 3, 2, 4], ["Ab", 1, 2.5, 0.6, 1, 1, 5], ["D", 1, 2.36, 0.7, 2, 1, 3],
  ],
  "voicing.upperStructureBVI": [
    ["Bb", 3, 2.22, 5.0, 6, 3, 4], ["F", 2, 2.36, 1.1, 4, 2, 4], ["Eb", 1, 2.18, 0.9, 3, 1, 3], ["C", 1, 2.36, 2.3, 2, 1, 4],
    ["Ab", 0, 1.96, 0.25, 3, 0, 2], ["G", 1, 2.18, 0.4, 3, 1, 3],
  ],
  "modal.backdoorTwoFive": [["Bb", 3, 2.5, 6.8, 3, 3, 5], ["F", 2, 2.6, 2.0, 2, 2, 5], ["Eb", 2, 2.5, 1.9, 3, 2, 4], ["C", 1, 2.5, 0.5, 1, 1, 5], ["G", 1, 2.36, 0.6, 2, 1, 4]],
  "gospel.halfStepTurnaround": [["Bb", 2, 2.36, 2.7, 4, 2, 4], ["Eb", 1, 2.5, 0.8, 2, 1, 4], ["F", 1, 2.22, 0.7, 3, 1, 3]],
  // the L4 one this player hasn't cracked yet
  "chromatic.constantStructure": [["Bb", 0, 1.7, 0.15, 4, 0, 1]],
};
// Where each concept was last drilled: a move on one of the bundled tunes. Most live on the
// reference tune; two live on the public-domain standards, so the demo's "Practise →" also
// exercises the cross-chart path (load that chart, then open the Coach on the move).
const places: Record<string, { tuneId: string; moveId: string }> = {
  "dominant.tritoneSub": { tuneId: referenceTune.id, moveId: "dominant.tritoneSub@10.1" },
  "functional.secondaryTwoFive": { tuneId: "sunny-side", moveId: "functional.secondaryTwoFive@2.1" },
  "voicing.upperStructureBVI": { tuneId: referenceTune.id, moveId: "voicing.upperStructureBVI@8.3" },
  "modal.backdoorTwoFive": { tuneId: "i-got-rhythm", moveId: "modal.backdoorTwoFive@10.3" },
  "gospel.halfStepTurnaround": { tuneId: referenceTune.id, moveId: "gospel.halfStepTurnaround@10.1" },
  "chromatic.constantStructure": { tuneId: referenceTune.id, moveId: "chromatic.constantStructure@4.1" },
};
for (const [ruleId, { tuneId, moveId }] of Object.entries(places)) {
  const tune = BUNDLED_TUNES.find((t) => t.id === tuneId);
  if (!tune) throw new Error(`${tuneId} isn't a bundled tune`);
  if (!generateMoves(tune).accepted.some((m) => m.id === moveId)) throw new Error(`${moveId} is not an accepted move on ${tune.title}`);
  if (!moveId.startsWith(ruleId + "@")) throw new Error(`${moveId} doesn't belong to ${ruleId}`);
}
for (const ruleId of Object.keys(plan)) if (!places[ruleId]) throw new Error(`no place for ${ruleId}`);

const concepts: { ruleId: string; keyTonic: string; dueInDays: number }[] = [];
for (const [ruleId, rows] of Object.entries(plan))
  for (const [keyTonic, reps, ease, ago, attempts, cleanRuns, lastGrade] of rows) {
    const intervalDays = interval(reps, ease);
    concepts.push({ ruleId, keyTonic, reps, ease, intervalDays, attempts, cleanRuns, lastGrade, reviewedDaysAgo: ago, dueInDays: r1(intervalDays - ago) || -0.01 });
  }

// 20 improv passes over 21 days, getting steadily better at landing on chord tones
const improv: object[] = [];
for (let i = 0; i < 20; i++) {
  const t = i / 19;
  const daysAgo = r1(21 - t * 20.6 - rnd() * 0.4);
  const chordTonePct = Math.round(47 + 25 * t + (rnd() - 0.5) * 9);
  const tensionPct = Math.round(15 + 8 * t + (rnd() - 0.5) * 5);
  const avoidPct = Math.max(1, Math.round(13 - 9 * t + (rnd() - 0.5) * 3));
  const outsidePct = Math.max(0, 100 - chordTonePct - tensionPct - avoidPct);
  improv.push({
    daysAgo,
    level: t < 0.3 ? 1 : t < 0.7 ? 2 : 3,
    view: rnd() < 0.8 ? "reharm" : "original",
    notes: Math.round(58 + 70 * t + rnd() * 30),
    chordTonePct, tensionPct, avoidPct, outsidePct,
    strongBeatChordTonePct: Math.round(54 + 30 * t + (rnd() - 0.5) * 8),
    guideToneLandings: Math.round(1 + 6 * t + rnd() * 1.5),
    heldAvoidNotes: Math.max(0, Math.round(3 - 3.5 * t + rnd())),
  });
}

writeFileSync(out, JSON.stringify({
  $comment: "Seeded practice history for the read-only demo (three weeks of a plausible player). Times are relative to page load; see demoHistory.ts.",
  tuneId: referenceTune.id,
  places,
  concepts,
  improv,
}, null, 1) + "\n");
console.log(concepts.length, "reviews,", concepts.filter((c) => c.dueInDays <= 0).length, "due,", improv.length, "improv runs");
