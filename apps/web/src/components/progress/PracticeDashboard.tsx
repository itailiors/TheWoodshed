import { CONCEPT_FAMILIES, conceptKind, conceptName as ruleName, prettyNote } from "@reharm/theory-core";
import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { countOpen } from "../../usage/panelOpens";
import { SketchBox } from "../../design/rough";
import { paper, pen, seedOf, wash } from "../../design/tokens";
import { DEMO } from "../../demo";
import { KeyMatrix } from "./KeyMatrix";
import { forgetLocalPractice, type DueItem, type ImprovRun, type Progress, type Review } from "../../library/practice";
import { progressSnapshot, refreshProgress, subscribeProgress } from "../../learn/progressStore";

import type { PractiseRequest } from "./KeyMatrix";
export type { PractiseRequest } from "./KeyMatrix";

interface Props {
  onPractise: (r: PractiseRequest) => void;
  /** A Path card: open the Coach on that concept (basics open their Learn). */
  onOpenConcept: (conceptId: string) => void;
  onClose: () => void;
}

const PathView = lazy(() => import("../learn/PathView").then((m) => ({ default: m.PathView })));

const ms = (t: string | number) => new Date(t).getTime();

function when(dueAt: string | number, now: number) {
  const d = ms(dueAt) - now;
  const abs = Math.abs(d);
  const unit = abs < 3_600_000 ? `${Math.max(1, Math.round(abs / 60_000))} min` : abs < 86_400_000 ? `${Math.round(abs / 3_600_000)} h` : ((n) => `${n} day${n === 1 ? "" : "s"}`)(Math.round(abs / 86_400_000));
  return d <= 0 ? (abs < 60_000 ? "due now" : `overdue ${unit}`) : `in ${unit}`;
}

/** In the demo, where the visitor's notebook lives, and a way to erase it (two clicks, no dialog). */
function LocalNotice({ storedIn }: { storedIn?: Progress["storedIn"] }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-ink-soft">
      <span>
        {storedIn === "tab"
          ? "Your notebook. This browser isn't letting the app store data, so it lasts until you close this tab."
          : "Your notebook, saved in this browser only: no account, nothing leaves your device."}
      </span>
      {confirming ? (
        <span className="flex gap-2 font-marker">
          <button type="button" className="cursor-pointer underline" style={{ color: pen.red }} onClick={() => void forgetLocalPractice()}>
            Erase every run
          </button>
          <button type="button" className="cursor-pointer text-ink underline" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </span>
      ) : (
        <button type="button" className="cursor-pointer font-marker text-ink underline" onClick={() => setConfirming(true)}>
          Start over…
        </button>
      )}
    </p>
  );
}

/**
 * The Concept Passport: your practice history as a teacher would keep it. A clipboard of
 * what's due today (the spaced-repetition queue), a 12-key page per concept with a stamp
 * for every key you've played it clean in, and how your solos have been landing lately.
 */
export function PracticeDashboard({ onPractise, onOpenConcept, onClose }: Props) {
  // the drawer always opens on "Today's practice"; "Path" is one click away (spec §C)
  const [tab, setTab] = useState<"today" | "path">("today");
  const pickTab = (t: "today" | "path") => {
    if (t === "path" && tab !== "path") countOpen("passport.path");
    setTab(t);
  };
  // the page's one shared passport read (progressStore): already fresh after every saved run
  const { progress: data, loading } = useSyncExternalStore(subscribeProgress, progressSnapshot);
  const failed = !loading && !data;
  const [rule, setRule] = useState<string | null>(null);
  const now = Date.now();

  // the last read failed (API down): opening the passport tries again, once
  useEffect(() => {
    if (!progressSnapshot().loading && !progressSnapshot().progress) refreshProgress();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // every concept you've touched, most-practised first
  const concepts = useMemo(() => {
    const byRule = new Map<string, Review[]>();
    for (const c of data?.concepts ?? []) byRule.set(c.ruleId, [...(byRule.get(c.ruleId) ?? []), c]);
    return [...byRule.entries()].sort((a, b) => sum(b[1]) - sum(a[1])).map(([id, reviews]) => ({ id, reviews }));
  }, [data]);
  const shown = concepts.find((c) => c.id === rule) ?? concepts[0];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" role="dialog" aria-modal="true" aria-labelledby="passport-h" onClick={onClose}>
      <div className="h-full w-full max-w-[960px] overflow-y-auto bg-paper p-3 shadow-2xl md:p-6" onClick={(e) => e.stopPropagation()}>
        <SketchBox seed={seedOf("passport")} fill={paper.light} strokeWidth={2}>
          <div className="space-y-6 p-4 md:p-6">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 id="passport-h" className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
                  📒 Concept passport
                </h2>
                <p className="text-sm text-ink-soft">Every Coach run, Changes answer, voiced shape and solo pass, kept like a teacher's notebook.</p>
                {data?.sample && (
                  <p className="mt-1 inline-block -rotate-1 rounded border-2 border-dashed px-2 text-sm" style={{ borderColor: pen.red, color: pen.red }}>
                    Sample notebook: three weeks of a made-up player's practice, so you can see the loop working. Finish a Coach run or a solo pass and
                    your own notebook replaces it.
                  </p>
                )}
                {DEMO && data && !data.sample && <LocalNotice storedIn={data.storedIn} />}
              </div>
              <button type="button" onClick={onClose} aria-label="Close the passport" className="cursor-pointer font-marker text-2xl leading-none hover:-rotate-6">
                ×
              </button>
            </header>

            <div role="tablist" aria-label="Passport views" className="flex flex-wrap gap-2 font-marker">
              {(
                [
                  ["today", "Today's practice"],
                  ["path", "Path"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  id={`passport-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`passport-panel-${id}`}
                  onClick={() => pickTab(id)}
                  className={`tap-lg cursor-pointer rounded-full border-2 border-ink px-4 py-0.5 ${tab === id ? "bg-ink text-paper-light" : "hover:bg-paper-shade"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "path" ? (
              <div id="passport-panel-path" role="tabpanel" aria-labelledby="passport-tab-path">
                <Suspense fallback={<p className="font-marker text-ink-soft">Opening your path…</p>}>
                  <PathView onOpen={onOpenConcept} />
                </Suspense>
              </div>
            ) : (
            <div id="passport-panel-today" role="tabpanel" aria-labelledby="passport-tab-today" className="space-y-6">
            {failed && !data && (
              <p className="rounded border-2 border-dashed px-4 py-3" style={{ borderColor: pen.red, color: pen.red }}>
                Can't reach the practice history right now. It lives in the API's database; start the API and this page fills in.
              </p>
            )}
            {!data && !failed && <p className="font-marker text-ink-soft">Opening the notebook…</p>}

            {data && (
              <>
                <Clipboard due={data.due} next={data.concepts} now={now} onPractise={onPractise} />

                <section aria-labelledby="pages-h" className="space-y-3">
                  <h3 id="pages-h" className="font-marker text-xl uppercase">
                    Passport pages
                  </h3>
                  {concepts.length === 0 ? (
                    <p className="text-ink-soft">
                      No stamps yet. Open a move's <span className="font-marker">✍ Drill the voicing</span> and play it cleanly: every key you nail gets stamped here.
                    </p>
                  ) : (
                    <>
                      {/* reharm moves (the Coach), the Changes game's motions and the Voicings shapes are kept apart */}
                      {CONCEPT_FAMILIES.map((f) => ({ title: f.heading, items: concepts.filter((c) => conceptKind(c.id) === f.kind) }))
                        .filter((group) => group.items.length > 0)
                        .map((group) => (
                          <div key={group.title} className="space-y-1.5">
                            <p className="font-hand text-sm uppercase tracking-wider text-ink-soft">{group.title}</p>
                            <div role="tablist" aria-label={group.title} className="flex flex-wrap gap-2 font-marker">
                              {group.items.map((c) => {
                                const clean = (data.cleanKeys[c.id] ?? []).length;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={shown?.id === c.id}
                                    onClick={() => setRule(c.id)}
                                    className={`cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 text-sm ${shown?.id === c.id ? "bg-ink text-paper-light" : "hover:bg-paper-shade"}`}
                                  >
                                    {ruleName(c.id)} <span className="opacity-70">{clean}/12</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      {shown && (
                        <KeyMatrix
                          ruleId={shown.id}
                          reviews={shown.reviews}
                          clean={data.cleanKeys[shown.id] ?? []}
                          now={now}
                          lastPlace={data.places[shown.id] ?? null}
                          onPractise={onPractise}
                        />
                      )}
                    </>
                  )}
                </section>

                <SoloTrend runs={data.recentImprov} />
              </>
            )}
            </div>
            )}
          </div>
        </SketchBox>
      </div>
    </div>
  );
}

const sum = (rs: Review[]) => rs.reduce((n, r) => n + r.attempts, 0);

/** The teacher's clipboard: what the spaced-repetition scheduler says to practise now. */
function Clipboard({ due, next, now, onPractise }: { due: DueItem[]; next: Review[]; now: number; onPractise: (r: PractiseRequest) => void }) {
  const upcoming = next.filter((c) => ms(c.dueAt) > now).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))[0];
  return (
    <section aria-labelledby="clip-h" className="relative">
      {/* the clip */}
      <span aria-hidden className="absolute -top-3 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-md border-2 border-ink bg-paper-shade" />
      <SketchBox seed={seedOf("clipboard")} fill={paper.base} strokeWidth={2} className="-rotate-[0.4deg]">
        <div className="space-y-3 p-4 pt-5">
          <h3 id="clip-h" className="font-marker text-xl uppercase">
            Today's practice
          </h3>
          {due.length === 0 ? (
            <p className="text-ink-soft">
              Nothing due. {upcoming ? `Next up: ${ruleName(upcoming.ruleId)} in ${prettyNote(upcoming.keyTonic)}, ${when(upcoming.dueAt, now)}.` : "Drill a move in the Coach and the scheduler starts planning your reviews."}
            </p>
          ) : (
            <ol className="space-y-2">
              {due.map((d) => (
                <li key={`${d.ruleId}:${d.keyTonic}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dashed border-ink-faint pb-2">
                  <span aria-hidden className="h-4 w-4 shrink-0 rounded-sm border-2 border-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="font-marker">{ruleName(d.ruleId)}</span> in <span className="font-marker text-lg">{prettyNote(d.keyTonic)}</span>
                    <span className="ml-2 text-xs text-ink-soft">
                      {when(d.dueAt, now)} · {d.cleanRuns}/{d.attempts} clean{d.lastGrade !== null ? ` · last ${d.lastGrade}/5` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onPractise({ ruleId: d.ruleId, keyTonic: d.keyTonic, lastPlace: d.lastPlace })}
                    className="cursor-pointer rounded-full border-2 border-ink bg-ink px-3 py-0.5 font-marker text-sm text-paper-light hover:-rotate-1"
                  >
                    Practise →
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SketchBox>
    </section>
  );
}

/** Recent solo passes: chord tones landed, as an ink line, with guide-tone landings as dots. */
function SoloTrend({ runs }: { runs: ImprovRun[] }) {
  const pts = [...runs].reverse(); // oldest → newest
  return (
    <section aria-labelledby="solos-h" className="space-y-2">
      <h3 id="solos-h" className="font-marker text-xl uppercase">
        Recent solos
      </h3>
      {pts.length < 2 ? (
        <p className="text-ink-soft">{pts.length ? "One pass so far." : "No solo passes yet."} Solo over the loop with the heatmap open, and each pass is logged here.</p>
      ) : (
        <>
          <svg viewBox="0 0 400 110" className="h-32 w-full" aria-label={`Chord tones per pass, last ${pts.length} passes: ${pts.map((r) => r.chordTonePct).join(", ")} percent`}>
            <g filter="url(#ink-wobble)">
              {[0, 50, 100].map((v) => (
                <g key={v}>
                  <line x1="30" x2="396" y1={100 - v * 0.9} y2={100 - v * 0.9} stroke="var(--color-ink-faint)" strokeWidth="0.8" strokeDasharray="2 4" />
                  <text x="2" y={104 - v * 0.9} fontSize="10" fill="var(--color-ink-soft)" className="font-hand">
                    {v}%
                  </text>
                </g>
              ))}
              <polyline
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth="2"
                strokeLinejoin="round"
                points={pts.map((r, i) => `${30 + (i * 366) / (pts.length - 1)},${100 - r.chordTonePct * 0.9}`).join(" ")}
              />
              {pts.map((r, i) => (
                <circle key={r.id} cx={30 + (i * 366) / (pts.length - 1)} cy={100 - r.chordTonePct * 0.9} r={2 + Math.min(4, r.guideToneLandings)} fill={wash.mustard} stroke="var(--color-ink)" strokeWidth="1" />
              ))}
            </g>
          </svg>
          <p className="text-xs text-ink-soft">
            Line: % of notes on chord tones per pass. Dot size: guide-tone landings at the changes. Latest: {pts[pts.length - 1].chordTonePct}% chord tones,{" "}
            {pts[pts.length - 1].guideToneLandings} landings, {pts[pts.length - 1].heldAvoidNotes} held avoid notes.
          </p>
        </>
      )}
    </section>
  );
}
