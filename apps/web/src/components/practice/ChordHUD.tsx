import { prettyNote, prettySymbol, symbol, type ImprovEntry } from "@reharm/theory-core";
import { SketchBox } from "../../design/rough";
import { paper, pen, seedOf, wash } from "../../design/tokens";
import { ChordName } from "../ChordName";
import { DoodleKeyboard } from "../DoodleKeyboard";

interface Props {
  now: ImprovEntry | null;
  next: ImprovEntry | null;
  /** Beats until the next chord sounds; null when stopped. */
  beatsToNext: number | null;
  playing: boolean;
}

const DEGREE: Record<string, string> = { "1": "root", "3": "3rd", b3: "♭3rd", "4": "4th", "5": "5th", "7": "7th", b7: "♭7th", bb7: "°7th", "6": "6th", "9": "9th", "13": "13th" };
const deg = (d: string) => DEGREE[d] ?? prettyNote(d);

/**
 * Current Chord HUD: the chord under the playhead, its right-hand scale drawn on a
 * doodle keyboard (guide tones ringed), where to land next, and a look-ahead.
 */
export function ChordHUD({ now, next, beatsToNext, playing }: Props) {
  if (!now) {
    return (
      <SketchBox seed={seedOf("hud-empty")} className="h-full" innerClassName="h-full grid place-items-center p-6 text-center font-marker text-ink-soft">
        Press Space to start the loop.
      </SketchBox>
    );
  }
  const [top, ...rest] = now.scales;
  const imminent = playing && beatsToNext !== null && beatsToNext <= 1;

  return (
    <SketchBox seed={seedOf("hud")} fill={paper.light} strokeWidth={2} className="h-full" innerClassName="flex h-full flex-col gap-1.5 overflow-y-auto p-3 sm:gap-2 sm:overflow-hidden sm:p-4">
      {/* NOW */}
      <div key={now.chord.id} className="animate-ink-in shrink-0">
        <p className="font-marker text-xs uppercase tracking-[0.2em] text-ink-soft">
          {playing ? "Now" : "First chord"}
          {now.chord.analysis && <span className="ml-2 normal-case tracking-normal">· {now.chord.analysis.roman}</span>}
        </p>
        <ChordName symbol={symbol(now.chord)} className="block text-3xl leading-tight sm:text-5xl xl:text-6xl" />
        {top ? (
          <>
            <p className="font-marker text-lg leading-tight sm:text-2xl" style={{ color: pen.red }}>
              {top.name}
            </p>
            {top.parent && <p className="text-xs text-ink-soft sm:text-sm">from {top.parent}</p>}
          </>
        ) : (
          <p className="font-marker text-base text-ink-soft sm:text-lg">play the chord tones</p>
        )}
      </div>

      {/* the scale, drawn (guaranteed a minimum usable height so mobile flex layout never crushes it to 0px) */}
      {top && (
        <div className="flex min-h-[72px] flex-1 items-center justify-center sm:min-h-[88px]">
          <DoodleKeyboard notes={top.notes} accent={now.guideTones.map((g) => g.note)} color={wash.mustard} className="max-h-full max-w-full!" />
        </div>
      )}

      {/* guide tones + landing */}
      <div className="shrink-0 space-y-0.5 text-xs leading-snug sm:space-y-1 sm:text-[15px]">
        <p>
          <span className="font-marker font-bold">Guide tones:</span>{" "}
          {now.guideTones.map((g) => `${prettyNote(g.note)} (${deg(g.degree)})`).join(" · ")}
        </p>
        {now.targets.length > 0 && next && (
          <p className={`rounded px-1 transition-colors duration-150 ${imminent ? "bg-wash-mustard/50" : ""}`}>
            <span className="font-marker font-bold">Land on:</span>{" "}
            {now.targets.map((t) => `${prettyNote(t.from)} → ${prettyNote(t.to)} (${deg(t.toDegree)})`).join(",  ")}
          </p>
        )}
        {top && top.avoid.length > 0 && (
          <p className="text-xs text-ink-soft sm:text-sm">
            Don't hold: <span style={{ color: pen.red }}>{top.avoid.map(prettyNote).join(" ")}</span>
          </p>
        )}
        {rest.length > 0 && <p className="truncate text-xs text-ink-soft sm:text-sm">also: {rest.map((s) => s.name).join(" · ")}</p>}
      </div>

      {/* NEXT */}
      {next && (
        <div className={`shrink-0 border-t-2 border-dashed border-ink/30 pt-1.5 sm:pt-2 ${imminent ? "opacity-100" : "opacity-70"}`}>
          <p className="flex items-baseline justify-between font-marker text-xs uppercase tracking-[0.2em] text-ink-soft">
            <span>Next</span>
            {playing && beatsToNext !== null && (
              <span className="normal-case tracking-normal">
                in {beatsToNext} beat{beatsToNext === 1 ? "" : "s"}
              </span>
            )}
          </p>
          <p className="flex items-baseline gap-3">
            <ChordName symbol={symbol(next.chord)} className="text-xl sm:text-2xl" />
            {next.scales[0] && <span className="truncate font-marker text-sm text-ink-soft sm:text-base">{next.scales[0].name}</span>}
          </p>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {`${prettySymbol(symbol(now.chord))}${top ? `, ${top.name}` : ""}`}
      </span>
    </SketchBox>
  );
}
