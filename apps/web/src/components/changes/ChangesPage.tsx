import { currentOptions, EAR_MOTION_NAME, FUNCTION_CHIPS, LEVELS, motionOfRuleId, prettyNote, prettySymbol, summarise, type LevelId, type Stage } from "@reharm/theory-core";
import { useEffect, useState } from "react";
import { player } from "../../audio/player";
import { SketchBox, SketchFilters } from "../../design/rough";
import { paper, pen, seedOf } from "../../design/tokens";
import type { DueItem } from "../../library/practice";
import { useNarrow, useTouchFirst } from "../../device/media";
import { useWakeLock } from "../../device/wakeLock";
import { noteBus } from "../../midi/noteBus";
import type { MidiStatus } from "../../midi/useMidi";
import { MidiMonitorToggle } from "../MidiMonitorToggle";
import { ModeSwitch, type AppMode } from "../ModeSwitch";
import { PenKeyboard, type PenKeyboardProps } from "../practice/PenKeyboard";
import { QwertyToggle } from "../QwertyToggle";
import { FunctionChips, LevelPicker, StageSelector } from "./Controls";
import { FeedbackLine, OptionCards, PromptChord } from "./GamePieces";
import { RoadTrail } from "./RoadTrail";
import { roadOf } from "./roadModel";
import { useChangesGame } from "./useChangesGame";
import { levelFor, useChangesProgress, type ChangesProgress } from "./useChangesProgress";

/*
 * The Changes tab: harmony games with sound. Its first game is "Make the Changes": you're on a
 * chord, and you say where it wants to go next, by playing the root (MIDI, the computer keys or
 * the keys on screen) or, with help on, tapping a card.
 *
 * Levels 1–3, each at three stages of help (Guided: cards that say what they are; Choices:
 * names only; Open: play it yourself, and from Level 2 name the function too). Saved
 * progress and the full session summary arrive in step 8.
 */

interface Props {
  midi: { status: MidiStatus; connect: () => void };
  onMode: (m: AppMode) => void;
}

/** The level and stage you last played, remembered per browser. */
const SETTINGS_KEY = "reharm.changes";
function loadSettings(): { level: LevelId; stage: Stage } {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return {
      level: [1, 2, 3].includes(v.level) ? v.level : 1,
      stage: ["guided", "choices", "open"].includes(v.stage) ? v.stage : "guided",
    };
  } catch {
    return { level: 1, stage: "guided" };
  }
}
function saveSettings(v: { level: LevelId; stage: Stage }) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(v));
  } catch {
    /* private mode: it lasts this visit */
  }
}

export function ChangesPage({ midi, onMode }: Props) {
  const game = useChangesGame();
  const { s, dispatch, step, round, listening } = game;
  const touchFirst = useTouchFirst();
  const narrow = useNarrow();
  const playing = s.phase !== "idle" && s.phase !== "summary";
  useWakeLock(playing);

  const [settings, setSettings] = useState(loadSettings);
  const updateSettings = (v: Partial<typeof settings>) =>
    setSettings((cur) => {
      const next = { ...cur, ...v };
      saveSettings(next);
      return next;
    });
  // the stage you end up at (moved up, or picked mid-game) is the one you start with next time
  useEffect(() => {
    if (playing) updateSettings({ stage: s.stage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, s.stage]);
  const progress = useChangesProgress();
  // due reviews of this level come first in any session (planSession skips other levels' ones)
  const startSession = () => game.start(settings.level, settings.stage, progress?.due ?? []);
  // "Review them": the level that covers them, at Open (only Open answers count for the scheduler)
  const startReview = (level: LevelId, due: DueItem[]) => {
    updateSettings({ level, stage: "open" });
    game.start(level, "open", due);
  };
  const setup = { settings, onSettings: updateSettings, progress, onReview: startReview };

  // moved up a stage: say so, with an Undo, for a few seconds
  const [promoted, setPromoted] = useState<Stage | null>(null);
  useEffect(() => {
    if (!s.promotedFrom) return setPromoted(null);
    setPromoted(s.promotedFrom);
    const t = setTimeout(() => setPromoted(null), 8000);
    return () => clearTimeout(t);
  }, [s.promotedFrom]);

  const options = currentOptions(s);
  const road = roadOf(s);
  const cardStage = s.stage === "open" ? null : s.stage;
  const chips = FUNCTION_CHIPS[s.level];

  // keyboard shortcuts: 1–3 pick a card, 1–7 pick a chip, Space plays it again / skips ahead, Enter goes on, Esc ends
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
      const n = Number(e.key);
      if (s.phase === "chip" && n >= 1 && n <= chips.length) dispatch({ type: "CHIP", chip: chips[n - 1] });
      else if (n >= 1 && n <= options.length && s.phase === "awaiting") dispatch({ type: "PICK", pc: options[n - 1].pc });
      else if (e.key === " ") {
        if (s.phase === "feedback") dispatch({ type: "ADVANCE" });
        else if (s.phase === "awaiting") game.playPrompt();
        else return;
      } else if (e.key === "Enter" && s.phase === "feedback") dispatch({ type: "ADVANCE" });
      else if (e.key === "Escape") dispatch({ type: "END" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, s.phase, options, chips, dispatch, game]);

  return (
    <div className="min-h-dvh p-3 text-ink md:p-5">
      <SketchFilters />
      <header className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ModeSwitch mode="changes" onMode={onMode} />
        <h1 className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
          Make the Changes{" "}
          <span className="text-base font-normal normal-case text-ink-soft">· Where does this chord want to go?</span>
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

      <SketchBox seed={seedOf("changes-stage")} fill={paper.light} strokeWidth={2} className="mx-auto max-w-2xl">
        <div className="space-y-4 p-4 md:p-6">
          {s.phase === "idle" && <Intro {...setup} onStart={startSession} />}

          {playing && step && round && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 font-hand text-sm text-ink-soft">
                <span>
                  Level {s.level} · {LEVELS[s.level - 1].name} · round {s.roundIdx + 1} of {s.rounds.length}
                </span>
                <span aria-label={`${s.points} points, streak ${s.streak}`}>
                  {s.points} pts · streak {s.streak}
                </span>
              </div>
              <StageSelector value={s.stage} onChange={(stage) => dispatch({ type: "SET_STAGE", stage })} />
              {promoted && (
                <p className="flex flex-wrap items-baseline gap-2 font-hand text-sm" role="status">
                  <span className="font-marker" style={{ color: "var(--color-sage-ink)" }}>
                    Moved up to {s.stage === "open" ? "Open" : "Choices"}:
                  </span>{" "}
                  8 right in a row.
                  <button type="button" onClick={() => dispatch({ type: "UNDO_PROMOTE" })} className="cursor-pointer font-marker underline">
                    Undo
                  </button>
                </p>
              )}

              {road && <RoadTrail {...road} seed={round.seed} scale={narrow ? 1 : 1.4} fit={!narrow} />}

              {/* at the round's end, the chord shown is where you landed: home */}
              <PromptChord
                chord={s.phase === "roundEnd" ? round.steps[round.steps.length - 1].expected : step.from}
                keyTonic={round.key}
                onPlay={() => game.playPrompt()}
                canPlay={s.phase === "awaiting"}
              />

              <div aria-live="polite" className="min-h-[1.5rem]">
                {s.phase === "awaiting" && (
                  <p className="font-marker text-lg">{s.stage === "open" ? "Where does it want to go? Play the root." : "Where does it want to go?"}</p>
                )}
                {s.phase === "roundEnd" && <p className="font-marker text-lg">Home. Hear the whole trip…</p>}
              </div>

              {cardStage && (s.phase === "awaiting" || s.phase === "prompting") && (
                <OptionCards
                  options={options}
                  stage={cardStage}
                  step={step}
                  keyTonic={round.key}
                  enabled={s.phase === "awaiting"}
                  onPick={(pc) => dispatch({ type: "PICK", pc })}
                />
              )}

              {s.phase === "chip" && (
                <FunctionChips chips={chips} root={prettySymbol(step.expected.symbol)} onPick={(chip) => dispatch({ type: "CHIP", chip })} />
              )}

              {(s.phase === "feedback" || s.phase === "fixing") && s.verdict && (
                <FeedbackLine
                  verdict={s.verdict}
                  step={step}
                  keyTonic={round.key}
                  fixing={s.phase === "fixing"}
                  chip={s.chip}
                  whyOpen={s.whyOpen}
                  canNext={s.phase === "feedback"}
                  onWhy={() => dispatch({ type: "WHY_TOGGLE" })}
                  onNext={() => dispatch({ type: "ADVANCE" })}
                />
              )}

              <AnswerKeyboard
                narrow={narrow}
                listening={listening}
                marks={keyboardMarks(s, options.map((o) => o.pc))}
              />

              <div className="flex justify-end">
                <button type="button" onClick={() => dispatch({ type: "END" })} className="cursor-pointer font-marker text-sm text-ink-soft underline">
                  End session
                </button>
              </div>
            </>
          )}

          {s.phase === "summary" && <Summary s={s} {...setup} onStart={startSession} />}
        </div>
      </SketchBox>
    </div>
  );
}

type Settings = { level: LevelId; stage: Stage };
type SetupProps = {
  settings: Settings;
  onSettings: (v: Partial<Settings>) => void;
  onStart: () => void;
  progress: ChangesProgress | null;
  onReview: (level: LevelId, due: DueItem[]) => void;
};

/** "2 reviews due: the setup in B♭ · the landing in F", and a button to play them (at Open, where reviews count). */
function DueReviewsNote({ due, onReview }: { due: DueItem[]; onReview: (level: LevelId, due: DueItem[]) => void }) {
  if (!due.length) return null;
  const motions = due.map((d) => motionOfRuleId(d.ruleId)!);
  const level = Math.max(...motions.map(levelFor)) as LevelId;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 rounded-lg border-2 border-dashed border-ink-soft px-3 py-2 font-hand" role="status">
      <span className="font-marker">
        {due.length} review{due.length === 1 ? "" : "s"} due:
      </span>
      <span className="text-ink-soft">{due.slice(0, 4).map((d, i) => `${EAR_MOTION_NAME[motions[i]].replace(/ \(.*\)$/, "").toLowerCase()} in ${prettyNote(d.keyTonic)}`).join(" · ")}</span>
      <button type="button" onClick={() => onReview(level, due)} className="ml-auto cursor-pointer font-marker text-ink underline">
        Review them →
      </button>
    </p>
  );
}

/** Pick a level and how much help, then go. The first level not yet mastered is "next up". */
function SessionSetup({ settings, onSettings, onStart, startLabel, progress, onReview }: SetupProps & { startLabel: string }) {
  return (
    <div className="space-y-3">
      {progress && <DueReviewsNote due={progress.due} onReview={onReview} />}
      <LevelPicker
        value={settings.level}
        onChange={(level) => onSettings({ level })}
        nextUp={progress ? progress.nextUp : 1}
        mastered={progress ? LEVELS.filter((l) => progress.mastery[l.id].mastered).map((l) => l.id) : []}
      />
      <p className="font-hand text-sm text-ink-soft">
        {progress?.mastery[settings.level].mastered ? "Mastered. " : `To master it: ${LEVELS[settings.level - 1].mastery} `}
        {progress && !progress.mastery[settings.level].mastered && progress.sessions.some((x) => x.level === settings.level) && `(${progress.mastery[settings.level].detail})`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <StageSelector value={settings.stage} onChange={(stage) => onSettings({ stage })} />
        <button type="button" onClick={onStart} className="tap-lg ml-auto cursor-pointer rounded-full border-2 border-ink bg-ink px-5 font-marker text-lg text-paper-light">
          {startLabel}
        </button>
      </div>
    </div>
  );
}

function Intro(props: SetupProps) {
  return (
    <div className="space-y-4">
      <p className="font-hand text-lg">
        You're on a chord. Play or pick the root it wants to go to next, hear the move, and learn why it works: the landing, the setup,
        the fourths staircase.
      </p>
      <p className="font-hand text-sm text-ink-soft">Any octave counts. No keyboard? Tap the keys on screen, or press M to play with your computer keys.</p>
      <SessionSetup {...props} startLabel="Start" />
    </div>
  );
}

const ALT_NAME: Record<string, string> = { tritoneSub: "the tritone sub", backdoor: "the backdoor", passingDim: "a passing diminished" };

/** The end of a session: how it went, what you found, and where to go next. */
function Summary({ s, ...setup }: SetupProps & { s: Parameters<typeof summarise>[0] }) {
  const sum = summarise(s);
  const level = LEVELS[s.level - 1];
  const mastery = setup.progress?.mastery[s.level];
  const next = LEVELS[s.level]; // undefined after the last level
  const suggestion = mastery?.mastered
    ? next
      ? `Level ${s.level} is mastered. Next up: Level ${next.id}, ${next.name}.`
      : "All three levels mastered. Keep them warm with your reviews."
    : s.stage !== "open"
      ? `Try ${s.stage === "guided" ? "Choices" : "Open"} next: less help, more points.`
      : `Mastering it: ${mastery?.detail ?? level.mastery}`;
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-marker text-2xl uppercase">
          Session · Level {s.level}, {level.name}
        </h2>
        <span className="font-marker text-2xl">{sum.points} pts</span>
      </div>
      <p className="font-hand text-lg">
        Best streak {sum.bestStreak} · {sum.roundsPlayed} of {s.rounds.length} trips home
      </p>

      {sum.byMotion.length > 0 && (
        <ul className="space-y-1.5" aria-label="Accuracy by move">
          {sum.byMotion.map((m) => (
            <li key={m.motion} className="flex items-center gap-3 font-hand">
              <span className="w-44 shrink-0 text-sm">{EAR_MOTION_NAME[m.motion]}</span>
              <span className="relative h-3 flex-1 rounded-full border border-ink-faint" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full bg-wash-sage/70" style={{ width: `${(100 * m.right) / m.total}%` }} />
              </span>
              <span className="w-12 shrink-0 text-right text-sm">
                {m.right}/{m.total}
              </span>
            </li>
          ))}
        </ul>
      )}

      {sum.stamped.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 font-hand text-sm">
          Played clean at Open:
          {sum.stamped.map((x) => (
            <span key={`${x.motion}${x.key}`} className="-rotate-3 rounded border-2 px-1.5 font-marker text-xs uppercase" style={{ borderColor: pen.red, color: pen.red }}>
              {prettyNote(x.key)} clean
            </span>
          ))}
        </p>
      )}
      {sum.discoveries.length > 0 && (
        <p className="font-hand text-sm">
          ⑂ Discoveries: {sum.discoveries.map((d) => `${prettySymbol(d.symbol)}${ALT_NAME[d.move] ? ` (${ALT_NAME[d.move]})` : ""}`).join(", ")}
        </p>
      )}
      <p className="font-marker">{suggestion}</p>

      <SessionSetup {...setup} startLabel="Again" />
    </div>
  );
}

// ── the answer keyboard ──

const OCTAVE4 = 60;

/** What the keyboard shows: the cards' roots as ghosts in Guided, your answer, and the fix after a miss. */
function keyboardMarks(s: ReturnType<typeof useChangesGame>["s"], optionPcs: number[]): Omit<PenKeyboardProps, "low" | "high"> {
  const step = s.rounds[s.roundIdx]?.steps[s.stepIdx];
  if (!step) return {};
  const at = (pc: number) => OCTAVE4 + pc;
  if (s.phase === "awaiting" && s.stage === "guided") return { target: optionPcs.map(at) };
  if (s.phase === "chip") return { played: [at(step.expected.pc)], ticks: [at(step.expected.pc)] };
  if (s.phase === "fixing") return { target: [at(step.expected.pc)], labels: [{ midi: at(step.expected.pc), label: prettyNote(step.expected.root) }] };
  if (s.phase === "feedback" && s.verdict) {
    const expected = { midi: at(step.expected.pc), label: prettyNote(step.expected.root) };
    if (s.verdict.kind === "right") return { played: [expected.midi], ticks: [expected.midi], labels: [expected] };
    if (s.verdict.kind === "alt") return { played: [at(s.verdict.played.pc)], rings: [at(s.verdict.played.pc)], target: [expected.midi], labels: [expected] };
    return { wrong: [{ midi: at(s.verdict.played.pc), label: prettyNote(s.verdict.played.root) }], target: [expected.midi], labels: [expected] };
  }
  return {};
}

/** On-screen keys go out on the note bus like any keyboard, and sound through the app's piano. */
function pressKey(m: number) {
  noteBus.emit({ type: "on", note: m, velocity: 0.7, source: "virtual" });
  void player.playNotes([m], 0.5);
  setTimeout(() => noteBus.emit({ type: "off", note: m, velocity: 0, source: "virtual" }), 150);
}

function AnswerKeyboard({ narrow, listening, marks }: { narrow: boolean; listening: boolean; marks: Omit<PenKeyboardProps, "low" | "high"> }) {
  // Any octave counts, so two octaves from C3 is plenty, and a phone (docked at the bottom) needs
  // just one, with short keys, so the game above stays in view.
  const rows = narrow ? [{ low: 60, high: 72 }] : [{ low: 48, high: 72 }];
  return (
    // on a phone the keys stay docked at the bottom of the screen, so the answer is always in reach
    <div
      className={
        narrow
          ? "sticky bottom-0 z-20 -mx-4 border-t-2 border-ink bg-paper-light px-3 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
          : ""
      }
    >
      <div className={`space-y-1 transition-opacity ${listening ? "" : "opacity-60"}`} aria-label={listening ? "Keyboard: play the next root" : "Keyboard: listening…"}>
        {rows.map((r) => (
          <PenKeyboard key={r.low} {...r} {...marks} showSplit={false} slim={narrow} short={narrow} onKey={pressKey} />
        ))}
      </div>
    </div>
  );
}
