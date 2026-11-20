import { useRevealState } from "../Reveal";
import { FIRST_RUN_HINTS, type HintScreen } from "./hints";

/*
 * One dismissible line per screen (spec §D "First-run hints"); Study keeps its own inline one
 * (`hint.study`). Stored as `reharm.reveal.hint.<screen>` through `useRevealState`, whose `hint.*`
 * keys skip the panel-open counter. If storage throws, the hint just shows each session.
 */

interface Props {
  screen: HintScreen;
  /**
   * A routing line is already showing (a PrereqNote or the return banner): one routing line at
   * a time (spec §A), so the hint waits.
   */
  hidden?: boolean;
  /** Replaces the screen's line (Practice on a touch-first phone has no ⌨). */
  text?: string;
  className?: string;
}

export function FirstRunHint({ screen, hidden = false, text, className = "" }: Props) {
  const [dismissed, setDismissed] = useRevealState(`hint.${screen}`);
  if (dismissed || hidden) return null;
  return (
    <p role="note" data-first-run-hint={screen} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 font-hand text-sm text-ink-soft ${className}`}>
      <span>{text ?? FIRST_RUN_HINTS[screen]}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="cursor-pointer font-marker text-xs underline decoration-dotted hover:text-ink pointer-coarse:min-h-11"
        aria-label="Got it: dismiss this tip"
      >
        ✕ Got it
      </button>
    </p>
  );
}
