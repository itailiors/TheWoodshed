import { currentRound, currentStep, prettySymbol, stepKind, trail, type GameState } from "@reharm/theory-core";
import type { Connector, Station } from "./RoadTrail";

/**
 * The road for the current moment of the game: the stations reached so far, where you are, the
 * next stop as a "?", and home as a ghost at the end. The shape of the next step (an even stair,
 * the wider hop, the door) is only drawn ahead of time in Guided: in Choices and Open it would
 * give the answer away.
 */
export function roadOf(s: GameState): { stations: Station[]; connectors: Connector[]; label: string } | null {
  const r = currentRound(s);
  const step = currentStep(s);
  if (!r || !step) return null;
  const chords = trail(s);
  const home = r.steps[r.steps.length - 1].expected;
  const lastStep = s.stepIdx === r.steps.length - 1;
  const answered = s.phase === "feedback" || s.phase === "fixing" || s.phase === "chip";
  const ended = s.phase === "roundEnd";

  const stations: Station[] = chords.map((c, i) => {
    if (i < chords.length - 1) return { symbol: c.symbol, state: "past" };
    if (ended) return { symbol: c.symbol, state: "home" };
    if (!answered) return { symbol: c.symbol, state: "current" };
    // the station the answer just reached, marked with how it went (a root waiting for its chip was right)
    return { symbol: c.symbol, state: lastStep ? "home" : "current", outcome: s.verdict?.kind ?? "right" };
  });
  const connectors: Connector[] = chords.slice(1).map((c, i) => ({ kind: stepKind(chords[i], c) }));

  if (!ended) {
    if (!answered) {
      // the next stop, not yet known
      stations.push({ symbol: null, state: "next" });
      connectors.push({ kind: s.stage === "guided" ? stepKind(step.from, step.expected) : "unknown" });
    }
    // home, far off, unless the stop in question is home itself
    if (!lastStep) {
      connectors.push({ kind: null });
      stations.push({ symbol: home.symbol, state: "ghost" });
    }
  }

  const label = `Road: ${chords.map((c) => prettySymbol(c.symbol)).join(", ")}${ended ? ", home." : `, then on to ${prettySymbol(home.symbol)}.`}`;
  return { stations, connectors, label };
}
