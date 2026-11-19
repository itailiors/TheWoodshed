import {
  chroma,
  classifyVoicing,
  drillKeyOrder,
  gradeShape,
  type DrillKeyWhy,
  parseShapeRuleId,
  shapeRuleId,
  KEYS,
  prettyNote,
  prettySymbol,
  symbol,
  transpose,
  VOICING_STYLES,
  voiceLeadForms,
  voicingForms,
  type Quality,
  type ShapeGrade,
  type VoicingForm,
  type VoicingStyle,
} from "@reharm/theory-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { player } from "../../audio/player";
import { fetchProgress, saveShapeRun } from "../../library/practice";
import { SketchBox, SketchFilters } from "../../design/rough";
import { paper, seedOf } from "../../design/tokens";
import { useNarrow, useTouchFirst } from "../../device/media";
import { useChordStrikes } from "../../midi/noteBus";
import type { MidiStatus } from "../../midi/useMidi";
import { MidiMonitorToggle } from "../MidiMonitorToggle";
import { ModeSwitch, type AppMode } from "../ModeSwitch";
import { phoneKeyboardRows, whiteCount } from "../practice/keyboardRows";
import { PenKeyboard } from "../practice/PenKeyboard";
import { QwertyToggle } from "../QwertyToggle";

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
}

type Source = "chord" | "major251" | "minor251";
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
}
function loadSettings(): Settings {
  const fallback: Settings = { source: "chord", chord: "maj7", key: "C", style: "shell", more: false };
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return {
      source: ["chord", "major251", "minor251"].includes(v.source) ? v.source : fallback.source,
      chord: CHORDS.some((c) => c.id === v.chord) ? v.chord : fallback.chord,
      key: (KEYS as readonly string[]).includes(v.key) ? v.key : fallback.key,
      style: VOICING_STYLES.some((s) => s.id === v.style) ? v.style : fallback.style,
      more: v.more === true,
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

const mk = (root: string, quality: Quality, alterations: string[] = []): Chord => ({ root, quality, extensions: [], alterations });

/** The chords on the stage: one, or a ii–V–I in the key. */
function chordsFor(s: Settings): Chord[] {
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

/** How each voice gets from one form to the next, voice by voice ("C→B −1", "F held"). */
function motionLine(a: VoicingForm, b: VoicingForm): string {
  const ua = a.notes.slice(1);
  const ub = b.notes.slice(1);
  if (ua.length !== ub.length) return `${ua.length} voices → ${ub.length}`;
  const parts = ua.map((n, i) => {
    const d = ub[i].midi - n.midi;
    return d === 0 ? `${prettyNote(n.name)} held` : `${prettyNote(n.name)}→${prettyNote(ub[i].name)} ${d > 0 ? "+" : "−"}${Math.abs(d)}`;
  });
  const held = ua.filter((n, i) => ub[i].midi === n.midi).length;
  return `${held} held · ${parts.filter((p) => !p.endsWith("held")).join(" · ") || "nothing moves"}`;
}

export function VoicingsPage({ midi, onMode, review = null }: Props) {
  const touchFirst = useTouchFirst();
  const narrow = useNarrow();
  const [settings, setSettings] = useState(() => settingsFor(review));
  const update = (v: Partial<Settings>) =>
    setSettings((cur) => {
      const next = { ...cur, ...v };
      saveSettings(next);
      return next;
    });

  // ── the 12-key drill: one chord in one family, weakest keys first (theory-core's drillKeyOrder) ──
  const [drill, setDrill] = useState<Drill | null>(null);
  const drillRef = useRef(drill);
  drillRef.current = drill;
  /** A choice made by hand ends the drill; the drill moves the key itself through `update`. */
  const pick = (v: Partial<Settings>) => {
    setDrill(null);
    update(v);
  };
  const startDrill = async () => {
    const c = chordsFor(settings)[0];
    const ruleId = shapeRuleId(settings.style, c.quality, c.alterations);
    const p = await fetchProgress();
    // the demo's sample notebook is someone else's practice: it never orders your drill
    const reviews = p && !p.sample ? p.concepts.filter((r) => r.ruleId === ruleId) : [];
    const keys = drillKeyOrder(reviews, settings.key, new Date());
    update({ key: keys[0].key });
    setDrill({ keys, at: 0, done: {} });
  };

  const chords = useMemo(() => chordsFor(settings), [settings]);
  const progression = chords.length > 1;
  // one chord: every form, and the one you're looking at; a ii–V–I: the voice-led path from a start form
  const [formId, setFormId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const forms = useMemo(() => voicingForms(chords[0], settings.style), [chords, settings.style]);
  const startForms = progression ? forms : [];
  const path = useMemo(() => (progression ? voiceLeadForms(chords, settings.style, formId ?? undefined) : null), [chords, settings.style, formId, progression]);
  useEffect(() => {
    setFormId(null);
    setStep(0);
  }, [settings.source, settings.chord, settings.key, settings.style]);

  const current: VoicingForm = path ? path[step] : (forms.find((f) => f.id === formId) ?? forms[0]);
  const chord = chords[progression ? step : 0];

  // ── hearing ──
  const [sounding, setSounding] = useState<number | null>(null);
  const hear = () => void player.playNotes(current.notes.map((n) => n.midi), 1.8);
  const arpeggio = () => void player.playSequence([...current.notes.map((n) => [n.midi]), current.notes.map((n) => n.midi)], 0.32);
  const hearPath = () => path && void player.playSequence(path.map((f) => f.notes.map((n) => n.midi)), 1.4, setSounding);

  // ── playing: MIDI / computer keys strike; on-screen keys tap in, then check ──
  const [played, setPlayed] = useState<number[]>([]);
  const [pending, setPending] = useState<number[]>([]);
  const [grade, setGrade] = useState<ShapeGrade | null>(null);
  // the practice history: wrong strikes on this chord so far, and whether its clean one is filed
  const misses = useRef(0);
  const filed = useRef(false);
  const [saved, setSaved] = useState<{ clean: boolean; days: number } | null>(null);
  useEffect(() => {
    setPlayed([]);
    setPending([]);
    setGrade(null);
    setSaved(null);
    misses.current = 0;
    filed.current = false;
  }, [current.id, chord.root, chord.quality, settings.style, step]);
  const check = (notes: number[]) => {
    setPlayed(notes);
    setPending([]);
    const g = gradeShape(notes, current, chord);
    setGrade(g);
    if (!g.valid) misses.current++;
    else if (!filed.current && /^[A-G][b#]?$/.test(chord.root)) {
      filed.current = true;
      // in a 12-key drill, this key is done: mark it (clean = no wrong strike first) and move on
      if (drill && drill.at < 12 && chroma(drill.keys[drill.at].key) === chroma(chord.root)) {
        const at = drill.at;
        setDrill((d) => d && { ...d, done: { ...d.done, [d.keys[at].key]: misses.current === 0 } });
        setTimeout(() => {
          if (drillRef.current?.keys !== drill.keys) return; // stopped (or restarted) meanwhile
          setDrill((d) => d && { ...d, at: at + 1 });
          if (at < 11) update({ key: drill.keys[at + 1].key });
        }, 900);
      }
      // filed under the family actually shown (a fallback form is close, and says so)
      void saveShapeRun({ ruleId: shapeRuleId(current.style, chord.quality, chord.alterations), keyTonic: chord.root, misses: misses.current }).then(
        (r) => r && setSaved({ clean: r.clean, days: r.review.intervalDays }),
      );
    }
    // in a ii–V–I, a clean chord moves you on to the next one
    if (g.valid && path && step < path.length - 1) setTimeout(() => setStep((i) => Math.min(i + 1, path.length - 1)), 900);
  };
  const checkRef = useRef(check);
  checkRef.current = check;
  useChordStrikes((notes) => checkRef.current(notes), true, 2);
  const tapKey = (m: number) => {
    void player.playNotes([m], 0.5);
    setGrade(null);
    setPlayed([]);
    setPending((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort((a, b) => a - b)));
  };

  // ── keyboard marks ──
  const target = current.notes.map((n) => n.midi);
  const labels = current.notes.map((n) => ({ midi: n.midi, label: degreeLabel(n.degree) }));
  const rings = current.notes.filter((n) => isGuide(n.degree)).map((n) => n.midi);
  const pcOf = (m: number) => ((m % 12) + 12) % 12;
  const formPcs = new Set(current.notes.map((n) => pcOf(n.midi)));
  const marks = grade
    ? {
        played,
        ticks: grade.valid ? played : [],
        check: grade.valid,
        missing: grade.valid ? [] : current.notes.filter((n, i) => i > 0 && grade.missing.includes(n.degree)).map((n) => ({ midi: n.midi, label: degreeLabel(n.degree) })),
        wrong: played.filter((m) => !formPcs.has(pcOf(m))).map((m) => ({ midi: m, label: "✗" })),
        target: grade.valid ? [] : target,
        labels: grade.valid ? labels : [],
      }
    : { target, labels, rings, pending };
  // a phone gets just the keys in play (all of a ii–V–I's, so the rows don't jump between chords),
  // higher row on top like a grand staff, both rows at the same key size. The bass is left off:
  // grading treats it as optional, it's named in the LH/RH line, and a row just for it would push
  // everything else off the screen.
  const inPlay = (path ?? [current]).flatMap((f) => f.notes.slice(1).map((n) => n.midi));
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
      {path && (
        <button type="button" onClick={hearPath} className={`${btn} hover:bg-paper-shade`}>
          ▶ {narrow ? "All 3" : `Hear the ${settings.source === "minor251" ? "ii–V–i" : "ii–V–I"}`}
        </button>
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
              value={settings.source}
              options={[
                { id: "chord", label: "One chord" },
                { id: "major251", label: "ii–V–I major" },
                { id: "minor251", label: "ii–V–i minor" },
              ]}
              onChange={(source) => pick({ source })}
            />
            {settings.source === "chord" && (
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
            {settings.source === "chord" && !drill && (
              <button
                type="button"
                onClick={() => void startDrill()}
                title="This chord and shape through all 12 keys: keys due for review and keys you've missed in come first"
                className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:bg-paper-shade"
              >
                Drill 12 keys →
              </button>
            )}
          </div>

          {drill && <DrillRibbon drill={drill} chord={pretty(chord)} style={styleName(settings.style)} onAgain={() => void startDrill()} onStop={() => setDrill(null)} />}

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
          {path ? (
            <>
              {/* a phone gets a one-row strip (chord + A/B) and the current step's detail underneath,
                  so the keyboard stays in view; wider screens show the detail on every card */}
              <ol className="grid grid-cols-3 gap-1 sm:gap-2" aria-label="The ii–V–I, voice-led">
                {path.map((f, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setStep(i)}
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
                          {i > 0 && <span className="block font-hand text-xs text-ink-soft">from {pretty(chords[i - 1])}: {motionLine(path[i - 1], f)}</span>}
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
              {narrow && (
                <p className="font-hand text-sm text-ink-soft">
                  {current.label}
                  {step > 0 && ` · from ${pretty(chords[step - 1])}: ${motionLine(path[step - 1], current)}`}
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
                      setStep(0);
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
              {styleName(settings.style)} can't voice {pretty(chord)} and keep both its 3rd and 7th, so this is the close voicing instead.
            </p>
          )}

          {/* ── the keys ── */}
          {!narrow && keyboard}
          <p className="font-hand text-sm">
            <span className="font-marker">LH</span> {byHand(current, "L")} <span className="mx-2 text-ink-faint">|</span> <span className="font-marker">RH</span> {byHand(current, "R")}
            <span className="ml-2 text-ink-soft">· ringed: the 3rd and 7th</span>
          </p>

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
                  {grade.hint}
                  {playedShape && playedShape.style !== current.style && <span className="ml-1 font-hand text-ink-soft">(that's a {styleName(playedShape.style)} shape)</span>}
                </p>
              )
            ) : (
              <p className="text-ink-soft">
                {touchFirst || midi.status !== "connected"
                  ? "Play it: tap the keys, then Check. Or connect a MIDI keyboard, or press M to play with your computer keys. Any octave counts."
                  : "Play it on your keyboard. Any octave counts; the bass note is optional."}
              </p>
            )}
          </div>
          <IdentifyHint played={played} chord={chord} grade={grade} />
          {narrow && keyboard}
        </div>
      </SketchBox>
    </div>
  );
}

interface Drill {
  keys: { key: string; why: DrillKeyWhy }[];
  /** The key being played (an index into `keys`); 12 when the drill is finished. */
  at: number;
  /** Keys finished so far: true when the first strike was clean. */
  done: Record<string, boolean>;
}

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
function IdentifyHint({ played, chord, grade }: { played: number[]; chord: Chord; grade: ShapeGrade | null }) {
  if (!grade || grade.valid || grade.playedForm || played.length < 3) return null;
  const k = classifyVoicing(played, chord)[0];
  if (!k) return null;
  return <p className="font-hand text-sm text-ink-soft">What you played is the {styleName(k.style)} form “{k.form}” of this chord.</p>;
}

function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker text-sm ${value === o.id ? "border-ink bg-ink text-paper-light" : "border-dashed border-ink-soft hover:bg-paper-shade"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
