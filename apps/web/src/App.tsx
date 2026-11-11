import {
  buildPathway,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryDrawer } from "./components/library/LibraryDrawer";
import { fetchTune } from "./library/api";
import { DEMO } from "./demo";
import { pen } from "./design/tokens";
import { usePlayback } from "./audio/usePlayback";
import { ImprovCard } from "./components/ImprovCard";
import { TransportBar } from "./components/TransportBar";
import { ModeSwitch, type AppMode } from "./components/ModeSwitch";
import { CompingCoach } from "./components/practice/CompingCoach";
import { PracticeMode } from "./components/practice/PracticeMode";
import { ImprovHeatmap } from "./components/practice/ImprovHeatmap";
import { useMidi } from "./midi/useMidi";
import { LeadSheet } from "./components/LeadSheet";
import { LevelDial } from "./components/LevelDial";
import { MoveCard } from "./components/MoveCard";
import { SideRail } from "./components/SideRail";
import { SketchBox, SketchFilters, SketchRule } from "./design/rough";
import { CATEGORY_LABEL, CATEGORY_WASH, paper, seedOf } from "./design/tokens";

const FEEL: Record<string, string> = { waltz: "jazz waltz", swing: "swing", bossa: "bossa", ballad: "ballad", straight8: "straight 8ths" };

const LAST_TUNE = "reharm.tune";
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
};

export function App() {
  // ── the tune on the stand (from the library; the reference tune until one loads) ──
  const [tune, setTune] = useState<Tune>(someday);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const loadTune = useCallback(async (id: string) => {
    const t = id === someday.id ? someday : await fetchTune(id);
    setTune(t);
    store.set(LAST_TUNE, id);
  }, []);
  useEffect(() => {
    const last = store.get(LAST_TUNE);
    if (DEMO) return; // the demo only ever shows the bundled tune
    if (last && last !== someday.id) loadTune(last).catch(() => {/* library offline: keep the reference tune */});
  }, [loadTune]);
  const bars = formBars(tune);

  const { accepted, rejected } = useMemo(() => generateMoves(tune), [tune]);

  const [level, setLevel] = useState(2);
  const [forced, setForced] = useState<string[]>([]);
  const [view, setView] = useState<"reharm" | "original">("reharm");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pathway = useMemo(
    () => buildPathway(accepted, level, forced.map((id) => accepted.find((m) => m.id === id)).filter((m): m is ReharmMove => !!m)),
    [accepted, level, forced],
  );
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
  const setMode = (m: AppMode) => {
    setModeState(m);
    try {
      localStorage.setItem("reharm.mode", m);
    } catch {
      /* storage unavailable: mode just won't persist */
    }
  };
  const [coachOpen, setCoachOpen] = useState(false);
  const openCoach = (id?: string) => {
    if (id) setSelectedId(id);
    if (id || selected) setCoachOpen(true);
  };

  // a new tune resets everything that belonged to the old one
  useEffect(() => {
    setForced([]);
    setSelectedId(null);
    setTempo(tune.tempo);
    setLoopSelection(false);
    setCoachOpen(false);
  }, [tune]);

  if (mode === "practice") {
    return (
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
      />
    );
  }

  return (
    <div className="flex min-h-screen text-ink">
      <SketchFilters />
      <SideRail playing={playback.status === "playing"} onPlay={playback.toggle} onPractice={() => openCoach()} onLibrary={DEMO ? undefined : () => setLibraryOpen(true)} />
      {libraryOpen && !DEMO &&<LibraryDrawer currentId={tune.id} onLoad={loadTune} onClose={() => setLibraryOpen(false)} />}
      {coachOpen && selected && (
        <CompingCoach tune={tune} move={selected} midiStatus={midi.status} onConnectMidi={midi.connect} onClose={() => setCoachOpen(false)} />
      )}

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 md:px-8 md:py-8">
        {/* ── banner ── */}
        <SketchBox seed={11} strokeWidth={2} fill={paper.light} className="mb-5">
          <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8 md:py-5">
            <div>
              <h1 className="ink-wobble font-marker text-3xl font-bold uppercase leading-none tracking-wide md:text-5xl">{tune.title}</h1>
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
            <ModeSwitch mode="study" onMode={setMode} />
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
            <SketchBox seed={21} strokeWidth={1.8}>
              <div className="p-4 md:p-6">
                <h2 id="lead-sheet-h" className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
                  Lead sheet
                </h2>
                <div className="mt-3">
                  <TransportBar
                    status={playback.status}
                    source={playback.source}
                    onToggle={playback.toggle}
                    tempo={tempo}
                    onTempo={setTempo}
                    loopSelection={loopSelection}
                    onLoopSelection={setLoopSelection}
                    canLoopSelection={!!selected}
                    midi={midi}
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
              <ImprovHeatmap key={tune.id} tune={tune} chords={shownChords} loop={loop} playing={playback.status === "playing"} />
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
                onPractice={() => openCoach(m.id)}
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
