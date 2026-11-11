import { prettyNote, symbol, type ImprovEntry } from "@reharm/theory-core";
import { SketchBox, SketchRule } from "../design/rough";
import { seedOf, wash } from "../design/tokens";
import { ChordName } from "./ChordName";
import { DoodleKeyboard } from "./DoodleKeyboard";

export function ImprovCard({ entries, title }: { entries: ImprovEntry[]; title: string }) {
  return (
    <SketchBox seed={seedOf("improv" + title)} className="text-ink">
      <section className="p-4" aria-label="Improvisation map">
        <h3 className="ink-wobble text-center font-marker text-xl font-bold uppercase">Improvising</h3>
        <p className="text-center text-sm text-ink-soft">(right hand) · {title}</p>
        <div className="mt-3 space-y-5">
          {entries.map((e, i) => {
            const [top, ...rest] = e.scales;
            return (
              <div key={e.chord.id}>
                {i > 0 && <SketchRule seed={seedOf(e.chord.id)} className="mb-4 opacity-50" strokeWidth={1} />}
                <div className="flex items-baseline justify-between gap-2">
                  <ChordName symbol={symbol(e.chord)} className="text-2xl" />
                  {top ? (
                    <span className="text-right font-marker text-lg">{top.name}</span>
                  ) : (
                    <span className="text-wash-brick text-sm">no scale fits the chord and melody</span>
                  )}
                </div>
                {top && (
                  <>
                    <p className="text-sm text-ink-soft">
                      {top.parent && <>from {top.parent} · </>}
                      {top.why}
                    </p>
                    <DoodleKeyboard notes={top.notes} accent={e.guideTones.map((g) => g.note)} color={wash.mustard} className="mt-2" />
                  </>
                )}
                {e.targets.length > 0 && (
                  <p className="mt-1 text-sm">
                    <span className="font-marker font-bold">Land on:</span>{" "}
                    {e.targets.map((t) => `${prettyNote(t.from)} → ${prettyNote(t.to)}`).join(",  ")}
                  </p>
                )}
                {rest.length > 0 && <p className="text-sm text-ink-soft">also: {rest.map((s) => s.name).join(" · ")}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </SketchBox>
  );
}
