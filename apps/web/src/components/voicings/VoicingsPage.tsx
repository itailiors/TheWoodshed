import {
  chroma,
  classifyVoicing,
  earStep,
  hiddenHint,
  shapeDiff,
  type EarEvent,
  type EarPhase,
  hasMelody,
  headScore,
  transposeTune,
  voiceTheTune,
  type Tune,
  type DrillAttempt,
  type DrillKeyWhy,
  type DrillRun,
  type DrillView,
  parseShapeRuleId,
  shapeRuleId,
  KEYS,
  prettyNote,
  prettySymbol,
  referenceTune,
  symbol,
  transpose,
  VOICING_STYLES,
  voicedForm,
  voiceLeadForms,
  voiceMotion,
  voicingForms,
  type Quality,
  type ShapeGrade,
  type VoicingForm,
  type VoicingStyle,
} from "@reharm/theory-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBandFeel } from "../../audio/bandFeel";
import { player } from "../../audio/player";
import { useDrillSession } from "../../practice/useDrillSession";
import { SketchBox, SketchFilters } from "../../design/rough";
import { keys, paper, seedOf, wash } from "../../design/tokens";
import { useNarrow, useTouchFirst } from "../../device/media";
import { useChordStrikes } from "../../midi/noteBus";
import type { MidiStatus } from "../../midi/useMidi";
import { MidiMonitorToggle } from "../MidiMonitorToggle";
import { ModeSwitch, type AppMode } from "../ModeSwitch";
import { phoneKeyboardRows, whiteCount } from "../practice/keyboardRows";
import { PenKeyboard } from "../practice/PenKeyboard";
import { QwertyToggle } from "../QwertyToggle";
import { notForUs } from "../Shortcuts";

/*
 * The Voicings tab: a shape library. Pick a chord (or a ii–V–I), pick a voicing family, and see
 * every form the engine offers, labelled by degree and hand. Hear it, then play it: MIDI and the
 * computer keys are graded as you strike the chord; on-screen keys are tapped in, then checked.
 * Every pitch comes from theory-core (`voicingForms`, `voiceLeadForms`, `gradeShape`); this page
 * only lays them out. The first clean voicing of each chord on the stage is filed in the practice
 * history as a `shape:<style>:<quality>` concept in the chord's root (the wrong strikes before it
 * are its misses), so it gets a passport page and comes back when due. The demo keeps it in the browser.
 */

interface Props {
  midi: { status: MidiStatus; connect: () => void };
  onMode: (m: AppMode) => void;
  /** A shape review picked in the passport ("Practise →"): the tab opens on that chord, key and family. */
  review?: { ruleId: string; keyTonic: string } | null;
  /** The tune on the stand: "Voice the tune" voices its head, when it has a melody. */
  tune: Tune;
  /** Put the reference tune (which has a melody) on the stand. */
  onOpenReference?: () => void;
}

type Source = "chord" | "major251" | "minor251" | "tune";
interface ChordChoice {
  id: string;
  label: string;
  quality: Quality;
  alterations: string[];
}
type Chord = { root: string; quality: Quality; extensions: string[]; alterations: string[] };

const CHORDS: ChordChoice[] = [
  { id: "maj7", label: "Major 7th", quality: "maj7", alterations: [] },
  { id: "m7", label: "Minor 7th", quality: "m7", alterations: [] },
  { id: "7", label: "Dominant 7th", quality: "7", alterations: [] },
  { id: "7b9", label: "Dominant 7th (♭9)", quality: "7", alterations: ["b9"] },
  { id: "m7b5", label: "Half-diminished (m7♭5)", quality: "m7b5", alterations: [] },
  { id: "6", label: "Major 6th", quality: "6", alterations: [] },
  { id: "m6", label: "Minor 6th", quality: "m6", alterations: [] },
  { id: "7sus4", label: "Dominant 7sus4", quality: "7sus4", alterations: [] },
  { id: "dim7", label: "Diminished 7th", quality: "dim7", alterations: [] },
];

/** Beginners see three families first; the rest wait behind "More shapes". */
const FIRST_STYLES: VoicingStyle[] = ["shell", "close", "drop2"];
const START_HERE: VoicingStyle = "shell";

const SETTINGS_KEY = "reharm.voicings";
interface Settings {
  source: Source;
  chord: string;
  key: string;
  style: VoicingStyle;
  more: boolean;
  /** Hear, hide, play: the voicing is played, then hidden, and you play it back from memory. */
  ear: boolean;
}
function loadSettings(): Settings {
  const fallback: Settings = { source: "chord", chord: "maj7", key: "C", style: "shell", more: false, ear: false };
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return {
      source: ["chord", "major251", "minor251", "tune"].includes(v.source) ? v.source : fallback.source,
      chord: CHORDS.some((c) => c.id === v.chord) ? v.chord : fallback.chord,
      key: (KEYS as readonly string[]).includes(v.key) ? v.key : fallback.key,
      style: VOICING_STYLES.some((s) => s.id === v.style) ? v.style : fallback.style,
      more: v.more === true,
      ear: v.ear === true,
    };
  } catch {
    return fallback;
  }
}
/** The settings a passport review opens on: that one chord, in its key, in its family. */
function settingsFor(review: Props["review"]): Settings {
  const saved = loadSettings();
  const s = review ? parseShapeRuleId(review.ruleId) : null;
  if (!review || !s) return saved;
  const c = CHORDS.find((x) => x.quality === s.quality && x.alterations.join("+") === s.alterations.join("+"));
  const key = KEYS.find((k) => chroma(k) === chroma(review.keyTonic));
  if (!c || !key) return saved;
  return { ...saved, source: "chord", chord: c.id, key, style: s.style, more: saved.more || !FIRST_STYLES.includes(s.style) };
}
function saveSettings(v: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(v));
  } catch {
    /* private mode: it lasts this visit */
  }
}

/** Voicings never moves the key after a clean chord (only the 12-key drill does). */
const HOLD = { kind: "flow", flow: "hold" } as const;

const mk = (root: string, quality: Quality, alterations: string[] = []): Chord => ({ root, quality, extensions: [], alterations });

/** The chords on the stage: one, a ii–V–I in the key, or the tune's changes (already in the key). */
function chordsFor(s: Settings, head: Tune | null = null): Chord[] {
  if (s.source === "tune" && head) return head.harmony;
  if (s.source === "major251") return [mk(transpose(s.key, "2"), "m7"), mk(transpose(s.key, "5"), "7"), mk(s.key, "maj7")];
  if (s.source === "minor251") return [mk(transpose(s.key, "2"), "m7b5"), mk(transpose(s.key, "5"), "7", ["b9"]), mk(s.key, "m6")];
  const c = CHORDS.find((x) => x.id === s.chord) ?? CHORDS[0];
  return [mk(s.key, c.quality, c.alterations)];
}

const pretty = (c: Chord) => prettySymbol(symbol(c));
const degreeLabel = (d: string) => (d === "1" ? "R" : prettyNote(d));
const styleName = (id: VoicingStyle) => VOICING_STYLES.find((s) => s.id === id)?.label ?? id;
const isGuide = (d: string) => ["3", "b3", "4", "7", "b7", "bb7", "6"].includes(d);
/** Pitch names of a form's notes, by hand ("LH: C · RH: E G B D"). */
const byHand = (f: VoicingForm, hand: "L" | "R") =>
  f.notes
    .filter((n) => n.hand === hand)
    .map((n) => `${prettyNote(n.name)} (${degreeLabel(n.degree)})`)
    .join("  ");

/** Voice motion from the chord before (theory-core's `voiceMotion`, the Coach's wording). */
const motionLine = (path: VoicingForm[], chords: Chord[], i: number) => voiceMotion(voicedForm(path[i - 1], chords[i - 1]), voicedForm(path[i], chords[i]));

export function VoicingsPage({ midi, onMode, review = null, tune, onOpenReference }: Props) {
  const touchFirst = useTouchFirst();
  const narrow = useNarrow();
  const [settings, setSettings] = useState(() => settingsFor(review));
  const update = (v: Partial<Settings>) =>
    setSettings((cur) => {
      const next = { ...cur, ...v };
      saveSettings(next);
      return next;
    });

  /** A choice made by hand ends a 12-key drill; the drill moves the key itself through `update`. */
  const pick = (v: Partial<Settings>) => {
    if (v.key !== undefined) session.changeKey(v.key, true);
    else session.stop();
    setWhyNoTune(false);
    update(v);
  };
  /** "Voice the tune" picked on a chart with no melody: say why, inline, with a way to a tune that has one. */
  const [whyNoTune, setWhyNoTune] = useState(false);
  const homeKey = (t: Tune) => KEYS.find((k) => chroma(k) === chroma(t.key.tonic)) ?? settings.key;
  const openReference = () => {
    onOpenReference?.();
    pick({ source: "tune", key: homeKey(referenceTune) });
  };
  /** The 12-key drill: one chord in one family, weakest keys first. */
  const startDrill = () => {
    const c = chordsFor(settings)[0];
    return session.startTwelveKey(shapeRuleId(settings.style, c.quality, c.alterations), settings.key);
  };

  // "Voice the tune": the head on the stand, moved to the chosen key (a chart with no melody can't be voiced under one)
  const melodyTune = hasMelody(tune);
  const head = useMemo(() => (settings.source === "tune" && melodyTune ? transposeTune(tune, settings.key) : null), [settings.source, settings.key, tune, melodyTune]);
  const source: Source = settings.source === "tune" && !head ? "chord" : settings.source;
  const chords = useMemo(() => chordsFor({ ...settings, source }, head), [settings, source, head]);
  const progression = chords.length > 1;
  // one chord: every form, and the one you're looking at; a ii–V–I: the voice-led path from a start form;
  // the tune: voice-led too, each chord under its melody note
  const [formId, setFormId] = useState<string | null>(null);
  const forms = useMemo(() => voicingForms(chords[0], settings.style), [chords, settings.style]);
  const startForms = progression && !head ? forms : [];
  const path = useMemo(
    () => (head ? voiceTheTune(head, settings.style) : progression ? voiceLeadForms(chords, settings.style, formId ?? undefined) : null),
    [head, chords, settings.style, formId, progression],
  );
  useEffect(() => {
    setFormId(null);
  }, [source, settings.chord, settings.key, settings.style, tune.id]);

  // ── the drill session: each chord on the stage is a run, filed once when first played clean
  // (theory-core's drillSession); a ii–V–I or the head moves on after each clean chord ──
  const single = forms.find((f) => f.id === formId) ?? forms[0];
  const runs = useMemo<DrillRun[]>(
    () => (path ? path.map((form, i) => ({ kind: "shape", form, chord: chords[i] })) : [{ kind: "shape", form: single, chord: chords[0] }]),
    [path, single, chords],
  );
  const session = useDrillSession({ runs, keyTonic: settings.key, flow: HOLD, delayMs: 900, onSetKey: (key) => update({ key }) });
  const step = session.view.run;
  const drill = session.view.lap;

  const current: VoicingForm = path ? path[step] : single;
  const chord = chords[progression ? step : 0];

  // ── hear, hide, play: where the chord on the stage is (theory-core's `earStep`); grading is unchanged ──
  const [earPhase, setEarPhase] = useState<EarPhase>("hear");
  const earEvent = (e: EarEvent) => setEarPhase((p) => earStep(p, e));
  /** Set once you've heard something here (audio is unlocked): from then on each new chord plays itself when hidden. */
  const earArmed = useRef(false);

  // ── hearing ──
  const [sounding, setSounding] = useState<number | null>(null);
  const heard = () => {
    earArmed.current = true;
    earEvent("heard");
  };
  const hear = () => {
    heard();
    void player.playNotes(current.notes.map((n) => n.midi), 1.8);
  };
  const arpeggio = () => {
    heard();
    void player.playSequence([...current.notes.map((n) => [n.midi]), current.notes.map((n) => n.midi)], 0.32);
  };
  const hearPath = () => {
    if (!path) return;
    heard();
    void player.playSequence(path.map((f) => f.notes.map((n) => n.midi)), 1.4, setSounding);
  };
  /** The head in time: the melody over the voicings (theory-core's `headScore`), swung like the band, and the stage following along. */
  const hearHead = () => {
    if (!head || !path) return;
    const { comp, line, steps } = headScore(head, path, getBandFeel().swing);
    heard();
    setHeadPlaying(true);
    void player.playScore([...comp, ...line], steps, (i) => {
      setSounding(i);
      if (i !== null) session.goToRun(i);
      else setHeadPlaying(false);
    });
  };
  const [headPlaying, setHeadPlaying] = useState(false);
  const headPlayingRef = useRef(headPlaying);
  headPlayingRef.current = headPlaying;
  const stopHead = () => {
    player.stopScore();
    setHeadPlaying(false);
    setSounding(null);
  };
  /** ◀ ▶ and ← →: the previous / next chord of a progression (taking over from a playing head). */
  const go = (d: 1 | -1) => {
    if (!path) return;
    if (headPlayingRef.current) stopHead();
    session.goToRun(Math.max(0, Math.min(path.length - 1, step + d)));
  };
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (notForUs(e) || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      e.preventDefault();
      goRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // a different head, shape, or leaving the tab stops it (stopping when nothing plays would cut a "Hear it")
  useEffect(
    () => () => {
      if (!headPlayingRef.current) return;
      player.stopScore();
      setHeadPlaying(false);
      setSounding(null);
    },
    [head, settings.style],
  );

  // a new chord on the stage (or the same one started over, or the mode switched) starts hidden and unheard;
  // in ear mode, once audio is unlocked, it plays itself. The head playing through counts as hearing it.
  const stageKey = `${session.view.epoch}|${settings.style}|${symbol(chord)}|${current.id}|${current.notes.map((n) => n.midi).join(",")}`;
  const hearRef = useRef(hear);
  hearRef.current = hear;
  useEffect(() => {
    const playing = headPlayingRef.current;
    setEarPhase((p) => (playing ? "recall" : earStep(p, "next")));
    if (playing || !settings.ear || !earArmed.current) return;
    const t = setTimeout(() => hearRef.current(), 250);
    return () => clearTimeout(t);
  }, [stageKey, settings.ear]);

  // ── playing: MIDI / computer keys strike; on-screen keys tap in, then check ──
  const [pending, setPending] = useState<number[]>([]);
  // the session grades each strike; tapping a key hides the last grade until the next one
  const [hidden, setHidden] = useState<DrillAttempt | null>(null);
  const latest = session.view.lastAttempt;
  const graded = latest && latest !== hidden && latest.by === "engine" && latest.kind === "shape" ? latest : null;
  const played = graded?.played ?? [];
  const grade: ShapeGrade | null = graded?.grade ?? null;
  const saved = session.saved && { clean: session.saved.clean, days: session.saved.review.intervalDays };
  // each graded strike moves the ear phase: clean shows the voicing, a miss keeps it hidden
  useEffect(() => {
    if (latest && latest.by === "engine" && latest.kind === "shape") earEvent(latest.grade.valid ? "clean" : "miss");
  }, [latest]);
  /** Ear mode, before a clean answer or Reveal: no target, no degrees, no note names; the chord symbol stays. */
  const concealed = settings.ear && earPhase !== "shown" && !grade?.valid;
  const reveal = () => earEvent("reveal");
  /** Shown again (after a clean answer or Reveal): hide it and hear it again. */
  const hideAgain = () => {
    setEarPhase("hear");
    setHidden(session.view.lastAttempt);
    hear();
  };
  // a new chord (or the same one started over) starts with no tapped-in notes
  useEffect(() => setPending([]), [session.view.epoch]);
  const check = (notes: number[]) => {
    setPending([]);
    session.strike(notes);
  };
  const checkRef = useRef(check);
  checkRef.current = check;
  useChordStrikes((notes) => checkRef.current(notes), true, 2);
  const tapKey = (m: number) => {
    void player.playNotes([m], 0.5);
    setHidden(session.view.lastAttempt);
    setPending((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort((a, b) => a - b)));
  };

  // ── keyboard marks ──
  const target = current.notes.map((n) => n.midi);
  const labels = current.notes.map((n) => ({ midi: n.midi, label: degreeLabel(n.degree), strong: isGuide(n.degree) }));
  const guides = current.notes.filter((n) => isGuide(n.degree)).map((n) => n.midi);
  const hands = current.notes.map((n) => ({ midi: n.midi, hand: n.hand }));
  // what was missing / extra against the last strike (theory-core's `shapeDiff`, from the grade)
  const diff = shapeDiff(current, played, grade);
  const marks = concealed
    ? // hidden: only your own notes, unjudged on the keys (the line under them counts what's off)
      grade
      ? { played }
      : { pending }
    : grade
      ? {
          played,
          ticks: grade.valid ? played : [],
          check: grade.valid,
          missing: diff.missing.map((n) => ({ midi: n.midi, label: degreeLabel(n.degree) })),
          wrong: diff.extra.map((m) => ({ midi: m, label: "✗" })),
          target: grade.valid ? [] : target,
          labels: grade.valid ? labels : [],
          hands,
        }
      : { target, labels, guides, hands, pending };
  // a phone gets just the keys in play (all of a ii–V–I's, so the rows don't jump between chords),
  // higher row on top like a grand staff, both rows at the same key size. The bass is left off:
  // grading treats it as optional, it's named in the LH/RH line, and a row just for it would push
  // everything else off the screen.
  // (a whole head spans too much for that: there the keys cover this chord and its neighbours)
  const near = head && path ? path.slice(Math.max(0, step - 1), step + 2) : path;
  const inPlay = (near ?? [current]).flatMap((f) => f.notes.slice(1).map((n) => n.midi));
  const rows = narrow ? [...phoneKeyboardRows(inPlay)].reverse() : [{ low: 36, high: 84 }];
  const widest = Math.max(...rows.map((r) => whiteCount(r.low, r.high)));
  const playedShape = grade?.playedForm;
  // hear it, play it: under the keys on a wide screen, in the docked bar on a phone
  const btn = narrow ? "cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker text-sm" : "tap-lg cursor-pointer rounded-full border-2 border-ink px-4 font-marker";
  const actions = (
    <div className={`flex flex-wrap items-center ${narrow ? "gap-1.5" : "gap-2"}`}>
      <button type="button" onClick={hear} className={`${btn} bg-ink text-paper-light`}>
        ▶ Hear it
      </button>
      <button type="button" onClick={arpeggio} className={`${btn} hover:bg-paper-shade`}>
        {narrow ? "Notes" : "Note by note"}
      </button>
      {concealed ? (
        <button type="button" onClick={reveal} className={`${btn} border-dashed hover:bg-paper-shade`}>
          {narrow ? "Reveal" : "Reveal the voicing"}
        </button>
      ) : (
        settings.ear && (
          <button type="button" onClick={hideAgain} className={`${btn} border-dashed hover:bg-paper-shade`}>
            {narrow ? "Hide" : "Hide it, hear it again"}
          </button>
        )
      )}
      {path && (
        <span className="flex items-center gap-1" role="group" aria-label="Step through the chords">
          <button type="button" onClick={() => go(-1)} disabled={step === 0} aria-label="Previous chord (←)" title="Previous chord (←)" className={`${btn} hover:bg-paper-shade disabled:cursor-default disabled:opacity-40`}>
            ◀
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={step === path.length - 1}
            aria-label="Next chord (→)"
            title="Next chord (→)"
            className={`${btn} hover:bg-paper-shade disabled:cursor-default disabled:opacity-40`}
          >
            ▶
          </button>
        </span>
      )}
      {head ? (
        headPlaying ? (
          <button type="button" onClick={stopHead} className={`${btn} bg-ink text-paper-light`}>
            ■ Stop
          </button>
        ) : (
          <button type="button" onClick={hearHead} className={`${btn} hover:bg-paper-shade`}>
            ▶ {narrow ? "Head" : "Hear the head"}
          </button>
        )
      ) : (
        path && (
          <button type="button" onClick={hearPath} className={`${btn} hover:bg-paper-shade`}>
            ▶ {narrow ? "All 3" : `Hear the ${source === "minor251" ? "ii–V–i" : "ii–V–I"}`}
          </button>
        )
      )}
      {pending.length > 0 && (
        <>
          <button type="button" onClick={() => check(pending)} className={`${btn} hover:bg-paper-shade`}>
            Check {narrow ? `(${pending.length})` : `my ${pending.length} notes`}
          </button>
          <button type="button" onClick={() => setPending([])} className="cursor-pointer font-marker text-sm text-ink-soft underline">
            Clear
          </button>
        </>
      )}
    </div>
  );
  // On a phone the keys come last and dock at the bottom of the screen (short keys, as in Changes),
  // with the buttons on top of them, so the voicing and the feedback line stay in view above.
  const keyboard = (
    <div
      className={
        narrow
          ? "sticky bottom-0 z-20 -mx-4 space-y-0.5 border-t-2 border-ink bg-paper-light px-2 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))]"
          : "space-y-1"
      }
    >
      {narrow && actions}
      {rows.map((r, i) => (
        <div key={r.low} style={{ width: `${(100 * whiteCount(r.low, r.high)) / widest}%` }}>
          <PenKeyboard {...r} {...marks} check={i === 0 && marks.check} showSplit={false} slim={narrow} short={narrow} onKey={tapKey} />
        </div>
      ))}
    </div>
  );
  // the beginner three first (Shells leading), then the rest in the mixer's order
  const ordered = [...FIRST_STYLES, ...VOICING_STYLES.map((s) => s.id).filter((id) => !FIRST_STYLES.includes(id))];
  const shown = settings.more ? ordered : ordered.filter((id) => FIRST_STYLES.includes(id) || id === settings.style);

  return (
    <div className="min-h-dvh p-3 text-ink md:p-5">
      <SketchFilters />
      <header className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ModeSwitch mode="voicings" onMode={onMode} />
        <h1 className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
          Voicings <span className="text-base font-normal normal-case text-ink-soft">· Pick a chord, pick a shape, see where the fingers go</span>
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!(touchFirst && midi.status === "unsupported") && (
            <button
              type="button"
              onClick={midi.connect}
              disabled={midi.status === "connected" || midi.status === "requesting"}
              className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 font-marker text-sm hover:bg-paper-shade disabled:cursor-default"
            >
              🎹 {midi.status === "connected" ? "MIDI connected" : midi.status === "requesting" ? "Connecting…" : "Connect MIDI"}
            </button>
          )}
          {midi.status === "connected" && <MidiMonitorToggle compact />}
          {!touchFirst && <QwertyToggle compact />}
        </div>
      </header>

      <SketchBox seed={seedOf("voicings-stage")} fill={paper.light} strokeWidth={2} className="mx-auto max-w-5xl">
        <div className="space-y-4 p-4 md:p-6">
          {/* ── what to voice ── */}
          <div className="flex flex-wrap items-center gap-2 font-hand">
            <Pills
              label="Source"
              value={source}
              options={[
                { id: "chord", label: "One chord" },
                { id: "major251", label: "ii–V–I major" },
                { id: "minor251", label: "ii–V–i minor" },
                { id: "tune", label: "Voice the tune", unavailable: !melodyTune },
              ]}
              // the tune opens in the key it's on the stand in; a chart with no melody explains itself instead
              onChange={(s) => {
                if (s === "tune" && !melodyTune) return setWhyNoTune(true);
                pick(s === "tune" && settings.source !== "tune" ? { source: s, key: homeKey(tune) } : { source: s });
              }}
            />
            {source === "chord" && (
              <label className="flex items-center gap-1">
                <span className="sr-only">Chord type</span>
                <select value={settings.chord} onChange={(e) => pick({ chord: e.target.value })} className="cursor-pointer rounded-full border-2 border-ink bg-paper-light px-2 py-0.5 font-marker">
                  {CHORDS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1 font-marker">
              Key
              <select value={settings.key} onChange={(e) => pick({ key: e.target.value })} className="cursor-pointer rounded-full border-2 border-ink bg-paper-light px-2 py-0.5">
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {prettyNote(k)}
                  </option>
                ))}
              </select>
            </label>
            {source === "chord" && !drill && (
              <button
                type="button"
                onClick={() => void startDrill()}
                title="This chord and shape through all 12 keys: keys due for review and keys you've missed in come first"
                className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:bg-paper-shade"
              >
                Drill 12 keys →
              </button>
            )}
            <button
              type="button"
              aria-pressed={settings.ear}
              onClick={() => {
                // switching it on is a click, so audio is unlocked: the chord on the stage plays, then hides
                earArmed.current = true;
                update({ ear: !settings.ear });
              }}
              title="Ear mode: the app plays the voicing, hides it from the keys, and you play it back from memory"
              className={`cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker ${settings.ear ? "border-ink bg-ink text-paper-light" : "border-dashed border-ink-soft hover:bg-paper-shade"}`}
            >
              👂 Hear, hide, play
            </button>
          </div>

          {whyNoTune && !melodyTune && (
            <p role="note" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-2 border-dashed border-ink-soft px-3 py-1.5 font-hand text-sm">
              <span>
                <span className="font-marker">{tune.title}</span> has chord changes only, so there's no melody to voice under.
              </span>
              {onOpenReference && hasMelody(referenceTune) && (
                <button type="button" onClick={openReference} className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:bg-paper-shade">
                  Open {referenceTune.title} →
                </button>
              )}
              <button type="button" onClick={() => setWhyNoTune(false)} aria-label="Dismiss" className="ml-auto cursor-pointer font-marker text-ink-soft">
                ✕
              </button>
            </p>
          )}

          {drill && <DrillRibbon drill={drill} chord={pretty(chord)} style={styleName(settings.style)} onAgain={() => void startDrill()} onStop={session.stop} />}

          {/* ── which family ── */}
          <div>
            <div role="radiogroup" aria-label="Voicing shape" className="flex flex-wrap items-center gap-2">
              {shown.map((id) => {
                const on = settings.style === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pick({ style: id })}
                    className={`cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker ${on ? "border-ink bg-ink text-paper-light" : "border-dashed border-ink-soft hover:bg-paper-shade"}`}
                  >
                    {styleName(id)}
                    {id === START_HERE && <span className={`ml-1 text-xs ${on ? "" : "text-ink-soft"}`}>· start here</span>}
                  </button>
                );
              })}
              <button type="button" onClick={() => update({ more: !settings.more })} className="cursor-pointer font-marker text-sm text-ink-soft underline">
                {settings.more ? "Fewer shapes" : "More shapes ▾"}
              </button>
            </div>
            <p className="mt-1 font-hand text-sm text-ink-soft">{VOICING_STYLES.find((s) => s.id === settings.style)?.hint}</p>
          </div>

          {/* ── the chord(s) ── */}
          {head && path ? (
            <>
              <LeadSheet head={head} path={path} step={step} sounding={sounding} narrow={narrow} onPick={(i) => (headPlaying ? (stopHead(), session.goToRun(i)) : session.goToRun(i))} />
              <p className="font-hand text-sm text-ink-soft">
                Bar {head.harmony[step]?.at.bar}: {current.label}
                {step > 0 && !concealed && ` · from ${pretty(chords[step - 1])}: ${motionLine(path, chords, step)}`}
              </p>
            </>
          ) : path ? (
            <>
              {/* a phone gets a one-row strip (chord + A/B) and the current step's detail underneath,
                  so the keyboard stays in view; wider screens show the detail on every card */}
              <ol className="grid grid-cols-3 gap-1 sm:gap-2" aria-label="The ii–V–I, voice-led">
                {path.map((f, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => session.goToRun(i)}
                      aria-current={i === step}
                      aria-label={`${pretty(chords[i])}, ${f.label}`}
                      className={`w-full cursor-pointer rounded-lg border-2 text-left ${narrow ? "px-2 py-1" : "px-3 py-2"} ${i === step ? "border-ink bg-paper-shade" : "border-dashed border-ink-soft"} ${sounding === i ? "ring-2 ring-wash-mustard" : ""}`}
                    >
                      <span className={`font-marker ${narrow ? "text-lg" : "text-xl"}`}>{pretty(chords[i])}</span>
                      {narrow ? (
                        (f.id === "A" || f.id === "B") && <span className="ml-1 font-hand text-sm text-ink-soft">{f.id}</span>
                      ) : (
                        <>
                          <span className="block font-hand text-sm text-ink-soft">{f.label}</span>
                          {/* the motion names notes: hidden in ear mode until this chord is shown */}
                          {i > 0 && !(settings.ear && (i > step || (i === step && concealed))) && (
                            <span className="block font-hand text-xs text-ink-soft">
                              from {pretty(chords[i - 1])}: {motionLine(path, chords, i)}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
              {narrow && (
                <p className="font-hand text-sm text-ink-soft">
                  {current.label}
                  {step > 0 && !concealed && ` · from ${pretty(chords[step - 1])}: ${motionLine(path, chords, step)}`}
                </p>
              )}
            </>
          ) : (
            <p className="font-marker text-3xl">{pretty(chord)}</p>
          )}

          {/* ── the forms ── */}
          {(progression ? startForms : forms).length > 1 && (
            <div className="flex flex-wrap items-center gap-2 font-hand text-sm">
              <span className="font-marker">{progression ? `Start the ${pretty(chords[0])} on:` : "Forms:"}</span>
              {(progression ? startForms : forms).map((f) => {
                const on = progression ? (formId ?? path?.[0].id) === f.id : current.id === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFormId(f.id);
                      session.goToRun(0);
                    }}
                    aria-pressed={on}
                    className={`cursor-pointer rounded-full border px-2 py-0.5 ${on ? "border-ink bg-paper-shade font-marker" : "border-dashed border-ink-soft"}`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
          {current.fellBack && (
            <p className="font-hand text-sm" role="note">
              {head
                ? `${styleName(settings.style)} can't fit ${pretty(chord)} under the melody's ${prettyNote(current.notes[current.notes.length - 1].name)}, so this chord is the close voicing instead.`
                : `${styleName(settings.style)} can't voice ${pretty(chord)} and keep both its 3rd and 7th, so this is the close voicing instead.`}
            </p>
          )}

          {/* ── the keys ── */}
          {!narrow && keyboard}
          {concealed ? (
            <p className="font-hand text-sm text-ink-soft" role="note">
              👂 The voicing is hidden{earPhase === "hear" ? ": hear it first." : "."} Play it back from memory; a clean answer, or Reveal, shows it again with what was missing or extra.
            </p>
          ) : (
            <p className="font-hand text-sm" aria-label="Voicing by hand, with the key legend">
              <HandTag hand="L" /> <span className="font-marker">LH</span> {byHand(current, "L")} <span className="mx-2 text-ink-faint">|</span> <HandTag hand="R" />{" "}
              <span className="font-marker">RH</span> {byHand(current, "R")}
              <span className="ml-2 whitespace-nowrap text-ink-soft">
                · <GuideTag /> guide tones ({current.notes.filter((n) => isGuide(n.degree)).map((n) => degreeLabel(n.degree)).join(", ")})
              </span>
            </p>
          )}

          {!narrow && actions}

          <div aria-live="polite" className="min-h-[1.5rem] font-hand text-lg">
            {grade ? (
              grade.valid ? (
                <p className="font-marker text-sage-ink">
                  ✓ {current.label}.{path && step < path.length - 1 ? ` On to the ${pretty(chords[step + 1])}…` : path ? " The whole progression, clean." : ""}
                  {saved && (
                    <span className="ml-2 font-hand text-base text-ink-soft">
                      {saved.clean ? `Stamped ${prettyNote(chord.root)} in the passport` : "Filed in the passport"} · next review{" "}
                      {saved.days <= 1 ? "tomorrow" : `in ${Math.round(saved.days)} days`}
                    </span>
                  )}
                </p>
              ) : (
                <p className="font-marker text-pen">
                  {/* hidden, the pen only counts what's off (its usual hint names the notes) */}
                  {concealed ? hiddenHint(grade) : grade.hint}
                  {!concealed && playedShape && playedShape.style !== current.style && <span className="ml-1 font-hand text-ink-soft">(that's a {styleName(playedShape.style)} shape)</span>}
                </p>
              )
            ) : (
              <p className="text-ink-soft">
                {concealed
                  ? earPhase === "hear"
                    ? "Press ▶ Hear it, then play it back from memory."
                    : "Now play it from memory. Any octave counts; the bass note is optional."
                  : touchFirst || midi.status !== "connected"
                  ? "Play it: tap the keys, then Check. Or connect a MIDI keyboard, or press M to play with your computer keys. Any octave counts."
                  : "Play it on your keyboard. Any octave counts; the bass note is optional."}
              </p>
            )}
          </div>
          {!concealed && <IdentifyHint played={played} chord={chord} grade={grade} />}
          {narrow && keyboard}
        </div>
      </SketchBox>
    </div>
  );
}

/** The 12-key drill's progress, from the session: `at` is 12 once it's finished; `done` is true for a key clean first time. */
type Drill = NonNullable<DrillView["lap"]>;

const WHY_TAG: Record<DrillKeyWhy, string> = { due: "due", weak: "missed before", new: "new", solid: "" };

/** The drill's 12 keys in order: ticked when done (✓✓ clean first time), the current one ringed, the rest tagged with why they're where they are. */
function DrillRibbon({ drill, chord, style, onAgain, onStop }: { drill: Drill; chord: string; style: string; onAgain: () => void; onStop: () => void }) {
  const finished = drill.at >= 12;
  const clean = Object.values(drill.done).filter(Boolean).length;
  return (
    <section aria-label="12-key drill" className="space-y-2 rounded-lg border-2 border-dashed border-ink-soft p-2 font-hand">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-marker">
          {finished ? `All 12 keys done: ${clean} clean first time.` : `12-key drill · ${style} · key ${drill.at + 1} of 12: ${chord}`}
        </span>
        <span className="text-sm text-ink-soft">{finished ? "Each key is filed in the passport." : "Due keys and keys you've missed in come first."}</span>
        <span className="ml-auto flex gap-3 font-marker text-sm">
          {finished && (
            <button type="button" onClick={onAgain} className="cursor-pointer underline">
              Drill again
            </button>
          )}
          <button type="button" onClick={onStop} className="cursor-pointer text-ink-soft underline">
            {finished ? "Done" : "Stop drill"}
          </button>
        </span>
      </p>
      <ol className="flex flex-wrap gap-1.5">
        {drill.keys.map(({ key, why }, i) => {
          const result = drill.done[key];
          const here = i === drill.at;
          return (
            <li
              key={key}
              aria-current={here || undefined}
              aria-label={`${prettyNote(key)}: ${result === undefined ? (here ? "playing now" : WHY_TAG[why] || "solid") : result ? "clean" : "done, with a miss"}`}
              className={`rounded-full border-2 px-2 py-0.5 text-sm ${here ? "border-pen font-marker" : result !== undefined ? "border-ink bg-paper-shade" : "border-dashed border-ink-faint"}`}
            >
              <span className="font-marker">{prettyNote(key)}</span>
              {result !== undefined ? <span className="ml-1">{result ? "✓✓" : "✓"}</span> : WHY_TAG[why] && <span className="ml-1 text-xs text-ink-soft">{WHY_TAG[why]}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** After a miss, if what was played is a known shape of this chord anyway, say which. */
/**
 * The head as a lead sheet: lines of four numbered bars, read left to right like music, each line
 * on its own rule so the rows read as systems (not columns), a double bar at the end. Each chord
 * shows the melody note it's voiced under.
 */
function LeadSheet({
  head,
  path,
  step,
  sounding,
  narrow,
  onPick,
}: {
  head: Tune;
  path: VoicingForm[];
  step: number;
  sounding: number | null;
  narrow: boolean;
  onPick: (i: number) => void;
}) {
  const bars = Math.max(...head.harmony.map((c) => c.at.bar));
  const lines = Array.from({ length: Math.ceil(bars / 4) }, (_, l) => [0, 1, 2, 3].map((j) => l * 4 + j + 1));
  const topName = (i: number) => prettyNote(path[i].notes[path[i].notes.length - 1].name);
  return (
    <div className="space-y-3" role="group" aria-label={`${head.title}, voiced with the melody on top`}>
      {lines.map((line) => (
        <ol key={line[0]} start={line[0]} className="grid grid-cols-4 border-b-2 border-ink">
          {line.map((bar, j) => {
            if (bar > bars) return <li key={bar} aria-hidden="true" />;
            const inBar = head.harmony.map((c, i) => ({ c, i })).filter(({ c }) => c.at.bar === bar);
            return (
              <li key={bar} className={`relative flex border-ink px-0.5 pt-5 ${j === 0 ? "border-l-2" : ""} ${bar === bars ? "border-r-4 border-double" : "border-r-2"}`}>
                <span aria-hidden="true" className="absolute top-0.5 left-1 font-marker text-sm leading-none text-ink-soft">
                  {bar}
                </span>
                {inBar.map(({ c, i }) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onPick(i)}
                    aria-current={i === step}
                    aria-label={`Bar ${bar}: ${prettySymbol(symbol(c))}, ${topName(i)} on top${path[i].fellBack ? ", close" : ""}`}
                    className={`min-w-0 flex-1 cursor-pointer rounded px-1 py-0.5 text-left ${i === step ? "bg-paper-shade outline-2 outline-ink" : "hover:bg-paper-shade"} ${sounding === i ? "ring-2 ring-wash-mustard" : ""}`}
                  >
                    {/* a phone's two-chord bar is ~40px a chord: smaller symbol, and just "♪F" */}
                    <span className={`block font-marker leading-tight ${narrow ? (inBar.length > 1 ? "text-[0.7rem]" : "text-sm") : "text-lg"}`}>{prettySymbol(symbol(c))}</span>
                    <span className="block truncate font-hand text-xs text-ink-soft">
                      {narrow ? `♪${topName(i)}` : `${topName(i)} on top`}
                      {path[i].fellBack ? (narrow ? "*" : " · close") : ""}
                    </span>
                  </button>
                ))}
              </li>
            );
          })}
        </ol>
      ))}
    </div>
  );
}

/** Legend swatch matching the keys: a washed key with the hand's shape tag (LH square, RH dot). */
function HandTag({ hand }: { hand: "L" | "R" }) {
  return (
    <svg viewBox="0 0 12 16" className="inline-block h-4 w-3 align-[-3px]" aria-hidden="true">
      <rect x="0.5" y="0.5" width="11" height="15" rx="1" fill={hand === "L" ? wash.brick : wash.blue} stroke={keys.line} />
      {hand === "L" ? <rect x="3.5" y="9.5" width="5" height="5" fill={keys.black} /> : <circle cx="6" cy="12" r="2.6" fill={keys.black} />}
    </svg>
  );
}

/** Legend swatch for the guide-tone mark on the keys: an ink double ring. */
function GuideTag() {
  return (
    <svg viewBox="0 0 16 16" className="inline-block h-4 w-4 align-[-3px]" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="4.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IdentifyHint({ played, chord, grade }: { played: number[]; chord: Chord; grade: ShapeGrade | null }) {
  if (!grade || grade.valid || grade.playedForm || played.length < 3) return null;
  const k = classifyVoicing(played, chord)[0];
  if (!k) return null;
  return <p className="font-hand text-sm text-ink-soft">What you played is the {styleName(k.style)} form “{k.form}” of this chord.</p>;
}

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  /** `unavailable`: drawn dimmed but still clickable, so picking it can say why. */
  options: { id: T; label: string; unavailable?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          aria-disabled={o.unavailable || undefined}
          onClick={() => onChange(o.id)}
          className={`cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker text-sm aria-disabled:opacity-50 ${value === o.id ? "border-ink bg-ink text-paper-light" : "border-dashed border-ink-soft hover:bg-paper-shade"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
