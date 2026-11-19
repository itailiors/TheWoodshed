import {
  absBeat,
  chordAtBeat,
  chroma,
  evaluateLineNote,
  IMPROV_LENSES,
  improvLens,
  melodyIn,
  pitchClass,
  prettyNote,
  prettySymbol,
  spellMidi,
  symbol,
  upperPitchClasses,
  voiceProgression,
  type ChordEvent,
  type ImprovEntry,
  type ImprovLens,
  type LineNoteEval,
  type Tune,
} from "@reharm/theory-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { player } from "../../audio/player";
import type { Playback } from "../../audio/usePlayback";
import { useMediaQuery, NARROW } from "../../device/media";
import { ink, pen, VERDICT_COLOR, wash } from "../../design/tokens";
import { noteBus, useNoteBus } from "../../midi/noteBus";
import { BeatPulse, CountInDisplay } from "../BeatPulse";
import { ChordName } from "../ChordName";
import { DoodleKeyboard } from "../DoodleKeyboard";
import { notForUs } from "../Shortcuts";
import { ImprovKeyboard, PLAYED } from "./ImprovKeyboard";

interface Props {
  tune: Tune;
  chords: ChordEvent[];
  /** Practice's improv map, by chord id (for stepping through the chords). */
  entries: Map<string, ImprovEntry>;
  loop: { startBar: number; endBar: number };
  now: ImprovEntry | null;
  next: ImprovEntry | null;
  beatsToNext: number | null;
  playback: Playback;
  /** The key the tune is in right now: the Blues lens builds its scale here. */
  keyTonic: string;
  onClose: () => void;
}

const LENS_KEY = "reharm.improvView";
const OCT_KEY = "reharm.improvOctaves";
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
};
const isLens = (v: string | null): v is ImprovLens => IMPROV_LENSES.some((l) => l.id === v);

/**
 * Improv mode: Practice with everything but the chord and the piano taken away. The chord under
 * the playhead written big, what you can play over it marked on a real keyboard (through one of
 * four lenses), the next chord in the corner with its landing notes dashed on the last beat,
 * and the notes you play lit as you play them. A full-window overlay (plus the Fullscreen API
 * where the browser has it); the Practice page, its heatmap included, keeps running underneath.
 */
export function ImprovMode({ tune, chords, entries, loop, now: liveNow, next: liveNext, beatsToNext, playback, keyTonic, onClose }: Props) {
  const bpb = tune.meter[0];
  const playing = playback.status === "playing";

  // ── stepping chord by chord (band stopped): look at each one, try it, move on ──
  const loopStart = (loop.startBar - 1) * bpb;
  const loopEnd = loop.endBar * bpb;
  const loopChords = useMemo(
    () =>
      chords.filter((c, i) => {
        const end = chords[i + 1] ? absBeat(chords[i + 1].at, bpb) : Infinity;
        return absBeat(c.at, bpb) < loopEnd && end > loopStart;
      }),
    [chords, bpb, loopStart, loopEnd],
  );
  const [browse, setBrowse] = useState<number | null>(null);
  useEffect(() => {
    if (playing) setBrowse(null); // Play hands the view back to the playhead
  }, [playing]);
  const step = (d: 1 | -1) => {
    const n = loopChords.length;
    if (!n) return;
    if (playing) playback.toggle();
    setBrowse((cur) => {
      const from = cur ?? Math.max(0, loopChords.findIndex((c) => c.id === liveNow?.chord.id));
      return (from + d + n) % n;
    });
  };
  const stepRef = useRef(step);
  stepRef.current = step;
  const browsed = browse !== null ? loopChords[browse] : null;
  const now = browsed ? (entries.get(browsed.id) ?? null) : liveNow;
  const next = browsed ? (entries.get(loopChords[(browse! + 1) % loopChords.length].id) ?? null) : liveNext;
  // a phone, upright or on its side
  const cramped = useMediaQuery(`${NARROW}, (max-height: 520px)`);
  const sideways = useMediaQuery("(max-height: 520px) and (orientation: landscape)");
  const upright = useMediaQuery(`${NARROW} and (orientation: portrait)`);

  const [lens, setLensState] = useState<ImprovLens>(() => {
    const v = read(LENS_KEY);
    return isLens(v) ? v : "full";
  });
  const setLens = (l: ImprovLens) => {
    setLensState(l);
    write(LENS_KEY, l);
  };
  const [phoneOctaves, setPhoneOctavesState] = useState<2 | 3>(() => (read(OCT_KEY) === "3" ? 3 : 2));
  const setPhoneOctaves = (n: 2 | 3) => {
    setPhoneOctavesState(n);
    write(OCT_KEY, String(n));
  };
  // the blues scale marks 6 notes plus the chord's 3rd and 7th: on a phone that only reads over 2 octaves
  const octaves = cramped ? (lens === "blues" ? 2 : phoneOctaves) : 3;
  const low = octaves === 3 ? 48 : 60;
  const high = 84;

  const view = useMemo(() => (now ? improvLens(now, lens, keyTonic) : null), [now, lens, keyTonic]);
  const imminent = playing && beatsToNext !== null && beatsToNext <= 1;
  // while stepping there's time to look: the landing notes stay up
  const aim = (imminent || browsed) && now && next ? now.targets.map((t) => t.to) : [];

  // ── ← → step chords here (taken before Practice, where they turn the dial) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (notForUs(e) || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      e.preventDefault();
      e.stopPropagation();
      stepRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  // ── V cycles the lens (Esc and F are Practice's: they close this) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (notForUs(e) || (e.key !== "v" && e.key !== "V")) return;
      setLensState((cur) => {
        const next = IMPROV_LENSES[(IMPROV_LENSES.findIndex((l) => l.id === cur) + 1) % IMPROV_LENSES.length].id;
        write(LENS_KEY, next);
        return next;
      });
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── real fullscreen where the browser allows it; the overlay already fills the window ──
  useEffect(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // ── the notes you play, judged against the chord sounding when you struck them ──
  const [held, setHeld] = useState(() => new Map<number, LineNoteEval["verdict"]>());
  const nowRef = useRef(now);
  nowRef.current = now;
  useNoteBus((m) => {
    if (m.type === "off") {
      setHeld((h) => {
        if (!h.has(m.note)) return h;
        const n = new Map(h);
        n.delete(m.note);
        return n;
      });
      return;
    }
    const beat = player.currentBeat();
    const at = beat !== null ? chordAtBeat(chords, beat, bpb) : nowRef.current ? { chord: nowRef.current.chord, next: nowRef.current.next } : null;
    if (!at) return;
    const mel = beat !== null ? melodyIn(tune, beat, beat + 0.01).map((n) => pitchClass(n.pitch)) : [];
    const { verdict } = evaluateLineNote(m.note, at.chord, at.next, mel);
    setHeld((h) => new Map(h).set(m.note, verdict));
  });

  // on-screen keys go through the same bus as MIDI and QWERTY
  const emit = (type: "on" | "off", note: number) => {
    if (type === "on") void player.noteOn(note);
    else player.noteOff(note);
    noteBus.emit({ type, note, velocity: 80, source: "virtual" });
  };

  // ── "how to play it": the voicing the band's piano comps with (same voice leading as engine.ts) ──
  const [showVoicing, setShowVoicing] = useState(false);
  const voicings = useMemo(() => {
    const vs = voiceProgression(chords);
    return new Map(chords.map((c, i) => [c.id, vs[i]]));
  }, [chords]);
  const voicing = now ? voicings.get(now.chord.id) : undefined;
  const rh = useMemo(() => {
    if (!now || !voicing) return [];
    const names = upperPitchClasses(now.chord, 5);
    return voicing.upper.map((m) => {
      const pc = names.find((n) => (((m - chroma(n)) % 12) + 12) % 12 === 0);
      return pc ? spellMidi(pc, m) : String(m);
    });
  }, [now, voicing]);
  const lh = now && voicing ? spellMidi(pitchClass(now.chord.bass ?? now.chord.root), voicing.bass) : null;

  const top = now?.scales[0];
  const chordPanel = (
    // Three columns with the chord in the middle one, so opening the voicing (right column) never
    // pushes the chord off centre. A phone stacks them, the voicing under the chord.
    <div
      className={`relative grid min-h-0 w-full items-center gap-x-8 gap-y-3 text-center ${
        cramped ? "grid-cols-1 justify-items-center" : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      }`}
    >
      {now ? (
        <div key={now.chord.id} className={`animate-ink-in ${cramped ? "" : "col-start-2"}`}>
          <p className="font-marker text-xs uppercase tracking-[0.25em] text-ink-soft sm:text-sm">
            {playing
              ? "Now"
              : browsed
                ? `Chord ${browse! + 1} of ${loopChords.length} · bar ${Math.floor(absBeat(browsed.at, bpb) / bpb) + 1}`
                : "First chord"}
            {now.chord.analysis && <span className="ml-2 normal-case tracking-normal">· {now.chord.analysis.roman}</span>}
          </p>
          <ChordName symbol={symbol(now.chord)} className={`block leading-none ${sideways ? "text-6xl" : "text-7xl sm:text-8xl lg:text-9xl"}`} />
          {view && (
            <p className={`mt-1 font-marker leading-tight ${sideways ? "text-xl" : "text-2xl sm:text-4xl"}`} style={{ color: pen.red }}>
              {view.title}
            </p>
          )}
          {lens === "full" && top?.parent && <p className="text-sm text-ink-soft">from {top.parent}</p>}
          <button
            type="button"
            aria-pressed={showVoicing}
            onClick={() => setShowVoicing((s) => !s)}
            className={`mt-2 cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker text-xs sm:text-sm ${
              showVoicing ? "border-ink bg-ink text-paper-light" : "border-dashed border-ink-soft text-ink-soft hover:bg-paper-shade"
            }`}
          >
            🎹 How to play it
          </button>
        </div>
      ) : (
        <p className={`font-marker text-2xl text-ink-soft ${cramped ? "" : "col-start-2"}`}>Press Play to start the loop.</p>
      )}
      {now && showVoicing && voicing && (
        <div key={`v${now.chord.id}`} className={`animate-ink-in w-[min(16rem,80vw)] text-left ${cramped ? "" : "col-start-3 justify-self-start"}`} aria-label={`How to play ${prettySymbol(symbol(now.chord))}`}>
          <p className="font-marker text-xs uppercase tracking-[0.2em] text-ink-soft">The band's voicing</p>
          <DoodleKeyboard notes={rh.map(pitchClass)} mode="ascending" accent={now.guideTones.map((g) => g.note)} color={wash.mustard} className="max-w-full!" />
          <p className="font-hand text-sm leading-snug">
            <span className="font-marker font-bold">LH</span> {lh && prettyNote(lh)}
            <span className="mx-2 text-ink-faint">·</span>
            <span className="font-marker font-bold">RH</span> {rh.map(prettyNote).join(" ")}
          </p>
        </div>
      )}
    </div>
  );

  const nextCard = next && (
    <div
      className={`rounded-lg border-2 border-dashed px-3 py-2 text-left transition-colors ${imminent ? "border-ink bg-wash-mustard/40" : "border-ink-faint"} ${
        sideways ? "mt-2 self-center" : "absolute right-0 top-0"
      }`}
      aria-label="Next chord"
    >
      <p className="flex items-baseline justify-between gap-3 font-marker text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        <span>Next</span>
        {playing && beatsToNext !== null && (
          <span className="normal-case tracking-normal">
            in {beatsToNext} beat{beatsToNext === 1 ? "" : "s"}
          </span>
        )}
      </p>
      <ChordName symbol={symbol(next.chord)} className="block text-2xl sm:text-3xl" />
      {next.scales[0] && <p className="font-marker text-sm text-ink-soft">{next.scales[0].name}</p>}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col gap-2 overscroll-contain bg-paper text-ink"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Improv mode"
    >
      {/* ── a thin top bar: the band, the lens, out ── */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex flex-col items-stretch gap-1">
          <button
            type="button"
            onClick={playback.toggle}
            disabled={playback.status === "loading"}
            className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 font-marker text-paper-light disabled:cursor-wait"
          >
            {playing ? "■ Stop" : playback.status === "loading" ? "… Loading" : "▶ Play"}
          </button>
          {/* step through the changes at your own pace (stops the band) */}
          <div className="flex gap-1 font-marker text-sm" role="group" aria-label="Step through the chords">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous chord"
              title="Previous chord (←)"
              className="flex-1 cursor-pointer whitespace-nowrap rounded-full border-2 border-ink-soft px-2.5 py-0.5 hover:bg-paper-shade"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next chord"
              title="Next chord (→)"
              className="flex-1 cursor-pointer whitespace-nowrap rounded-full border-2 border-ink-soft px-2.5 py-0.5 hover:bg-paper-shade"
            >
              Next ›
            </button>
          </div>
        </div>
        <BeatPulse position={playback.position} beatTick={playback.beatTick} count={playback.count} beatsPerBar={bpb} />
        <div role="radiogroup" aria-label="What the keys show" title="What the keys show (shortcut: V)" className="ml-auto inline-flex flex-wrap gap-1 font-marker text-xs sm:text-sm">
          {IMPROV_LENSES.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={lens === l.id}
              onClick={() => setLens(l.id)}
              className={`cursor-pointer rounded-full border px-2.5 py-0.5 ${lens === l.id ? "border-ink bg-ink text-paper-light" : "border-ink-faint text-ink-soft hover:bg-paper-shade"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        {cramped && lens !== "blues" && (
          <button
            type="button"
            onClick={() => setPhoneOctaves(phoneOctaves === 2 ? 3 : 2)}
            className="cursor-pointer rounded-full border border-dashed border-ink-soft px-2.5 py-0.5 font-marker text-xs"
            title="Keyboard range"
          >
            {phoneOctaves} oct
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Improv mode (Esc)"
          title="Close (Esc or F)"
          className="cursor-pointer rounded-full border-2 border-ink px-2.5 py-0.5 font-marker text-sm hover:bg-paper-shade"
        >
          ✕
        </button>
      </header>

      {/* ── the chord over the piano (side by side on a phone held sideways) ── */}
      <main className={`grid min-h-0 flex-1 gap-3 ${sideways ? "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "grid-rows-[minmax(0,1fr)_auto]"}`}>
        <div className="relative flex min-h-0 flex-col justify-center">
          {chordPanel}
          {nextCard}
        </div>
        <div className="flex min-h-0 flex-col justify-end gap-1">
          {/* the keyboard sizes from its own aspect ratio (capped), the chord gets the rest */}
          <div className={sideways ? "min-h-0 flex-1" : "max-h-[55dvh]"}>
            {view && <ImprovKeyboard low={low} high={high} marks={view.keys} aim={aim} held={held} tall={upright} onKey={(m) => emit("on", m)} onKeyUp={(m) => emit("off", m)} />}
          </div>
          <Legend lens={lens} />
        </div>
      </main>

      {playback.count && (
        <div className="absolute inset-0 grid place-items-center bg-paper-light/85">
          <div className="text-center">
            <p className="font-marker text-sm uppercase tracking-[0.2em] text-ink-soft">Count-in</p>
            <CountInDisplay count={playback.count} />
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {now ? `${prettySymbol(symbol(now.chord))}${view ? `, ${view.title}: ${view.keys.map((k) => prettyNote(k.note)).join(" ")}` : ""}` : ""}
      </span>
    </div>
  );
}

function Swatch({ color, label, hatch }: { color: string; label: string; hatch?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-5 -rotate-2 rounded-sm"
        style={{ background: hatch ? `repeating-linear-gradient(-50deg, ${color} 0 2px, transparent 2px 5px)` : color }}
      />
      {label}
    </span>
  );
}

/** What the marks mean, for the lens in use. */
function Legend({ lens }: { lens: ImprovLens }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-0.5 font-hand text-xs text-ink-soft sm:text-sm">
      {lens === "blues" ? <Swatch color={wash.brick} label="blues scale" hatch /> : <Swatch color={VERDICT_COLOR["chord-tone"]} label="chord tone" hatch />}
      {lens === "full" && <Swatch color={VERDICT_COLOR.tension} label="tension" hatch />}
      {lens === "full" && (
        <span className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: pen.red }}>
            ✕
          </span>
          pass through, don't hold
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: ink.deep }} /> 3rd / 7th
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-dashed" style={{ borderColor: ink.deep }} /> land here next
      </span>
      <Swatch color={PLAYED} label="you" />
    </div>
  );
}
