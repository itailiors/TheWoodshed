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
import { packLabels, textWidth, useFontsReady } from "../../design/labels";
import { SketchBox, useRough, useSize } from "../../design/rough";
import { ink, seedOf, VERDICT_COLOR } from "../../design/tokens";
import { noteBus, useNoteBus } from "../../midi/noteBus";
import { PenKeyboard } from "./PenKeyboard";
import { saveImprovRun } from "../../library/practice";

interface Props {
  tune: Tune;
  chords: ChordEvent[];
  loop: { startBar: number; endBar: number };
  playing: boolean;
  /** Fill a fixed-height slot (Practice Mode): no intro text, no mouse keyboard, tape stretches to fit. */
  compact?: boolean;
  /** Saved with each pass, so the history knows what you were soloing over. */
  level: number;
  view: "reharm" | "original";
}

/** Passes shorter than this aren't worth a history entry (a stray note or two). */
const MIN_NOTES_TO_SAVE = 4;

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
/** Loops up to this many bars show whole; longer ones show one PAGE at a time. */
const WHOLE_MAX = 12;
/** Bars per page (two 4-bar phrases), aligned to bar 1 like Practice Mode's lead sheet. */
const PAGE = 8;
const CHORD_FONT = '700 14px Kalam, "Noto Music"';
const CHORD_LANE_Y = [14, 29];
const LABEL: Record<LineNoteEval["verdict"], string> = { "chord-tone": "Chord tone", tension: "Tension", avoid: "Avoid", outside: "Chromatic / outside" };

/**
 * Improv heatmap: solo over the backing loop and every note lands on a "loop tape",
 * coloured by what it is over the chord that was sounding.
 */
/** The heatmap's numbers for a set of notes: shown under the tape, and saved per pass. */
function summarise(notes: HeatNote[]) {
  const total = notes.length || 1;
  const count = (v: LineNoteEval["verdict"]) => notes.filter((n) => n.ev.verdict === v).length;
  const pct = (v: LineNoteEval["verdict"]) => Math.round((count(v) / total) * 100);
  const strong = notes.filter((n) => Math.abs(n.start - Math.round(n.start)) <= 0.15);
  const strongCT = strong.filter((n) => n.ev.verdict === "chord-tone").length;
  return {
    n: notes.length,
    pct,
    strong: strong.length ? Math.round((strongCT / strong.length) * 100) : null,
    landings: notes.filter((n) => n.landing).length,
    realAvoid: notes.filter((n) => n.ev.verdict === "avoid" && !n.passing && n.end !== null).length,
  };
}

export function ImprovHeatmap({ tune, chords, loop, playing, compact = false, level, view }: Props) {
  // In compact mode the tape takes the slot's aspect ratio, so it fills the space without distorting text.
  const [tapeRef, tapeSize] = useSize<HTMLDivElement>();
  const H = compact && tapeSize.w > 0 ? Math.max(110, Math.round((W * tapeSize.h) / tapeSize.w)) : H_DEFAULT;
  const bpb = tune.meter[0];
  const loopStart = (loop.startBar - 1) * bpb;
  const loopEnd = loop.endBar * bpb;
  const span = loopEnd - loopStart;

  // ── paging: a long loop squeezed into one tape made chord names pile up and notes too thin
  // to read, so loops over WHOLE_MAX bars show 8 bars at a time. Pages are aligned to bar 1
  // (bars 1–8, 9–16 …), the same pages Practice Mode's lead sheet turns, so the two stay in step.
  const loopBars = loop.endBar - loop.startBar + 1;
  const paged = loopBars > WHOLE_MAX;
  const pageOf = (bar: number) => Math.floor((bar - 1) / PAGE);
  const firstPage = pageOf(loop.startBar);
  const lastPage = pageOf(loop.endBar);
  const [browsePage, setBrowsePage] = useState(firstPage);
  const [head, setHead] = useState<number | null>(null);
  const headBar = head !== null ? Math.floor(head / bpb) + 1 : null;
  const pageIdx = !paged ? firstPage : headBar !== null ? Math.min(lastPage, Math.max(firstPage, pageOf(headBar))) : Math.min(lastPage, Math.max(firstPage, browsePage));
  // keep the browse position on the page the music last showed, so Stop doesn't jump away
  useEffect(() => {
    if (paged && headBar !== null) setBrowsePage(pageIdx);
  }, [paged, headBar, pageIdx]);
  useEffect(() => setBrowsePage(pageOf(loop.startBar)), [loop.startBar, loop.endBar]);
  const winFirstBar = paged ? Math.max(loop.startBar, pageIdx * PAGE + 1) : loop.startBar;
  const winLastBar = paged ? Math.min(loop.endBar, pageIdx * PAGE + PAGE) : loop.endBar;
  const winStart = (winFirstBar - 1) * bpb;
  const winEnd = winLastBar * bpb;
  const inWin = (start: number, end: number) => start < winEnd && end > winStart;
  const x = (beat: number) => ((Math.min(winEnd, Math.max(winStart, beat)) - winStart) / (winEnd - winStart)) * W;

  const [armed, setArmed] = useState(true);
  const [notes, setNotes] = useState<HeatNote[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const pass = useRef(0);
  const lastBeat = useRef(-1);
  const nextId = useRef(1);
  const open = useRef(new Map<number, number>()); // midi -> note id

  // ── saving: one history entry per pass over the loop ──
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const saveCtx = useRef({ tuneId: tune.id, level, view, loop });
  saveCtx.current = { tuneId: tune.id, level, view, loop };
  const savedPasses = useRef(new Set<number>());
  const savePass = (p: number) => {
    if (savedPasses.current.has(p)) return;
    const ns = notesRef.current.filter((n) => n.pass === p);
    if (ns.length < MIN_NOTES_TO_SAVE) return;
    savedPasses.current.add(p);
    const st = summarise(ns);
    const c = saveCtx.current;
    void saveImprovRun({
      tuneId: c.tuneId,
      level: c.level,
      view: c.view,
      loopStartBar: c.loop.startBar,
      loopEndBar: c.loop.endBar,
      notes: st.n,
      chordTonePct: st.pct("chord-tone"),
      tensionPct: st.pct("tension"),
      avoidPct: st.pct("avoid"),
      outsidePct: st.pct("outside"),
      strongBeatChordTonePct: st.strong,
      guideToneLandings: st.landings,
      heldAvoidNotes: st.realAvoid,
    });
  };
  const savePassRef = useRef(savePass);
  savePassRef.current = savePass;
  // Leaving mid-pass (switching modes, changing tune) still counts what you played.
  useEffect(() => () => savePassRef.current(pass.current), []);

  // smooth playhead + loop-wrap detection
  useEffect(() => {
    if (!playing) {
      setHead(null);
      // Stopping ends the pass: save it, and start a fresh one for the next Play.
      savePassRef.current(pass.current);
      if (notesRef.current.some((n) => n.pass === pass.current)) pass.current++;
      return;
    }
    let raf = 0;
    const tick = () => {
      const b = player.currentBeat();
      if (b !== null) {
        if (b < lastBeat.current - 0.5) {
          savePassRef.current(pass.current); // the loop wrapped: that pass is finished
          pass.current++;
        }
        lastBeat.current = b;
        setHead(b);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const changes = useMemo(() => chords.map((c) => ({ beat: absBeat(c.at, bpb), chord: c })), [chords, bpb]);

  // chord names over this window, packed into two rows so crowded bars never overlap
  useFontsReady();
  const chordLabels = packLabels(
    changes
      .filter((c) => c.beat >= winStart && c.beat < winEnd && c.beat >= loopStart && c.beat < loopEnd)
      .map((c) => {
        const text = prettySymbol(symbol(c.chord));
        return { item: c, text, x: x(c.beat) + 4, width: textWidth(text, CHORD_FONT), maxRight: W - 2 };
      }),
    { lanes: CHORD_LANE_Y.length, gap: 8, font: CHORD_FONT, minX: 2 },
  );
  // the notes start below whichever label rows are in use
  const top = chordLabels.some((l) => l.lane > 0) ? 42 : 28;
  const y = (midi: number) => top + ((HIGH - Math.min(HIGH, Math.max(LOW, midi))) / (HIGH - LOW)) * (H - top - 18);

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
  const done = notes.filter((n) => n.end !== null && inWin(n.start, n.end));
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
    [done.map((n) => `${n.id}:${n.end}:${n.passing}`).join(","), pass.current, winStart, winEnd, top, H],
  );

  const stats = useMemo(() => summarise(notes), [notes]);

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
            {paged && (
              <span className="flex items-center gap-1 text-ink-soft" aria-live="polite">
                <button
                  type="button"
                  aria-label="Previous 8 bars"
                  disabled={headBar !== null || pageIdx <= firstPage}
                  onClick={() => setBrowsePage(pageIdx - 1)}
                  className="cursor-pointer rounded px-1 hover:bg-paper-shade disabled:cursor-default disabled:opacity-30"
                >
                  ‹
                </button>
                bars {winFirstBar}–{winLastBar} of {loop.endBar}
                <button
                  type="button"
                  aria-label="Next 8 bars"
                  disabled={headBar !== null || pageIdx >= lastPage}
                  onClick={() => setBrowsePage(pageIdx + 1)}
                  className="cursor-pointer rounded px-1 hover:bg-paper-shade disabled:cursor-default disabled:opacity-30"
                >
                  ›
                </button>
              </span>
            )}
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
            {paged && " Long loops show 8 bars at a time, turning with the music (or with ‹ › when stopped)."}
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
            {Array.from({ length: winLastBar - winFirstBar + 1 }, (_, i) => {
              const bx = x(winStart + i * bpb);
              return (
                <g key={winFirstBar + i}>
                  <line x1={bx} y1={18} x2={bx} y2={H - 6} className="stroke-ink-faint" strokeDasharray="4 5" strokeWidth={1} />
                  <text x={bx + 3} y={H - 8} fontSize={10} className="fill-ink-faint font-hand">
                    {winFirstBar + i}
                  </text>
                </g>
              );
            })}
            {chordLabels.map((l) => (
              <text key={l.item.chord.id} x={l.x} y={CHORD_LANE_Y[l.lane]} fontSize={14} fontWeight={700} className="fill-ink font-marker">
                {l.truncated && <title>{l.text}</title>}
                {l.shown}
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
              .filter((n) => n.end === null && head !== null && inWin(n.start, head!))
              .map((n) => (
                <rect key={n.id} x={x(n.start)} y={y(n.midi) - 5} width={Math.max(6, x(head!) - x(n.start))} height={10} rx={2} fill={VERDICT_COLOR[n.ev.verdict]} />
              ))}
            {/* tooltips */}
            {notes.filter((n) => inWin(n.start, n.end ?? n.start + 0.25)).map((n) => (
              <rect key={`t${n.id}`} x={x(n.start)} y={y(n.midi) - 6} width={Math.max(8, x(n.end ?? n.start + 0.25) - x(n.start))} height={12} fill="transparent">
                <title>
                  {`${prettyNote(n.ev.name)} = ${prettyNote(n.ev.role)} over ${prettySymbol(n.chordSymbol)} · ${LABEL[n.ev.verdict]}${n.passing ? " (passing)" : ""}${n.ev.scale ? ` · scale: ${n.ev.scale}` : ""}${n.landing ? " · guide-tone landing" : ""}`}
                </title>
              </rect>
            ))}
            {head !== null && head >= winStart && head < winEnd && <line x1={x(head)} y1={18} x2={x(head)} y2={H - 6} className="stroke-wash-brick" strokeWidth={2} />}
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
