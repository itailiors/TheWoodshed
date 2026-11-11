import {
  absBeat,
  chordAtBeat,
  chroma,
  KEYS,
  improvMap,
  type ChordEvent,
  type ImprovEntry,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";
import { useEffect, useMemo, useRef } from "react";
import { player } from "../../audio/player";
import type { Playback } from "../../audio/usePlayback";
import { BeatPulse, CountInDisplay, CountInPicker } from "../BeatPulse";
import { SketchBox, SketchFilters } from "../../design/rough";
import { LEVELS, seedOf } from "../../design/tokens";
import { midiName, type MidiStatus } from "../../midi/useMidi";
import { LeadSheet } from "../LeadSheet";
import { LevelDial } from "../LevelDial";
import { ModeSwitch, type AppMode } from "../ModeSwitch";
import { KeyPicker } from "../KeyPicker";
import { LoadingLine } from "../LoadingLine";
import { TrioMixer } from "../TrioMixer";
import { ChordHUD } from "./ChordHUD";
import { ImprovHeatmap } from "./ImprovHeatmap";

interface Props {
  tune: Tune;
  chords: ChordEvent[];
  pathway: ReharmMove[];
  view: "reharm" | "original";
  onView: (v: "reharm" | "original") => void;
  level: number;
  onLevel: (l: number) => void;
  loop: { startBar: number; endBar: number };
  loopSelection: boolean;
  onLoopSelection: (on: boolean) => void;
  tempo: number;
  onTempo: (bpm: number) => void;
  playback: Playback;
  midi: { status: MidiStatus; devices: string[]; held: number[]; connect: () => void };
  onMode: (m: AppMode) => void;
  totalBars: number;
  keyControl: { tonic: string; original: string; mode: "major" | "minor"; onChange: (tonic: string) => void };
}

const PAGE = 8;

const SHORTCUTS: [string, string][] = [
  ["Space", "play / stop"],
  ["← →", "spice"],
  ["A", "A/B"],
  ["L", "loop move"],
  ["[ ]", "tempo"],
  [", .", "key ½ step"],
  ["1–4", "pno/bass/dr/click"],
  ["Esc", "study"],
];

/**
 * Practice Mode: both hands on the piano. A fixed 100dvh layout (sheet + Current
 * Chord HUD on top, heatmap tape pinned to the bottom third), driven from the keyboard.
 */
export function PracticeMode(p: Props) {
  const { tune, chords, loop, playback } = p;
  const bpb = tune.meter[0];
  const playing = playback.status === "playing";

  // ── sync: one improv map per chord list; the Tone.Draw-timed position picks the entry ──
  const entries = useMemo(() => {
    const m = new Map<string, ImprovEntry>();
    improvMap(tune, chords).forEach((e) => m.set(e.chord.id, e));
    return m;
  }, [tune, chords]);

  const loopStart = (loop.startBar - 1) * bpb;
  const loopEnd = loop.endBar * bpb;
  const nowBeat = playback.position ? (playback.position.bar - 1) * bpb + (playback.position.beat - 1) : loopStart;
  const at = chordAtBeat(chords, nowBeat, bpb);
  const nextChord = at?.next && absBeat(at.next.at, bpb) < loopEnd ? at.next : chordAtBeat(chords, loopStart, bpb)?.chord;
  const nextStart = at?.next && absBeat(at.next.at, bpb) < loopEnd ? absBeat(at.next.at, bpb) : loopEnd;
  const beatsToNext = playing && at ? Math.max(0, Math.round(nextStart - nowBeat)) : null;
  const now = at ? (entries.get(at.chord.id) ?? null) : null;
  const next = nextChord ? (entries.get(nextChord.id) ?? null) : null;

  // long forms: show the 8-bar page under the playhead (short tunes fit whole)
  const curBar = playback.position?.bar ?? loop.startBar;
  const paged = p.totalBars > 12;
  const firstBar = paged ? Math.floor((curBar - 1) / PAGE) * PAGE + 1 : 1;
  const lastBar = paged ? Math.min(firstBar + PAGE - 1, p.totalBars) : p.totalBars;

  // ── hands-on-keys controls ──
  const latest = useRef(p);
  latest.current = p;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = latest.current;
      const handled = (() => {
        switch (e.key) {
          case " ":
            s.playback.toggle();
            return true;
          case "ArrowLeft":
            s.onLevel(Math.max(0, s.level - 1));
            return true;
          case "ArrowRight":
            s.onLevel(Math.min(LEVELS.length - 1, s.level + 1));
            return true;
          case "a":
          case "A":
            s.onView(s.view === "reharm" ? "original" : "reharm");
            return true;
          case "l":
          case "L":
            s.onLoopSelection(!s.loopSelection);
            return true;
          case "[":
            s.onTempo(Math.max(60, s.tempo - 4));
            return true;
          case "]":
            s.onTempo(Math.min(260, s.tempo + 4));
            return true;
          case ",":
          case ".": {
            const { tonic, onChange } = s.keyControl;
            onChange(KEYS.find((k) => chroma(k) === (chroma(tonic) + (e.key === "." ? 1 : 11)) % 12)!);
            return true;
          }
          case "Escape":
            s.onMode("study");
            return true;
          case "1":
          case "2":
          case "3":
          case "4": {
            const inst = (["piano", "bass", "drums", "click"] as const)[Number(e.key) - 1];
            player.setMix(inst, !player.mix[inst]);
            return true;
          }
          default:
            return false;
        }
      })();
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ask for MIDI once on entry, so the keyboard just works.
  useEffect(() => {
    if (latest.current.midi.status === "idle") latest.current.midi.connect();
  }, []);

  return (
    <div className="flex h-dvh flex-col gap-3 overflow-hidden p-3 text-ink md:p-4">
      <SketchFilters />

      {/* ── top bar ── */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
        <ModeSwitch mode="practice" onMode={p.onMode} />
        <h1 className="ink-wobble hidden truncate font-marker text-xl font-bold uppercase lg:block" style={{ viewTransitionName: "tune-title" }}>
          {tune.title}
        </h1>
        <button
          type="button"
          onClick={playback.toggle}
          disabled={playback.status === "loading"}
          className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-1 font-marker text-paper-light disabled:cursor-wait"
        >
          {playing ? "■ Stop" : playback.status === "loading" ? "… Loading" : "▶ Play"}
        </button>
        <BeatPulse position={playback.position} beatTick={playback.beatTick} count={playback.count} beatsPerBar={bpb} />
        {playback.status === "loading" ? <LoadingLine /> : <TrioMixer compact />}
        <span className="font-marker">♩ = {p.tempo}</span>
        <CountInPicker compact bars={playback.countInBars} onChange={playback.setCountIn} />
        <KeyPicker compact {...p.keyControl} />
        <LevelDial level={p.level} onChange={p.onLevel} />
        <span className="font-marker text-sm">
          {p.view === "reharm" ? "Reharm" : "Original"}
          {p.loopSelection && " · looping the move"}
        </span>
        <span className="font-marker text-sm text-ink-soft">
          🎹 {p.midi.status === "connected" ? p.midi.devices[0] : p.midi.status === "requesting" ? "connecting…" : "no MIDI"}
          {p.midi.held.length > 0 && ` · ${p.midi.held.map(midiName).join(" ")}`}
        </span>
        <span className="ml-auto hidden gap-3 text-xs text-ink-faint xl:flex" aria-label="Keyboard shortcuts">
          {SHORTCUTS.map(([k, v]) => (
            <span key={k}>
              <kbd className="rounded border border-ink-faint px-1 font-hand">{k}</kbd> {v}
            </span>
          ))}
        </span>
      </header>

      {/* ── sheet + HUD: top two thirds ── */}
      <div className="grid min-h-0 flex-[2] grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(300px,32%)]">
        <SketchBox
          seed={seedOf("practice-sheet")}
          strokeWidth={1.8}
          className="hidden min-h-0 md:block"
          innerClassName="relative h-full p-3"
          style={{ viewTransitionName: "lead-sheet" }}
        >
          {paged && (
            <span className="absolute right-4 top-2 font-marker text-xs text-ink-faint">
              bars {firstBar}–{lastBar} of {p.totalBars}
            </span>
          )}
          <LeadSheet
            fit
            firstBar={firstBar}
            lastBar={lastBar}
            tune={tune}
            chords={chords}
            moves={p.view === "reharm" ? p.pathway : []}
            onSelect={() => {}}
            showWashes={p.view === "reharm"}
            playhead={playback.position}
            loopBars={loop}
            activeChordId={playing ? at?.chord.id : null}
          />
        </SketchBox>
        <div className="relative min-h-0">
          <ChordHUD now={now} next={next} beatsToNext={beatsToNext} playing={playing} />
          {/* the count-in, written big over the HUD until the band comes in */}
          {playback.count && (
            <div className="absolute inset-2 grid place-items-center rounded-lg bg-paper-light/90">
              <div className="text-center">
                <p className="font-marker text-sm uppercase tracking-[0.2em] text-ink-soft">Count-in</p>
                <CountInDisplay count={playback.count} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── heatmap tape: bottom third ── */}
      <div className="min-h-0 flex-1">
        <ImprovHeatmap key={tune.id} compact tune={tune} chords={chords} loop={loop} playing={playing} level={p.level} view={p.view} />
      </div>

      {playback.source === "synth" && <p className="sr-only">Piano samples unreachable; using a synth.</p>}
    </div>
  );
}
