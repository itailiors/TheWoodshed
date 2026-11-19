import { parseNote } from "@reharm/theory-core";

/**
 * A shareable reharm: `?tune=coop-blues&key=Bb&level=3&play=1`.
 *
 * The same link is onboarding (open the demo straight onto a turned-up dial) and a way to
 * send a reharm to someone: picks (`pick`) and chords kept as written (`keep`) travel with
 * it, and since move and chord ids are positional, they mean the same thing in any key.
 * Everything is optional; anything malformed is dropped rather than refused, so a
 * hand-typed link still opens what it can.
 */
export interface DeepLink {
  /** The chart's own id (not a transposed `id@Key`). Absent = the reference tune. */
  tune?: string;
  /** The tonic to play it in, spelled as given ("Bb", "F#"). */
  key?: string;
  /** Dial level, 0–4. */
  level?: number;
  /** The move to open. */
  move?: string;
  /** Moves picked over the dial's choice ("Also works here"). */
  picks: string[];
  /** Chords kept as written (Chord by chord). */
  keep: string[];
  /** bpm, when it isn't the chart's own. */
  tempo?: number;
  /** Offer to start the band straight away (a ▶ prompt: audio needs a click). */
  play: boolean;
}

export const TEMPO_RANGE = [40, 320] as const;
const KNOWN = ["tune", "key", "level", "move", "pick", "keep", "tempo", "play"];

const list = (v: string | null) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** "Bb", "bb", "B♭", "F#", "f♯" → a spelled tonic; anything else (double flats too) → undefined. */
export function parseKey(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim().replace(/♭/g, "b").replace(/♯/g, "#");
  try {
    const n = parseNote(s);
    if (Math.abs(n.alter) > 1) return undefined;
    return n.letter + (n.alter === 1 ? "#" : n.alter === -1 ? "b" : "");
  } catch {
    return undefined;
  }
}

/** Read a query string (`location.search`). Null when it carries none of our parameters. */
export function readDeepLink(search: string): DeepLink | null {
  const p = new URLSearchParams(search);
  if (!KNOWN.some((k) => p.has(k))) return null;
  // Number("") is 0, so a blank `level=` must not read as level 0
  const num = (k: string) => (p.get(k)?.trim() ? Number(p.get(k)) : NaN);
  const level = num("level");
  const tempo = num("tempo");
  return {
    tune: p.get("tune")?.trim() || undefined,
    key: parseKey(p.get("key")),
    level: Number.isInteger(level) && level >= 0 && level <= 4 ? level : undefined,
    move: p.get("move")?.trim() || undefined,
    picks: list(p.get("pick")),
    keep: list(p.get("keep")),
    tempo: tempo >= TEMPO_RANGE[0] && tempo <= TEMPO_RANGE[1] ? Math.round(tempo) : undefined,
    play: ["1", "true", "yes", ""].includes(p.get("play") ?? "no"),
  };
}

/**
 * Write a link as a query string ("?…", or "" when there's nothing to say). Ids keep their
 * `@ . : ,` readable: they're legal in a query, and `move=tritoneSub@2.1` is a link a person
 * can read. `#` (F#) is escaped, or the browser would take it for the fragment.
 */
export function writeDeepLink(l: Partial<DeepLink>): string {
  const enc = (v: string) => encodeURIComponent(v).replace(/%40/g, "@").replace(/%2C/g, ",").replace(/%3A/g, ":");
  const parts: string[] = [];
  const put = (k: string, v: string | number | undefined) => v !== undefined && v !== "" && parts.push(`${k}=${enc(String(v))}`);
  put("tune", l.tune);
  put("key", l.key);
  put("level", l.level);
  put("move", l.move);
  put("pick", l.picks?.join(","));
  put("keep", l.keep?.join(","));
  put("tempo", l.tempo);
  if (l.play) parts.push("play=1");
  return parts.length ? `?${parts.join("&")}` : "";
}
