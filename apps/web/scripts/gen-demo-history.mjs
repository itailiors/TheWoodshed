// Generates apps/web/src/library/demoHistory.json: three weeks of plausible practice, with
// times stored relative to "now" (days ago / days until due) so the demo never goes stale.
import { writeFileSync } from "node:fs";
const out = process.argv[2];
let s = 20261111;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const r1 = (x) => Math.round(x * 10) / 10;

// SM-2 as the API runs it: reps 1 → 1 day, reps 2 → 3 days, then interval × ease.
const interval = (reps, ease) => (reps === 0 ? 10 / 1440 : reps === 1 ? 1 : reps === 2 ? 3 : Math.round(3 * ease ** (reps - 2) * 100) / 100);

// [key, reps, ease, daysSinceReview, attempts, cleanRuns, lastGrade]
const plan = {
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
  "chromatic.commonToneDiminished": [["Bb", 2, 2.36, 2.7, 4, 2, 4], ["Eb", 1, 2.5, 0.8, 2, 1, 4], ["F", 1, 2.22, 0.7, 3, 1, 3]],
  "gospel.halfStepTurnaround": [["Bb", 2, 2.6, 1.8, 2, 2, 5], ["F", 1, 2.5, 0.6, 1, 1, 5]],
  "symmetric.coltraneSubstitution": [["Bb", 0, 1.7, 0.15, 4, 0, 1]],
};
// where each concept was last drilled: a move in the demo tune
const places = {
  "dominant.tritoneSub": "dominant.tritoneSub@6.1",
  "functional.secondaryTwoFive": "functional.secondaryTwoFive@2.1",
  "voicing.upperStructureBVI": "voicing.upperStructureBVI@4.1",
  "modal.backdoorTwoFive": "modal.backdoorTwoFive@8.1",
  "chromatic.commonToneDiminished": "chromatic.commonToneDiminished@3.1",
  "gospel.halfStepTurnaround": "gospel.halfStepTurnaround@8.1",
  "symmetric.coltraneSubstitution": "symmetric.coltraneSubstitution@7.1",
};

const concepts = [];
for (const [ruleId, rows] of Object.entries(plan))
  for (const [keyTonic, reps, ease, ago, attempts, cleanRuns, lastGrade] of rows) {
    const intervalDays = interval(reps, ease);
    concepts.push({ ruleId, keyTonic, reps, ease, intervalDays, attempts, cleanRuns, lastGrade, reviewedDaysAgo: ago, dueInDays: r1(intervalDays - ago) || -0.01 });
  }

// 20 improv passes over 21 days, getting steadily better at landing on chord tones
const improv = [];
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
  tuneId: "someday-my-prince",
  places,
  concepts,
  improv,
}, null, 1) + "\n");
console.log(concepts.length, "reviews,", concepts.filter((c) => c.dueInDays <= 0).length, "due,", improv.length, "improv runs");
