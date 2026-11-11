import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Foundation for the MIDI Comping Coach: asks for Web MIDI access, listens on every
 * input (hot-plug aware), logs note on/off, and tracks which keys are held.
 */
export function useMidi(onNote?: (e: MidiNoteEvent) => void) {
  const [status, setStatus] = useState<MidiStatus>(
    typeof navigator !== "undefined" && "requestMIDIAccess" in navigator ? "idle" : "unsupported",
  );
  const [devices, setDevices] = useState<string[]>([]);
  const [held, setHeld] = useState<number[]>([]);
  const access = useRef<MIDIAccess | null>(null);
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;

  const handle = useCallback((device: string) => (msg: MIDIMessageEvent) => {
    if (!msg.data || msg.data.length < 2) return;
    const [status, d1, d2 = 0] = msg.data;
    const cmd = status & 0xf0;
    const channel = (status & 0x0f) + 1;
    let ev: MidiNoteEvent | null = null;
    if (cmd === 0x90 && d2 > 0) ev = { type: "on", note: d1, velocity: d2, channel, device, time: msg.timeStamp };
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) ev = { type: "off", note: d1, velocity: d2, channel, device, time: msg.timeStamp };
    else if (cmd === 0xb0 && d1 === 64) console.log(`[MIDI] sustain ${d2 >= 64 ? "down" : "up"} (${device})`);
    if (!ev) return;
    console.log(`[MIDI] note ${ev.type.padEnd(3)} ${midiName(ev.note).padEnd(4)} #${ev.note} vel ${ev.velocity} ch ${channel} · ${device}`);
    setHeld((h) => (ev!.type === "on" ? [...new Set([...h, ev!.note])].sort((a, b) => a - b) : h.filter((n) => n !== ev!.note)));
    noteBus.emit({ type: ev.type, note: ev.note, velocity: ev.velocity, source: "midi" });
    onNoteRef.current?.(ev);
  }, []);

  const attach = useCallback(() => {
    const a = access.current;
    if (!a) return;
    const names: string[] = [];
    a.inputs.forEach((input) => {
      const name = input.name ?? input.id;
      input.onmidimessage = handle(name);
      names.push(name);
    });
    setDevices(names);
    setStatus(names.length ? "connected" : "no-devices");
  }, [handle]);

  const connect = useCallback(async () => {
    if (!("requestMIDIAccess" in navigator)) return setStatus("unsupported");
    setStatus("requesting");
    try {
      access.current = await navigator.requestMIDIAccess({ sysex: false });
      access.current.onstatechange = (e) => {
        const port = (e as MIDIConnectionEvent).port;
        console.info(`[MIDI] ${port?.type} "${port?.name}" ${port?.state}`);
        attach();
      };
      attach();
    } catch (err) {
      console.warn("[MIDI] access denied", err);
      setStatus("denied");
    }
  }, [attach]);

  useEffect(
    () => () => {
      access.current?.inputs.forEach((i) => (i.onmidimessage = null));
      if (access.current) access.current.onstatechange = null;
    },
    [],
  );

  return { status, devices, held, connect };
}
