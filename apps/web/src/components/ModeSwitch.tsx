export type AppMode = "study" | "practice" | "coach";

const MODES: { id: AppMode; label: string; title: string }[] = [
  { id: "study", label: "Study", title: "The reharm engine: the lead sheet, the dial and the theory" },
  { id: "practice", label: "Practice", title: "Hands on the keys: the loop, the HUD and the improv heatmap" },
  { id: "coach", label: "Coach", title: "The Comping Coach: drill a move's voicings in all 12 keys" },
];

/** Study (Reharm Engine) ↔ Practice (hands on the keys) ↔ Coach (voicing drills). */
export function ModeSwitch({ mode, onMode }: { mode: AppMode; onMode: (m: AppMode) => void }) {
  return (
    <div role="tablist" aria-label="Mode" className="flex rounded-full border-2 border-ink p-0.5 font-marker">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          title={m.title}
          onClick={() => onMode(m.id)}
          className={`cursor-pointer rounded-full px-3 py-0.5 ${mode === m.id ? "bg-ink text-paper-light" : "hover:bg-paper-shade"}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
