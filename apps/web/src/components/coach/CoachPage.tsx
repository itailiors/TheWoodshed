import { chroma, conceptDrillSteps, KEYS, prettyNote, prettySymbol, RULES, symbol, type ReharmMove, type Tune } from "@reharm/theory-core";
import { useEffect, useMemo, useState } from "react";
import { SketchBox, SketchFilters } from "../../design/rough";
import { CATEGORY_WASH, paper, pen, seedOf, wash } from "../../design/tokens";
import { DEMO } from "../../demo";
import { fetchProgress, onPracticeSaved, type Progress } from "../../library/practice";
import type { MidiStatus } from "../../midi/useMidi";
import { ModeSwitch, type AppMode } from "../ModeSwitch";
import { MidiMonitorToggle } from "../MidiMonitorToggle";
import { QwertyToggle } from "../QwertyToggle";
import { KeyMatrix, type PractiseRequest } from "../progress/KeyMatrix";
import { CoachDrill, nextCircleKey, type KeyFlow } from "./CoachDrill";
import { useTouchFirst } from "../../device/media";
import { ChordName } from "../ChordName";

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
  const touchFirst = useTouchFirst();

  const tuneMove = accepted.find((m) => m.id === moveId) ?? firstTuneMove;
  const activeRuleId = scope === "concept" || !tuneMove ? ruleId : tuneMove.ruleId;
  const activeRule = RULES.find((r) => r.id === activeRuleId) ?? RULES[0];

  const conceptFallback = useMemo(() => conceptDrillSteps(activeRuleId, key), [activeRuleId, key]);
  const move = scope === "tune" && tuneMove ? tuneMove : conceptFallback.move;

  // practice history: server-side (in the demo, the seeded history), plus this session's runs,
  // so the passport stamps at once, and the read-only demo, which saves nothing, still shows what you've done
  const [progress, setProgress] = useState<Progress | null>(null);
  const [session, setSession] = useState<Record<string, { clean: string[]; tried: string[] }>>({});
  useEffect(() => {
    let live = true;
    const load = () => void fetchProgress().then((p) => live && p && setProgress(p));
    load();
    const off = onPracticeSaved(load);
    return () => {
      live = false;
      off();
    };
  }, []);

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

  const conceptSamples = useMemo(
    () =>
      RULES.map((r) => {
        const sample = conceptDrillSteps(r.id, "C").move;
        return { rule: r, category: sample.category, level: sample.level };
      }),
    [],
  );

  const due = (progress?.due ?? []).slice(0, 5);
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

          {scope === "concept" ? (
            <section className="space-y-1.5">
              <h3 className="font-marker text-sm uppercase tracking-wider text-ink-soft">All {RULES.length} Jazz Concepts</h3>
              <ol className="space-y-1">
                {conceptSamples.map(({ rule: r, category, level }) => {
                  const clean = cleanFor(r.id).length;
                  const on = r.id === activeRuleId;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        aria-current={on || undefined}
                        onClick={() => {
                          setRuleId(r.id);
                          if (!window.matchMedia("(min-width: 1024px)").matches) {
                            document.getElementById("coach-drill")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left hover:-rotate-1 ${
                          on ? "border-ink bg-paper-light" : "border-transparent hover:border-ink-faint"
                        }`}
                      >
                        <span className="h-3 w-3 shrink-0 -rotate-6 rounded-sm" style={{ background: CATEGORY_WASH[category] }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-marker text-[15px]">{r.name}</span>
                          <span className="block truncate text-xs text-ink-soft">
                            L{level}
                            {r.pedagogy ? ` · ${r.pedagogy.formula}` : ""}
                            {clean > 0 && <span style={{ color: pen.red }}> · {clean}/12 clean</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
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

        {/* ── Zone 2 (Center Stage): 12-Key Circle-of-Fifths Ribbon + Drill ── */}
        <div id="coach-drill" className="order-1 scroll-mt-4 space-y-3 lg:order-none">
          <a href="#coach-moves" className="inline-block font-marker text-sm text-ink-soft underline lg:hidden">
            ↓ Drill a different concept{due.length ? ` · ${due.length} due for review` : ""}
          </a>

          {/* 12-Key Circle-of-Fifths Ribbon & Key Flow Selector */}
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
                </div>
              </div>

              <ol aria-label="12 keys around the circle" className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
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
                              ? { background: `${wash.blue}33` }
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

          <SketchBox seed={seedOf("coach-drill")} fill={paper.light} strokeWidth={2} style={{ viewTransitionName: "lead-sheet" }}>
            <div className="p-3 sm:p-4 md:p-6">
              <CoachDrill
                key={`${scope}:${scope === "concept" ? activeRuleId : move.id}`}
                tune={tune}
                move={move}
                conceptRuleId={scope === "concept" || !tuneMove ? activeRuleId : null}
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
            </div>
          </SketchBox>
        </div>

        {/* ── Zone 3 (Right Rail): Concept Passport Page ── */}
        <aside aria-labelledby="coach-passport-h" className="order-3 space-y-3 lg:sticky lg:top-4 lg:order-none">
          <SketchBox seed={seedOf("coach-passport")} fill={paper.light}>
            <div className="space-y-3 p-4">
              <div>
                <h3 id="coach-passport-h" className="font-marker text-lg uppercase">
                  {activeRule.name} · passport
                </h3>
                {activeRule.pedagogy && (
                  <p className="mt-0.5 text-xs text-ink-soft">
                    <span className="font-marker text-ink">{activeRule.pedagogy.formula}</span> · {activeRule.pedagogy.whenToUse}
                  </p>
                )}
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
                {DEMO ? "Stamps here come from a sample notebook plus your runs this visit; nothing is saved in the demo." : "Every run is saved and scheduled for review."}
              </p>
            </div>
          </SketchBox>
        </aside>
      </div>
    </div>
  );
}

const ms = (t: string | number) => new Date(t).getTime();
