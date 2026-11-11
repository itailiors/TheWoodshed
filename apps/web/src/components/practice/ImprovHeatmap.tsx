import {
  absBeat,
  chordAtBeat,
  chroma,
  evaluateLineNote,
  guideTones,
  melodyIn,
  pitchClass,
  prettyNote,
  prettySymbol,
  symbol,
  type ChordEvent,
  type LineNoteEval,
  type Tune,
} from "@reharm/theory-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { player } from "../../audio/player";
import { SketchBox, useRough, useSize } from "../../design/rough";
import { ink, seedOf, VERDICT_COLOR } from "../../design/tokens";
import { noteBus, useNoteBus } from "../../midi/noteBus";
import { PenKeyboard } from "./PenKeyboard";

interface Props {
  tune: Tune;
  chords: ChordEvent[];
  loop: { startBar: number; endBar: number };
  playing: boolean;
  /** Fill a fixed-height slot (Practice Mode): no intro text, no mouse keyboard, tape stretches to fit. */
  compact?: boolean;
}

interface HeatNote {
  id: number;
  midi: number;
  start: number;
  end: number | null;
  pass: number;
  chordSymbol: string;
  ev: LineNoteEval;
  /** A short off-beat avoid note: a passing tone, not a mistake. */
  passing: boolean;
  /** Started within a quarter beat of a chord change, on a guide tone of the new chord. */
  landing: boolean;
}

const W = 1000;
const H_DEFAULT = 250;
const LOW = 48;
const HIGH = 96;
const KEEP_PASSES = 3;
const LABEL: Record<LineNoteEval["verdict"], string> = { "chord-tone": "Chord tone", tension: "Tension", avoid: "Avoid", outside: "Chromatic / outside" };

/**
 * Improv heatmap: solo over the backing loop and every note lands on a "loop tape",
 * coloured by what it is over the chord that was sounding.
 */
export function ImprovHeatmap({ tune, chords, loop, playing, compact = false }: Props) {
  // In compact mode the tape takes the slot's aspect ratio, so it fills the space without distorting text.
  const [tapeRef, tapeSize] = useSize<HTMLDivElement>();
  const H = compact && tapeSize.w > 0 ? Math.max(110, Math.round((W * tapeSize.h) / tapeSize.w)) : H_DEFAULT;
  const bpb = tune.meter[0];
  const loopStart = (loop.startBar - 1) * bpb;
  const loopEnd = loop.endBar * bpb;
  const span = loopEnd - loopStart;
  const x = (beat: number) => ((beat - loopStart) / span) * W;
  const y = (midi: number) => 28 + ((HIGH - Math.min(HIGH, Math.max(LOW, midi))) / (HIGH - LOW)) * (H - 46);

  const [armed, setArmed] = useState(true);
  const [notes, setNotes] = useState<HeatNote[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [head, setHead] = useState<number | null>(null);
  const pass = useRef(0);
  const lastBeat = useRef(-1);
  const nextId = useRef(1);
  const open = useRef(new Map<number, number>()); // midi -> note id

  // smooth playhead + loop-wrap detection
  useEffect(() => {
    if (!playing) {
      setHead(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const b = player.currentBeat();
      if (b !== null) {
        if (b < lastBeat.current - 0.5) pass.current++;
        lastBeat.current = b;
        setHead(b);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const changes = useMemo(() => chords.map((c) => ({ beat: absBeat(c.at, bpb), chord: c })), [chords, bpb]);

  useNoteBus((m) => {
    const beat = player.currentBeat();
    if (m.type === "on") {
      if (beat === null) {
        setHint("Press Play to start the backing loop, then solo over it.");
        return;
      }
      setHint(null);
      const at = chordAtBeat(chords, beat, bpb);
      if (!at) return;
      const mel = melodyIn(tune, beat, beat + 0.01).map((n) => pitchClass(n.pitch));
      const ev = evaluateLineNote(m.note, at.chord, at.next, mel);
      const change = changes.find((c) => Math.abs(c.beat - beat) <= 0.25 || Math.abs(c.beat + span - beat) <= 0.25);
      const landing = !!change && guideTones(change.chord).some((g) => chroma(g.note) === m.note % 12);
      const id = nextId.current++;
      open.current.set(m.note, id);
      setNotes((ns) =>
        [...ns, { id, midi: m.note, start: beat, end: null, pass: pass.current, chordSymbol: symbol(at.chord), ev, passing: false, landing }].filter(
          (n) => n.pass > pass.current - KEEP_PASSES,
        ),
      );
    } else {
      const id = open.current.get(m.note);
      if (id === undefined) return;
      open.current.delete(m.note);
      setNotes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const end = beat === null || beat < n.start ? loopEnd : beat;
          const dur = end - n.start;
          const offbeat = Math.abs(n.start - Math.round(n.start)) > 0.15;
          return { ...n, end, passing: n.ev.verdict === "avoid" && dur < 0.5 && offbeat };
        }),
      );
    }
  }, armed);

  // ── drawing ──
  const g = useRef<SVGGElement>(null);
  const done = notes.filter((n) => n.end !== null);
  useRough(
    g,
    (rc, add) => {
      for (const n of done) {
        const age = pass.current - n.pass;
        const x1 = x(n.start);
        const w = Math.max(7, x(n.end!) - x1);
        const color = VERDICT_COLOR[n.ev.verdict];
        const node = rc.rectangle(x1, y(n.midi) - 5, w, 10, {
          seed: seedOf("n" + n.id),
          fill: color,
          fillStyle: n.passing ? "hachure" : age === 0 ? "solid" : "hachure",
          hachureGap: 2.5,
          stroke: n.landing ? ink.deep : color,
          strokeWidth: n.landing ? 1.8 : 1,
          roughness: 1.1,
        });
        node.setAttribute("opacity", String(age === 0 ? 1 : age === 1 ? 0.45 : 0.2));
        add(node);
      }
    },
    [done.map((n) => `${n.id}:${n.end}:${n.passing}`).join(","), pass.current, span, loopStart, H],
  );

  const stats = useMemo(() => {
    const total = notes.length || 1;
    const count = (v: LineNoteEval["verdict"]) => notes.filter((n) => n.ev.verdict === v).length;
    const strong = notes.filter((n) => Math.abs(n.start - Math.round(n.start)) <= 0.15);
    const strongCT = strong.filter((n) => n.ev.verdict === "chord-tone").length;
    const realAvoid = notes.filter((n) => n.ev.verdict === "avoid" && !n.passing && n.end !== null).length;
    return {
      n: notes.length,
      pct: (v: LineNoteEval["verdict"]) => Math.round((count(v) / total) * 100),
      strong: strong.length ? Math.round((strongCT / strong.length) * 100) : null,
      landings: notes.filter((n) => n.landing).length,
      realAvoid,
    };
  }, [notes]);

  const emit = (type: "on" | "off", note: number) => {
    // on-screen keys go through the same bus as MIDI
    if (type === "on") void player.noteOn(note);
    else player.noteOff(note);
    noteBus.emit({ type, note, velocity: 80, source: "virtual" });
  };

  return (
    <SketchBox seed={seedOf("heatmap")} strokeWidth={1.8} className={compact ? "h-full" : ""} innerClassName={compact ? "h-full" : ""}>
      <section className={compact ? "flex h-full flex-col px-4 py-2" : "p-4 md:p-6"} aria-labelledby="heat-h">
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
          <h2 id="heat-h" className={`ink-wobble font-marker font-bold uppercase ${compact ? "text-lg" : "text-2xl md:text-3xl"}`}>
            Improv heatmap
          </h2>
          <div className="flex items-center gap-3 font-marker text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={armed} onChange={(e) => setArmed(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
              Record my line
            </label>
            <button type="button" onClick={() => setNotes([])} className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 hover:bg-paper-shade">
              Clear
            </button>
          </div>
        </div>
        {!compact && (
          <p className="mt-1 text-sm text-ink-soft">
            Play single-note lines over the loop (bars {loop.startBar}–{loop.endBar}). Each note is judged against the chord sounding at that moment. Older passes fade.
          </p>
        )}

        <div ref={tapeRef} className={compact ? "min-h-0 flex-1" : "mt-3 overflow-x-auto"}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className={compact ? "block h-full w-full" : "block h-auto w-full min-w-[560px]"}
            role="img"
            aria-label="Improv heatmap loop tape"
          >
            {/* bar grid + chord labels */}
            {Array.from({ length: loop.endBar - loop.startBar + 1 }, (_, i) => {
              const bx = x(loopStart + i * bpb);
              return (
                <g key={i}>
                  <line x1={bx} y1={18} x2={bx} y2={H - 6} className="stroke-ink-faint" strokeDasharray="4 5" strokeWidth={1} />
                  <text x={bx + 3} y={H - 8} fontSize={10} className="fill-ink-faint font-hand">
                    {loop.startBar + i}
                  </text>
                </g>
              );
            })}
            {changes
              .filter((c) => c.beat >= loopStart && c.beat < loopEnd)
              .map((c) => (
                <text key={c.chord.id} x={x(c.beat) + 4} y={14} fontSize={14} fontWeight={700} className="fill-ink font-marker">
                  {prettySymbol(symbol(c.chord))}
                </text>
              ))}
            {[60, 72, 84].map((m) => (
              <text key={m} x={W - 4} y={y(m) + 3} textAnchor="end" fontSize={9} className="fill-ink-faint font-hand">
                C{m / 12 - 1}
              </text>
            ))}
            <g ref={g} />
            {/* notes still sounding */}
            {notes
              .filter((n) => n.end === null && head !== null)
              .map((n) => (
                <rect key={n.id} x={x(n.start)} y={y(n.midi) - 5} width={Math.max(6, x(head!) - x(n.start))} height={10} rx={2} fill={VERDICT_COLOR[n.ev.verdict]} />
              ))}
            {/* tooltips */}
            {notes.map((n) => (
              <rect key={`t${n.id}`} x={x(n.start)} y={y(n.midi) - 6} width={Math.max(8, x(n.end ?? n.start + 0.25) - x(n.start))} height={12} fill="transparent">
                <title>
                  {`${prettyNote(n.ev.name)} = ${prettyNote(n.ev.role)} over ${prettySymbol(n.chordSymbol)} · ${LABEL[n.ev.verdict]}${n.passing ? " (passing)" : ""}${n.ev.scale ? ` · scale: ${n.ev.scale}` : ""}${n.landing ? " · guide-tone landing" : ""}`}
                </title>
              </rect>
            ))}
            {head !== null && <line x1={x(head)} y1={18} x2={x(head)} y2={H - 6} className="stroke-wash-brick" strokeWidth={2} />}
          </svg>
        </div>

        <div className={`flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 ${compact ? "mt-1 text-xs" : "mt-3 text-sm"}`}>
          {(Object.keys(LABEL) as LineNoteEval["verdict"][]).map((v) => (
            <span key={v} className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 -rotate-2 rounded-sm" style={{ background: VERDICT_COLOR[v] }} />
              {LABEL[v]} {stats.n > 0 && <span className="text-ink-faint">{stats.pct(v)}%</span>}
            </span>
          ))}
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded-sm border-2 border-ink" /> guide-tone landing
          </span>
        </div>
        {stats.n > 0 && (
          <p className={`shrink-0 font-marker ${compact ? "truncate text-sm" : "mt-2 text-[15px]"}`}>
            {stats.strong !== null && <>Chord tones on the beat: {stats.strong}%. </>}
            Landed on a guide tone at {stats.landings} change{stats.landings === 1 ? "" : "s"}.{" "}
            {stats.realAvoid > 0 ? `${stats.realAvoid} held avoid note${stats.realAvoid === 1 ? "" : "s"}: resolve them by step.` : "No held avoid notes."}
          </p>
        )}
        {hint && <p className={`shrink-0 font-marker text-wash-brick ${compact ? "text-sm" : "mt-2"}`}>{hint}</p>}

        <details className={compact ? "hidden" : "mt-3"}>
          <summary className="cursor-pointer font-marker text-sm text-ink-soft">No MIDI? Play with the mouse</summary>
          <PenKeyboard low={60} high={84} onKey={(m) => emit("on", m)} onKeyUp={(m) => emit("off", m)} className="mt-2 max-w-[520px]" />
        </details>
      </section>
    </SketchBox>
  );
}
