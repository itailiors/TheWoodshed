import type { PlaybackStatus } from "../audio/usePlayback";
import type { CountInBars, CountState, InstrumentSource } from "../audio/player";
import type { TimePos } from "@reharm/theory-core";
import type { BandSource } from "../audio/band";
import { midiName, type MidiStatus } from "../midi/useMidi";
import { BeatPulse, CountInDisplay, CountInPicker } from "./BeatPulse";
import { LoadingLine } from "./LoadingLine";
import { QwertyToggle } from "./QwertyToggle";
import { TrioMixer } from "./TrioMixer";

interface Props {
  status: PlaybackStatus;
  source: InstrumentSource | null;
  bandSource?: { bass: BandSource; drums: BandSource } | null;
  onToggle: () => void;
  tempo: number;
  onTempo: (bpm: number) => void;
  loopSelection: boolean;
  onLoopSelection: (on: boolean) => void;
  canLoopSelection: boolean;
  midi: { status: MidiStatus; devices: string[]; held: number[]; connect: () => void };
  /** The beat, for the metronome dot. */
  pulse: { position: TimePos | null; beatTick: number; count: CountState | null; beatsPerBar: number };
  countIn: { bars: CountInBars; onChange: (b: CountInBars) => void };
}

const MIDI_TEXT: Record<MidiStatus, string> = {
  idle: "Connect MIDI",
  unsupported: "MIDI not supported in this browser",
  requesting: "Asking for MIDI…",
  connected: "MIDI",
  "no-devices": "No MIDI devices found",
  denied: "MIDI access denied",
};

/** Play / tempo / loop / MIDI, styled as pencil marks in the lead sheet's margin. */
export function TransportBar({ status, source, bandSource = null, onToggle, tempo, onTempo, loopSelection, onLoopSelection, canLoopSelection, midi, pulse, countIn }: Props) {
  const playing = status === "playing";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-marker">
      <button
        type="button"
        onClick={onToggle}
        disabled={status === "loading"}
        aria-label={playing ? "Stop" : "Play"}
        className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-1 text-paper-light shadow-[2px_2px_0_var(--color-ink-faint)] transition-transform hover:-rotate-1 disabled:cursor-wait disabled:opacity-70"
      >
        <span aria-hidden>{playing ? "■" : status === "loading" ? "…" : "▶"}</span>
        {playing ? "Stop" : status === "loading" ? "Loading the band" : "Play"}
      </button>

      {pulse.count ? <CountInDisplay count={pulse.count} size="sm" /> : <BeatPulse {...pulse} />}

      {status === "loading" ? <LoadingLine /> : <TrioMixer />}

      <label className="flex items-center gap-2 text-sm">
        <span>♩ = {tempo}</span>
        <input
          type="range"
          min={60}
          max={260}
          step={2}
          value={tempo}
          onChange={(e) => onTempo(Number(e.target.value))}
          className="w-28 accent-[var(--color-ink)]"
          aria-label="Tempo"
        />
      </label>

      <CountInPicker bars={countIn.bars} onChange={countIn.onChange} />

      <label className={`flex items-center gap-2 text-sm ${canLoopSelection ? "" : "opacity-40"}`}>
        <input
          type="checkbox"
          checked={loopSelection}
          disabled={!canLoopSelection}
          onChange={(e) => onLoopSelection(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-ink)]"
        />
        Loop selected move
      </label>

      <button
        type="button"
        onClick={midi.connect}
        disabled={midi.status === "unsupported" || midi.status === "requesting"}
        className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 text-sm hover:bg-paper-shade disabled:cursor-default"
        title={midi.devices.join(", ") || undefined}
      >
        🎹 {MIDI_TEXT[midi.status]}
        {midi.status === "connected" && `: ${midi.devices[0]}${midi.devices.length > 1 ? ` +${midi.devices.length - 1}` : ""}`}
        {midi.held.length > 0 && <span className="ml-1 text-ink-soft">· {midi.held.map(midiName).join(" ")}</span>}
      </button>
      <QwertyToggle compact={midi.status === "connected"} />

      {status === "error" && <span className="text-sm text-wash-brick">Audio couldn't start. See the console.</span>}
      {source === "synth" && <span className="text-xs text-ink-faint">(piano samples unreachable, so this is a synth fallback)</span>}
      {bandSource && (bandSource.bass === "synth" || bandSource.drums === "synth") && (
        <span className="text-xs text-ink-faint">
          ({[bandSource.bass === "synth" && "bass", bandSource.drums === "synth" && "drum"].filter(Boolean).join(" and ")} samples unreachable,
          using synths)
        </span>
      )}
    </div>
  );
}
