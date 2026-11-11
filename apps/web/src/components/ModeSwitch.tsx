export type AppMode = "study" | "practice";

/** Study (Reharm Engine) ↔ Practice (hands on the keys). */
export function ModeSwitch({ mode, onMode }: { mode: AppMode; onMode: (m: AppMode) => void }) {
  return (
    <div role="tablist" aria-label="Mode" className="flex rounded-full border-2 border-ink p-0.5 font-marker">
      {(["study", "practice"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => onMode(m)}
          className={`cursor-pointer rounded-full px-3 py-0.5 capitalize ${mode === m ? "bg-ink text-paper-light" : "hover:bg-paper-shade"}`}
        >
          {m === "study" ? "Study" : "Practice"}
        </button>
      ))}
    </div>
  );
}
