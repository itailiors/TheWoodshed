import {
  absBeat,
  buildPathwayTraced,
  generateMovesTraced,
  prettyNote,
  prettySymbol,
  sortedHarmony,
  symbol,
  type PathwayDecision,
  type Rank,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";
import { useMemo, type ReactNode } from "react";
import { CATEGORY_LABEL, CATEGORY_WASH, pen, wash } from "../../design/tokens";

interface Props {
  tune: Tune;
  level: number;
  /** Your picks from "Also works here": they go in first, just as in the app. */
  forced: ReharmMove[];
  bar: number;
}

type Row = {
  move: ReharmMove;
  /** Melody-filter reasons when it was struck out. */
  struck: string[] | null;
  decision: PathwayDecision | null;
};

const STAGES = ["Rule proposes", "Melody filter", "Voice leading", "Pathway"] as const;

const chordsOf = (cs: { root: string; quality: string }[]) => cs.map((c) => prettySymbol(symbol(c as Parameters<typeof symbol>[0]))).join(" · ");

/**
 * The engine's decisions for one bar, as a pipeline you can read left to right:
 * every rule that proposed something here, what the melody filter did to it (red pen),
 * its guide-tone voice-leading score (an ink bar), and how the pathway builder ranked it.
 * The data is the engine's own trace (generateMovesTraced / buildPathwayTraced), the same
 * code path the app plays from, so nothing here is reconstructed after the fact.
 */
export function XRayPipeline({ tune, level, forced, bar }: Props) {
  const bpb = tune.meter[0];
  const trace = useMemo(() => generateMovesTraced(tune), [tune]);
  const path = useMemo(() => buildPathwayTraced(trace.accepted, level, forced), [trace, level, forced]);
  const byId = useMemo(() => new Map(trace.accepted.map((m) => [m.id, m])), [trace]);

  const [from, to] = [(bar - 1) * bpb, bar * bpb];
  const touches = (m: ReharmMove) => m.spanBeats.start < to && m.spanBeats.end > from;

  const rows: Row[] = useMemo(() => {
    const kept = trace.accepted.filter(touches).map((m) => ({ move: m, struck: null, decision: path.decisions.get(m.id) ?? null }));
    const cut = trace.rejected.filter((r) => touches(r.move)).map((r) => ({ move: r.move, struck: r.reasons, decision: null }));
    const order = (r: Row) => (r.decision?.kind === "forced" || r.decision?.kind === "chosen" ? 0 : r.struck ? 2 : 1);
    return [...kept, ...cut].sort((a, b) => order(a) - order(b) || rankOf(b.decision) - rankOf(a.decision) || a.move.priority - b.move.priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace, path, bar]);

  // Which rules were asked about the chords in this bar, and what they said.
  const chordsHere = sortedHarmony(tune).filter((c) => {
    const s = absBeat(c.at, bpb);
    return s < to && s + c.beats > from;
  });
  const asked = trace.attempts.filter((a) => chordsHere.some((c) => c.id === a.chordId));
  const silent = [...new Set(asked.filter((a) => a.outcome === "no-fit").map((a) => a.ruleName))].filter(
    (name) => !asked.some((a) => a.ruleName === name && a.outcome !== "no-fit"),
  );

  return (
    <div className="space-y-4">
      {/* what was on the page before the engine touched it */}
      <p className="text-[15px]">
        <span className="font-marker">Bar {bar} as written:</span> {chordsHere.map((c) => prettySymbol(symbol(c))).join(" · ") || "(no chord starts here)"}
        <span className="text-ink-soft">
          {" "}
          · {asked.length} rule checks on {chordsHere.length} chord{chordsHere.length === 1 ? "" : "s"}, {rows.length} proposal{rows.length === 1 ? "" : "s"} touch this bar
        </span>
      </p>

      {/* stage headers with hand-drawn arrows between them */}
      <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.25fr)] items-center gap-3 md:grid">
        {STAGES.map((s, i) => (
          <div key={s} className="flex items-center gap-2 font-marker text-sm uppercase tracking-wider text-ink-soft">
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-ink text-xs text-ink">{i + 1}</span>
            {s}
            {i < STAGES.length - 1 && <InkArrow />}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded border-2 border-dashed border-ink-faint px-4 py-3 text-ink-soft">
          No rule proposed anything that touches bar {bar}. The engine leaves it as written, and that's a decision too.
        </p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r) => (
            <PipelineRow key={r.move.id} row={r} byId={byId} />
          ))}
        </ol>
      )}

      {silent.length > 0 && (
        <p className="text-sm text-ink-soft">
          <span className="font-marker text-ink">Nothing to say here:</span> {silent.join(" · ")}
          <span className="text-ink-faint"> (their conditions didn't match these chords)</span>
        </p>
      )}
    </div>
  );
}

/** "bar 2" or "bars 7–8" (a span ending on a downbeat doesn't reach into that bar). */
function barRange(m: ReharmMove) {
  const last = m.span.to.beat === 1 ? m.span.to.bar - 1 : m.span.to.bar;
  return last > m.span.from.bar ? `bars ${m.span.from.bar}–${last}` : `bar ${m.span.from.bar}`;
}

const rankOf = (d: PathwayDecision | null) => (d && "rank" in d && d.rank ? d.rank.total : -Infinity);

function PipelineRow({ row, byId }: { row: Row; byId: Map<string, ReharmMove> }) {
  const { move: m, struck, decision } = row;
  const won = decision?.kind === "chosen" || decision?.kind === "forced";
  return (
    <li
      className={`grid grid-cols-1 gap-3 rounded-lg border-2 p-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.25fr)] md:items-center ${
        won ? "border-ink bg-paper-light" : "border-dashed border-ink-faint"
      } ${struck ? "opacity-90" : ""}`}
    >
      {/* 1 · the proposal */}
      <div className="relative min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="inline-block h-3 w-3 shrink-0 -rotate-6 rounded-sm" style={{ background: CATEGORY_WASH[m.category] }} title={CATEGORY_LABEL[m.category]} />
          <span className="font-marker font-bold">{m.title}</span>
          <span className="rounded border border-ink-faint px-1 font-marker text-xs">L{m.level}</span>
        </p>
        <p className="mt-0.5 font-music text-sm">
          <span className="text-ink-soft">{chordsOf(m.original)}</span> <span aria-hidden>→</span> {chordsOf(m.chords)}
        </p>
        <p className="text-xs text-ink-faint">{barRange(m)}</p>
        {struck && <RedStrike />}
      </div>

      {/* 2 · the melody filter */}
      <Cell label={STAGES[1]}>
        {struck ? (
          <p className="font-hand text-[15px] leading-snug" style={{ color: pen.red }}>
            ✗ {struck[0]}
            {struck.length > 1 && <span className="text-xs"> (+{struck.length - 1} more)</span>}
          </p>
        ) : m.checks.melody.length ? (
          <p className="text-sm">
            <span className="font-marker">✓ melody fits</span>{" "}
            <span className="text-ink-soft">
              {m.checks.melody
                .slice(0, 3)
                .map((c) => `${prettyNote(c.note)} over ${prettySymbol(c.chordSymbol)} (${prettyNote(c.role)})`)
                .join(", ")}
            </span>
          </p>
        ) : (
          <p className="text-sm text-ink-soft">no melody notes under it{m.checks.melodyVerified ? "" : ", so it isn't melody-checked"}</p>
        )}
      </Cell>

      {/* 3 · voice leading */}
      <Cell label={STAGES[2]}>
        <ScoreBar score={m.checks.score} faded={!!struck} />
        {m.voiceLeading.length > 0 && (
          <p className="mt-1 truncate font-music text-xs text-ink-soft" title="Guide-tone motion into the next chord">
            {m.voiceLeading
              .slice(0, 2)
              .map((v) => `${prettyNote(v.from)}→${prettyNote(v.to)} (${v.semitones >= 0 ? "+" : ""}${v.semitones})`)
              .join("  ")}
          </p>
        )}
      </Cell>

      {/* 4 · the pathway's verdict */}
      <Cell label={STAGES[3]}>{struck ? <p className="text-sm text-ink-faint">never reached: struck by the melody filter</p> : <Verdict d={decision} byId={byId} />}</Cell>
    </li>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-marker text-[11px] uppercase tracking-wider text-ink-faint md:hidden">{label}</p>
      {children}
    </div>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The rank sum, written out: "L2×2 + 8.5 − 1.5 = 11". */
function Formula({ r }: { r: Rank }) {
  return (
    <span className="font-mono text-xs text-ink-soft" title="rank = level × 2 + voice-leading score − 1.5 per earlier use of the same rule">
      L{r.level}×2 + {fmt(r.score)}
      {r.repeats > 0 && ` − ${fmt(r.penalty)}`} = <span className="font-bold text-ink">{fmt(r.total)}</span>
    </span>
  );
}

function Verdict({ d, byId }: { d: PathwayDecision | null; byId: Map<string, ReharmMove> }) {
  if (!d) return null;
  // Name the winner by title and place: two tritone subs in one phrase are different moves.
  const title = (id: string) => {
    const m = byId.get(id);
    return m ? `${m.title} (${barRange(m)})` : id;
  };
  switch (d.kind) {
    case "forced":
      return <Stamp>Your pick: it goes in first</Stamp>;
    case "chosen":
      return (
        <div>
          <Stamp>In the reharm</Stamp>
          <p className="mt-1">
            <Formula r={d.rank} />
          </p>
        </div>
      );
    case "dial-off":
      return <p className="text-sm text-ink-soft">dial at L0: the tune as written</p>;
    case "above-dial":
      return (
        <p className="text-sm">
          too spicy for the dial: <span className="font-marker">L{d.level}</span> on an <span className="font-marker">L{d.maxLevel}</span> setting
        </p>
      );
    case "overlaps":
      return (
        <div className="text-sm">
          <p>
            lost the beats to <span className="font-marker">{title(d.by)}</span>
          </p>
          {d.rank && (
            <p>
              <Formula r={d.rank} />
            </p>
          )}
        </div>
      );
    case "capped":
      return (
        <div className="text-sm">
          <p>
            phrase full: bars {d.window[0]}–{d.window[1]} allow {d.maxMoves}, taken by <span className="font-marker">{d.takenBy.map(title).join(", ")}</span>
          </p>
          <p>
            <Formula r={d.rank} />
          </p>
        </div>
      );
  }
}

/** A red-pen circle-and-tick: the move made it into the reharm. */
function Stamp({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-flex items-center gap-1.5 font-marker" style={{ color: pen.red }}>
      <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden filter="url(#ink-wobble)">
        <circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5.8 10.4 L8.8 13.3 L14.4 6.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  );
}

/** Guide-tone voice-leading score (0–10) as an ink bar with a hatched fill. */
function ScoreBar({ score, faded }: { score: number; faded: boolean }) {
  const pct = Math.max(0, Math.min(10, score)) * 10;
  return (
    <div className={`flex items-center gap-2 ${faded ? "opacity-50" : ""}`} title={`Guide-tone voice-leading score: ${fmt(score)} of 10 (10 = the guide tones barely move)`}>
      <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="h-3.5 flex-1" aria-hidden>
        <defs>
          <pattern id="xray-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke={wash.blue} strokeWidth="2.4" />
          </pattern>
        </defs>
        <g filter="url(#ink-wobble)">
          <rect x="1" y="2" width="98" height="10" fill="none" stroke="var(--color-ink-faint)" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="1" y="2" width={(98 * pct) / 100} height="10" fill="url(#xray-hatch)" stroke="var(--color-ink)" strokeWidth="1.4" />
        </g>
      </svg>
      <span className="w-12 shrink-0 text-right font-mono text-xs">{fmt(score)}/10</span>
    </div>
  );
}

/** The red pen through a struck-out proposal. */
function RedStrike() {
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <path d="M2 21 C30 16 62 13 98 8" fill="none" stroke={pen.red} strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" filter="url(#ink-wobble)" />
    </svg>
  );
}

function InkArrow() {
  return (
    <svg viewBox="0 0 40 12" className="ml-auto h-3 w-10 text-ink-soft" aria-hidden filter="url(#ink-wobble)">
      <path d="M1 6.5 C12 5.6 24 6.9 36 6 M30 1.8 L37 6 L30.6 10.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
