import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getChannelVolumes,
  getMasterVolume,
  resetChannelVolumes,
  setChannelVolume,
  setMasterVolume,
  subscribeChannelVolumes,
  subscribeMasterVolume,
  type ChannelId,
} from "../audio/mix";
import { BandFeelControls, useBandFeelChanged } from "./BandFeelControls";

interface Props {
  compact?: boolean;
  className?: string;
  /** The tune's meter, so the band styles offered fit it (a waltz has no bossa). */
  beatsPerBar?: number;
}

const CHANNEL_META: ReadonlyArray<{
  id: ChannelId;
  icon: string;
  label: string;
  sublabel: string;
}> = [
  {
    id: "playerPiano",
    icon: "🎹",
    label: "Player & Master",
    sublabel: "Your keys + Ghost Master",
  },
  {
    id: "bgPiano",
    icon: "🎼",
    label: "Background Piano",
    sublabel: "Backing comping & head",
  },
  {
    id: "bass",
    icon: "🎻",
    label: "Upright Bass",
    sublabel: "Walking or in 2",
  },
  {
    id: "drums",
    icon: "🥁",
    label: "Drums",
    sublabel: "Ride, hi-hat, snare & kick",
  },
];

const formatDb = (db: number) => `${db > 0 ? `+${db}` : db} dB`;

/**
 * Master Volume control (-24 dB to +12 dB) bound to `Tone.Destination.volume.value`,
 * plus an "Advanced" popover drawer with independent channel sliders for:
 * - Player & Master Piano (live keys, Ghost Master & auditions)
 * - Background Piano (band comping & melody)
 * - Upright Bass
 * - Drums
 */
export function VolumeMixer({ compact = false, className = "", beatsPerBar = 4 }: Props) {
  const db = useSyncExternalStore(subscribeMasterVolume, getMasterVolume);
  const channels = useSyncExternalStore(subscribeChannelVolumes, getChannelVolumes);
  const feelChanged = useBandFeelChanged();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const formatted = formatDb(db);
  const icon = db <= -20 ? "🔈" : db > 3 ? "🔊" : "🔉";
  const hasCustomChannels =
    channels.playerPiano !== 0 || channels.bgPiano !== 0 || channels.bass !== 0 || channels.drums !== 0;
  const customised = hasCustomChannels || feelChanged;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex items-center ${className}`}>
      <div
        role="group"
        aria-label="Master volume"
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/70 bg-paper-light/80 px-2.5 py-0.5 font-marker text-xs text-ink"
      >
        <button
          type="button"
          onClick={() => setMasterVolume(db === 0 ? 6 : 0)}
          title={`Master volume (${formatted}). Click to toggle 0 dB / +6 dB boost.`}
          aria-label={`Master volume ${formatted}, toggle boost`}
          className="cursor-pointer select-none leading-none hover:scale-110"
        >
          {icon}
        </button>
        <input
          type="range"
          min={-24}
          max={12}
          step={1}
          value={db}
          aria-label="Master volume (dB)"
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          className={`${compact ? "w-14 sm:w-20" : "w-16 sm:w-24"} h-1.5 cursor-pointer accent-[var(--color-ink)]`}
        />
        <span className="min-w-[3.1rem] text-right font-hand text-[11px] tabular-nums text-ink-soft">
          {formatted}
        </span>
        <span className="text-ink/25" aria-hidden>
          |
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Open the mixer: channel faders, swing and band style"
          className={`cursor-pointer rounded-full px-1.5 py-0.5 font-marker text-[10px] tracking-wide transition-colors ${
            open
              ? "bg-ink text-paper"
              : customised
                ? "bg-mustard/25 text-ink hover:bg-mustard/40"
                : "text-ink-soft hover:bg-ink/10 hover:text-ink"
          }`}
        >
          {compact ? "Mix" : "Advanced"} {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Advanced instrument mixer"
          className="absolute right-0 top-full z-50 mt-1.5 w-64 sm:w-72 rounded-xl border-2 border-ink bg-paper p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between border-b border-ink/15 pb-1.5">
            <span className="font-marker text-xs tracking-wide text-ink">
              🎚️ Advanced Channel Mix
            </span>
            <button
              type="button"
              onClick={() => {
                resetChannelVolumes();
              }}
              disabled={!hasCustomChannels}
              className="cursor-pointer rounded px-1.5 py-0.5 font-hand text-[11px] text-ink-soft underline decoration-dotted hover:text-ink disabled:cursor-default disabled:opacity-40"
            >
              Reset 0 dB
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {CHANNEL_META.map((ch) => {
              const val = channels[ch.id];
              return (
                <div key={ch.id} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <label
                      htmlFor={`mixer-${ch.id}`}
                      className="flex items-center gap-1 font-marker text-xs text-ink"
                    >
                      <span aria-hidden>{ch.icon}</span>
                      <span>{ch.label}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setChannelVolume(ch.id, 0)}
                      title="Click to reset channel to 0 dB"
                      className="cursor-pointer font-hand text-[11px] tabular-nums text-ink-soft hover:text-ink"
                    >
                      {formatDb(val)}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-hand text-[10px] leading-tight text-ink-soft">
                      {ch.sublabel}
                    </span>
                    <input
                      id={`mixer-${ch.id}`}
                      type="range"
                      min={-24}
                      max={12}
                      step={1}
                      value={val}
                      aria-label={`${ch.label} volume (dB)`}
                      onChange={(e) => setChannelVolume(ch.id, Number(e.target.value))}
                      className="h-1.5 w-28 sm:w-32 shrink-0 cursor-pointer accent-[var(--color-ink)]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <BandFeelControls beatsPerBar={beatsPerBar} />
        </div>
      )}
    </div>
  );
}
