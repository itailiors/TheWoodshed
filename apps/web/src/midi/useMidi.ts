import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "../components/Toaster";
import { player } from "../audio/player";
import { controlBus } from "./controlBus";
import { midiMonitor } from "./monitor";
import { noteBus } from "./noteBus";

export type MidiStatus = "idle" | "unsupported" | "requesting" | "connected" | "no-devices" | "denied";

export interface MidiNoteEvent {
  type: "on" | "off";
  note: number;
  velocity: number;
  channel: number;
  device: string;
  time: number;
}

const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
export const midiName = (n: number) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

/*
 * Held MIDI notes live outside React state on purpose. useMidi runs in App, so a setState per
 * key press re-rendered the whole app (lead sheet and all): 50–80 ms of main thread blocked on
 * every note, and any note arriving meanwhile waited for it. Now only the readouts that show
 * held notes subscribe, and they hear at most once every 16 ms (a chord is one render). A timer rather than
 * requestAnimationFrame, so a hidden tab can't leave the readout stuck on old notes.
 * Sound never waits for any of this: the note bus fires first.
 */
let heldNotes: number[] = [];
const heldSubs = new Set<() => void>();
let heldTimer: ReturnType<typeof setTimeout> | null = null;
function publishHeld(next: number[]) {
  heldNotes = next;
  if (heldTimer) return;
  heldTimer = setTimeout(() => {
    heldTimer = null;
    heldSubs.forEach((f) => f());
  }, 16);
}
/** The MIDI keys currently down (all devices), for display. */
export function useMidiHeld(): number[] {
  return useSyncExternalStore(
    (fn) => (heldSubs.add(fn), () => void heldSubs.delete(fn)),
    () => heldNotes,
  );
}

/** Per-note logging is for development; a public build keeps the console clean. */
const debug = import.meta.env.DEV ? (...a: unknown[]) => console.debug(...a) : () => {};

/**
 * Foundation for the MIDI Comping Coach: asks for Web MIDI access, listens on every
 * input (hot-plug aware), and tracks which keys are held, per device.
 *
 * Stuck notes: a keyboard that's unplugged (or crashes, or sleeps) mid-chord never sends
 * its note-offs, so every listener downstream (the chord-strike grouper, the heatmap, the
 * held-notes readout) would think those keys are down forever and grade the next chord
 * wrong. So when a device goes away, or sends All Notes Off / All Sound Off, its held notes
 * are released here, through the same note bus, exactly as if the keys had come up.
 */
export function useMidi(onNote?: (e: MidiNoteEvent) => void) {
  const [status, setStatus] = useState<MidiStatus>(
    typeof navigator !== "undefined" && "requestMIDIAccess" in navigator ? "idle" : "unsupported",
  );
  const [devices, setDevices] = useState<string[]>([]);
  const access = useRef<MIDIAccess | null>(null);
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;
  /** port id → { name, notes held on it }. The source of truth for releasing. */
  const heldBy = useRef(new Map<string, { name: string; notes: Set<number> }>());

  const syncHeld = useCallback(() => {
    const all = new Set<number>();
    heldBy.current.forEach((d) => d.notes.forEach((n) => all.add(n)));
    publishHeld([...all].sort((a, b) => a - b));
  }, []);

  const deliver = useCallback((ev: MidiNoteEvent) => {
    noteBus.emit({ type: ev.type, note: ev.note, velocity: ev.velocity, source: "midi" });
    onNoteRef.current?.(ev);
  }, []);

  /** Release everything a device is holding. Returns how many notes were let go. */
  const releaseDevice = useCallback(
    (id: string) => {
      const d = heldBy.current.get(id);
      if (!d || d.notes.size === 0) return 0;
      const notes = [...d.notes];
      d.notes.clear();
      for (const note of notes) deliver({ type: "off", note, velocity: 0, channel: 0, device: d.name, time: performance.now() });
      syncHeld();
      return notes.length;
    },
    [deliver, syncHeld],
  );

  const handle = useCallback(
    (id: string, device: string) => (msg: MIDIMessageEvent) => {
      if (!msg.data || msg.data.length < 2) return;
      const [status, d1, d2 = 0] = msg.data;
      const cmd = status & 0xf0;
      const channel = (status & 0x0f) + 1;
      if (cmd === 0xb0) {
        // CC 120 All Sound Off / CC 123 All Notes Off: some controllers send these from a panic button
        if (d1 === 120 || d1 === 123) releaseDevice(id);
        if (d1 === 64) debug(`[MIDI] sustain ${d2 >= 64 ? "down" : "up"} (${device})`);
        controlBus.emit({ cc: d1, value: d2, channel, device });
        return;
      }
      let ev: MidiNoteEvent | null = null;
      if (cmd === 0x90 && d2 > 0) ev = { type: "on", note: d1, velocity: d2, channel, device, time: msg.timeStamp };
      else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) ev = { type: "off", note: d1, velocity: d2, channel, device, time: msg.timeStamp };
      if (!ev) return;
      debug(`[MIDI] note ${ev.type.padEnd(3)} ${midiName(ev.note).padEnd(4)} #${ev.note} vel ${ev.velocity} ch ${channel} · ${device}`);
      let d = heldBy.current.get(id);
      if (!d) heldBy.current.set(id, (d = { name: device, notes: new Set() }));
      if (ev.type === "on") d.notes.add(ev.note);
      else if (!d.notes.delete(ev.note)) return; // an off for a key we never saw go down (or already released): nothing to do
      deliver(ev); // the note bus (and so the sound) first; the readout can wait a frame
      syncHeld();
    },
    [deliver, releaseDevice, syncHeld],
  );

  const attach = useCallback(() => {
    const a = access.current;
    if (!a) return;
    const names: string[] = [];
    const live = new Set<string>();
    a.inputs.forEach((input) => {
      // an input can be listed but "disconnected" for a moment during a hot-unplug
      if (input.state === "disconnected") return;
      const name = input.name ?? input.id;
      input.onmidimessage = handle(input.id, name);
      names.push(name);
      live.add(input.id);
    });
    // anything that was holding notes and is no longer here: let its keys up
    let released = 0;
    let lost: string | null = null;
    for (const [id, d] of heldBy.current) {
      if (live.has(id)) continue;
      const n = releaseDevice(id);
      if (n) (released += n), (lost = d.name);
      heldBy.current.delete(id);
    }
    if (lost) toast(`${lost} disconnected, so its ${released} held note${released === 1 ? "" : "s"} ${released === 1 ? "was" : "were"} released.`, { tone: "warn" });
    setDevices(names);
    setStatus(names.length ? "connected" : "no-devices");
  }, [handle, releaseDevice]);

  const connect = useCallback(async () => {
    if (!("requestMIDIAccess" in navigator)) return setStatus("unsupported");
    // MIDI notes aren't user gestures, so they can't unlock audio. This click can: load the
    // engine now, so the first note you play already sounds through the app's piano.
    if (midiMonitor.get()) void player.init().catch(() => {});
    setStatus("requesting");
    try {
      access.current = await navigator.requestMIDIAccess({ sysex: false });
      access.current.onstatechange = (e) => {
        const port = (e as MIDIConnectionEvent).port;
        if (port?.type !== "input") return;
        debug(`[MIDI] ${port.type} "${port.name}" ${port.state}`);
        attach();
      };
      attach();
    } catch (err) {
      console.warn("[MIDI] access denied", err);
      setStatus("denied");
    }
  }, [attach]);

  // Leaving the page (or the component): release what's held, so no listener keeps a stuck key.
  useEffect(
    () => () => {
      access.current?.inputs.forEach((i) => (i.onmidimessage = null));
      if (access.current) access.current.onstatechange = null;
      for (const id of [...heldBy.current.keys()]) releaseDevice(id);
    },
    [releaseDevice],
  );

  return { status, devices, connect };
}
