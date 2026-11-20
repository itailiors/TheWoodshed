import {
  chroma,
  conceptDrillSteps,
  conceptKind,
  isBasicsId,
  KEYS,
  learnName,
  prettyNote,
  prettySymbol,
  RULES,
  symbol,
  type ConceptStatus,
  type LessonStage,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { SketchBox, SketchFilters } from "../../design/rough";
import { useRevealState } from "../Reveal";
import { CATEGORY_WASH, paper, pen, seedOf, tint, wash } from "../../design/tokens";
import { DEMO } from "../../demo";
import { updateLessonFlag } from "../../learn/lessonFlags";
import { usePathStates } from "../../learn/usePathStates";
import { useQwerty } from "../../midi/qwerty";
import type { MidiStatus } from "../../midi/useMidi";
import { ModeSwitch, type AppMode } from "../ModeSwitch";
import { MidiMonitorToggle } from "../MidiMonitorToggle";
import { QwertyToggle } from "../QwertyToggle";
import { KeyMatrix, type PractiseRequest } from "../progress/KeyMatrix";
import { CoachDrill, nextCircleKey, type KeyFlow } from "./CoachDrill";
import { coachLesson } from "./coachLesson";
import { coachInput, openingStage, retireGradingStore, stagesFor } from "./gradingMode";
import { LearnStage } from "./LearnStage";
import { StageLadder } from "./StageLadder";
import { useMediaQuery, useTouchFirst } from "../../device/media";
import { ChordName } from "../ChordName";
import { conceptLevel, nextUpReason, pathOrder, recommendedFirstLabel, tierBands } from "../../learn/pathModel";
import { DueDot, PathChip } from "../learn/PathChip";
import { useEscapeCapture } from "../learn/useEscapeCapture";
import { countOpen } from "../../usage/panelOpens";

/** Phones (spec §A "Layout"): the rail becomes a "Your path ▾" sheet plus a row of Next up chips. */
const PHONE = "(max-width: 767.98px)";

/**
 * One concept on the "Your path" rail: its name, a line (Next up's reason, or the level and
 * formula) and its state chip; a Recommended-first concept carries a dashed chip that opens the
 * first unmet prerequisite's Learn (spec §B). States are this browser's own (rule 11).
 */
function ConceptItem({
  id,
  status,
  on,
  line,
  wash: square,
  onPick,
  onLearnFirst,
  chip = true,
}: {
  id: string;
  status: ConceptStatus | undefined;
  on: boolean;
  line: string;
  /** Show the state chip (Next up's reason line already names the state). */
  chip?: boolean;
  wash?: string;
  onPick: () => void;
  onLearnFirst: (prereqId: string) => void;
}) {
  const unmet = status?.state === "recommendedFirst" ? status.recommendedFirst : [];
  return (
    <li className="space-y-0.5" data-rail-concept={id}>
      <button
        type="button"
        aria-current={on || undefined}
        onClick={onPick}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left hover:-rotate-1 motion-reduce:hover:rotate-0 ${
          on ? "border-ink bg-paper-light" : "border-transparent hover:border-ink-faint"
        }`}
      >
        <span
          aria-hidden
          className={`h-3 w-3 shrink-0 -rotate-6 rounded-sm ${square ? "" : "border-2 border-ink-soft"}`}
          style={square ? { background: square } : undefined}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-marker text-[15px]">{learnName(id)}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-soft">
            <span className="min-w-0 truncate">{line}</span>
            {!unmet.length && chip && <PathChip status={status} />}
          </span>
        </span>
        {status?.due && <DueDot className="shrink-0 self-start" />}
      </button>
      {unmet.length > 0 && (
        <button
          type="button"
          onClick={() => onLearnFirst(unmet[0])}
          className="tap-lg ml-7 cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-2 text-left font-marker text-xs leading-5 text-ink-soft hover:border-ink hover:text-ink"
        >
          {recommendedFirstLabel(unmet)}
        </button>
      )}
    </li>
  );
}

/**
 * What a move does, in chords: the struck-out original, the new chords and where they resolve
 * (e.g. ~~D7~~ A♭7 → Gm7). Two moves from the same rule share a title, so this is what tells
 * them apart in the move list.
 */
function MoveRoute({ move }: { move: ReharmMove }) {
  return (
    <span className="block truncate text-sm leading-tight">
      <span className="sr-only">{moveRouteLabel(move)}</span>
      <span aria-hidden="true">
      {move.original.map((c) => (
        <ChordName key={c.id} symbol={symbol(c)} className="mr-1 text-ink-soft line-through decoration-pen decoration-2" />
      ))}
      {move.chords.map((c, i) => (
        <span key={c.id}>
          {i > 0 && <span className="text-ink-faint"> · </span>}
          <ChordName symbol={symbol(c)} className="text-ink" />
        </span>
      ))}
      {move.targetSymbol && (
        <>
          <span className="font-marker text-ink-soft"> → </span>
          <ChordName symbol={move.targetSymbol} className="text-ink-soft" />
        </>
      )}
      </span>
    </span>
  );
}

function moveRouteLabel(move: ReharmMove): string {
  const replaced = move.original.map((c) => prettySymbol(symbol(c))).join(", ");
  const added = move.chords.map((c) => prettySymbol(symbol(c))).join(", ");
  return `${added} in place of ${replaced}${move.targetSymbol ? `, resolving to ${prettySymbol(move.targetSymbol)}` : ""}`;
}

export type CoachScope = "concept" | "tune";

interface Props {
  tune: Tune;
  /** Every move the engine accepted for this tune (the drill list). */
  accepted: ReharmMove[];
  /** The moves in the current reharm, listed first. */
  pathway: ReharmMove[];
  /** Which move, concept rule, and key to open on (from "Drill the voicing" or the Concept Passport). */
  initial: { moveId: string | null; ruleId?: string | null; key?: string; scope?: CoachScope };
  midi: { status: MidiStatus; connect: () => void };
  onMode: (m: AppMode) => void;
  /** A due review from another concept or chart: the app resolves the concept and key. */
  onPractise: (r: PractiseRequest) => void;
}

const RULE_NAME = new Map(RULES.map((r) => [r.id, r.name]));

/** A basic has no drill: its ladder is Learn plus where it's practised (spec §A "Basics concepts"). */
const PRACTISE_ELSEWHERE: Partial<Record<string, { label: string; mode: AppMode }>> = {
  "basics:guideTones": { label: "Practise it: Voicings › Shells ›", mode: "voicings" },
  "basics:dominantResolution": { label: "Practise it: Changes, V → I ›", mode: "changes" },
  "basics:twoFiveOne": { label: "Practise it: Changes, ii–V–I ›", mode: "changes" },
};
const CIRCLE_FOURTHS = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7].map((c) => KEYS.find((k) => chroma(k) === c)!);
const CIRCLE_FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].map((c) => KEYS.find((k) => chroma(k) === c)!);

/**
 * The Comping Coach, upgraded to a 3-Zone 12-Key Concept Workbench:
 *  - Left Rail: toggle between "Concept Drill (All 12 Keys)" and "In Tune", plus due reviews.
 *  - Center Stage: 12-Key Circle-of-Fifths Ribbon + Key Flow Selector + Isolated CoachDrill.
 *  - Right Rail: 12-key KeyMatrix stamp grid for the active concept.
 */
export function CoachPage({ tune, accepted, pathway, initial, midi, onMode, onPractise }: Props) {
  const firstTuneMove = accepted.find((m) => m.id === initial.moveId) ?? pathway[0] ?? accepted[0] ?? null;
  const defaultScope: CoachScope =
    initial.scope ?? (initial.ruleId && !accepted.some((m) => m.id === initial.moveId) ? "concept" : firstTuneMove ? "tune" : "concept");

  const [scope, setScope] = useState<CoachScope>(defaultScope);
  const [moveId, setMoveId] = useState<string | null>(firstTuneMove?.id ?? null);
  const [ruleId, setRuleId] = useState<string>(initial.ruleId ?? firstTuneMove?.ruleId ?? RULES[0].id);
  const [key, setKey] = useState(initial.key ?? tune.key.tonic);
  const [keyFlow, setKeyFlow] = useState<KeyFlow>("fourths");
  // the 12-key grid repeats the passport's key matrix, so it waits one click away
  const [ribbonOpen, setRibbonOpen] = useRevealState("coach.ribbon");
  const touchFirst = useTouchFirst();

  const tuneMove = accepted.find((m) => m.id === moveId) ?? firstTuneMove;
  // a basics foundation (the fresh path's first stop, or a prerequisite) is always a concept: it has no move in a tune
  const basics = isBasicsId(ruleId);
  const activeRuleId = scope === "concept" || !tuneMove || basics ? ruleId : tuneMove.ruleId;
  const activeRule = RULES.find((r) => r.id === activeRuleId) ?? RULES[0];
  const inTune = scope === "tune" && !!tuneMove && !basics;

  // every rule fires on its canonical progression in all 12 keys (theory-core's learn.canonical test), so `.move` is set
  const conceptFallback = useMemo(() => conceptDrillSteps(activeRule.id, key), [activeRule.id, key]);
  const move = inTune ? tuneMove : conceptFallback.move!;

  // practice history: server-side (in the demo, the seeded history), plus this session's runs,
  // so the passport stamps at once, and the read-only demo, which saves nothing, still shows what you've done.
  // The path states (Learn or Play it, the prerequisite note) read only the player's OWN runs (rule 11).
  const { progress, own, states, flags, loading, nextUp } = usePathStates();
  const [session, setSession] = useState<Record<string, { clean: string[]; tried: string[] }>>({});

  // ── the stage ladder: Learn → Study it → Self-check → Play it (spec §A) ──
  const qwertyOn = useQwerty().enabled;
  const midiConnected = midi.status === "connected";
  const input = coachInput(midiConnected, qwertyOn);
  // the old global grading choice is retired: each concept's `lastStage` flag is the one source of truth
  useEffect(retireGradingStore, []);
  const learn = useMemo(
    () => coachLesson(activeRuleId, key, inTune ? { tune, move: tuneMove! } : null),
    [activeRuleId, key, inTune, tune, tuneMove],
  );
  const stages = stagesFor(!!learn, basics);
  const status = states.get(activeRuleId);
  const flag = flags[activeRuleId];
  /** Stages picked in this visit, per concept (also kept as `lastStage`); otherwise where the concept opens. */
  const [picked, setPicked] = useState<Record<string, LessonStage>>({});
  const chosen = picked[activeRuleId];
  const stage: LessonStage =
    chosen && stages.includes(chosen)
      ? chosen
      : openingStage({ state: status?.state ?? "new", hasLesson: !!learn, basics, lastStage: flag?.lastStage, touchFirst, midiConnected });
  /** Focus follows a stage change the player made (not the page opening). */
  const focusStage = useRef(false);
  const [stageFocus, setStageFocus] = useState(false);
  const pickStage = (s: LessonStage) => {
    focusStage.current = true;
    setStageFocus(true);
    setPicked((p) => ({ ...p, [activeRuleId]: s }));
    // in a handler, never an effect (StrictMode): where this concept was left
    updateLessonFlag(activeRuleId, { lastStage: s });
  };
  useEffect(() => {
    if (!focusStage.current || stage === "learn") return;
    focusStage.current = false;
    document.getElementById("coach-h")?.focus();
  }, [stage, activeRuleId]);

  /** "Learn that first" (or a step's prerequisite chip): the concept to come back to, shown as "from …". */
  const [returnTo, setReturnTo] = useState<{ forId: string; id: string; scope: CoachScope; moveId: string | null } | null>(null);
  /** Open `prereqId`'s Learn, to come back to `from` (the current concept, or a rail item's own chip). */
  const learnFirstFor = (from: { id: string; scope: CoachScope }, prereqId: string) => {
    setReturnTo({ forId: prereqId, id: from.id, scope: from.scope, moveId });
    setScope("concept");
    setRuleId(prereqId);
    setPicked((p) => ({ ...p, [prereqId]: "learn" }));
    focusStage.current = true;
    setStageFocus(true);
    setSheetOpen(false);
  };
  const learnFirst = (prereqId: string) => learnFirstFor({ id: activeRuleId, scope }, prereqId);
  const returning = returnTo && returnTo.forId === activeRuleId ? returnTo : null;
  const finishLesson = () => {
    if (returning) {
      // back where the player came from, on its Learn stage (the note, if a prerequisite is still unmet)
      setReturnTo(null);
      setScope(returning.scope);
      setRuleId(returning.id);
      if (returning.moveId) setMoveId(returning.moveId);
      setPicked((p) => ({ ...p, [returning.id]: "learn" }));
      setStageFocus(true);
      return;
    }
    if (basics) {
      setLessonDone(activeRuleId);
      return;
    }
    // finished: Familiar for the path (the stepper set `finishedAt`); hand off to Study it
    pickStage("study");
  };
  const [lessonDone, setLessonDone] = useState<string | null>(null);
  const elsewhere = basics ? PRACTISE_ELSEWHERE[activeRuleId] : undefined;
  const finishedStages = new Set<LessonStage>([
    ...(flag?.finishedAt || flag?.testedOutAt ? (["learn"] as const) : []),
    ...((own.cleanKeys[activeRuleId]?.length ?? 0) > 0 ? (["self", "play"] as const) : []),
  ]);
  const ladder = (
    <StageLadder
      stages={stages}
      stage={stage}
      onStage={pickStage}
      finished={finishedStages}
      selfWithHint={input !== "none"}
      extra={
        elsewhere && (
          <button
            type="button"
            onClick={() => onMode(elsewhere.mode)}
            className="tap-lg cursor-pointer whitespace-nowrap rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 font-marker text-sm text-ink-soft hover:border-ink hover:text-ink"
          >
            {elsewhere.label}
          </button>
        )
      }
    />
  );

  // Esc back to Study, like Practice Mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !(e.target instanceof HTMLInputElement) && onMode("study");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMode]);

  const cleanFor = (rId: string) => {
    const keys = new Set([...(progress?.cleanKeys[rId] ?? []), ...(session[rId]?.clean ?? [])].map(chroma));
    return [...keys].sort((a, b) => a - b).map((c) => KEYS[c]);
  };

  const inReharm = new Set(pathway.map((m) => m.id));
  const groups = useMemo(() => {
    const rest = accepted.filter((m) => !inReharm.has(m.id)).sort((a, b) => a.spanBeats.start - b.spanBeats.start || a.level - b.level);
    return [
      { title: "In your reharm", moves: pathway },
      { title: "Also found in this tune", moves: rest },
    ].filter((g) => g.moves.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted, pathway]);

  // each rule's category wash on the rail, from its canonical progression (as the Coach drills it)
  const categoryOf = useMemo(() => new Map(RULES.map((r) => [r.id, conceptDrillSteps(r.id, "C").move!.category])), []);
  const bands = useMemo(tierBands, []);
  const order = useMemo(pathOrder, []);

  // ── "Your path": the rail on a desktop, a sheet on a phone (spec §A "Layout", §B "Next up") ──
  const phone = useMediaQuery(PHONE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetBtn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const closeSheet = () => {
    setSheetOpen(false);
    sheetBtn.current?.focus();
  };
  useEscapeCapture(sheetOpen && phone, closeSheet);
  /** The sheet keeps Tab inside itself while it's open. */
  const trapFocus = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !sheet.current) return;
    const els = [...sheet.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")].filter((el) => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const openSheet = () => {
    countOpen("coach.pathSheet");
    setSheetOpen(true);
  };
  useEffect(() => {
    if (sheetOpen) sheet.current?.querySelector<HTMLElement>("button")?.focus();
  }, [sheetOpen]);
  const [allOpen, setAllOpen] = useRevealState("coach.allConcepts");
  const pickConcept = (id: string) => {
    setScope("concept");
    setRuleId(id);
    setSheetOpen(false);
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      document.getElementById("coach-drill")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const lineFor = (id: string) => {
    const level = conceptLevel(id);
    const formula = RULES.find((r) => r.id === id)?.pedagogy?.formula;
    return [level === null ? "Foundation" : `L${level}`, formula].filter(Boolean).join(" · ");
  };
  const item = (id: string, line: string, chip = true) => (
    <ConceptItem
      key={id}
      chip={chip}
      id={id}
      status={states.get(id)}
      on={scope === "concept" && id === activeRuleId}
      line={line}
      wash={categoryOf.has(id) ? CATEGORY_WASH[categoryOf.get(id)!] : undefined}
      onPick={() => pickConcept(id)}
      onLearnFirst={(pre) => learnFirstFor({ id, scope: "concept" }, pre)}
    />
  );

  // ‹ Prev / Next ›: step through the list on the left without scrolling to it (on a phone it's far below)
  const stepList: { id: string; pick: () => void }[] =
    scope === "concept"
      ? order.map((id) => ({ id, pick: () => setRuleId(id) }))
      : groups.flatMap((g) => g.moves).map((m) => ({ id: m.id, pick: () => (setMoveId(m.id), setRuleId(m.ruleId)) }));
  const stepIdx = stepList.findIndex((s) => s.id === (scope === "concept" ? activeRuleId : move.id));
  const stepTo = (d: -1 | 1) => stepList[stepIdx + d]?.pick();

  // the Changes game's and the Voicings tab's reviews are played in their own tabs, not drilled here
  const due = (progress?.due ?? []).filter((d) => conceptKind(d.ruleId) === "reharm").slice(0, 5);
  const now = Date.now();
  const activeCleanKeys = cleanFor(activeRuleId);
  const activeCleanSet = new Set(activeCleanKeys.map(chroma));
  const ribbonKeys = keyFlow === "fifths" ? CIRCLE_FIFTHS : CIRCLE_FOURTHS;

  return (
    <div className="min-h-dvh p-3 text-ink md:p-5">
      <SketchFilters />
      <header className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ModeSwitch mode="coach" onMode={onMode} />
        <h1 className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl" style={{ viewTransitionName: "tune-title" }}>
          Comping coach{" "}
          <span className="text-base font-normal normal-case text-ink-soft">
            · {scope === "concept" ? "12-Key Concept Drill" : tune.title}
          </span>
        </h1>
        {/* no Web MIDI on iPhone/iPad Safari: the self-check is the way in there, not a dead button */}
        {!(touchFirst && midi.status === "unsupported") && (
          <button
            type="button"
            onClick={midi.connect}
            disabled={midi.status === "connected" || midi.status === "requesting"}
            className="ml-auto cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 font-marker text-sm hover:bg-paper-shade disabled:cursor-default"
          >
            🎹 {midi.status === "connected" ? "MIDI connected" : midi.status === "requesting" ? "Connecting…" : "Connect MIDI"}
          </button>
        )}
        {midi.status === "connected" && <MidiMonitorToggle compact />}
        {!touchFirst && <QwertyToggle compact />}
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)_330px]">
        {/* ── Zone 1 (Left Rail): Scope Toggle + Concept Curriculum / Tune Moves ── */}
        {/* on a phone the rail is a bottom sheet ("Your path ▾"); elsewhere these wrappers are display: contents */}
        <div className={phone ? (sheetOpen ? "fixed inset-0 z-40 bg-ink/20" : "hidden") : "contents"} onClick={phone ? closeSheet : undefined}>
        <div
          ref={sheet}
          role={phone ? "dialog" : undefined}
          aria-modal={phone || undefined}
          aria-label={phone ? "Your path" : undefined}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={phone ? trapFocus : undefined}
          className={
            phone
              ? "fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t-2 border-ink bg-paper-light px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
              : "contents"
          }
        >
        {phone && (
          <div className="mb-3 flex items-center justify-between">
            <p className="font-marker text-xl uppercase">Your path</p>
            <button type="button" onClick={closeSheet} aria-label="Close your path" className="tap-lg cursor-pointer font-marker text-2xl leading-none">
              ×
            </button>
          </div>
        )}
        <nav id="coach-moves" aria-label="What to drill" className="order-2 scroll-mt-4 space-y-4 lg:sticky lg:top-4 lg:order-none">
          <div role="tablist" aria-label="Coach drill scope" className="grid grid-cols-2 gap-1.5 rounded-lg border-2 border-ink bg-paper-base p-1 font-marker text-xs">
            <button
              type="button"
              role="tab"
              aria-selected={scope === "concept"}
              onClick={() => setScope("concept")}
              className={`cursor-pointer rounded px-2 py-1.5 text-center transition-colors ${
                scope === "concept" ? "bg-ink text-paper-light" : "text-ink hover:bg-paper-shade"
              }`}
            >
              🎯 Concept Drill (12 Keys)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "tune"}
              onClick={() => setScope("tune")}
              className={`cursor-pointer rounded px-2 py-1.5 text-center transition-colors ${
                scope === "tune" ? "bg-ink text-paper-light" : "text-ink hover:bg-paper-shade"
              }`}
            >
              🎵 In Tune
            </button>
          </div>

          {due.length > 0 && (
            <SketchBox seed={seedOf("coach-due")} fill={paper.base} className="-rotate-[0.4deg]">
              <section className="space-y-2 p-3">
                <h3 className="font-marker text-sm uppercase tracking-wider">Due for review</h3>
                <ol className="space-y-1.5">
                  {due.map((d) => {
                    const here = d.ruleId === activeRuleId && chroma(d.keyTonic) === chroma(key);
                    return (
                      <li key={`${d.ruleId}:${d.keyTonic}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setRuleId(d.ruleId);
                            setKey(d.keyTonic);
                            setScope("concept");
                            onPractise({ ruleId: d.ruleId, keyTonic: d.keyTonic, lastPlace: d.lastPlace });
                          }}
                          className={`w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-paper-shade ${here ? "bg-paper-shade" : ""}`}
                        >
                          <span className="font-marker">{RULE_NAME.get(d.ruleId) ?? d.ruleId}</span> in <span className="font-marker">{prettyNote(d.keyTonic)}</span>
                          {ms(d.dueAt) < now - 60_000 && (
                            <span className="ml-1 text-xs" style={{ color: pen.red }}>
                              overdue
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </SketchBox>
          )}

          {/* Your path: Next up (due first, then the frontier), from this browser's own runs and lessons */}
          <section aria-labelledby="coach-next-h" className="space-y-1.5" data-next-up>
            {!phone && <h2 className="font-marker text-lg uppercase">Your path</h2>}
            <h3 id="coach-next-h" className="font-marker text-sm uppercase tracking-wider" style={{ color: pen.red }}>
              Next up
            </h3>
            {nextUp.length ? (
              <ol className="space-y-1">{nextUp.map((id) => item(id, nextUpReason(id, states, own, now), false))}</ol>
            ) : (
              <p className="text-sm text-ink-soft">Nothing new is waiting. Pick any concept, or play something due.</p>
            )}
          </section>

          {scope === "concept" ? (
            <section className="space-y-2" data-all-concepts>
              <button
                type="button"
                aria-expanded={allOpen}
                aria-controls="coach-all-concepts"
                onClick={() => setAllOpen(!allOpen)}
                className="tap-lg flex w-full cursor-pointer items-center justify-between font-marker text-sm uppercase tracking-wider text-ink-soft hover:text-ink"
              >
                All concepts <span aria-hidden>{allOpen ? "▾" : "▸"}</span>
              </button>
              <div id="coach-all-concepts" hidden={!allOpen} className="space-y-3">
                {bands.map((b) => (
                  <section key={b.tier} aria-label={b.heading} className="space-y-1">
                    <h3 className="font-hand text-sm uppercase tracking-wider text-ink-soft">{b.heading}</h3>
                    <ol className="space-y-1">{b.nodes.map((n) => item(n.id, lineFor(n.id)))}</ol>
                  </section>
                ))}
              </div>
            </section>
          ) : groups.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-ink-faint p-3 text-sm text-ink-soft">
              No moves found in {tune.title} at the current dial.{" "}
              <button type="button" onClick={() => setScope("concept")} className="cursor-pointer font-marker text-ink underline">
                Switch to Concept Drill (12 Keys)
              </button>{" "}
              to practise any concept right now.
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.title} className="space-y-1.5">
                <h3 className="font-marker text-sm uppercase tracking-wider text-ink-soft">{g.title}</h3>
                <ol className="space-y-1">
                  {g.moves.map((m) => {
                    const clean = cleanFor(m.ruleId).length;
                    const on = m.id === move.id;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          aria-current={on || undefined}
                          onClick={() => {
                            setMoveId(m.id);
                            setRuleId(m.ruleId);
                            if (!window.matchMedia("(min-width: 1024px)").matches) {
                              document.getElementById("coach-drill")?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                          className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left hover:-rotate-1 ${
                            on ? "border-ink bg-paper-light" : "border-transparent hover:border-ink-faint"
                          }`}
                        >
                          <span className="h-3 w-3 shrink-0 -rotate-6 rounded-sm" style={{ background: CATEGORY_WASH[m.category] }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-marker text-[15px]">{m.title}</span>
                            <MoveRoute move={m} />
                            <span className="text-xs text-ink-soft">
                              bar {m.span.from.bar} · L{m.level}
                              {clean > 0 && <span style={{ color: pen.red }}> · {clean}/12 clean</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))
          )}
        </nav>
        </div>
        </div>

        {/* ── Zone 2 (Center Stage): 12-Key Circle-of-Fifths Ribbon + Drill ── */}
        {/* below lg the drill comes first and the ribbon after it (flex order); lg keeps source order */}
        <div id="coach-drill" className="order-1 flex scroll-mt-4 flex-col gap-3 lg:order-none">
          <div className="flex flex-wrap items-center gap-2 font-marker text-sm">
            <button
              type="button"
              onClick={() => stepTo(-1)}
              disabled={stepIdx <= 0}
              aria-label={`Previous ${scope === "concept" ? "concept" : "move"}`}
              className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 hover:bg-paper-shade disabled:cursor-default disabled:opacity-35"
            >
              ‹ Prev
            </button>
            <span className="text-ink-soft" aria-live="polite">
              {stepIdx < 0 ? learnName(activeRuleId) : `${scope === "concept" ? "Concept" : "Move"} ${stepIdx + 1} of ${stepList.length}`}
            </span>
            <button
              type="button"
              onClick={() => stepTo(1)}
              disabled={stepIdx >= stepList.length - 1}
              aria-label={`Next ${scope === "concept" ? "concept" : "move"}`}
              className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 hover:bg-paper-shade disabled:cursor-default disabled:opacity-35"
            >
              Next ›
            </button>
            {phone ? (
              <button
                ref={sheetBtn}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                onClick={openSheet}
                className="tap-lg ml-auto cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 hover:bg-paper-shade"
              >
                Your path <span aria-hidden>▾</span>
                {due.length ? ` · ${due.length} due` : ""}
              </button>
            ) : (
              <a href="#coach-moves" className="ml-auto text-ink-soft underline lg:hidden">
                ↓ All {scope === "concept" ? "concepts" : "moves"}
                {due.length ? ` · ${due.length} due` : ""}
              </a>
            )}
          </div>
          {phone && nextUp.length > 0 && (
            // the 2–4 Next up items as chips, scrolling sideways (spec §A "Layout")
            <nav aria-label="Next up" className="-mx-1 overflow-x-auto px-1 pb-1">
              <ol className="flex w-max gap-1.5 font-marker text-sm">
                {nextUp.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={(scope === "concept" && id === activeRuleId) || undefined}
                      onClick={() => pickConcept(id)}
                      className={`tap-lg cursor-pointer whitespace-nowrap rounded-full border-2 px-3 py-0.5 ${
                        scope === "concept" && id === activeRuleId ? "border-ink bg-paper-light" : "border-dashed border-ink-soft text-ink"
                      }`}
                    >
                      {states.get(id)?.due && <DueDot className="mr-1" />}
                      {learnName(id)}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* 12-Key Circle-of-Fifths Ribbon & Key Flow Selector */}
          <div className="order-2 lg:order-none">
          <SketchBox seed={seedOf("coach-ribbon")} fill={paper.base} strokeWidth={1.6}>
            <div className="space-y-2.5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-marker text-xs uppercase tracking-wider text-ink-soft">
                  ⭕ 12-Key Circle Ribbon · <span className="text-ink">{activeCleanKeys.length}/12 clean</span>
                </span>
                <div role="group" aria-label="Key progression flow" className="flex flex-wrap items-center gap-1 font-marker text-xs">
                  {(
                    [
                      { id: "fourths", label: "↺ Circle of 4ths" },
                      { id: "fifths", label: "↻ Circle of 5ths" },
                      { id: "hold", label: "🔒 Hold Key" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={keyFlow === opt.id}
                      onClick={() => setKeyFlow(opt.id)}
                      className={`cursor-pointer rounded-full border border-ink px-2.5 py-0.5 ${
                        keyFlow === opt.id ? "bg-ink text-paper-light" : "hover:bg-paper-shade"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setKey(nextCircleKey(key, keyFlow === "hold" ? "fourths" : keyFlow))}
                    title="Step to the next key in the circle"
                    className="cursor-pointer rounded-full border border-dashed border-ink px-2.5 py-0.5 hover:bg-paper-shade"
                  >
                    Next key →
                  </button>
                  <button
                    type="button"
                    aria-expanded={ribbonOpen}
                    aria-controls="coach-ribbon-keys"
                    onClick={() => setRibbonOpen(!ribbonOpen)}
                    className="cursor-pointer rounded-full border border-dashed border-ink-soft px-2.5 py-0.5 text-ink-soft hover:border-ink hover:text-ink"
                  >
                    All keys <span aria-hidden>{ribbonOpen ? "▾" : "▸"}</span>
                  </button>
                </div>
              </div>

              <ol id="coach-ribbon-keys" hidden={!ribbonOpen} aria-label="12 keys around the circle" className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                {ribbonKeys.map((k) => {
                  const isHere = chroma(k) === chroma(key);
                  const isClean = activeCleanSet.has(chroma(k));
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        aria-current={isHere || undefined}
                        onClick={() => setKey(k)}
                        style={
                          isHere
                            ? { borderColor: pen.red, boxShadow: `0 0 0 1.5px ${pen.red}` }
                            : isClean
                              ? { background: tint(wash.blue, 20) }
                              : undefined
                        }
                        className={`relative flex w-full cursor-pointer items-center justify-center rounded border-2 py-1 font-marker text-sm transition-transform hover:-translate-y-0.5 ${
                          isHere ? "bg-paper-light font-bold text-ink" : isClean ? "border-ink text-ink" : "border-ink-faint/60 text-ink-soft hover:border-ink"
                        }`}
                      >
                        {prettyNote(k)}
                        {isClean && (
                          <span className="ml-0.5 text-[10px]" style={{ color: pen.red }} aria-hidden>
                            ✓
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </SketchBox>
          </div>

          <div className="order-1 lg:order-none">
          <SketchBox seed={seedOf("coach-drill")} fill={paper.light} strokeWidth={2} style={{ viewTransitionName: "lead-sheet" }}>
            <div className="p-3 sm:p-4 md:p-6">
              {loading && !chosen ? (
                // where a concept opens depends on the player's own runs: wait for them (a moment, from this browser or the API)
                <p className="font-hand text-ink-soft">Opening your notebook…</p>
              ) : stage === "learn" && learn ? (
                // GRADER ISOLATION: Learn renders the lesson INSTEAD of the drill, so nothing that grades or saves is mounted
                <LearnStage
                  key={`${activeRuleId}:${inTune ? move.id : ""}`}
                  conceptId={activeRuleId}
                  data={learn}
                  tonic={key}
                  status={status}
                  flag={flag}
                  own={own}
                  ladder={ladder}
                  from={returning ? learnName(returning.id) : undefined}
                  finishLabel={returning ? `Back to ${learnName(returning.id)} ›` : basics ? "Done" : "Study it ›"}
                  onFinish={finishLesson}
                  onLearn={learnFirst}
                  midiConnected={midiConnected}
                  focus={stageFocus}
                  footer={
                    lessonDone === activeRuleId && (
                      <p role="status" className="font-hand text-base text-ink-soft" data-lesson-done>
                        ✓ Lesson done.{" "}
                        {elsewhere ? "Now hear it and play it where it lives: the link above." : "Pick the next concept on the left, or press Next ›."}
                      </p>
                    )
                  }
                />
              ) : basics ? (
                // a basic without a lesson: nothing to drill here (every node Next up returns has one, so this is a fallback)
                <div className="space-y-3">
                  {ladder}
                  <p className="font-hand text-lg">{learnName(activeRuleId)} has no lesson here yet.</p>
                </div>
              ) : (
              <CoachDrill
                key={`${scope}:${scope === "concept" ? activeRuleId : move.id}:${stage}`}
                stage={stage === "learn" ? "study" : stage}
                input={input}
                onStage={pickStage}
                ladder={ladder}
                lesson={learn?.lesson ?? null}
                tune={tune}
                move={move}
                conceptRuleId={inTune ? null : activeRuleId}
                keyFlow={keyFlow}
                drillKey={key}
                onDrillKey={setKey}
                onRun={({ key: k, clean }) =>
                  setSession((s) => {
                    const cur = s[activeRuleId] ?? { clean: [], tried: [] };
                    return { ...s, [activeRuleId]: { clean: clean ? [...cur.clean, k] : cur.clean, tried: [...cur.tried, k] } };
                  })
                }
                midiStatus={midi.status}
                onConnectMidi={midi.connect}
              />
              )}
            </div>
          </SketchBox>
          </div>
        </div>

        {/* ── Zone 3 (Right Rail): Concept Passport Page ── */}
        {/* a basic has no keys of its own to stamp: its practice is filed under Changes and Voicings */}
        <aside aria-labelledby="coach-passport-h" hidden={basics} className="order-3 space-y-3 lg:sticky lg:top-4 lg:order-none">
          <SketchBox seed={seedOf("coach-passport")} fill={paper.light}>
            <div className="space-y-3 p-4">
              <div>
                <h3 id="coach-passport-h" className="font-marker text-lg uppercase">
                  {activeRule.name} · passport
                </h3>
              </div>
              <KeyMatrix
                ruleId={activeRuleId}
                reviews={(progress?.concepts ?? []).filter((c) => c.ruleId === activeRuleId)}
                clean={activeCleanKeys}
                now={now}
                lastPlace={null}
                current={key}
                compact
                onPractise={(r) => setKey(r.keyTonic)}
              />
              <p className="text-xs text-ink-soft">
                {touchFirst ? "Tap" : "Click"} a key to drill it there.{" "}
                {!DEMO
                  ? "Every run is saved and scheduled for review."
                  : progress?.sample
                    ? "Stamps here come from a sample notebook until you finish your first run."
                    : progress?.storedIn === "tab"
                      ? "Runs are scheduled for review, but kept only until you close this tab."
                      : "Every run is saved in this browser and scheduled for review."}
              </p>
            </div>
          </SketchBox>
        </aside>
      </div>
    </div>
  );
}

const ms = (t: string | number) => new Date(t).getTime();
