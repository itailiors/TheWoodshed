import {
  buildPathway,
  chroma,
  transposeTune,
  densityLabel,
  formBars,
  generateMoves,
  improvMap,
  overlaps,
  prettyNote,
  prettySymbol,
  realize,
  someday,
  sortedHarmony,
  symbol,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { prefetchAudio } from "./audio/player";
import { fetchTune, LibraryError } from "./library/api";
import { checkApi, onceOnline } from "./library/apiStatus";
import { OfflineBanner } from "./components/OfflineBanner";
import { toast, Toaster } from "./components/Toaster";
import { DEMO } from "./demo";
import { pen } from "./design/tokens";
import { usePlayback } from "./audio/usePlayback";
import { ImprovCard } from "./components/ImprovCard";
import { TransportBar } from "./components/TransportBar";
import { ModeSwitch, type AppMode } from "./components/ModeSwitch";
import { ImprovHeatmap } from "./components/practice/ImprovHeatmap";
import { lazyWithPreload, whenIdle } from "./lazy";
import { PanelBoundary } from "./components/PanelBoundary";
import type { PractiseRequest } from "./components/progress/PracticeDashboard";
import { useMidi } from "./midi/useMidi";
import { KeyPicker } from "./components/KeyPicker";
import { LeadSheet } from "./components/LeadSheet";
import { LevelDial } from "./components/LevelDial";
import { MoveCard } from "./components/MoveCard";
import { SideRail } from "./components/SideRail";
import { SketchBox, SketchFilters, SketchRule } from "./design/rough";
import { CATEGORY_LABEL, CATEGORY_WASH, paper, seedOf } from "./design/tokens";

// Split out of the main bundle: each is only needed after a click (or on a return visit
// straight into Practice Mode), and all three are prefetched once the page is idle.
const LibraryDrawer = lazyWithPreload(() => import("./components/library/LibraryDrawer").then((m) => m.LibraryDrawer));
const CompingCoach = lazyWithPreload(() => import("./components/practice/CompingCoach").then((m) => m.CompingCoach));
// The X-ray (and, inside it, the Proof tab's fast-check worker) only loads when opened.
const PracticeDashboard = lazyWithPreload(() => import("./components/progress/PracticeDashboard").then((m) => m.PracticeDashboard));
const EngineXRay = lazyWithPreload(() => import("./components/xray/EngineXRay").then((m) => m.EngineXRay));
const PracticeMode = lazyWithPreload(() => import("./components/practice/PracticeMode").then((m) => m.PracticeMode));

/** What a lazy screen shows for the moment its chunk is still arriving. */
function Inking({ label }: { label: string }) {
  return (
    <p role="status" className="fixed inset-0 z-40 grid place-items-center bg-paper/60 font-marker text-lg text-ink-soft">
      {label}…
    </p>
  );
}

const FEEL: Record<string, string> = { waltz: "jazz waltz", swing: "swing", bossa: "bossa", ballad: "ballad", straight8: "straight 8ths" };

const LAST_TUNE = "reharm.tune";
/** Remembered with the id, so "that tune is gone" can name it after it's been deleted. */
const LAST_TITLE = "reharm.tune.title";
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
  remove: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  },
};
/** Per-tune transposition: `reharm.key:<tune id>` = the tonic you last played it in. */
const KEY_PREFIX = "reharm.key:";

export function App() {
  // ── the tune on the stand (from the library; the reference tune until one loads) ──
  // `baseTune` is the chart as written; `tune` is it in the key you've chosen. Everything
  // downstream (engine, moves, playback, heatmap, Deep Dive) only ever sees `tune`.
  const [baseTune, setTune] = useState<Tune>(someday);
  const [keyTonic, setKeyTonic] = useState<string | null>(() => store.get(KEY_PREFIX + someday.id));
  // Each tune remembers the key you last played it in.
  useEffect(() => setKeyTonic(store.get(KEY_PREFIX + baseTune.id)), [baseTune.id]);
  const changeKey = useCallback(
    (k: string) => {
      const home = chroma(k) === chroma(baseTune.key.tonic);
      setKeyTonic(home ? null : k);
      if (home) store.remove(KEY_PREFIX + baseTune.id);
      else store.set(KEY_PREFIX + baseTune.id, k);
    },
    [baseTune],
  );
  const tune = useMemo(
    () => (keyTonic && chroma(keyTonic) !== chroma(baseTune.key.tonic) ? transposeTune(baseTune, keyTonic) : baseTune),
    [baseTune, keyTonic],
  );
  const [libraryOpen, setLibraryOpen] = useState(false);
  const loadTune = useCallback(async (id: string) => {
    const t = id === someday.id ? someday : await fetchTune(id);
    setTune(t);
    store.set(LAST_TUNE, id);
    store.set(LAST_TITLE, t.title);
  }, []);
  const backToReference = useCallback((note: string) => {
    setTune(someday);
    store.set(LAST_TUNE, someday.id);
    store.set(LAST_TITLE, someday.title);
    toast(note, { tone: "warn" });
  }, []);

  // Reopen the tune that was on the stand last time.
  useEffect(() => {
    if (DEMO) return; // the demo only ever shows the bundled tune
    const last = store.get(LAST_TUNE);
    const lastTitle = store.get(LAST_TITLE);
    if (!last || last === someday.id) return;
    let live = true; // false once this effect is cleaned up (StrictMode runs it twice in dev)
    let cancelRetry = () => {};
    const restore = () =>
      loadTune(last).catch(async (err) => {
        if (!live) return;
        if (err instanceof LibraryError && err.status === 404) {
          backToReference(`${lastTitle ? `“${lastTitle}”` : "The tune you had open"} is no longer in your library, so here's ${someday.title} instead.`);
        } else if (err instanceof LibraryError && err.unreachable && (await checkApi()) !== "online" && live) {
          // The API is down (the banner says so). Keep the reference tune for now, and
          // put the remembered one back on the stand as soon as the API returns.
          cancelRetry = onceOnline(() => void restore());
        }
      });
    void restore();
    return () => {
      live = false;
      cancelRetry();
    };
  }, [loadTune, backToReference]);
  const bars = formBars(tune);

  const { accepted, rejected } = useMemo(() => generateMoves(tune), [tune]);

  const [level, setLevel] = useState(2);
  const [forced, setForced] = useState<string[]>([]);
  const [view, setView] = useState<"reharm" | "original">("reharm");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const forcedMoves = useMemo(() => forced.map((id) => accepted.find((m) => m.id === id)).filter((m): m is ReharmMove => !!m), [accepted, forced]);
  const pathway = useMemo(() => buildPathway(accepted, level, forcedMoves), [accepted, level, forcedMoves]);
  const realized = useMemo(() => realize(tune, pathway), [tune, pathway]);
  const original = useMemo(() => sortedHarmony(tune), [tune]);
  const shownChords = view === "reharm" ? realized : original;
  const improv = useMemo(() => improvMap(tune, shownChords), [tune, shownChords]);

  const selected = pathway.find((m) => m.id === selectedId) ?? pathway[0] ?? null;
  const improvForSelected = selected
    ? improv.filter((e) =>
        view === "reharm" ? selected.chords.some((c) => c.id === e.chord.id) : selected.replaces.includes(e.chord.id),
      )
    : improv.slice(0, 2);

  const changeLevel = (l: number) => {
    setLevel(l);
    setForced([]);
    setSelectedId(null);
  };
  const pick = (alt: ReharmMove) => {
    setForced((f) => [...f.filter((id) => !overlaps(accepted.find((m) => m.id === id)!, alt)), alt.id]);
    setSelectedId(alt.id);
  };

  const usedCategories = [...new Set(pathway.map((m) => m.category))];

  // ── playback ──
  const [tempo, setTempo] = useState(tune.tempo);
  const [loopSelection, setLoopSelection] = useState(false);
  const loop = useMemo(() => {
    if (loopSelection && selected) {
      // one bar of run-up, through the bar the move resolves into
      return { startBar: Math.max(1, selected.span.from.bar - 1), endBar: selected.span.to.bar };
    }
    return { startBar: 1, endBar: bars };
  }, [loopSelection, selected, bars]);
  const arrangement = useMemo(() => ({ tune, chords: shownChords, loop }), [tune, shownChords, loop]);
  const playback = usePlayback(arrangement, tempo);
  const midi = useMidi();
  const [mode, setModeState] = useState<AppMode>(() => {
    try {
      return localStorage.getItem("reharm.mode") === "practice" ? "practice" : "study";
    } catch {
      return "study";
    }
  });
  /**
   * Switch Study ↔ Practice. The band never stops (playback lives up here, not in either
   * screen), and where the browser supports the View Transitions API the lead sheet morphs
   * from its Study frame into the Practice frame (both carry `view-transition-name:
   * lead-sheet`) while the rest cross-fades. Practice Mode's chunk is loaded first, so the
   * transition captures the real screen, not the "inking…" placeholder.
   */
  const setMode = useCallback(async (m: AppMode) => {
    const commit = () => {
      flushSync(() => setModeState(m));
      store.set("reharm.mode", m);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) return commit();
    if (m === "practice") await PracticeMode.preload().catch(() => {});
    // The browser runs the update only after it has captured the old screen. If it can't
    // render a frame (a backgrounded or embedded tab), that never happens, so after a short
    // wait we switch anyway and drop the animation: the mode change must never hang on it.
    let done = false;
    const commitOnce = () => {
      if (done) return;
      done = true;
      commit();
    };
    const vt = document.startViewTransition(commitOnce);
    // A skipped transition rejects `ready`; that's expected here, not an error.
    vt.ready.catch(() => {});
    setTimeout(() => {
      if (done) return;
      commitOnce();
      vt.skipTransition();
    }, 400);
  }, []);
  const [coachOpen, setCoachOpen] = useState(false);
  const [xrayOpen, setXrayOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  // The Coach drills one exact move, in one key. Usually the selected move in the tune's key,
  // but the review queue can ask for any move (even one the dial isn't showing) in any key.
  const [coachTarget, setCoachTarget] = useState<{ moveId: string; key?: string } | null>(null);
  const coachMove = (coachTarget && accepted.find((m) => m.id === coachTarget.moveId)) ?? selected;
  const openCoach = (id?: string) => {
    if (id) setSelectedId(id);
    const target = id ?? selected?.id;
    if (!target) return;
    setCoachTarget({ moveId: target });
    setCoachOpen(true);
  };

  /**
   * "Practise →" from the passport: open the Coach on that concept, in that key. If it was
   * last practised on another chart, load that chart first; then pick the exact move (or any
   * move of the same rule in this tune).
   */
  const [pendingPractise, setPendingPractise] = useState<(PractiseRequest & { tuneId: string }) | null>(null);
  const practiseConcept = async (r: PractiseRequest) => {
    setPassportOpen(false);
    const tuneId = r.lastPlace?.tuneId ?? baseTune.id;
    if (tuneId !== baseTune.id) {
      try {
        await loadTune(tuneId);
      } catch {
        toast(`Couldn't open the tune you last practised this on, so trying it in ${baseTune.title}.`, { tone: "warn" });
        setPendingPractise({ ...r, lastPlace: null, tuneId: baseTune.id });
        return;
      }
    }
    setPendingPractise({ ...r, tuneId });
  };
  useEffect(() => {
    const p = pendingPractise;
    if (!p || baseTune.id !== p.tuneId) return; // wait until the right chart is on the stand
    setPendingPractise(null);
    const move = accepted.find((m) => m.id === p.lastPlace?.moveId) ?? accepted.find((m) => m.ruleId === p.ruleId);
    if (!move) {
      toast(`${tune.title} has no spot for that concept. Load a tune where it fits, then open the Coach from its move card.`, { tone: "warn" });
      return;
    }
    setSelectedId(move.id);
    setCoachTarget({ moveId: move.id, key: p.keyTonic });
    setCoachOpen(true);
  }, [pendingPractise, baseTune.id, accepted, tune.title]);
  /**
   * "Practice this move": select it, loop it (one bar of run-up through its resolution),
   * go to Practice Mode, and start the band if it isn't already playing. If it is, the
   * engine jumps straight into the new loop instead of finishing the old pass.
   */
  const practiceMove = (id: string) => {
    setSelectedId(id);
    setLoopSelection(true);
    void setMode("practice");
    void playback.play();
  };

  // Once the first paint is done, fetch what the next click will need: the audio engine
  // (so Play starts inside the click's activation window) and the lazy screens.
  useEffect(() => {
    prefetchAudio();
    whenIdle(() => {
      void PracticeMode.preload().catch(() => {});
      void CompingCoach.preload().catch(() => {});
      if (!DEMO) void LibraryDrawer.preload().catch(() => {});
    });
  }, []);

  // A new tune resets everything that belonged to the old one. A key change doesn't: move
  // ids are positional, so your picks, the selected move and the loop all carry across keys.
  useEffect(() => {
    setForced([]);
    setSelectedId(null);
    setTempo(baseTune.tempo);
    setLoopSelection(false);
    setCoachOpen(false);
  }, [baseTune]);

  const keyControl = { tonic: tune.key.tonic, original: baseTune.key.tonic, mode: tune.key.mode, onChange: changeKey };

  if (mode === "practice") {
    return (
      <Suspense fallback={<Inking label="Setting up the practice room" />}>
        <Toaster />
        <PracticeMode
        tune={tune}
        chords={shownChords}
        pathway={pathway}
        view={view}
        onView={setView}
        level={level}
        onLevel={changeLevel}
        loop={loop}
        loopSelection={loopSelection}
        onLoopSelection={setLoopSelection}
        tempo={tempo}
        onTempo={setTempo}
        playback={playback}
        midi={midi}
        onMode={setMode}
        totalBars={bars}
          keyControl={keyControl}
        />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen text-ink">
      <SketchFilters />
      <Toaster />
      <SideRail
        playing={playback.status === "playing"}
        onPlay={playback.toggle}
        onPractice={() => openCoach()}
        onLibrary={DEMO ? undefined : () => setLibraryOpen(true)}
        onProgress={DEMO ? undefined : () => setPassportOpen(true)}
      />
      <Suspense fallback={<Inking label="Opening the drawer" />}>
      {libraryOpen && !DEMO && (
        <PanelBoundary onClose={() => setLibraryOpen(false)}>
        <LibraryDrawer
          currentId={baseTune.id}
          onLoad={loadTune}
          onClose={() => setLibraryOpen(false)}
          onDeleted={(id, title) => {
            if (id === baseTune.id) backToReference(`Deleted “${title}”, which was on the stand, so here's ${someday.title}.`);
          }}
        />
        </PanelBoundary>
      )}
      {coachOpen && coachMove && (
        <PanelBoundary onClose={() => setCoachOpen(false)}>
          <CompingCoach
            key={`${coachMove.id}:${coachTarget?.key ?? ""}`}
            tune={tune}
            move={coachMove}
            initialKey={coachTarget?.key}
            midiStatus={midi.status}
            onConnectMidi={midi.connect}
            onClose={() => setCoachOpen(false)}
          />
        </PanelBoundary>
      )}
      {passportOpen && !DEMO && (
        <PanelBoundary onClose={() => setPassportOpen(false)}>
          <PracticeDashboard onPractise={(r) => void practiseConcept(r)} onClose={() => setPassportOpen(false)} />
        </PanelBoundary>
      )}
      {xrayOpen && (
        <PanelBoundary onClose={() => setXrayOpen(false)}>
        <EngineXRay
          tune={tune}
          level={level}
          forced={forcedMoves}
          playheadBar={playback.status === "playing" ? (playback.position?.bar ?? null) : null}
          startBar={selected?.span.from.bar ?? 1}
          onClose={() => setXrayOpen(false)}
        />
        </PanelBoundary>
      )}
      </Suspense>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 md:px-8 md:py-8">
        <OfflineBanner />
        {/* ── banner ── */}
        <SketchBox seed={11} strokeWidth={2} fill={paper.light} className="mb-5">
          <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8 md:py-5">
            <div>
              <h1 className="ink-wobble font-marker text-3xl font-bold uppercase leading-none tracking-wide md:text-5xl" style={{ viewTransitionName: "tune-title" }}>
                {tune.title}
              </h1>
              <p className="mt-2 text-sm text-ink-soft md:text-base">
                {[tune.composer, `${prettyNote(tune.key.tonic)} ${tune.key.mode}`, `${tune.meter.join("/")} ${FEEL[tune.feel]}`, `${bars} bars`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="ink-wobble text-right font-marker font-bold uppercase leading-[0.9] text-ink-soft">
              <div className="text-2xl md:text-3xl">Reharm</div>
              <div className="text-2xl text-ink md:text-3xl">Lab</div>
            </div>
          </header>
        </SketchBox>

        {/* ── toolbar ── */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {DEMO ? (
              <span className="-rotate-2 rounded border-2 border-dashed px-2 font-marker text-sm" style={{ borderColor: pen.red, color: pen.red }}>
                Read-only demo
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:-rotate-1 hover:bg-paper-shade"
              >
                📚 Setlist
              </button>
            )}
            {!DEMO && (
              <button
                type="button"
                onClick={() => setPassportOpen(true)}
                onPointerEnter={() => void PracticeDashboard.preload().catch(() => {})}
                className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:-rotate-1 hover:bg-paper-shade"
              >
                📒 Progress
              </button>
            )}
            <ModeSwitch mode="study" onMode={setMode} />
            <button
              type="button"
              onClick={() => setXrayOpen(true)}
              onPointerEnter={() => void EngineXRay.preload().catch(() => {})}
              className="cursor-pointer rounded-full border-2 border-dashed border-ink px-3 py-0.5 font-marker hover:-rotate-1 hover:bg-paper-shade"
              title="See how the engine decided, bar by bar, and run its proofs live"
            >
              🔬 Engine X-ray
            </button>
            <KeyPicker {...keyControl} />
            <LevelDial level={level} onChange={changeLevel} />
          </div>
          <div className="flex items-center gap-1 font-marker" role="group" aria-label="Show chords">
            {(["original", "reharm"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 capitalize ${view === v ? "bg-ink text-paper-light" : "hover:bg-paper-shade"}`}
              >
                {v === "reharm" ? "Reharm" : "Original"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── left: the living lead sheet ── */}
          <section aria-labelledby="lead-sheet-h">
            <SketchBox seed={21} strokeWidth={1.8} style={{ viewTransitionName: "lead-sheet" }}>
              <div className="p-4 md:p-6">
                <h2 id="lead-sheet-h" className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
                  Lead sheet
                </h2>
                <div className="mt-3">
                  <TransportBar
                    status={playback.status}
                    source={playback.source}
                    bandSource={playback.bandSource}
                    onToggle={playback.toggle}
                    tempo={tempo}
                    onTempo={setTempo}
                    loopSelection={loopSelection}
                    onLoopSelection={setLoopSelection}
                    canLoopSelection={!!selected}
                    midi={midi}
                    pulse={{ position: playback.position, beatTick: playback.beatTick, count: playback.count, beatsPerBar: tune.meter[0] }}
                    countIn={{ bars: playback.countInBars, onChange: playback.setCountIn }}
                  />
                </div>
                <div className="mt-2 overflow-x-auto">
                  <div className="min-w-[640px]">
                    <LeadSheet
                      tune={tune}
                      chords={shownChords}
                      moves={pathway}
                      selectedId={selected?.id}
                      onSelect={setSelectedId}
                      showWashes={view === "reharm"}
                      playhead={playback.position}
                      loopBars={playback.status === "playing" || loopSelection ? loop : null}
                      lastBar={bars}
                    />
                  </div>
                </div>
                {usedCategories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    {usedCategories.map((c) => (
                      <span key={c} className="flex items-center gap-2">
                        <span className="inline-block h-3 w-6 -rotate-2 rounded-sm opacity-70" style={{ background: CATEGORY_WASH[c] }} />
                        {CATEGORY_LABEL[c]}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-ink-faint">
                  {tune.melodyCoverage === "anchors"
                    ? "Melody: only a few anchor notes are entered. Slashes mean no melody yet. "
                    : tune.melodyCoverage === "none"
                      ? "No melody on this chart (iReal charts carry chords only), so moves aren't melody-checked. "
                      : ""}
                  Click a coloured wash to open its move. Flip Original/Reharm or turn the dial while it plays: the chords swap in on the next beat.
                </p>
              </div>
            </SketchBox>

            <div className="mt-6">
              <ImprovHeatmap key={tune.id} tune={tune} chords={shownChords} loop={loop} playing={playback.status === "playing"} level={level} view={view} />
            </div>

            {selected && improvForSelected.length > 0 && (
              <div className="mt-6 lg:hidden">
                <ImprovCard entries={improvForSelected} title={`bar ${selected.span.from.bar}`} />
              </div>
            )}
          </section>

          {/* ── right: reharm & tricks ── */}
          <aside aria-labelledby="tricks-h" className="space-y-5">
            <div>
              <h2 id="tricks-h" className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
                Reharm &amp; tricks
              </h2>
              <SketchRule seed={31} strokeWidth={2.2} />
              {level > 0 && (
                <p className="mt-1 text-sm text-ink-soft">
                  {pathway.length} move{pathway.length === 1 ? "" : "s"} · {densityLabel(level)}
                  {level < 4 && accepted.length > pathway.length && ` (turn the dial up for more, or swap one in from “Also works here”)`}
                </p>
              )}
            </div>

            {pathway.length === 0 && (
              <p className="text-ink-soft">Level 0 shows the tune as written. Turn the dial up to let the engine reharmonize.</p>
            )}

            {pathway.map((m) => (
              <MoveCard
                key={m.id}
                tuneId={tune.id}
                move={m}
                selected={m.id === selected?.id}
                onSelect={() => setSelectedId(m.id)}
                onPick={pick}
                onPractice={() => practiceMove(m.id)}
                onDrill={() => openCoach(m.id)}
                alternatives={accepted.filter((a) => a.id !== m.id && overlaps(a, m))}
              />
            ))}

            {selected && improvForSelected.length > 0 && (
              <div className="hidden lg:block">
                <ImprovCard entries={improvForSelected} title={`bar ${selected.span.from.bar}${view === "original" ? " (original)" : ""}`} />
              </div>
            )}

            {rejected.length > 0 && (
              <SketchBox seed={seedOf("rejected")} className="text-ink opacity-80">
                <section className="p-4 text-sm">
                  <h3 className="font-marker text-base font-bold uppercase">Considered &amp; rejected</h3>
                  <ul className="mt-1 space-y-1">
                    {rejected.map((r) => (
                      <li key={r.move.id}>
                        <span className="font-marker">
                          Bar {r.move.span.from.bar}: {r.move.chords.map((c) => prettySymbol(symbol(c))).join(" · ")}
                        </span>{" "}
                        <span className="text-ink-soft">({r.reasons[0]})</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </SketchBox>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
