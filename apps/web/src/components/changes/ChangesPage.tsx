import { currentOptions, LEVELS, prettyNote, summarise, type LevelId, type Stage } from "@reharm/theory-core";
import { useEffect } from "react";
import { player } from "../../audio/player";
import { SketchBox, SketchFilters } from "../../design/rough";
import { paper, seedOf } from "../../design/tokens";
import { useNarrow, useTouchFirst } from "../../device/media";
import { useWakeLock } from "../../device/wakeLock";
import { noteBus } from "../../midi/noteBus";
import type { MidiStatus } from "../../midi/useMidi";
import { MidiMonitorToggle } from "../MidiMonitorToggle";
import { ModeSwitch, type AppMode } from "../ModeSwitch";
import { PenKeyboard, type PenKeyboardProps } from "../practice/PenKeyboard";
import { QwertyToggle } from "../QwertyToggle";
import { FeedbackLine, OptionCards, PromptChord } from "./GamePieces";
import { useChangesGame } from "./useChangesGame";

/*
 * The Changes tab: harmony games with sound. Its first game is "Make the Changes": you're on a
 * chord, and you say where it wants to go next, by playing the root (MIDI, the computer keys or
 * the keys on screen) or, with help on, tapping a card.
 *
 * Step 5 of the build: Level 1 (the landing) at the Guided stage, playable end to end. Levels
 * 2–3, the Choices/Open stages and the function chips are wired in the reducer and arrive on
 * screen in step 7; the road (step 6) and the saved progress and summary (step 8) after that.
 */

interface Props {
  midi: { status: MidiStatus; connect: () => void };
  onMode: (m: AppMode) => void;
}

const V1_LEVEL: LevelId = 1;
const V1_STAGE: Stage = "guided";

export function ChangesPage({ midi, onMode }: Props) {
  const game = useChangesGame();
  const { s, dispatch, step, round, listening } = game;
  const touchFirst = useTouchFirst();
  const narrow = useNarrow();
  const playing = s.phase !== "idle" && s.phase !== "summary";
  useWakeLock(playing);

  const options = currentOptions(s);
  const cardStage = s.stage === "open" ? null : s.stage;

  // keyboard shortcuts: 1–3 pick a card, Space plays it again / skips ahead, Enter goes on, Esc ends
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length && s.phase === "awaiting") dispatch({ type: "PICK", pc: options[n - 1].pc });
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
  }, [playing, s.phase, options, dispatch, game]);

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
          {s.phase === "idle" && <Intro onStart={() => game.start(V1_LEVEL, V1_STAGE)} />}

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

              {/* at the round's end, the chord shown is where you landed: home */}
              <PromptChord
                chord={s.phase === "roundEnd" ? round.steps[round.steps.length - 1].expected : step.from}
                keyTonic={round.key}
                onPlay={() => game.playPrompt()}
                canPlay={s.phase === "awaiting"}
              />

              <div aria-live="polite" className="min-h-[1.5rem]">
                {s.phase === "awaiting" && <p className="font-marker text-lg">Where does it want to go?</p>}
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

              {(s.phase === "feedback" || s.phase === "fixing") && s.verdict && (
                <FeedbackLine
                  verdict={s.verdict}
                  step={step}
                  keyTonic={round.key}
                  fixing={s.phase === "fixing"}
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

          {s.phase === "summary" && <Summary s={s} onAgain={() => game.start(s.level, s.stage)} />}
        </div>
      </SketchBox>
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-3">
      <p className="font-hand text-lg">
        You're on a chord. Play or pick the root it wants to go to next, hear the move, and learn why it works: the landing, the setup,
        the fourths staircase.
      </p>
      <p className="font-hand text-sm text-ink-soft">Any octave counts. No keyboard? Tap the keys on screen, or press M to play with your computer keys.</p>
      <button type="button" onClick={onStart} className="tap-lg cursor-pointer rounded-full border-2 border-ink bg-ink px-5 font-marker text-lg text-paper-light">
        Start · Level 1, {LEVELS[0].name}
      </button>
    </div>
  );
}

function Summary({ s, onAgain }: { s: Parameters<typeof summarise>[0]; onAgain: () => void }) {
  const sum = summarise(s);
  return (
    <div className="space-y-3" aria-live="polite">
      <h2 className="font-marker text-2xl uppercase">Session</h2>
      <p className="font-hand text-lg">
        {sum.points} points · best streak {sum.bestStreak} · {sum.roundsPlayed} of {s.rounds.length} trips home
      </p>
      {sum.discoveries.length > 0 && (
        <p className="font-hand text-sm text-ink-soft">Discoveries: {sum.discoveries.map((d) => d.symbol.replace(/b/g, "♭")).join(", ")}</p>
      )}
      <button type="button" onClick={onAgain} className="tap-lg cursor-pointer rounded-full border-2 border-ink bg-ink px-5 font-marker text-paper-light">
        Again
      </button>
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
  if (s.phase === "fixing") return { target: [at(step.expected.pc)], labels: [{ midi: at(step.expected.pc), label: prettyNote(step.expected.root) }] };
  if (s.phase === "feedback" && s.verdict) {
    const expected = { midi: at(step.expected.pc), label: prettyNote(step.expected.root) };
    if (s.verdict.kind === "right") return { played: [expected.midi], labels: [expected] };
    if (s.verdict.kind === "alt") return { played: [at(s.verdict.played.pc)], target: [expected.midi], labels: [expected] };
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
  // two octaves from C3: any octave counts, so this is plenty. A phone gets them as two rows, higher on top.
  const rows = narrow
    ? [
        { low: 60, high: 72 },
        { low: 48, high: 59 },
      ]
    : [{ low: 48, high: 72 }];
  return (
    <div className={`space-y-1 transition-opacity ${listening ? "" : "opacity-60"}`} aria-label={listening ? "Keyboard: play the next root" : "Keyboard: listening…"}>
      {rows.map((r) => (
        <PenKeyboard key={r.low} {...r} {...marks} showSplit={false} slim={narrow} onKey={pressKey} />
      ))}
    </div>
  );
}
