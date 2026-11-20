import {
  conceptKind,
  editorPathway,
  editorPicks,
  liveChordCursor,
  placeChordCursor,
  stepChord,
  type ChordCursor,
  chroma,
  transposeTune,
  densityLabel,
  formBars,
  generateMoves,
  KEYS,
  improvMap,
  overlaps,
  prettyNote,
  prettySymbol,
  realize,
  referenceTune,
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
import { APP_MODES, ModeSwitch, type AppMode } from "./components/ModeSwitch";
import { ImprovHeatmap } from "./components/practice/ImprovHeatmap";
import { lazyWithPreload, whenIdle } from "./lazy";
import { PanelBoundary } from "./components/PanelBoundary";
import type { PractiseRequest } from "./components/progress/PracticeDashboard";
import { useMidi } from "./midi/useMidi";
import { KeyPicker } from "./components/KeyPicker";
import { LeadSheet } from "./components/LeadSheet";
import { LevelDial } from "./components/LevelDial";
import { OriginalStamp } from "./components/OriginalStamp";
import { usePedalLevel } from "./midi/pedal";
import { usePathwayEditor } from "./usePathwayEditor";
import { MoveCard } from "./components/MoveCard";
import { ChordMoveSelector } from "./components/ChordMoveSelector";
import { ChordFactsCard } from "./components/ChordFactsCard";
import { Reveal, useRevealState } from "./components/Reveal";
import { countOpen } from "./usage/panelOpens";
import { SideRail } from "./components/SideRail";
import { useNarrow } from "./device/media";
import { useWakeLock } from "./device/wakeLock";
import { SketchBox, SketchFilters, SketchRule } from "./design/rough";
import { CATEGORY_LABEL, CATEGORY_WASH, paper, seedOf } from "./design/tokens";
import { readDeepLink, writeDeepLink, type DeepLink } from "./deepLink";
import { PlayPrompt } from "./components/PlayPrompt";
import { Kbd, ShortcutsHelp, STUDY_SHORTCUTS } from "./components/Shortcuts";
import { useStudyKeys } from "./studyKeys";
import { useQwerty } from "./midi/qwerty";
import { useTouchFirst } from "./device/media";

// Split out of the main bundle: each is only needed after a click (or on a return visit
// straight into Practice Mode), and all three are prefetched once the page is idle.
const LibraryDrawer = lazyWithPreload(() => import("./components/library/LibraryDrawer").then((m) => m.LibraryDrawer));
const CoachPage = lazyWithPreload(() => import("./components/coach/CoachPage").then((m) => m.CoachPage));
const ChangesPage = lazyWithPreload(() => import("./components/changes/ChangesPage").then((m) => m.ChangesPage));
const VoicingsPage = lazyWithPreload(() => import("./components/voicings/VoicingsPage").then((m) => m.VoicingsPage));
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
  const [baseTune, setTune] = useState<Tune>(referenceTune);
  // ── a deep link (`?tune=…&key=Bb&level=3&play=1`) ──
  // `initialLink` is what the page was opened with; `pendingLink` is that link until it has
  // been applied to its tune (which may still be loading), then null. Until then the address
  // bar is left alone, so a reload mid-load still has the link.
  const [initialLink] = useState<DeepLink | null>(() => readDeepLink(window.location.search));
  const [pendingLink, setPendingLink] = useState<DeepLink | null>(initialLink);
  const [keyTonic, setKeyTonic] = useState<string | null>(() => store.get(KEY_PREFIX + referenceTune.id));
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
    const t = id === referenceTune.id ? referenceTune : await fetchTune(id);
    setTune(t);
    store.set(LAST_TUNE, id);
    store.set(LAST_TITLE, t.title);
  }, []);
  const backToReference = useCallback((note: string) => {
    setTune(referenceTune);
    store.set(LAST_TUNE, referenceTune.id);
    store.set(LAST_TITLE, referenceTune.title);
    toast(note, { tone: "warn" });
  }, []);

  // Open the tune a link names, or else reopen the one that was on the stand last time.
  // (A link without `tune` means the reference tune.)
  useEffect(() => {
    const last = initialLink ? (initialLink.tune ?? referenceTune.id) : store.get(LAST_TUNE);
    const lastTitle = initialLink ? null : store.get(LAST_TITLE);
    if (!last || last === referenceTune.id) return;
    let live = true; // false once this effect is cleaned up (StrictMode runs it twice in dev)
    let cancelRetry = () => {};
    const restore = () =>
      loadTune(last).catch(async (err) => {
        if (!live) return;
        if (err instanceof LibraryError && err.status === 404) {
          setPendingLink(null);
          backToReference(
            initialLink
              ? `That link is to a tune that isn't in ${DEMO ? "the demo library" : "your library"} (“${last}”), so here's ${referenceTune.title} instead.`
              : `${lastTitle ? `“${lastTitle}”` : "The tune you had open"} is no longer in your library, so here's ${referenceTune.title} instead.`,
          );
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
  }, [loadTune, backToReference, initialLink]);
  const bars = formBars(tune);

  const { accepted, rejected } = useMemo(() => generateMoves(tune), [tune]);

  // The dial, your picks, the chords you keep and the open move; the rules are theory-core's `editPathway`.
  const [editor, edit] = usePathwayEditor(accepted);
  const { level, picks: forced, kept, selectedId } = editor;
  const [view, setView] = useState<"reharm" | "original">("reharm");

  const forcedMoves = useMemo(() => editorPicks(editor, accepted), [accepted, editor]);
  const pathway = useMemo(() => editorPathway(editor, accepted), [accepted, editor]);
  const realized = useMemo(() => realize(tune, pathway), [tune, pathway]);
  const original = useMemo(() => sortedHarmony(tune), [tune]);
  const shownChords = view === "reharm" ? realized : original;
  const improv = useMemo(() => improvMap(tune, shownChords), [tune, shownChords]);

  /** The written chord a move resolves into (the engine's `targetSymbol`): its Before / After both land there. */
  const targetOf = (m: ReharmMove) => {
    if (!m.targetSymbol) return undefined;
    const i = original.findIndex((c) => c.id === m.replaces[m.replaces.length - 1]);
    return i >= 0 ? original[i + 1] : undefined;
  };

  const selected = pathway.find((m) => m.id === selectedId) ?? pathway[0] ?? null;
  const improvForSelected = selected
    ? improv.filter((e) =>
        view === "reharm" ? selected.chords.some((c) => c.id === e.chord.id) : selected.replaces.includes(e.chord.id),
      )
    : improv.slice(0, 2);

  const changeLevel = (l: number) => edit({ type: "dial", level: l });
  // A linked pedal or mod wheel moves only the dial and keeps your choices. The new pathway
  // reaches the band on the next beat, like any other dial change.
  usePedalLevel((l) => edit({ type: "pedal", level: l }));
  /**
   * Open a move (a wash, a move card, ← →, a deep link…). That hands the right panel back to the
   * move, so the chord cursor is dropped: otherwise re-opening the move that stayed open under a
   * bare chord changes nothing and the chord's card keeps sitting on top of it.
   */
  const setSelectedId = (id: string | null) => {
    setChordCursor(null);
    edit({ type: "select", id });
  };
  const pick = (alt: ReharmMove) => edit({ type: "pick", id: alt.id });
  // Chord by chord: keep one chord as written, or hand it back to the dial
  const keepChord = (chordId: string) => edit({ type: "keep", chordId });
  const dialChord = (chordId: string) => edit({ type: "release", chordId });
  // The chord cursor (⇧ ← →): walks the tune's own changes, opening the move over each one
  // (theory-core's `stepChord`). It goes stale on its own once another move is opened.
  const [chordCursor, setChordCursor] = useState<ChordCursor | null>(null);
  const [chordTick, setChordTick] = useState(0);
  const cursorChordId = liveChordCursor(chordCursor, original, selectedId)?.chordId ?? null;
  // Study's secondary panels fold away (one click each); see Reveal for why folded means unmounted
  const [chordsOpen, setChordsOpen] = useRevealState("study.chordByChord");
  const [soloOpen, setSoloOpen] = useRevealState("study.solo");
  const [rejectedOpen, setRejectedOpen] = useRevealState("study.rejected");
  const [hintSeen, setHintSeen] = useRevealState("hint.study");
  const stepChordBy = (dir: 1 | -1) => {
    const next = stepChord(original, pathway, chordCursor, selectedId, dir);
    if (!next) return;
    if (!chordsOpen) setChordsOpen(true); // stepping lands focus on the chord's row, so the list must be there
    setChordCursor(next);
    setChordTick((t) => t + 1);
    setCursorFollow(true);
    if (next.moveId !== selectedId) edit({ type: "select", id: next.moveId });
  };
  /** Stepping moves focus to the chord's row in Chord by chord; a click leaves focus and scroll where they are. */
  const [cursorFollow, setCursorFollow] = useState(true);
  /** A click on a chord (its symbol on the lead sheet, or its name in Chord by chord): the cursor goes there. */
  const goToChord = (chordId: string) => {
    const next = placeChordCursor(original, pathway, chordId, selectedId);
    if (!next) return; // a reharm chord: it sits inside a wash, which opens its move
    setChordCursor(next);
    setChordTick((t) => t + 1);
    setCursorFollow(false);
    if (next.moveId !== selectedId) edit({ type: "select", id: next.moveId });
  };
  // The cursor on a chord the reharm leaves alone: the right panel shows that chord, not the old move.
  const improvOriginal = useMemo(() => improvMap(tune, original), [tune, original]);
  const bareChord =
    cursorChordId && !pathway.some((m) => m.replaces.includes(cursorChordId)) ? (original.find((c) => c.id === cursorChordId) ?? null) : null;
  const bareFacts = bareChord && (
    <ChordFactsCard chord={bareChord} entry={improvOriginal.find((e) => e.chord.id === bareChord.id)} />
  );

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
  // the phone on the music stand mustn't sleep mid-chorus (any mode: Study, Practice, Coach)
  useWakeLock(playback.status === "playing");
  const narrow = useNarrow();
  const midi = useMidi();
  const [mode, setModeState] = useState<AppMode>(() => {
    try {
      const saved = localStorage.getItem("reharm.mode");
      // a link opens on the lead sheet (Practice, if that's where you were, shows it too)
      if (initialLink && saved !== "practice") return "study";
      // anything unknown (an old build's value, a typo) falls back to Study
      return (APP_MODES as readonly string[]).includes(saved ?? "") ? (saved as AppMode) : "study";
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
    if (m === "coach") await CoachPage.preload().catch(() => {});
    if (m === "changes") await ChangesPage.preload().catch(() => {});
    if (m === "voicings") await VoicingsPage.preload().catch(() => {});
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
  /** A Changes review picked in the passport: the game opens ready to play it. */
  const [changesReview, setChangesReview] = useState<{ ruleId: string; keyTonic: string } | null>(null);
  const [shapeReview, setShapeReview] = useState<{ ruleId: string; keyTonic: string } | null>(null);
  const [xrayOpen, setXrayOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  // drawer opens from a click are tallied (this browser only) alongside the folded panels
  const openDrawer = (name: "setlist" | "progress" | "xray") => {
    countOpen(`drawer.${name}`);
    ({ setlist: setLibraryOpen, progress: setPassportOpen, xray: setXrayOpen })[name](true);
  };
  // The Coach page opens on a specific tune move or directly on a 12-key concept drill.
  const [coachTarget, setCoachTarget] = useState<{
    moveId: string | null;
    ruleId?: string | null;
    key?: string;
    scope?: "concept" | "tune";
  } | null>(null);
  const openCoach = (id?: string) => {
    const targetMoveId = id ?? selected?.id ?? null;
    if (id) setSelectedId(id);
    const targetMove = accepted.find((m) => m.id === targetMoveId);
    setCoachTarget({
      moveId: targetMoveId,
      ruleId: targetMove?.ruleId ?? null,
      scope: targetMove ? "tune" : "concept",
    });
    void setMode("coach");
  };

  /**
   * "Practise →" from the passport or due queue: route directly to the 12-Key Concept Drill
   * screen for that rule and key without failing if the current tune has no spot for it.
   */
  const practiseConcept = (r: PractiseRequest) => {
    setPassportOpen(false);
    // the Changes game's reviews are played in the Changes tab, at Open, starting in that key
    const kind = conceptKind(r.ruleId);
    if (kind === "ear") {
      setChangesReview({ ruleId: r.ruleId, keyTonic: r.keyTonic });
      void setMode("changes");
      return;
    }
    // a voicing shape opens the Voicings tab on that chord, in that key, in that family
    if (kind === "shape") {
      setShapeReview({ ruleId: r.ruleId, keyTonic: r.keyTonic });
      void setMode("voicings");
      return;
    }
    const matchingMove =
      (r.lastPlace?.tuneId === baseTune.id && accepted.find((m) => m.id === r.lastPlace?.moveId)) ||
      accepted.find((m) => m.ruleId === r.ruleId) ||
      null;
    if (matchingMove) setSelectedId(matchingMove.id);
    setCoachTarget({
      moveId: matchingMove?.id ?? null,
      ruleId: r.ruleId,
      key: r.keyTonic,
      scope: "concept",
    });
    void setMode("coach");
  };
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
      void CoachPage.preload().catch(() => {});
      void LibraryDrawer.preload().catch(() => {});
    });
  }, []);

  // A new tune resets everything that belonged to the old one. A key change doesn't: move
  // ids are positional, so your picks, the selected move and the loop all carry across keys.
  useEffect(() => {
    edit({ type: "newTune" });
    setTempo(baseTune.tempo);
    setLoopSelection(false);
  }, [baseTune, edit]);

  // Apply a link once its tune is on the stand. Declared after the resets above so its state
  // lands last. Applying is idempotent (StrictMode re-runs it with the same link). The key
  // isn't saved as "the key you last played this in": opening a link doesn't change that.
  const [playPrompt, setPlayPrompt] = useState(false);
  useEffect(() => {
    const l = pendingLink;
    if (!l || baseTune.id !== (l.tune ?? referenceTune.id)) return;
    if (l.key) setKeyTonic(chroma(l.key) === chroma(baseTune.key.tonic) ? null : l.key);
    edit({ type: "link", level: l.level, picks: l.picks, keep: l.keep, move: l.move });
    if (l.tempo) setTempo(l.tempo);
    if (l.play) setPlayPrompt(true);
    setPendingLink(null);
  }, [baseTune, pendingLink, edit]);

  /** This reharm as a link: tune, key, dial, picks, the open move and a non-default tempo. */
  const linkState = useMemo(
    (): Partial<DeepLink> => ({
      tune: baseTune.id,
      key: keyTonic ?? undefined,
      level,
      move: selectedId ?? undefined,
      picks: forced,
      keep: kept,
      tempo: tempo !== baseTune.tempo ? tempo : undefined,
    }),
    [baseTune, keyTonic, level, selectedId, forced, kept, tempo],
  );
  // The address bar always holds the reharm on the stand, so copying it shares it. Debounced:
  // a tempo drag would otherwise hit the browser's replaceState rate limit (Safari throws).
  useEffect(() => {
    if (pendingLink) return;
    const t = setTimeout(() => {
      const { pathname, search, hash } = window.location;
      const next = writeDeepLink(linkState);
      if (next === search) return;
      try {
        window.history.replaceState(window.history.state, "", pathname + next + hash);
      } catch {
        /* rate-limited: the next change writes it */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [linkState, pendingLink]);
  const shareLink = async () => {
    const { origin, pathname } = window.location;
    const url = origin + pathname + writeDeepLink({ ...linkState, play: true });
    try {
      await navigator.clipboard.writeText(url);
      toast(`Link copied: it opens ${tune.title} on level ${level}${keyTonic ? ` in ${prettyNote(tune.key.tonic)}` : ""}${forced.length || kept.length ? " with your picks" : ""}, ready to play.`);
    } catch {
      toast(`Couldn't reach the clipboard. The address bar has the same link.`, { tone: "warn" });
    }
  };
  const playFromLink = () => {
    setPlayPrompt(false);
    void playback.play();
  };
  // ── Study shortcuts (Practice Mode has its own) ──
  const [helpOpen, setHelpOpen] = useState(false);
  const qwertyKeys = useQwerty();
  const touchFirst = useTouchFirst();
  const byPosition = useMemo(
    () => [...pathway].sort((a, b) => a.span.from.bar - b.span.from.bar || a.span.from.beat - b.span.from.beat),
    [pathway],
  );
  useStudyKeys(mode === "study" && !libraryOpen && !passportOpen && !xrayOpen && !playPrompt && !helpOpen, {
    toggle: () => void playback.toggle(),
    step: (dir) => {
      if (byPosition.length === 0) return;
      const i = selected ? byPosition.findIndex((m) => m.id === selected.id) : -1;
      const next = byPosition[Math.min(byPosition.length - 1, Math.max(0, i + dir))];
      setSelectedId(next.id);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector(`[data-move-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    },
    chord: stepChordBy,
    dial: (dir) => changeLevel(Math.min(4, Math.max(0, level + dir))),
    flipView: () => setView((v) => (v === "reharm" ? "original" : "reharm")),
    loop: () => selected && setLoopSelection((l) => !l),
    tempo: (dir) => setTempo((t) => Math.min(260, Math.max(60, t + dir * 4))),
    key: (dir) => changeKey(KEYS.find((k) => chroma(k) === (chroma(tune.key.tonic) + (dir === 1 ? 1 : 11)) % 12)!),
    help: () => setHelpOpen(true),
  });

  const playPromptView = playPrompt && (
    <PlayPrompt
      title={tune.title}
      detail={[level === 0 ? "As written" : `Level ${level}`, `in ${prettyNote(tune.key.tonic)}${tune.key.mode === "minor" ? " minor" : ""}`, `${tempo} bpm`].join(" · ")}
      onPlay={playFromLink}
      onClose={() => setPlayPrompt(false)}
    />
  );

  const keyControl = { tonic: tune.key.tonic, original: baseTune.key.tonic, mode: tune.key.mode, onChange: changeKey };

  // The band belongs to Study and Practice (the lead sheet's two screens). Every other tab (Coach,
  // Changes, Voicings) plays its own chords, so a band carrying on underneath would clash: it stops on
  // the way in (it doesn't restart on the way out; Play is one tap away). A band still in its count-in
  // ("loading") is caught when it turns "playing".
  const { status: bandStatus, toggle: toggleBand } = playback;
  useEffect(() => {
    if (mode !== "study" && mode !== "practice" && bandStatus === "playing") toggleBand();
  }, [mode, bandStatus, toggleBand]);

  if (mode === "voicings") {
    return (
      <Suspense fallback={<Inking label="Laying out the shapes" />}>
        <Toaster />
        <PanelBoundary onClose={() => void setMode("study")}>
          <VoicingsPage key={shapeReview ? `${shapeReview.ruleId}@${shapeReview.keyTonic}` : "voicings"} midi={midi} onMode={setMode} review={shapeReview} tune={tune} onOpenReference={() => void loadTune(referenceTune.id)} />
        </PanelBoundary>
      </Suspense>
    );
  }

  if (mode === "changes") {
    return (
      <Suspense fallback={<Inking label="Opening the changes" />}>
        <Toaster />
        <PanelBoundary onClose={() => void setMode("study")}>
          <ChangesPage key={changesReview ? `${changesReview.ruleId}@${changesReview.keyTonic}` : "changes"} midi={midi} onMode={setMode} review={changesReview} />
        </PanelBoundary>
      </Suspense>
    );
  }

  if (mode === "coach") {
    return (
      <Suspense fallback={<Inking label="Opening the Coach" />}>
        <Toaster />
        <PanelBoundary onClose={() => void setMode("study")}>
          <CoachPage
            key={`${baseTune.id}:${coachTarget?.scope ?? ""}:${coachTarget?.ruleId ?? ""}:${coachTarget?.moveId ?? ""}:${coachTarget?.key ?? ""}`}
            tune={tune}
            accepted={accepted}
            pathway={pathway}
            initial={{
              moveId: coachTarget?.moveId ?? selected?.id ?? null,
              ruleId: coachTarget?.ruleId ?? selected?.ruleId ?? null,
              key: coachTarget?.key,
              scope: coachTarget?.scope,
            }}
            midi={midi}
            onMode={setMode}
            onPractise={(r) => practiseConcept(r)}
          />
        </PanelBoundary>
      </Suspense>
    );
  }

  if (mode === "practice") {
    return (
      <Suspense fallback={<Inking label="Setting up the practice room" />}>
        <Toaster />
        {playPromptView}
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
      {playPromptView}
      {helpOpen && <ShortcutsHelp title="Study shortcuts" shortcuts={STUDY_SHORTCUTS} qwertyOn={qwertyKeys.enabled} onClose={() => setHelpOpen(false)} />}
      <SideRail
        playing={playback.status === "playing"}
        onPlay={playback.toggle}
        onPractice={() => openCoach()}
        onLibrary={() => openDrawer("setlist")}
        onProgress={() => openDrawer("progress")}
      />
      <Suspense fallback={<Inking label="Opening the drawer" />}>
      {libraryOpen && (
        <PanelBoundary onClose={() => setLibraryOpen(false)}>
        <LibraryDrawer
          currentId={baseTune.id}
          onLoad={loadTune}
          onClose={() => setLibraryOpen(false)}
          onDeleted={(id, title) => {
            if (id === baseTune.id) backToReference(`Deleted “${title}”, which was on the stand, so here's ${referenceTune.title}.`);
          }}
        />
        </PanelBoundary>
      )}
      {passportOpen && (
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
          kept={kept}
          playheadBar={playback.status === "playing" ? (playback.position?.bar ?? null) : null}
          startBar={selected?.span.from.bar ?? 1}
          onClose={() => setXrayOpen(false)}
        />
        </PanelBoundary>
      )}
      </Suspense>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 sm:px-4 sm:py-5 md:px-8 md:py-8">
        <OfflineBanner />
        {/* ── banner ── */}
        <SketchBox seed={11} strokeWidth={2} fill={paper.light} className="mb-5">
          <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4 md:px-8 md:py-5">
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
            <div className="ink-wobble hidden text-right font-marker font-bold uppercase leading-[0.9] text-ink-soft sm:block">
              <div className="text-2xl md:text-3xl">Reharm</div>
              <div className="text-2xl text-ink md:text-3xl">Lab</div>
            </div>
          </header>
        </SketchBox>

        {/* ── toolbar ── */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {DEMO && (
              <span
                className="-rotate-2 rounded border-2 border-dashed px-2 font-marker text-sm"
                style={{ borderColor: pen.red, color: pen.red }}
                title="No account and no server: your practice is saved in this browser, and the setlist is a fixed demo library."
              >
                Demo · saves in this browser
              </span>
            )}
            <button
              type="button"
              onClick={() => openDrawer("setlist")}
              onPointerEnter={() => void LibraryDrawer.preload().catch(() => {})}
              className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:-rotate-1 hover:bg-paper-shade"
            >
              📚 Setlist
            </button>
            <button
              type="button"
              onClick={() => openDrawer("progress")}
              onPointerEnter={() => void PracticeDashboard.preload().catch(() => {})}
              className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:-rotate-1 hover:bg-paper-shade"
            >
              📒 Progress
            </button>
            <ModeSwitch mode="study" onMode={setMode} />
            <button
              type="button"
              onClick={() => openDrawer("xray")}
              onPointerEnter={() => void EngineXRay.preload().catch(() => {})}
              className="cursor-pointer rounded-full border-2 border-dashed border-ink px-3 py-0.5 font-marker hover:-rotate-1 hover:bg-paper-shade"
              title="See how the engine decided, bar by bar, and run its proofs live"
            >
              🔬 Engine X-ray
            </button>
            <button
              type="button"
              onClick={() => void shareLink()}
              className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:-rotate-1 hover:bg-paper-shade"
              title="Copy a link to this reharm: the tune, key, dial level and your picks. It opens ready to play."
            >
              🔗 Share
            </button>
            {!touchFirst && (
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="cursor-pointer rounded-full border-2 border-dashed border-ink-faint px-2.5 py-0.5 font-marker text-sm text-ink-soft hover:border-ink hover:text-ink"
                title="Keyboard shortcuts"
                aria-label="Keyboard shortcuts"
              >
                ⌨ <Kbd k="?" />
              </button>
            )}
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
              <div className="p-3 sm:p-4 md:p-6">
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
                {/* phones get two bars a line rather than a sideways-scrolling page */}
                <div className="mt-2">
                  <div>
                    <LeadSheet
                      perSystem={narrow ? 2 : 4}
                      tune={tune}
                      chords={shownChords}
                      moves={pathway}
                      selectedId={selected?.id}
                      onSelect={setSelectedId}
                      showWashes={view === "reharm"}
                      playhead={playback.position}
                      loopBars={playback.status === "playing" || loopSelection ? loop : null}
                      lastBar={bars}
                      activeChordId={cursorChordId}
                      onChord={goToChord}
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
                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                  <p className="min-w-[16rem] flex-1 text-xs text-ink-faint">
                    {tune.melodyCoverage === "anchors"
                      ? "Melody: only a few anchor notes are entered. Slashes mean no melody yet. "
                      : tune.melodyCoverage === "none"
                        ? tune.rights?.kind === "public-domain"
                          ? `${tune.rights.note} No melody, so moves aren't melody-checked. `
                          : "No melody on this chart (iReal charts carry chords only), so moves aren't melody-checked. "
                        : ""}
                    {!hintSeen && (
                      <>
                        Click a coloured wash to open its move. Flip Original/Reharm or turn the dial while it plays: the chords swap in on the next beat.{" "}
                        <button
                          type="button"
                          onClick={() => setHintSeen(true)}
                          className="cursor-pointer underline decoration-dotted hover:text-ink"
                          aria-label="Dismiss this tip"
                        >
                          Got it
                        </button>
                      </>
                    )}
                  </p>
                  {tune.rights?.kind === "original" && <OriginalStamp rights={tune.rights} className="ml-auto" />}
                </div>
              </div>
            </SketchBox>

            {accepted.length > 0 && (
              <Reveal label="Edit chord by chord" open={chordsOpen} onToggle={setChordsOpen} className="mt-6">
              <SketchBox seed={seedOf("chord-by-chord")} fill={paper.light} className="mt-3">
                <div className="p-3 sm:p-4">
                  <ChordMoveSelector
                    chords={original}
                    accepted={accepted}
                    pathway={pathway}
                    forcedIds={forced}
                    keptIds={kept}
                    level={level}
                    selectedId={selected?.id}
                    onPick={pick}
                    onKeep={keepChord}
                    onDial={dialChord}
                    onSelect={setSelectedId}
                    cursorChordId={cursorChordId}
                    cursorTick={chordTick}
                    onStepChord={stepChordBy}
                    onGoToChord={goToChord}
                    cursorFollow={cursorFollow}
                  />
                </div>
              </SketchBox>
              </Reveal>
            )}

            <Reveal label="🎹 Solo over it" open={soloOpen} onToggle={setSoloOpen} className="mt-4">
              {/* the scale card is for soloing, so it waits in here with the heatmap rather than crowding first load */}
              {!bareFacts && selected && improvForSelected.length > 0 && (
                <div className="mt-3">
                  <ImprovCard entries={improvForSelected} title={`bar ${selected.span.from.bar}${view === "original" ? " (original)" : ""}`} />
                </div>
              )}
              <div className="mt-3">
                <ImprovHeatmap
                  key={tune.id}
                  tune={tune}
                  chords={shownChords}
                  loop={loop}
                  playing={playback.status === "playing"}
                  level={level}
                  view={view}
                  trading={false}
                  mixer={false}
                />
              </div>
            </Reveal>

            {bareFacts && <div className="mt-6 lg:hidden">{bareFacts}</div>}
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

            {bareFacts && <div className="hidden lg:block">{bareFacts}</div>}

            {pathway.length === 0 && (
              <p className="text-ink-soft">Level 0 shows the tune as written. Turn the dial up to let the engine reharmonize.</p>
            )}

            {pathway.map((m) => (
              <MoveCard
                key={m.id}
                tuneId={tune.id}
                move={m}
                target={targetOf(m)}
                selected={m.id === selected?.id}
                onSelect={() => setSelectedId(m.id)}
                onPick={pick}
                onPractice={() => practiceMove(m.id)}
                onDrill={() => openCoach(m.id)}
                alternatives={accepted.filter((a) => a.id !== m.id && overlaps(a, m))}
              />
            ))}

            {rejected.length > 0 && (
              <Reveal
                label={`${rejected.length} considered & rejected`}
                open={rejectedOpen}
                onToggle={setRejectedOpen}
              >
              <SketchBox seed={seedOf("rejected")} className="mt-3 text-ink opacity-80">
                <section className="p-4 text-sm">
                  <h3 className="sr-only">Considered &amp; rejected</h3>
                  <ul className="space-y-1">
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
              </Reveal>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
