import { chroma, KEYS, prettyNote, RULES } from "@reharm/theory-core";
import { useEffect, useMemo, useState } from "react";
import { SketchBox } from "../../design/rough";
import { paper, pen, seedOf, wash } from "../../design/tokens";
import { fetchProgress, onPracticeSaved, type DueItem, type ImprovRun, type Progress, type Review } from "../../library/practice";

/** A concept + key to practise (from the clipboard, or a key on a passport page). */
export interface PractiseRequest {
  ruleId: string;
  keyTonic: string;
  lastPlace: { tuneId: string; moveId: string } | null;
}

interface Props {
  onPractise: (r: PractiseRequest) => void;
  onClose: () => void;
}

const RULE_NAME = new Map(RULES.map((r) => [r.id, r.name]));
const ruleName = (id: string) => RULE_NAME.get(id) ?? id;
/** Passport pages run round the circle of fifths, the order you'd take a concept through the keys. */
const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].map((c) => KEYS.find((k) => chroma(k) === c)!);
const ms = (t: string | number) => new Date(t).getTime();

function when(dueAt: string | number, now: number) {
  const d = ms(dueAt) - now;
  const abs = Math.abs(d);
  const unit = abs < 3_600_000 ? `${Math.max(1, Math.round(abs / 60_000))} min` : abs < 86_400_000 ? `${Math.round(abs / 3_600_000)} h` : `${Math.round(abs / 86_400_000)} days`;
  return d <= 0 ? (abs < 60_000 ? "due now" : `overdue ${unit}`) : `in ${unit}`;
}

/**
 * The Concept Passport: your practice history as a teacher would keep it. A clipboard of
 * what's due today (the spaced-repetition queue), a 12-key page per concept with a stamp
 * for every key you've played it clean in, and how your solos have been landing lately.
 */
export function PracticeDashboard({ onPractise, onClose }: Props) {
  const [data, setData] = useState<Progress | null>(null);
  const [failed, setFailed] = useState(false);
  const [rule, setRule] = useState<string | null>(null);
  const now = Date.now();

  useEffect(() => {
    let live = true;
    const load = () =>
      void fetchProgress().then((p) => {
        if (!live) return;
        setFailed(!p);
        if (p) setData(p);
      });
    load();
    const off = onPracticeSaved(load);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      off();
      window.removeEventListener("keydown", onKey);
    };
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
                <p className="text-sm text-ink-soft">Every Coach run and every solo pass, kept like a teacher's notebook.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close the passport" className="cursor-pointer font-marker text-2xl leading-none hover:-rotate-6">
                ×
              </button>
            </header>

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
                      <div role="tablist" aria-label="Concepts" className="flex flex-wrap gap-2 font-marker">
                        {concepts.map((c) => {
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

/**
 * One concept's passport page: the 12 keys round the circle of fifths. A key you've played
 * clean gets an ink wash and a red stamp; one you've tried shows a dashed outline with your
 * last grade; untouched keys are faint. Click any key to practise it there.
 */
function KeyMatrix({
  ruleId,
  reviews,
  clean,
  now,
  lastPlace,
  onPractise,
}: {
  ruleId: string;
  reviews: Review[];
  clean: string[];
  now: number;
  lastPlace: PractiseRequest["lastPlace"];
  onPractise: (r: PractiseRequest) => void;
}) {
  const byKey = new Map(reviews.map((r) => [chroma(r.keyTonic), r]));
  const cleanSet = new Set(clean.map(chroma));
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">
        <span className="font-marker text-ink">{clean.length} of 12 keys</span> played clean. Round the circle of fifths, a key at a time.
      </p>
      <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {FIFTHS.map((k, i) => {
          const r = byKey.get(chroma(k));
          const isClean = cleanSet.has(chroma(k));
          const due = r && ms(r.dueAt) <= now;
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onPractise({ ruleId, keyTonic: k, lastPlace })}
                aria-label={`${prettyNote(k)}: ${isClean ? "clean" : r ? `tried ${r.attempts}×, last grade ${r.lastGrade}/5` : "not tried yet"}. Practise it.`}
                className={`relative grid aspect-square w-full cursor-pointer place-items-center rounded-lg transition-transform hover:-rotate-2 ${i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.4deg]"}`}
              >
                <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full" aria-hidden filter="url(#ink-wobble)">
                  {isClean && <ellipse cx="40" cy="41" rx="34" ry="31" fill={wash.blue} opacity="0.35" filter="url(#watercolor)" />}
                  <rect
                    x="5"
                    y="5"
                    width="70"
                    height="70"
                    rx="8"
                    fill="none"
                    stroke={isClean ? "var(--color-ink)" : "var(--color-ink-faint)"}
                    strokeWidth={isClean ? 2.2 : 1.4}
                    strokeDasharray={isClean ? undefined : r ? "5 3" : "2 4"}
                  />
                </svg>
                <span className={`relative font-marker text-2xl ${isClean || r ? "text-ink" : "text-ink-faint"}`}>{prettyNote(k)}</span>
                {isClean && (
                  // the teacher's stamp
                  <span
                    className="absolute bottom-2.5 right-2.5 -rotate-12 rounded border-2 px-1 font-marker text-[10px] leading-tight tracking-widest"
                    style={{ borderColor: pen.red, color: pen.red }}
                  >
                    CLEAN
                  </span>
                )}
                {!isClean && r && <span className="absolute bottom-1.5 text-[10px] text-ink-soft">{r.lastGrade}/5</span>}
                {due && <span className="absolute right-1.5 top-1 text-xs" title="due for review" style={{ color: pen.red }}>●</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
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
