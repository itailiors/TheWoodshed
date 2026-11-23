import {
  absBeat,
  chordAtBeat,
  chroma,
  evaluateLineNote,
  isOnBeat,
  isPassingTone,
  GHOST_PERSONALITIES,
  guideTones,
  melodyIn,
  pitchClass,
  prettyNote,
  prettySymbol,
  symbol,
  transformMotif,
  type ChordEvent,
  type GhostNote,
  type GhostPersonality,
  type LineNoteEval,
  type TradeSpan,
  type Tune,
} from "@reharm/theory-core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNarrow } from "../../device/media";
import type { GhostInstrument } from "../../audio/band";
import { ghostSax } from "../../audio/ghostSax";
import { player } from "../../audio/player";
import { packLabels, textWidth, useFontsReady } from "../../design/labels";
import { SketchBox, useRough, useSize } from "../../design/rough";
import { ink, seedOf, VERDICT_COLOR, wash } from "../../design/tokens";
import { VerdictMark, VerdictSwatch } from "../../design/VerdictMark";
import { describeVerdicts, VERDICT_MARK, VERDICTS } from "../../design/verdictMarks";
import { noteBus, useNoteBus } from "../../midi/noteBus";
import { GlossaryChip } from "../learn/GlossaryChip";
import { VolumeMixer } from "../VolumeMixer";
import { PenKeyboard } from "./PenKeyboard";
import { saveImprovRun } from "../../library/practice";

/** Legend words that are glossary terms: chipped (spec §D, Practice). */
const LEGEND_TERM: Partial<Record<(typeof VERDICTS)[number], string>> = { avoid: "avoid note", tension: "tensions" };

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
  /** Current playback tempo (BPM) for scheduling Ghost Master responses in time. */
  tempo?: number;
  /** Trading 2s or 4s with a Ghost Master (0 = off). */
  tradeBars?: TradeSpan;
  onTradeBars?: (span: TradeSpan) => void;
  ghostPersonality?: GhostPersonality;
  onGhostPersonality?: (p: GhostPersonality) => void;
  ghostInstrument?: GhostInstrument;
  onGhostInstrument?: (inst: GhostInstrument) => void;
  /** Offer Ghost Master trading. Off in Study, which leaves performing to Practice. Default true. */
  trading?: boolean;
  /** Show the heatmap's own volume mixer. Off where the page already has one. Default: when not compact. */
  mixer?: boolean;
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
  /** A short off-beat avoid note: a passing tone, not a mistake. Set when the note ends (`closeNote`). */
  passing: boolean;
  /** Started within a quarter beat of a chord change, on a guide tone of the new chord. */
  landing: boolean;
}

/** End a held note at `end`; only now can it be judged a passing tone. Every way a note closes goes through here. */
const closeNote = (n: HeatNote, end: number): HeatNote => ({ ...n, end, passing: isPassingTone(n.ev, n.start, end) });

/** Tape width in viewBox units; a phone gets a narrower tape (4-bar pages) so the notes keep their height. */
const TAPE_W = 1000;
const PHONE_TAPE_W = 520;
const H_DEFAULT = 250;
const LOW = 48;
const HIGH = 96;
const KEEP_PASSES = 3;
/** Loops up to this many bars show whole; longer ones show one PAGE at a time. */
const WHOLE_MAX = 12;
/** Bars per page (two 4-bar phrases), aligned to bar 1 like Practice Mode's lead sheet. */
const PAGE = 8;
/** On a phone a page is one 4-bar phrase, so notes and chord names keep a readable size. */
const PHONE_PAGE = 4;
const CHORD_FONT = '700 14px Kalam, "Noto Music"';
const CHORD_LANE_Y = [14, 29];
/** Radius of the verdict shape drawn at the start of each note (bars are 10 units tall). */
const MARK_R = 3.6;
const markX = (x1: number, x2: number) => x1 + Math.min(5, Math.max(0, x2 - x1) / 2);

/**
 * Improv heatmap: solo over the backing loop and every note lands on a "loop tape",
 * coloured by what it is over the chord that was sounding.
 */
/** The heatmap's numbers for a set of notes: shown under the tape, and saved per pass. */
function summarise(notes: HeatNote[]) {
  const total = notes.length || 1;
  const count = (v: LineNoteEval["verdict"]) => notes.filter((n) => n.ev.verdict === v).length;
  const pct = (v: LineNoteEval["verdict"]) => Math.round((count(v) / total) * 100);
  const strong = notes.filter((n) => isOnBeat(n.start));
  const strongCT = strong.filter((n) => n.ev.verdict === "chord-tone").length;
  return {
    n: notes.length,
    pct,
    strong: strong.length ? Math.round((strongCT / strong.length) * 100) : null,
    landings: notes.filter((n) => n.landing).length,
    realAvoid: notes.filter((n) => n.ev.verdict === "avoid" && !n.passing && n.end !== null).length,
  };
}

interface StoredGhostNote extends GhostNote {
  id: number;
  pass: number;
  personality: GhostPersonality;
  /** Optional link from the end of the user's call motif to the first note of the Ghost response. */
  callFrom?: { beat: number; midi: number };
}

/** Why a note got its colour, in one line: "E = 3 over C7 · chord tone · guide-tone landing". */
function explain(n: HeatNote) {
  return `${prettyNote(n.ev.name)} = ${prettyNote(n.ev.role)} over ${prettySymbol(n.chordSymbol)} · ${VERDICT_MARK[n.ev.verdict].label}${n.passing ? " (passing)" : ""}${n.ev.scale ? ` · scale: ${n.ev.scale}` : ""}${n.landing ? " · guide-tone landing" : ""}`;
}

function explainGhost(n: StoredGhostNote) {
  const meta = GHOST_PERSONALITIES.find((p) => p.id === n.personality);
  return `👻 ${meta?.label ?? "Ghost Master"} (${meta?.master ?? ""}): ${prettyNote(n.ev.name)} = ${prettyNote(n.ev.role)} over ${prettySymbol(n.chordSymbol)} · ${n.tag}`;
}

export function ImprovHeatmap({
  tune,
  chords,
  loop,
  playing,
  compact = false,
  level,
  view,
  tempo = 120,
  tradeBars: controlledTrade,
  onTradeBars,
  ghostPersonality: controlledPersonality,
  onGhostPersonality,
  ghostInstrument: controlledInstrument,
  onGhostInstrument,
  trading = true,
  mixer = !compact,
}: Props) {
  const [localTrade, setLocalTrade] = useState<TradeSpan>(0);
  const [localPersonality, setLocalPersonality] = useState<GhostPersonality>("side-slipper");
  const [localInstrument, setLocalInstrument] = useState<GhostInstrument>("sax");
  const tradeBars: TradeSpan = trading ? (controlledTrade ?? localTrade) : 0;
  const setTradeBars = onTradeBars ?? setLocalTrade;
  const ghostPersonality = controlledPersonality ?? localPersonality;
  const setGhostPersonality = onGhostPersonality ?? setLocalPersonality;
  const ghostInstrument = controlledInstrument ?? localInstrument;
  const setGhostInstrument = onGhostInstrument ?? setLocalInstrument;
  // In compact mode the tape takes the slot's aspect ratio, so it fills the space without distorting text.
  const [tapeRef, tapeSize] = useSize<HTMLDivElement>();
  const narrow = useNarrow();
  const W = narrow ? PHONE_TAPE_W : TAPE_W;
  const H = compact && tapeSize.w > 0 ? Math.max(110, Math.round((W * tapeSize.h) / tapeSize.w)) : H_DEFAULT;
  const bpb = tune.meter[0];
  const loopStart = (loop.startBar - 1) * bpb;
  const loopEnd = loop.endBar * bpb;
  const span = loopEnd - loopStart;

  // ── paging: a long loop squeezed into one tape made chord names pile up and notes too thin
  // to read, so loops over WHOLE_MAX bars show 8 bars at a time. Pages are aligned to bar 1
  // (bars 1–8, 9–16 …), the same pages Practice Mode's lead sheet turns, so the two stay in step.
  const loopBars = loop.endBar - loop.startBar + 1;
  const pageBars = narrow ? PHONE_PAGE : PAGE;
  const paged = loopBars > (narrow ? PHONE_PAGE : WHOLE_MAX);
  const pageOf = (bar: number) => Math.floor((bar - 1) / pageBars);
  const firstPage = pageOf(loop.startBar);
  const lastPage = pageOf(loop.endBar);
  const [browsePage, setBrowsePage] = useState(firstPage);
  const [headBar, setHeadBar] = useState<number | null>(null);
  const [passVersion, setPassVersion] = useState(0);
  const pageIdx = !paged ? firstPage : headBar !== null ? Math.min(lastPage, Math.max(firstPage, pageOf(headBar))) : Math.min(lastPage, Math.max(firstPage, browsePage));
  // keep the browse position on the page the music last showed, so Stop doesn't jump away
  useEffect(() => {
    if (paged && headBar !== null) setBrowsePage(pageIdx);
  }, [paged, headBar, pageIdx]);
  useEffect(() => setBrowsePage(pageOf(loop.startBar)), [loop.startBar, loop.endBar, pageBars]);
  const winFirstBar = paged ? Math.max(loop.startBar, pageIdx * pageBars + 1) : loop.startBar;
  const winLastBar = paged ? Math.min(loop.endBar, pageIdx * pageBars + pageBars) : loop.endBar;
  const winStart = (winFirstBar - 1) * bpb;
  const winEnd = winLastBar * bpb;
  const inWin = (start: number, end: number) => start < winEnd && end > winStart;
  const x = (beat: number) => ((Math.min(winEnd, Math.max(winStart, beat)) - winStart) / (winEnd - winStart)) * W;

  const [armed, setArmed] = useState(true);
  const [notes, setNotes] = useState<HeatNote[]>([]);
  const [ghostNotes, setGhostNotes] = useState<StoredGhostNote[]>([]);
  const [ghostSummary, setGhostSummary] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  /** The note tapped for an explanation (touch has no hover, so <title> tooltips never show). */
  const [picked, setPicked] = useState<number | null>(null);
  const pickedNote = picked === null ? null : (notes.find((n) => n.id === picked) ?? null);
  const pickedGhost = picked === null ? null : (ghostNotes.find((n) => n.id === picked) ?? null);
  const pass = useRef(0);
  const totalLoops = useRef(0);
  const [loopCount, setLoopCount] = useState(0);
  /** Saves the user's final call phrase of a chorus before the loop wipe so Chorus N+1 can open with a Ghost response (e.g. 12-bar blues Trading 4s). */
  const prevChorusCall = useRef<{ notes: { midi: number; start: number; end: number }[]; callStartBeat: number; callEndBeat: number } | null>(null);
  const lastBeat = useRef(-1);
  const lastHeadBar = useRef<number | null>(null);
  const lastGhostPhraseKey = useRef<string | null>(null);
  const ghostTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const headBeatRef = useRef<number | null>(null);
  const playheadRef = useRef<SVGLineElement>(null);
  const openNotesRef = useRef<SVGGElement>(null);
  const winRef = useRef({ winStart, winEnd, W });
  winRef.current = { winStart, winEnd, W };
  const nextId = useRef(1);
  const open = useRef(new Map<number, number>()); // midi -> note id

  /** Effective trade span in bars, clamped so even a short 2-bar loop splits into 1 bar Call + 1 bar Response. */
  const effTradeBars = tradeBars > 0 ? Math.max(1, Math.min(tradeBars, Math.floor(loopBars / 2) || 1)) : 0;
  /**
   * Continuous phrase index across chorus boundaries: `absoluteBeat = totalLoops * span + (beat - loopStart)`.
   * On a 12-bar blues (3 × 4-bar phrases), Chorus 1 is User(0), Ghost(1), User(2), and Chorus 2
   * automatically begins at phraseIdx 3 (Ghost), preventing the user from playing 8 bars in a row.
   */
  const isGhostBeat = useCallback(
    (beat: number, chorusIdx = loopCount) => {
      if (effTradeBars <= 0) return false;
      const phraseBeats = effTradeBars * bpb;
      const absoluteBeat = chorusIdx * span + Math.max(0, beat - loopStart);
      const phraseIdx = Math.floor(absoluteBeat / phraseBeats);
      return phraseIdx % 2 === 1;
    },
    [effTradeBars, bpb, span, loopStart, loopCount],
  );
  const tradeCtxRef = useRef({ effTradeBars, ghostPersonality, ghostInstrument, tune, chords, bpb, loopStart, loopEnd, span, tempo });
  tradeCtxRef.current = { effTradeBars, ghostPersonality, ghostInstrument, tune, chords, bpb, loopStart, loopEnd, span, tempo };

  const clearGhostTimers = useCallback(() => {
    ghostTimers.current.forEach((t) => clearTimeout(t));
    ghostTimers.current = [];
    ghostSax.release();
  }, []);
  useEffect(() => () => clearGhostTimers(), [clearGhostTimers]);

  /** Imperatively move the playhead <line> and stretch any held-note <rect>s without re-rendering React. */
  const syncPlayhead = useCallback((b: number | null) => {
    const { winStart: ws, winEnd: we, W: width } = winRef.current;
    const spanBeats = we - ws;
    const toX = (beat: number) => ((Math.min(we, Math.max(ws, beat)) - ws) / spanBeats) * width;
    const line = playheadRef.current;
    if (line) {
      if (b !== null && b >= ws && b < we) {
        const px = String(toX(b));
        line.setAttribute("x1", px);
        line.setAttribute("x2", px);
        line.style.display = "";
      } else {
        line.style.display = "none";
      }
    }
    const openGroup = openNotesRef.current;
    if (openGroup) {
      const rects = openGroup.children;
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i] as SVGRectElement;
        const start = Number(rect.dataset.start);
        if (b !== null && b >= start && start < we && b > ws) {
          const x1 = toX(start);
          const x2 = toX(b);
          rect.setAttribute("x", String(x1));
          rect.setAttribute("width", String(Math.max(6, x2 - x1)));
          rect.style.display = "";
        } else {
          rect.style.display = "none";
        }
      }
    }
  }, []);

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

  // smooth playhead + loop-wrap wipe + continuous-chorus Ghost Master Call-and-Response trigger
  useEffect(() => {
    if (!playing) {
      // Immediately cap any held notes (`end === null`) at the stop beat so they don't keep stretching across the tape
      const stopBeat = headBeatRef.current ?? (lastBeat.current >= 0 ? lastBeat.current : null);
      if (open.current.size > 0 || notesRef.current.some((n) => n.end === null)) {
        open.current.clear();
        const capped = notesRef.current.map((n) => {
          if (n.end !== null) return n;
          return closeNote(n, stopBeat !== null && stopBeat > n.start ? stopBeat : Math.min(loopEnd, n.start + 0.25));
        });
        notesRef.current = capped;
        setNotes(capped);
      }

      headBeatRef.current = null;
      lastBeat.current = -1;
      lastHeadBar.current = null;
      lastGhostPhraseKey.current = null;
      totalLoops.current = 0;
      prevChorusCall.current = null;
      setLoopCount(0);
      clearGhostTimers();
      setHeadBar(null);
      syncPlayhead(null);
      // Stopping ends the pass: save it, and start a fresh one for the next Play.
      savePassRef.current(pass.current);
      if (notesRef.current.some((n) => n.pass === pass.current)) {
        pass.current++;
        setPassVersion((v) => v + 1);
      }
      return;
    }
    let raf = 0;
    const tick = () => {
      const b = player.currentBeat();
      headBeatRef.current = b;
      if (b !== null) {
        const tc = tradeCtxRef.current;
        const phraseBeats = tc.effTradeBars * tc.bpb;

        if (lastBeat.current >= 0 && b < lastBeat.current - 0.5) {
          // Save the completed pass before wiping the tape clean for the new chorus
          savePassRef.current(pass.current);

          // Preserve the user's final call phrase of the outgoing chorus in case Chorus N+1 opens with a Ghost response
          if (tc.effTradeBars > 0) {
            const tailStart = Math.max(tc.loopStart, tc.loopEnd - phraseBeats);
            const tailNotes = notesRef.current
              .filter((n) => n.pass === pass.current && n.start < tc.loopEnd && (n.end ?? tc.loopEnd) > tailStart)
              .map((n) => ({ midi: n.midi, start: n.start, end: n.end ?? tc.loopEnd }));
            prevChorusCall.current = { notes: tailNotes, callStartBeat: tailStart, callEndBeat: tc.loopEnd };
          }

          pass.current++;
          totalLoops.current++;
          setLoopCount(totalLoops.current);
          lastGhostPhraseKey.current = null;
          clearGhostTimers();
          open.current.clear();
          notesRef.current = [];
          setNotes([]);
          setGhostNotes([]);
          setPicked(null);
          setPassVersion((v) => v + 1);
        }
        lastBeat.current = b;
        const bar = Math.floor(b / bpb) + 1;
        if (bar !== lastHeadBar.current) {
          lastHeadBar.current = bar;
          setHeadBar(bar);
        }

        // ── Trading 2s / 4s: continuous phraseIdx across chorus boundaries ──
        if (tc.effTradeBars > 0) {
          const localOffset = Math.max(0, b - tc.loopStart);
          const absoluteBeat = totalLoops.current * tc.span + localOffset;
          const continuousPhraseIdx = Math.floor(absoluteBeat / phraseBeats);
          if (continuousPhraseIdx % 2 === 1) {
            const pKey = `${totalLoops.current}:${continuousPhraseIdx}`;
            if (lastGhostPhraseKey.current !== pKey) {
              lastGhostPhraseKey.current = pKey;
              const localPhraseIdx = Math.floor(localOffset / phraseBeats);
              const respStartBeat = tc.loopStart + localPhraseIdx * phraseBeats;
              const respEndBeat = Math.min(tc.loopEnd, respStartBeat + phraseBeats);

              // Close any user notes still held across the Call -> Response barline
              if (open.current.size > 0) {
                open.current.clear();
                setNotes((ns) =>
                  ns.map((n) => (n.end === null && n.pass === pass.current ? closeNote(n, respStartBeat) : n)),
                );
              }

              // If the Ghost opens at the top of a new chorus (localPhraseIdx === 0), answer the previous chorus's final call phrase
              let callStartBeat = tc.loopStart + (localPhraseIdx - 1) * phraseBeats;
              let callEndBeat = respStartBeat;
              let callNotes: { midi: number; start: number; end: number }[];
              if (localPhraseIdx === 0 && prevChorusCall.current) {
                callStartBeat = prevChorusCall.current.callStartBeat;
                callEndBeat = prevChorusCall.current.callEndBeat;
                callNotes = prevChorusCall.current.notes;
              } else {
                callStartBeat = Math.max(tc.loopStart, respStartBeat - phraseBeats);
                callEndBeat = respStartBeat;
                callNotes = notesRef.current
                  .filter((n) => n.pass === pass.current && n.start < callEndBeat && (n.end ?? callEndBeat) > callStartBeat)
                  .map((n) => ({ midi: n.midi, start: n.start, end: n.end ?? callEndBeat }));
              }

              const resp = transformMotif({
                notes: callNotes,
                personality: tc.ghostPersonality,
                tune: tc.tune,
                chords: tc.chords,
                callStartBeat,
                callEndBeat,
                respStartBeat,
                respEndBeat,
                continuousPhraseIdx,
              });

              const lastUserNote = localPhraseIdx > 0 && callNotes.length > 0 ? callNotes[callNotes.length - 1] : undefined;
              const curPass = pass.current;
              const stamped: StoredGhostNote[] = resp.notes.map((gn, idx) => ({
                ...gn,
                id: nextId.current++,
                pass: curPass,
                personality: tc.ghostPersonality,
                callFrom: idx === 0 && lastUserNote ? { beat: lastUserNote.end ?? lastUserNote.start, midi: lastUserNote.midi } : undefined,
              }));

              setGhostNotes((prev) => [...prev.filter((g) => g.pass === curPass), ...stamped]);
              setGhostSummary(resp.summary);

              // Ensure the rhythm section (walking upright bass + swinging drums) keeps grooving under the Ghost's solo
              if (!player.mix.bass) player.setMix("bass", true);
              if (!player.mix.drums) player.setMix("drums", true);

              // Schedule Ghost Master audio playback (Saxophone MonoSynth or Piano Sampler) in time with the trio
              clearGhostTimers();
              const spb = 60 / Math.max(40, tc.tempo);
              const useSax = tc.ghostInstrument === "sax";
              for (let idx = 0; idx < stamped.length; idx++) {
                const gn = stamped[idx];
                const nextGn = stamped[idx + 1];
                const delaySec = Math.max(0, (gn.start - b) * spb);
                const maxBeforeNextSec = nextGn ? Math.max(0.05, (nextGn.start - gn.start) * spb * 0.76) : Infinity;
                const durSec = Math.min(maxBeforeNextSec, Math.max(0.06, (gn.end - gn.start) * spb * 0.82));
                const timerId = setTimeout(() => {
                  if (useSax) {
                    player.resume();
                    ghostSax.play(gn.voicing, durSec, 0, gn.vel);
                  } else {
                    void player.playNotes(gn.voicing, durSec, 0, gn.vel);
                  }
                }, Math.round(delaySec * 1000));
                ghostTimers.current.push(timerId);
              }
            }
          }
        }
      }
      syncPlayhead(b);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, bpb, syncPlayhead, clearGhostTimers]);

  const changes = useMemo(() => chords.map((c) => ({ beat: absBeat(c.at, bpb), chord: c })), [chords, bpb]);

  // chord names over this window, packed into two rows so crowded bars never overlap
  const fontsReady = useFontsReady();
  const chordLabels = useMemo(
    () =>
      packLabels(
        changes
          .filter((c) => c.beat >= winStart && c.beat < winEnd && c.beat >= loopStart && c.beat < loopEnd)
          .map((c) => {
            const text = prettySymbol(symbol(c.chord));
            const cx = ((Math.min(winEnd, Math.max(winStart, c.beat)) - winStart) / (winEnd - winStart)) * W;
            return { item: c, text, x: cx + 4, width: textWidth(text, CHORD_FONT), maxRight: W - 2 };
          }),
        { lanes: CHORD_LANE_Y.length, gap: 8, font: CHORD_FONT, minX: 2 },
      ),
    [changes, winStart, winEnd, loopStart, loopEnd, W, fontsReady],
  );
  // the notes start below whichever label rows are in use
  const top = chordLabels.some((l) => l.lane > 0) ? 42 : 28;
  const y = (midi: number) => top + ((HIGH - Math.min(HIGH, Math.max(LOW, midi))) / (HIGH - LOW)) * (H - top - 18);

  useNoteBus((m) => {
    const rawBeat = player.currentBeat();
    const beat = rawBeat ?? headBeatRef.current ?? (lastBeat.current >= 0 ? lastBeat.current : null);
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
      setNotes((ns) => {
        // Close any previously unclosed note on the same MIDI pitch before starting the new one
        const closedPrev = ns.map((n) =>
          n.midi === m.note && n.end === null ? closeNote(n, Math.max(n.start + 0.08, beat)) : n,
        );
        const next = [
          ...closedPrev,
          { id, midi: m.note, start: beat, end: null, pass: pass.current, chordSymbol: symbol(at.chord), ev, passing: false, landing },
        ].filter((n) => n.pass > pass.current - KEEP_PASSES);
        notesRef.current = next;
        return next;
      });
    } else {
      open.current.delete(m.note);
      setNotes((ns) => {
        if (!ns.some((n) => n.midi === m.note && n.end === null)) return ns;
        const next = ns.map((n) => {
          if (n.midi !== m.note || n.end !== null) return n;
          return closeNote(n, beat === null || beat < n.start ? Math.min(loopEnd, n.start + 0.25) : Math.max(n.start + 0.08, beat));
        });
        notesRef.current = next;
        return next;
      });
    }
  }, armed);

  // Keep newly mounted open-note <rect>s and window switches aligned with the current playhead immediately on commit.
  useLayoutEffect(() => {
    syncPlayhead(headBeatRef.current);
  }, [notes, winStart, winEnd, W, H, top, syncPlayhead]);

  // ── drawing ──
  const g = useRef<SVGGElement>(null);
  const done = notes.filter((n) => n.end !== null && n.pass > pass.current - KEEP_PASSES && inWin(n.start, n.end));
  const doneGhost = ghostNotes.filter((n) => n.pass > pass.current - KEEP_PASSES && inWin(n.start, n.end));
  useRough(
    g,
    (rc, add, memo) => {
      for (const n of done) {
        const age = pass.current - n.pass;
        const fillStyle = n.passing ? "hachure" : age === 0 ? "solid" : "hachure";
        const key = `${n.id}:${n.end}:${fillStyle}:${winStart}:${winEnd}:${top}:${W}:${H}`;
        const node = memo(key, () => {
          const x1 = x(n.start);
          const w = Math.max(7, x(n.end!) - x1);
          const color = VERDICT_COLOR[n.ev.verdict];
          return rc.rectangle(x1, y(n.midi) - 5, w, 10, {
            seed: seedOf("n" + n.id),
            fill: color,
            fillStyle,
            hachureGap: 2.5,
            stroke: n.landing ? ink.deep : color,
            strokeWidth: n.landing ? 1.8 : 1,
            roughness: 1.1,
          });
        });
        node.setAttribute("opacity", String(age === 0 ? 1 : age === 1 ? 0.45 : 0.2));
        add(node);
      }

      // ── Ghost Master answer notes (Sage / Mustard wash + motif connector arc) ──
      for (const gn of doneGhost) {
        const age = pass.current - gn.pass;
        const opacity = String(age === 0 ? 0.95 : age === 1 ? 0.45 : 0.2);

        // If this is the first note of the Ghost Master's response, sketch a curved arrow from the user's call
        if (gn.callFrom && gn.callFrom.beat >= winStart && gn.start <= winEnd) {
          const arcKey = `arc:${gn.id}:${winStart}:${winEnd}:${top}:${W}:${H}`;
          const arcNode = memo(arcKey, () => {
            const x1 = x(gn.callFrom!.beat);
            const y1 = y(gn.callFrom!.midi);
            const x2 = x(gn.start);
            const y2 = y(gn.midi);
            const mx = (x1 + x2) / 2;
            const my = Math.max(top + 4, Math.min(y1, y2) - 18);
            return rc.curve(
              [
                [x1, y1],
                [mx, my],
                [x2, y2],
              ],
              {
                seed: seedOf("arc" + gn.id),
                stroke: wash.sage,
                strokeWidth: 1.5,
                roughness: 1.2,
              },
            );
          });
          arcNode.setAttribute("opacity", opacity);
          add(arcNode);
        }

        // For Block-Chord Harmonizer, draw the lower harmonized voices in soft sage underneath the melody
        if (gn.voicing.length > 1) {
          for (const vMidi of gn.voicing.slice(0, -1)) {
            if (vMidi < LOW || vMidi > HIGH) continue;
            const vKey = `gv:${gn.id}:${vMidi}:${winStart}:${winEnd}:${top}:${W}:${H}`;
            const vNode = memo(vKey, () => {
              const x1 = x(gn.start);
              const w = Math.max(7, x(gn.end) - x1);
              return rc.rectangle(x1, y(vMidi) - 3.5, w, 7, {
                seed: seedOf(`gv${gn.id}:${vMidi}`),
                fill: wash.sage,
                fillStyle: "hachure",
                hachureGap: 3.5,
                stroke: wash.sage,
                strokeWidth: 0.9,
                roughness: 0.9,
              });
            });
            vNode.setAttribute("opacity", String(age === 0 ? 0.55 : 0.22));
            add(vNode);
          }
        }

        const gFill = gn.enclosure ? wash.mustard : wash.sage;
        const gKey = `gn:${gn.id}:${gn.end}:${winStart}:${winEnd}:${top}:${W}:${H}`;
        const gNode = memo(gKey, () => {
          const x1 = x(gn.start);
          const w = Math.max(8, x(gn.end) - x1);
          return rc.rectangle(x1, y(gn.midi) - 5.5, w, 11, {
            seed: seedOf("gn" + gn.id),
            fill: gFill,
            fillStyle: gn.enclosure ? "cross-hatch" : "solid",
            hachureGap: 2.5,
            stroke: ink.deep,
            strokeWidth: gn.landing ? 2 : 1.4,
            roughness: 1.2,
          });
        });
        gNode.setAttribute("opacity", opacity);
        add(gNode);
      }
    },
    [
      done.map((n) => `${n.id}:${n.end}:${n.passing}`).join(","),
      doneGhost.map((n) => `${n.id}:${n.end}`).join(","),
      passVersion,
      pass.current,
      winStart,
      winEnd,
      top,
      W,
      H,
    ],
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-marker text-sm">
            {paged && (
              <span className="flex items-center gap-1 whitespace-nowrap text-ink-soft" aria-live="polite">
                <button
                  type="button"
                  aria-label={`Previous ${pageBars} bars`}
                  disabled={headBar !== null || pageIdx <= firstPage}
                  onClick={() => setBrowsePage(pageIdx - 1)}
                  className="min-w-8 cursor-pointer rounded-full px-1 hover:bg-paper-shade disabled:cursor-default disabled:opacity-30"
                >
                  ‹
                </button>
                bars {winFirstBar}–{winLastBar} of {loop.endBar}
                <button
                  type="button"
                  aria-label={`Next ${pageBars} bars`}
                  disabled={headBar !== null || pageIdx >= lastPage}
                  onClick={() => setBrowsePage(pageIdx + 1)}
                  className="min-w-8 cursor-pointer rounded-full px-1 hover:bg-paper-shade disabled:cursor-default disabled:opacity-30"
                >
                  ›
                </button>
              </span>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={armed} onChange={(e) => setArmed(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
              Record my line
            </label>
            {trading && <button
              type="button"
              onClick={() => setTradeBars(tradeBars === 0 ? 2 : tradeBars === 2 ? 4 : 0)}
              aria-pressed={tradeBars > 0}
              className={`cursor-pointer rounded-full border-2 px-3 py-0.5 ${
                tradeBars > 0 ? "border-ink bg-wash-sage/40 font-bold text-ink" : "border-dashed border-ink-soft hover:bg-paper-shade"
              }`}
            >
              {tradeBars === 0 ? "🎷 Trade 2s / 4s" : `🎷 Trading ${tradeBars}s`}
            </button>}
            {tradeBars > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setGhostInstrument(ghostInstrument === "sax" ? "piano" : "sax")}
                  title="Switch Ghost Master instrument between Saxophone and Piano"
                  className="cursor-pointer rounded-full border-2 border-ink bg-wash-mustard/40 px-2.5 py-0.5 text-xs font-bold text-ink hover:bg-wash-mustard/60"
                >
                  {ghostInstrument === "sax" ? "🎷 Sax" : "🎹 Piano"}
                </button>
                <select
                  aria-label="Ghost Master personality"
                  value={ghostPersonality}
                  onChange={(e) => setGhostPersonality(e.target.value as GhostPersonality)}
                  className="cursor-pointer rounded-full border-2 border-ink bg-paper-light px-2.5 py-0.5 font-marker text-xs text-ink"
                >
                  {GHOST_PERSONALITIES.map((gp) => (
                    <option key={gp.id} value={gp.id}>
                      👻 {gp.label} ({gp.master})
                    </option>
                  ))}
                </select>
              </>
            )}
            {mixer && <VolumeMixer compact beatsPerBar={bpb} />}
            <button
              type="button"
              onClick={() => {
                setNotes([]);
                setGhostNotes([]);
                setGhostSummary(null);
              }}
              className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 hover:bg-paper-shade"
            >
              Clear
            </button>
          </div>
        </div>
        {!compact && (
          <p className="mt-1 text-sm text-ink-soft">
            Play single-note lines over the loop (bars {loop.startBar}–{loop.endBar}). Each note is judged against the chord sounding at that moment. Older passes fade.
            {paged && ` Long loops show ${pageBars} bars at a time, turning with the music (or with ‹ › when stopped).`} Tap or hover a note to see why it got its colour and shape.
          </p>
        )}

        <div ref={tapeRef} className={compact ? "min-h-0 flex-1" : "mt-3 overflow-x-auto"}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className={compact ? "block h-full w-full" : "block h-auto w-full sm:min-w-[560px]"}
            role="img"
            aria-label={`Improv heatmap loop tape, bars ${winFirstBar}–${winLastBar}: ${describeVerdicts(stats.n, stats.pct)}`}
          >
            {/* bar grid + Call/Response phase tinting + chord labels */}
            {Array.from({ length: winLastBar - winFirstBar + 1 }, (_, i) => {
              const barNum = winFirstBar + i;
              const barBeat = winStart + i * bpb;
              const bx = x(barBeat);
              const bw = x(barBeat + bpb) - bx;
              const ghostBar = effTradeBars > 0 && isGhostBeat(barBeat);
              const prevGhostBar = effTradeBars > 0 && i > 0 ? isGhostBeat(barBeat - bpb) : !ghostBar;
              const phaseStart = effTradeBars > 0 && (i === 0 || ghostBar !== prevGhostBar);
              return (
                <g key={barNum}>
                  {ghostBar && <rect x={bx} y={18} width={bw} height={H - 24} fill={wash.sage} opacity={0.12} />}
                  <line x1={bx} y1={18} x2={bx} y2={H - 6} className="stroke-ink-faint" strokeDasharray="4 5" strokeWidth={1} />
                  <text x={bx + 3} y={H - 8} fontSize={10} className="fill-ink-faint font-hand">
                    {barNum}
                  </text>
                  {phaseStart && (
                    <text
                      x={bx + 4}
                      y={H - 20}
                      fontSize={9}
                      fontWeight={700}
                      fill={ghostBar ? wash.sage : ink.soft}
                      className="font-marker uppercase"
                    >
                      {ghostBar ? "👻 Ghost answer" : "🎷 Your call"}
                    </text>
                  )}
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
            {/* each note's verdict as a shape too, not only a colour (● chord tone, ◇ tension, ✕ avoid, △ outside) */}
            <g>
              {done.map((n) => {
                const age = pass.current - n.pass;
                return (
                  <g key={`m${n.id}`} opacity={age === 0 ? 1 : age === 1 ? 0.45 : 0.2}>
                    <VerdictMark verdict={n.ev.verdict} cx={markX(x(n.start), x(n.end!))} cy={y(n.midi)} r={MARK_R} />
                  </g>
                );
              })}
            </g>
            {/* notes still sounding (stretched imperatively in rAF via openNotesRef) */}
            <g ref={openNotesRef}>
              {notes
                .filter((n) => n.end === null)
                .map((n) => (
                  <rect
                    key={n.id}
                    data-start={n.start}
                    x={x(n.start)}
                    y={y(n.midi) - 5}
                    width={6}
                    height={10}
                    rx={2}
                    fill={VERDICT_COLOR[n.ev.verdict]}
                    style={{ display: "none" }}
                  />
                ))}
            </g>
            {/* their shapes stay put at the note's start (kept out of openNotesRef, whose children are all stretched rects) */}
            <g>
              {notes
                .filter((n) => n.end === null && n.start >= winStart && n.start < winEnd)
                .map((n) => (
                  <VerdictMark key={`om${n.id}`} verdict={n.ev.verdict} cx={x(n.start) + 3} cy={y(n.midi)} r={MARK_R} />
                ))}
            </g>
            {/* tooltips for user notes and Ghost Master notes */}
            {notes
              .filter((n) => n.pass > pass.current - KEEP_PASSES && inWin(n.start, n.end ?? n.start + 0.25))
              .map((n) => (
                <rect
                  key={`t${n.id}`}
                  x={x(n.start)}
                  y={y(n.midi) - 9}
                  width={Math.max(14, x(n.end ?? n.start + 0.25) - x(n.start))}
                  height={18}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => setPicked((p) => (p === n.id ? null : n.id))}
                >
                  <title>{explain(n)}</title>
                </rect>
              ))}
            {doneGhost.map((gn) => (
              <rect
                key={`gt${gn.id}`}
                x={x(gn.start)}
                y={y(gn.midi) - 9}
                width={Math.max(14, x(gn.end) - x(gn.start))}
                height={18}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => setPicked((p) => (p === gn.id ? null : gn.id))}
              >
                <title>{explainGhost(gn)}</title>
              </rect>
            ))}
            <line ref={playheadRef} x1={0} y1={18} x2={0} y2={H - 6} className="stroke-wash-brick" strokeWidth={2} style={{ display: "none" }} />
          </svg>
        </div>

        <div className={`flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 ${compact ? "mt-1 text-xs" : "mt-3 text-sm"}`}>
          {VERDICTS.map((v) => (
            <span key={v} className="flex items-center gap-2">
              <VerdictSwatch verdict={v} color={VERDICT_COLOR[v]} />
              {LEGEND_TERM[v] ? <GlossaryChip term={LEGEND_TERM[v]}>{VERDICT_MARK[v].label}</GlossaryChip> : VERDICT_MARK[v].label}{" "}
              {stats.n > 0 && <span className="text-ink-faint">{stats.pct(v)}%</span>}
            </span>
          ))}
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded-sm border-2 border-ink" />{" "}
            <span>
              <GlossaryChip term="guide tones">guide-tone</GlossaryChip> landing
            </span>
          </span>
          {tradeBars > 0 && (
            <>
              <span className="flex items-center gap-2 font-marker">
                <span className="inline-block h-3 w-6 -rotate-1 rounded-sm border border-ink" style={{ background: wash.sage }} /> 👻 Ghost Master answer
              </span>
              {/* the rest of what the Ghost draws, each told apart by pattern as well as colour */}
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3 w-6 -rotate-1 rounded-sm border border-ink"
                  style={{ background: `repeating-linear-gradient(45deg, ${wash.mustard} 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, ${wash.mustard} 0 2px, transparent 2px 4px)` }}
                />
                <span>
                  <GlossaryChip term="enclosure" /> (cross-hatched)
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2 w-6 -rotate-1 rounded-sm border"
                  style={{ borderColor: wash.sage, background: `repeating-linear-gradient(-50deg, ${wash.sage} 0 1.5px, transparent 1.5px 4px)` }}
                />
                its harmony voices (hatched)
              </span>
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 12" className="inline-block h-3 w-6" aria-hidden>
                  <path d="M2 10 Q12 0 22 10" fill="none" stroke={wash.sage} strokeWidth={1.8} strokeLinecap="round" />
                </svg>
                your call → its answer
              </span>
            </>
          )}
        </div>
        {ghostSummary && tradeBars > 0 && (
          <p className={`shrink-0 font-hand text-ink-soft ${compact ? "truncate text-xs" : "mt-1.5 text-sm"}`} role="status">
            👻 {ghostSummary}
          </p>
        )}
        {stats.n > 0 && (
          <p className={`shrink-0 font-marker ${compact ? "truncate text-sm" : "mt-2 text-[15px]"}`}>
            {stats.strong !== null && <>Chord tones on the beat: {stats.strong}%. </>}
            Landed on a guide tone at {stats.landings} change{stats.landings === 1 ? "" : "s"}.{" "}
            {stats.realAvoid > 0 ? `${stats.realAvoid} held avoid note${stats.realAvoid === 1 ? "" : "s"}: resolve them by step.` : "No held avoid notes."}
          </p>
        )}
        {pickedNote && (
          <p className={`shrink-0 font-hand ${compact ? "truncate text-sm" : "mt-2"}`} role="status">
            <VerdictSwatch verdict={pickedNote.ev.verdict} color={VERDICT_COLOR[pickedNote.ev.verdict]} className="align-middle" /> {explain(pickedNote)}
          </p>
        )}
        {pickedGhost && (
          <p className={`shrink-0 font-hand ${compact ? "truncate text-sm" : "mt-2"}`} role="status">
            <span className="inline-block h-3 w-3 -rotate-6 rounded-sm border border-ink align-middle" style={{ background: wash.sage }} /> {explainGhost(pickedGhost)}
          </p>
        )}
        {hint && <p className={`shrink-0 font-marker text-wash-brick ${compact ? "text-sm" : "mt-2"}`}>{hint}</p>}

        <details className={compact ? "hidden" : "mt-3"}>
          <summary className="cursor-pointer font-marker text-sm text-ink-soft">No MIDI? Play on the keys here</summary>
          <PenKeyboard low={60} high={84} onKey={(m) => emit("on", m)} onKeyUp={(m) => emit("off", m)} className="mt-2 max-w-[520px]" />
        </details>
      </section>
    </SketchBox>
  );
}
