import { chroma, KEYS, prettyNote, RULES, type ReharmMove, type Tune } from "@reharm/theory-core";
import { useEffect, useMemo, useState } from "react";
import { SketchBox, SketchFilters } from "../../design/rough";
import { CATEGORY_WASH, paper, pen, seedOf } from "../../design/tokens";
import { DEMO } from "../../demo";
import { fetchProgress, onPracticeSaved, type Progress } from "../../library/practice";
import type { MidiStatus } from "../../midi/useMidi";
import { ModeSwitch, type AppMode } from "../ModeSwitch";
import { QwertyToggle } from "../QwertyToggle";
import { KeyMatrix, type PractiseRequest } from "../progress/KeyMatrix";
import { CoachDrill } from "./CoachDrill";

interface Props {
  tune: Tune;
  /** Every move the engine accepted for this tune (the drill list). */
  accepted: ReharmMove[];
  /** The moves in the current reharm, listed first. */
  pathway: ReharmMove[];
  /** Which move and key to open on (from "Drill the voicing" or the review queue). */
  initial: { moveId: string | null; key?: string };
  midi: { status: MidiStatus; connect: () => void };
  onMode: (m: AppMode) => void;
  /** A due review from another concept or chart: the app resolves the tune and move. */
  onPractise: (r: PractiseRequest) => void;
}

const RULE_NAME = new Map(RULES.map((r) => [r.id, r.name]));

/**
 * The Comping Coach, as its own room: what to drill on the left (this tune's moves and the
 * reviews that are due), the drill in the middle, and this concept's 12-key passport page
 * on the right, so you can see which keys you own and pick the next one.
 */
export function CoachPage({ tune, accepted, pathway, initial, midi, onMode, onPractise }: Props) {
  const first = accepted.find((m) => m.id === initial.moveId) ?? pathway[0] ?? accepted[0] ?? null;
  const [moveId, setMoveId] = useState(first?.id ?? null);
  const [key, setKey] = useState(initial.key ?? tune.key.tonic);
  const move = accepted.find((m) => m.id === moveId) ?? first;

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

  const cleanFor = (ruleId: string) => {
    const keys = new Set([...(progress?.cleanKeys[ruleId] ?? []), ...(session[ruleId]?.clean ?? [])].map(chroma));
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

  const due = (progress?.due ?? []).slice(0, 5);
  const now = Date.now();

  if (!move) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-ink">
        <SketchFilters />
        <p className="max-w-md text-center font-marker text-lg">
          The engine found nothing to drill in {tune.title} yet. Turn the dial up in Study, or load another tune.{" "}
          <button type="button" onClick={() => onMode("study")} className="cursor-pointer underline">
            Back to Study
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh p-3 text-ink md:p-5">
      <SketchFilters />
      <header className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ModeSwitch mode="coach" onMode={onMode} />
        <h1 className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl" style={{ viewTransitionName: "tune-title" }}>
          Comping coach <span className="text-base font-normal normal-case text-ink-soft">· {tune.title}</span>
        </h1>
        <button
          type="button"
          onClick={midi.connect}
          disabled={midi.status === "connected" || midi.status === "requesting"}
          className="ml-auto cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 font-marker text-sm hover:bg-paper-shade disabled:cursor-default"
        >
          🎹 {midi.status === "connected" ? "MIDI connected" : midi.status === "requesting" ? "Connecting…" : "Connect MIDI"}
        </button>
        <QwertyToggle compact />
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)_330px]">
        {/* ── left: what to drill ── */}
        <nav aria-label="What to drill" className="space-y-5 lg:sticky lg:top-4">
          {due.length > 0 && (
            <SketchBox seed={seedOf("coach-due")} fill={paper.base} className="-rotate-[0.4deg]">
              <section className="space-y-2 p-3">
                <h3 className="font-marker text-sm uppercase tracking-wider">Due for review</h3>
                <ol className="space-y-1.5">
                  {due.map((d) => {
                    const here = d.ruleId === move.ruleId && chroma(d.keyTonic) === chroma(key);
                    return (
                      <li key={`${d.ruleId}:${d.keyTonic}`}>
                        <button
                          type="button"
                          onClick={() => onPractise({ ruleId: d.ruleId, keyTonic: d.keyTonic, lastPlace: d.lastPlace })}
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

          {groups.map((g) => (
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
                        onClick={() => setMoveId(m.id)}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left hover:-rotate-1 ${on ? "border-ink bg-paper-light" : "border-transparent hover:border-ink-faint"}`}
                      >
                        <span className="h-3 w-3 shrink-0 -rotate-6 rounded-sm" style={{ background: CATEGORY_WASH[m.category] }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-marker text-[15px]">{m.title}</span>
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
          ))}
        </nav>

        {/* ── centre: the drill ── */}
        <SketchBox seed={seedOf("coach-drill")} fill={paper.light} strokeWidth={2} style={{ viewTransitionName: "lead-sheet" }}>
          <div className="p-4 md:p-6">
            <CoachDrill
              key={move.id}
              tune={tune}
              move={move}
              drillKey={key}
              onDrillKey={setKey}
              onRun={({ key: k, clean }) =>
                setSession((s) => {
                  const cur = s[move.ruleId] ?? { clean: [], tried: [] };
                  return { ...s, [move.ruleId]: { clean: clean ? [...cur.clean, k] : cur.clean, tried: [...cur.tried, k] } };
                })
              }
              midiStatus={midi.status}
              onConnectMidi={midi.connect}
            />
          </div>
        </SketchBox>

        {/* ── right: this concept's passport page ── */}
        <aside aria-labelledby="coach-passport-h" className="space-y-3 lg:sticky lg:top-4">
          <SketchBox seed={seedOf("coach-passport")} fill={paper.light}>
            <div className="space-y-3 p-4">
              <h3 id="coach-passport-h" className="font-marker text-lg uppercase">
                {RULE_NAME.get(move.ruleId) ?? move.title} · passport
              </h3>
              <KeyMatrix
                ruleId={move.ruleId}
                reviews={(progress?.concepts ?? []).filter((c) => c.ruleId === move.ruleId)}
                clean={cleanFor(move.ruleId)}
                now={now}
                lastPlace={null}
                current={key}
                compact
                onPractise={(r) => setKey(r.keyTonic)}
              />
              <p className="text-xs text-ink-soft">
                Click a key to drill it there.{" "}
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
