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

/**
 * A `move` value shaped like a Reharm Daily slug (`tritone-sub`): lowercase words joined by
 * hyphens, no dots and no `@`. The Lab's own move ids are `ruleId@bar.beat` with a dotted rule id
 * (`dominant.tritoneSub@2.1`), so the two never collide and old share links keep their meaning.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

/**
 * The Reharm Daily slugs (bridge-spec §3) and the Lab concept each opens in the Coach. The Lab has
 * no plain "Lydian ♯4" rule; upper structure II is that sound (a D triad over C is C Lydian), so
 * `lydian-sharp4` opens it and `upper-structure` opens the ♭VI one.
 */
export const BRIDGE_MOVES: Readonly<Record<string, string>> = {
  "tritone-sub": "dominant.tritoneSub",
  "backdoor-dominant": "modal.backdoorTwoFive",
  "modal-interchange": "modal.borrowedIv",
  "chromatic-mediant": "dominant.mediantDominant",
  "secondary-ii-v": "functional.secondaryTwoFive",
  "upper-structure": "voicing.upperStructureBVI",
  "diminished-pivot": "chromatic.passingDiminished",
  "lydian-sharp4": "voicing.upperStructureII",
};

/** Where a Reharm Daily link came from, for the "← Reharm Daily" pill. */
export type BridgeSource = "reharm-daily" | "reharm";

/**
 * The Reharm Daily side of a URL: `?mode=changes`, `?move=<slug>`, `?from=…`. Read alongside
 * `readDeepLink` and never written back: the address bar keeps only the reharm, so these act once.
 */
export interface BridgeLink {
  /** Open on this tab instead of Study. Only `changes` is linked today. */
  mode?: "changes";
  /** A Coach concept to open (a rule id), from a known `move` slug. */
  concept?: string;
  from?: BridgeSource;
}

export function readBridgeLink(search: string): BridgeLink {
  const p = new URLSearchParams(search);
  const move = p.get("move")?.trim() ?? "";
  const from = p.get("from")?.trim();
  return {
    mode: p.get("mode")?.trim().toLowerCase() === "changes" ? "changes" : undefined,
    concept: SLUG.test(move) ? BRIDGE_MOVES[move] : undefined,
    from: from === "reharm-daily" || from === "reharm" ? from : undefined,
  };
}

/** Read a query string (`location.search`). Null when it carries none of our parameters. */
export function readDeepLink(search: string): DeepLink | null {
  const p = new URLSearchParams(search);
  // a slug (known or not) belongs to the bridge, not to the reharm: it doesn't make this a reharm link
  if (SLUG.test(p.get("move")?.trim() ?? "")) p.delete("move");
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
