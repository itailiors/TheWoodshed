import { useRef } from "react";
import { useRough, type RoughCanvas } from "../design/rough";
import { ink, paper, seedOf } from "../design/tokens";

type Draw = (rc: RoughCanvas, add: (n: SVGElement) => void, seed: number) => void;
const o = (seed: number, extra: Record<string, unknown> = {}) => ({ seed, stroke: ink.deep, strokeWidth: 2, roughness: 1, ...extra });

const ICONS: Record<string, Draw> = {
  menu: (rc, add, s) => [10, 20, 30].forEach((y, i) => add(rc.line(8, y, 32, y, o(s + i)))),
  keyboard: (rc, add, s) => {
    add(rc.rectangle(8, 8, 24, 24, o(s)));
    [14, 20, 26].forEach((x, i) => add(rc.rectangle(x - 2, 8, 4, 14, o(s + i + 1, { fill: ink.deep, fillStyle: "solid", strokeWidth: 1 }))));
  },
  practice: (rc, add, s) =>
    [11, 20, 29].forEach((y, i) => {
      add(rc.circle(10, y, 5, o(s + i)));
      add(rc.line(17, y, 32, y, o(s + 10 + i)));
    }),
  settings: (rc, add, s) => {
    add(rc.circle(20, 20, 18, o(s)));
    add(rc.circle(20, 20, 6, o(s + 1)));
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      add(rc.line(20 + Math.cos(a) * 9, 20 + Math.sin(a) * 9, 20 + Math.cos(a) * 14, 20 + Math.sin(a) * 14, o(s + 2 + i)));
    }
  },
  play: (rc, add, s) => {
    add(rc.circle(20, 20, 34, o(s, { fill: ink.deep, fillStyle: "solid" })));
    add(rc.polygon([[16, 12], [16, 28], [29, 20]], o(s + 1, { fill: paper.light, fillStyle: "solid", stroke: paper.light })));
  },
  stop: (rc, add, s) => {
    add(rc.circle(20, 20, 34, o(s, { fill: ink.deep, fillStyle: "solid" })));
    add(rc.rectangle(14, 14, 12, 12, o(s + 1, { fill: paper.light, fillStyle: "solid", stroke: paper.light })));
  },
  notes: (rc, add, s) => {
    add(rc.rectangle(9, 8, 22, 24, o(s)));
    [15, 20, 25].forEach((y, i) => add(rc.line(13, y, 27, y, o(s + i + 1, { strokeWidth: 1.4 }))));
  },
};

function RailIcon({ name, label, onClick, active }: { name: keyof typeof ICONS; label: string; onClick?: () => void; active?: boolean }) {
  const g = useRef<SVGGElement>(null);
  useRough(g, (rc, add) => ICONS[name](rc, add, seedOf(name)), [name]);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-12 w-12 cursor-pointer place-items-center rounded-lg transition-transform hover:-rotate-3 hover:scale-105 ${
        active ? "bg-paper-shade/70" : ""
      }`}
    >
      <svg viewBox="0 0 40 40" className="h-10 w-10 overflow-visible">
        <g ref={g} />
      </svg>
    </button>
  );
}

export function SideRail({
  playing,
  onPlay,
  onPractice,
  onLibrary,
}: {
  playing: boolean;
  onPlay: () => void;
  onPractice: () => void;
  onLibrary: () => void;
}) {
  return (
    <nav aria-label="Main" className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col items-center gap-4 border-r-2 border-dashed border-ink/40 py-6 md:flex">
      <RailIcon name="menu" label="Menu" />
      <RailIcon name="keyboard" label="Reharm Engine" active />
      <RailIcon name="practice" label="Comping coach (selected move)" onClick={onPractice} />
      <RailIcon name="settings" label="Settings" />
      <div className="my-2" />
      <RailIcon name={playing ? "stop" : "play"} label={playing ? "Stop" : "Play"} onClick={onPlay} />
      <div className="flex-1" />
      <RailIcon name="notes" label="Setlist (library & import)" onClick={onLibrary} />
    </nav>
  );
}
