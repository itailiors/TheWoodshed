import { useEffect, useRef } from "react";
import { SketchBox } from "../design/rough";
import { paper, seedOf } from "../design/tokens";

export type Shortcut = [keys: string, what: string];

export const STUDY_SHORTCUTS: Shortcut[] = [
  ["Space", "play / stop"],
  ["← →", "previous / next move"],
  ["⇧ ← →", "previous / next chord"],
  ["↑ ↓", "dial up / down"],
  ["A", "original / reharm"],
  ["L", "loop the move"],
  ["[ ]", "tempo"],
  [", .", "key ½ step"],
  ["M", "QWERTY keys"],
  ["?", "this list"],
];

export const PRACTICE_SHORTCUTS: Shortcut[] = [
  ["Space", "play / stop"],
  ["← →", "reharm level"],
  ["A", "A/B"],
  ["L", "loop move"],
  ["T", "trade 2s/4s"],
  ["F", "improv mode (V: what's shown)"],
  ["[ ]", "tempo"],
  [", .", "key ½ step"],
  ["1–4", "pno/bass/dr/click"],
  ["M", "QWERTY keys"],
  ["Esc", "study"],
  ["?", "this list"],
];

/** Coach's Learn stage (the LessonStepper). Space/Enter on a focused button press that button instead. */
export const COACH_LEARN_SHORTCUTS: Shortcut[] = [
  ["← →", "back / next step"],
  ["Enter", "next step (on a question: Show me, then reveal)"],
  ["Space", "▶ hear the step"],
  ["Esc", "close a word's note"],
  ["M", "QWERTY keys"],
  ["?", "this list"],
];

/** Shortcuts the letter keys can't serve while QWERTY mode is playing notes with them. */
const QWERTY_TAKES = new Set(["A", "L", "T", "F"]);
export const available = (list: Shortcut[], qwertyOn: boolean) => list.filter(([k]) => !(qwertyOn && QWERTY_TAKES.has(k)));

/** Keys a page shortcut must leave alone: typing in a field, or a browser/OS chord. */
export const notForUs = (e: KeyboardEvent) => {
  const t = e.target;
  return (
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
};

export const Kbd = ({ k }: { k: string }) => <kbd className="rounded border border-ink-faint px-1 font-hand">{k}</kbd>;

interface Props {
  title: string;
  shortcuts: Shortcut[];
  /** QWERTY mode is on: the letters it plays are listed as unavailable. */
  qwertyOn: boolean;
  onClose: () => void;
}

/**
 * The `?` card. Modal: while it's up, keys go nowhere else (Escape or `?` closes it), so a
 * stray Space can't start the band behind it. Listens in the capture phase, ahead of the
 * page's own shortcut handlers (QWERTY's capture listener still runs first: it was installed
 * at startup).
 */
export function ShortcutsHelp({ title, shortcuts, qwertyOn, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // stopImmediatePropagation, not stopPropagation: a page handler on window itself would
      // otherwise still hear the key (e.g. Practice Mode's Escape → back to Study)
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      // Tab, and Enter/Space on the close button, still work inside the card
      if (e.key === "Tab" || (e.target instanceof Node && box.current?.contains(e.target))) return;
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const usable = new Set(available(shortcuts, qwertyOn).map(([k]) => k));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-paper/70 px-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="shortcuts-h" className="w-full max-w-md">
        <SketchBox seed={seedOf("shortcuts")} strokeWidth={2} fill={paper.light}>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="shortcuts-h" className="ink-wobble font-marker text-xl font-bold uppercase">
                {title}
              </h2>
              <button type="button" autoFocus onClick={onClose} aria-label="Close" className="cursor-pointer font-marker text-lg text-ink-soft hover:text-ink">
                ×
              </button>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {shortcuts.map(([k, v]) => (
                <div key={k} className={`contents ${usable.has(k) ? "" : "[&>*]:opacity-40"}`}>
                  <dt className="text-right">
                    <Kbd k={k} />
                  </dt>
                  <dd>
                    {v}
                    {!usable.has(k) && <span className="text-ink-faint"> (playing a note while QWERTY keys are on)</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </SketchBox>
      </div>
    </div>
  );
}
