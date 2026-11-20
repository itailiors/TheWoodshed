import { chroma, prettyNote } from "@reharm/theory-core";

/*
 * A lesson step's key-centre map (`LessonStep.map`, the Coltrane lesson's step 1): the 12 keys on a
 * ring, home at the top, and the centres the tour visits joined in order. Three centres a major 3rd
 * apart land on every 4th mark, so the tour reads as a triangle before a note is played. The notes
 * come from the lesson (the engine's); this only places them.
 */

const R = 40;
const C = 60;

/** Where a note sits on the ring: home (the last centre) at 12 o'clock, a half step = 30° clockwise. */
export function ringPoint(note: string, home: string, r = R): { x: number; y: number } {
  const steps = (((chroma(note) - chroma(home)) % 12) + 12) % 12;
  const a = (steps * Math.PI) / 6;
  return { x: +(C + r * Math.sin(a)).toFixed(2), y: +(C - r * Math.cos(a)).toFixed(2) };
}

export function KeyCentreMap({ centres }: { centres: string[] }) {
  if (centres.length < 2) return null;
  const home = centres[centres.length - 1];
  const pts = centres.map((n) => ringPoint(n, home));
  const names = centres.map(prettyNote);
  return (
    <figure className="my-1 flex items-center gap-3" data-key-centre-map>
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0 text-ink" role="img" aria-label={`Key-centre map: ${names.join(", then ")}, on the ring of 12 keys.`}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.5} />
        {Array.from({ length: 12 }, (_, k) => {
          const a = (k * Math.PI) / 6;
          return <circle key={k} cx={C + R * Math.sin(a)} cy={C - R * Math.cos(a)} r={1.6} fill="currentColor" fillOpacity={0.45} />;
        })}
        {/* the tour, in order, back to where it started */}
        <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" className="text-pen" />
        {pts.map((p, i) => {
          const label = ringPoint(centres[i], home, R + 13);
          const last = i === pts.length - 1;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={last ? 5 : 4} fill={last ? "currentColor" : "var(--color-paper-light)"} stroke="currentColor" strokeWidth={2} />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={14} fill="currentColor" className="font-marker">
                {names[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="font-hand text-base text-ink-soft">
        {names.join(" → ")}
      </figcaption>
    </figure>
  );
}
