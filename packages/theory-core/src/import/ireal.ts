/**
 * iReal Pro URL importer.
 *
 * Format (as implemented by the open-source parsers, e.g. infojunkie/ireal-musicxml):
 *   irealb://<uri-encoded: song === song === ... === playlistName>
 *   song fields, "="-separated: 0 title, 1 composer ("Last First"), 3 style, 4 key ("Bb", "C-"),
 *   5 transpose, 6 music ("1r34LbKcu7" + scrambled chart), 7 comp style, 8 bpm, 9 repeats
 *   irealbook://title=composer=style=key=n=music (older, unscrambled, songs back to back)
 *
 * The chart is a string of barlines ({ } [ ] | Z), markers (T44, *A, N1, Q, S, Y, <comments>)
 * and chord symbols ("C^7", "D-7", "G7b9/B", "Bh7", "x" = repeat bar, "r" = repeat 2 bars,
 * "n" = N.C., "p" = pause, "W" = invisible root).
 */
import { analyzeTune } from "../analysis";
import { chroma } from "../pitch";
import type { ChordEvent, Quality, Section, Tune } from "../types";

export class IRealParseError extends Error {}

export interface ImportedSong {
  tune: Tune;
  /** The iReal style string, e.g. "Medium Swing". */
  style: string;
  /** Things the importer had to approximate. Shown to the user. */
  warnings: string[];
}

export interface IRealImport {
  playlist: string | null;
  songs: ImportedSong[];
}

// ── de-obfuscation ─────────────────────────────────────────────────────────
const MUSIC_PREFIX = "1r34LbKcu7";

/** Swap chars 0–4 with 45–49 and 10–23 with 26–39 of a 50-char block. Self-inverse. */
function obfusc50(s: string): string {
  const out = s.split("");
  for (let i = 0; i < 5; i++) {
    out[49 - i] = s[i];
    out[i] = s[49 - i];
  }
  for (let i = 10; i < 24; i++) {
    out[49 - i] = s[i];
    out[i] = s[49 - i];
  }
  return out.join("");
}

export function unscramble(s: string): string {
  let r = "";
  while (s.length > 51) {
    r += obfusc50(s.substring(0, 50));
    s = s.substring(50);
  }
  r += s;
  return r.replace(/Kcl/g, "| x").replace(/LZ/g, " |").replace(/XyQ/g, "   ");
}

/** The inverse of the block swap (used by tests and for exporting). */
export function scramble(music: string): string {
  let r = "";
  let s = music;
  while (s.length > 51) {
    r += obfusc50(s.substring(0, 50));
    s = s.substring(50);
  }
  return r + s;
}

// ── chord symbols ──────────────────────────────────────────────────────────
const CHORD_RE = /^([A-GW][b#]?)((?:sus|alt|add|[+\-^\dhob#])*)(\*[^*]*\*)?(\/[A-G][b#]?)?(\([^)]*\))?/;

interface ParsedChord {
  root: string;
  quality: Quality;
  extensions: string[];
  alterations: string[];
  bass?: string;
}

const MOD_RE = /^(b13|#11|b9|#9|#5|b5|b6|add9|sus|alt|13|11|9|7|6)/;

/** "-7b5" -> m7b5, "7b9" -> 7 + b9, "^9" -> maj7 + 9, "h7" -> m7b5 … */
export function parseQuality(q: string): { quality: Quality; extensions: string[]; alterations: string[]; leftover: string } {
  let s = q;
  const ext = new Set<string>();
  const alt = new Set<string>();
  let quality: Quality;
  const eat = (re: RegExp) => {
    const m = re.exec(s);
    if (!m) return null;
    s = s.slice(m[0].length);
    return m[0];
  };

  if (eat(/^-\^9/)) {
    quality = "mMaj7";
    ext.add("9");
  } else if (eat(/^-\^7?/)) quality = "mMaj7";
  else if (eat(/^-7b5/)) quality = "m7b5";
  else if (eat(/^-69/)) {
    quality = "m6";
    ext.add("9");
  } else if (eat(/^-6/)) quality = "m6";
  else if (eat(/^-11/)) {
    quality = "m7";
    ext.add("9").add("11");
  } else if (eat(/^-9/)) {
    quality = "m7";
    ext.add("9");
  } else if (eat(/^-7/)) quality = "m7";
  else if (eat(/^-/)) quality = "m";
  else if (eat(/^h9/)) {
    quality = "m7b5";
    ext.add("9");
  } else if (eat(/^h7?/)) quality = "m7b5";
  else if (eat(/^o7?/)) quality = "dim7";
  else if (eat(/^\^13/)) {
    quality = "maj7";
    ext.add("9").add("13");
  } else if (eat(/^\^9/)) {
    quality = "maj7";
    ext.add("9");
  } else if (eat(/^\^7?/)) quality = "maj7";
  else if (eat(/^69/)) {
    quality = "6";
    ext.add("9");
  } else if (eat(/^6/)) quality = "6";
  else if (eat(/^\+/)) quality = "aug";
  else if (eat(/^(2|add9)/)) {
    quality = "maj";
    ext.add("9");
  } else if (eat(/^5/)) quality = "maj";
  else if (eat(/^13/)) {
    quality = "7";
    ext.add("9").add("13");
  } else if (eat(/^11/)) {
    quality = "7sus4";
    ext.add("9");
  } else if (eat(/^9/)) {
    quality = "7";
    ext.add("9");
  } else if (eat(/^7/)) quality = "7";
  else if (eat(/^sus/)) quality = "7sus4";
  else quality = "maj";

  // modifiers: b9, #11, sus, alt, …
  for (let m = eat(MOD_RE); m; m = eat(MOD_RE)) {
    if (m === "sus") quality = "7sus4";
    else if (m === "alt") ["b9", "#9", "b13"].forEach((a) => alt.add(a));
    else if (m === "b6") alt.add("b13");
    else if (m === "add9" || m === "9") ext.add("9");
    else if (m === "11") ext.add("11");
    else if (m === "13") ext.add("9").add("13");
    else if (m === "7" && quality === "aug") quality = "7";
    else if (m === "7" || m === "6") {
      /* redundant digit, e.g. "7sus7" */
    } else alt.add(m);
  }
  if (quality === "aug" && alt.size) quality = "7";
  if (quality === "7" && q.startsWith("+")) alt.add("#5");
  if (quality === "maj7" && alt.has("#5")) {
    quality = "maj7#5";
    alt.delete("#5");
  }
  return { quality, extensions: [...ext], alterations: [...alt], leftover: s };
}

// ── chart tokenizer ────────────────────────────────────────────────────────
type Item =
  | { kind: "chord"; chord: ParsedChord | null; invisibleBass?: string; text: string }
  | { kind: "repeat1" }
  | { kind: "repeat2" }
  | { kind: "nc" }
  | { kind: "pause" };

interface RawBar {
  items: Item[];
  spaces: number;
  openedBy: string;
  repeatStart: boolean;
  repeatEnd: boolean;
  ending: number | null;
  section: string | null;
  time: [number, number] | null;
}

const SECTION_NAMES: Record<string, string> = { i: "Intro", v: "Verse" };

function timeSig(t: string): [number, number] {
  const d = t.slice(1);
  if (d === "12") return [12, 8];
  return [Number(d[0]), Number(d[1])];
}

function tokenize(music: string, warnings: Set<string>): RawBar[] {
  const bars: RawBar[] = [];
  const fresh = (openedBy: string): RawBar => ({
    items: [],
    spaces: 0,
    openedBy,
    repeatStart: openedBy === "{",
    repeatEnd: false,
    ending: null,
    section: null,
    time: null,
  });
  let cur = fresh("start");
  const close = (closer: string) => {
    const hasContent = cur.items.length > 0;
    const sustainBar = ["|", "{", "["].includes(cur.openedBy) && cur.spaces >= 2;
    if (hasContent || sustainBar) bars.push(cur);
    else if (bars.length && (cur.repeatEnd || cur.section || cur.time)) {
      // markers on an empty fragment belong to the bar we just closed / the next bar
      const last = bars[bars.length - 1];
      last.repeatEnd ||= cur.repeatEnd;
    }
    cur = fresh(closer);
  };

  let i = 0;
  while (i < music.length) {
    const c = music[i];
    const rest = music.slice(i);
    if (c === "<") {
      const end = music.indexOf(">", i);
      const text = music.slice(i + 1, end === -1 ? undefined : end);
      if (/D\.?[CS]\.?|coda|fine/i.test(text)) warnings.add(`Chart has road-map directions (“${text.trim()}”). Imported in written order only.`);
      i = end === -1 ? music.length : end + 1;
      continue;
    }
    const t = /^T\d\d/.exec(rest);
    if (t) {
      cur.time = timeSig(t[0]);
      i += 3;
      continue;
    }
    const sec = /^\*([a-zA-Z])/.exec(rest);
    if (sec) {
      cur.section = SECTION_NAMES[sec[1]] ?? sec[1].toUpperCase();
      i += 2;
      continue;
    }
    const end = /^N(\d)/.exec(rest);
    if (end) {
      cur.ending = Number(end[1]);
      i += 2;
      continue;
    }
    if (c === "{" || c === "[" || c === "|" || c === "]" || c === "}" || c === "Z") {
      if (c === "}") cur.repeatEnd = true;
      if (c === "{" || c === "[") {
        // opening marks start a new bar (closing whatever was open before)
        if (cur.items.length || cur.spaces >= 2) close(c);
        else {
          const keep = { section: cur.section, time: cur.time };
          cur = fresh(c);
          Object.assign(cur, keep);
          if (c === "{") cur.repeatStart = true;
        }
      } else close(c);
      i++;
      continue;
    }
    if (c === " " || c === ",") {
      if (c === " ") cur.spaces++;
      i++;
      continue;
    }
    if (c === "x") {
      cur.items.push({ kind: "repeat1" });
      i++;
      continue;
    }
    if (c === "r") {
      cur.items.push({ kind: "repeat2" });
      i++;
      continue;
    }
    if (c === "n") {
      cur.items.push({ kind: "nc" });
      i++;
      continue;
    }
    if (c === "p") {
      cur.items.push({ kind: "pause" });
      i++;
      continue;
    }
    if (c === "Q" || c === "S") {
      warnings.add("Chart has a segno/coda. Imported in written order only.");
      i++;
      continue;
    }
    if ("YUfls".includes(c)) {
      i++;
      continue;
    }
    const ch = CHORD_RE.exec(rest);
    if (ch && ch[0].length) {
      const [text, root, qual, , bassPart] = ch;
      if (root === "W") {
        cur.items.push({ kind: "chord", chord: null, invisibleBass: bassPart?.slice(1), text });
      } else {
        const p = parseQuality(qual);
        if (p.leftover) warnings.add(`Couldn't fully read “${text}”; used the closest chord.`);
        cur.items.push({
          kind: "chord",
          text,
          chord: { root, quality: p.quality, extensions: p.extensions, alterations: p.alterations, bass: bassPart?.slice(1) },
        });
      }
      i += text.length;
      continue;
    }
    i++; // unknown character: skip
  }
  close("end");
  return bars;
}

/** Unroll { } repeats with N1/N2 endings into the order the band plays them. */
function expandRepeats(bars: RawBar[]): RawBar[] {
  const endingOf: (number | null)[] = [];
  let current: number | null = null;
  bars.forEach((b, i) => {
    if (b.ending) current = b.ending;
    else if (i > 0 && (b.repeatStart || b.section)) current = null;
    endingOf[i] = current;
    if (b.repeatEnd && current !== null) current = null;
  });

  const out: RawBar[] = [];
  let i = 0;
  let start = 0;
  let pass = 1;
  let jumpedFrom = -1;
  let guard = 0;
  while (i < bars.length && guard++ < 10000) {
    const b = bars[i];
    if (pass === 2 && i > jumpedFrom && endingOf[i] === null) pass = 1;
    if (b.repeatStart && pass === 1) start = i;
    const e = endingOf[i];
    if (e !== null && e !== pass) {
      i++;
      continue;
    }
    out.push(b);
    if (b.repeatEnd && pass === 1) {
      pass = 2;
      jumpedFrom = i;
      i = start;
      continue;
    }
    if (b.repeatEnd && pass === 2) pass = 1;
    i++;
  }
  return out;
}

/** How the beats of a bar are shared between n chords (iReal charts don't say; this is the usual reading). */
export function splitBar(n: number, beats: number): number[] {
  if (n <= 1) return [beats];
  if (beats === 4 && n === 3) return [2, 1, 1];
  if (beats === 3 && n === 2) return [2, 1];
  if (beats % n === 0) return Array(n).fill(beats / n);
  const base = Math.floor(beats / n);
  if (base >= 1) return [beats - base * (n - 1), ...Array(n - 1).fill(base)];
  return Array(n).fill(beats / n);
}

// ── song → Tune ────────────────────────────────────────────────────────────
const FEELS: [RegExp, Tune["feel"], number][] = [
  [/waltz/i, "waltz", 150],
  [/bossa|samba|latin|afro|cuban|mambo|bolero/i, "bossa", 140],
  [/ballad/i, "ballad", 72],
  [/even|rock|funk|pop|8ths|soul|r&b|gospel/i, "straight8", 100],
];

function feelOf(style: string): { feel: Tune["feel"]; tempo: number } {
  for (const [re, feel, tempo] of FEELS) if (re.test(style)) return { feel, tempo };
  return { feel: "swing", tempo: /up|fast|bebop/i.test(style) ? 240 : /slow/i.test(style) ? 100 : 160 };
}

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "untitled";

function fixTitle(t: string): string {
  const m = /^(.*), (The|A|An)$/i.exec(t.trim());
  return m ? `${m[2]} ${m[1]}` : t.trim();
}

function fixComposer(c: string): string | undefined {
  const parts = c.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || /^composer$/i.test(c.trim())) return undefined;
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : parts.join(" ");
}

function buildSong(fields: { title: string; composer: string; style: string; key: string; bpm: number; music: string }): ImportedSong {
  const warnings = new Set<string>();
  const title = fixTitle(fields.title) || "Untitled";
  const composer = fixComposer(fields.composer);
  const keyM = /^([A-G][b#]?)(-)?/.exec(fields.key.trim());
  if (!keyM) warnings.add(`Unknown key “${fields.key}”; assumed C major.`);
  const tonic = keyM?.[1] ?? "C";
  const mode: "major" | "minor" = keyM?.[2] ? "minor" : "major";

  const raw = expandRepeats(tokenize(fields.music, warnings));
  if (!raw.length) throw new IRealParseError(`“${title}” has no bars I could read.`);
  const meter: [number, number] = raw.find((b) => b.time)?.time ?? [4, 4];
  if (raw.some((b) => b.time && (b.time[0] !== meter[0] || b.time[1] !== meter[1]))) {
    warnings.add(`Time signature changes inside the tune; everything was read in ${meter.join("/")}.`);
  }
  const bpb = meter[0];

  // resolve x / r / p / W / N.C. into concrete chords per bar
  const resolved: ParsedChord[][] = [];
  const harmony: ChordEvent[] = [];
  let pendingRepeat: ParsedChord[] | null = null;
  let last: ParsedChord | null = null;
  let lastEvent: ChordEvent | null = null;
  const sections: Section[] = [];

  raw.forEach((bar, k) => {
    const barNo = k + 1;
    if (bar.section) {
      if (sections.length) sections[sections.length - 1].bars = barNo - sections[sections.length - 1].startBar;
      sections.push({ id: `${bar.section}${sections.filter((s) => s.label === bar.section).length + 1}`, label: bar.section, startBar: barNo, bars: 0 });
    }

    let slots: (ParsedChord | "hold")[] = [];
    if (bar.items.some((it) => it.kind === "repeat2")) {
      slots = resolved[k - 2] ?? [];
      pendingRepeat = resolved[k - 1] ?? null;
    } else if (bar.items.some((it) => it.kind === "repeat1")) {
      slots = resolved[k - 1] ?? [];
    } else if (!bar.items.length && pendingRepeat) {
      slots = pendingRepeat;
      pendingRepeat = null;
    } else {
      for (const it of bar.items) {
        if (it.kind === "chord") {
          const c = it.chord ?? (last ? { ...last, bass: it.invisibleBass } : null);
          if (c) slots.push(c);
        } else if (it.kind === "pause" || it.kind === "nc") slots.push("hold");
      }
    }
    resolved[k] = slots.filter((s): s is ParsedChord => s !== "hold");

    if (!slots.length) {
      if (lastEvent) lastEvent.beats += bpb; // empty bar: the chord rings on
      return;
    }
    const durs = splitBar(slots.length, bpb);
    let beat = 1;
    slots.forEach((s, j) => {
      if (s === "hold") {
        if (lastEvent) lastEvent.beats += durs[j];
      } else {
        const ev: ChordEvent = {
          id: `b${barNo}.${beat}`,
          at: { bar: barNo, beat },
          beats: durs[j],
          root: s.root,
          quality: s.quality,
          extensions: s.extensions,
          alterations: s.alterations,
          ...(s.bass && chroma(s.bass) !== chroma(s.root) ? { bass: s.bass } : {}),
        };
        harmony.push(ev);
        lastEvent = ev;
        last = s;
      }
      beat += durs[j];
    });
  });

  const totalBars = raw.length;
  if (sections.length) sections[sections.length - 1].bars = totalBars + 1 - sections[sections.length - 1].startBar;
  else sections.push({ id: "A1", label: "A", startBar: 1, bars: totalBars });
  if (sections[0].startBar > 1) sections.unshift({ id: "pickup", label: "–", startBar: 1, bars: sections[0].startBar - 1 });

  const { feel, tempo } = feelOf(fields.style);
  const tune: Tune = analyzeTune({
    id: slugify(`${title} ${composer ?? ""}`),
    title,
    composer,
    key: { tonic, mode },
    meter,
    feel: meter[0] === 3 && feel === "swing" ? "waltz" : feel,
    tempo: fields.bpm > 0 ? fields.bpm : tempo,
    sections,
    formOrder: sections.map((s) => s.id),
    harmony,
    melody: [],
    melodyCoverage: "none",
    source: { kind: "ireal", personalUseOnly: true },
  });
  return { tune, style: fields.style, warnings: [...warnings] };
}

/** Parse an irealb:// or irealbook:// link (single song or playlist). */
export function parseIRealUrl(input: string): IRealImport {
  const m = /(irealb(?:ook)?):\/\/([^"'\s<>]*)/.exec(input.trim());
  if (!m) throw new IRealParseError("That doesn't look like an iReal Pro link. It should start with irealb:// or irealbook://.");
  let payload: string;
  try {
    payload = decodeURIComponent(m[2]);
  } catch {
    throw new IRealParseError("The link is cut off or its encoding is broken. Copy it again from iReal Pro (Share → Copy link).");
  }

  if (m[1] === "irealbook") {
    const f = payload.split("=");
    const songs: ImportedSong[] = [];
    for (let i = 0; i + 5 < f.length; i += 6) {
      songs.push(buildSong({ title: f[i], composer: f[i + 1], style: f[i + 2], key: f[i + 3], bpm: 0, music: f[i + 5] }));
    }
    if (!songs.length) throw new IRealParseError("No songs found in that irealbook:// link.");
    return { playlist: null, songs };
  }

  const parts = payload.split("===");
  const playlist = parts.length > 1 ? parts.pop()!.trim() || null : null;
  const songs = parts
    .filter((p) => p.includes("="))
    .map((p) => {
      const f = p.split("=");
      const enc = f[6] ?? "";
      const music = enc.includes(MUSIC_PREFIX) ? unscramble(enc.split(MUSIC_PREFIX)[1]) : enc;
      return buildSong({ title: f[0], composer: f[1] ?? "", style: (f[3] ?? "").trim(), key: f[4] ?? "C", bpm: Number(f[8]) || 0, music });
    });
  if (!songs.length) throw new IRealParseError("No songs found in that link.");
  return { playlist, songs };
}

/** Build an irealb:// link for one song (round-trip tests, future export). */
export function toIRealUrl(s: { title: string; composer: string; style: string; key: string; bpm?: number; music: string }): string {
  // iReal never leaves the composer empty ("Composer" = unknown); an empty one would create "===", the song separator
  const fields = [s.title, s.composer.trim() || "Composer", "", s.style, s.key, "", MUSIC_PREFIX + scramble(s.music), "", String(s.bpm ?? 0), "3"];
  return "irealb://" + encodeURIComponent(fields.join("="));
}
