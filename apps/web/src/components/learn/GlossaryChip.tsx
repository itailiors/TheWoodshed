import { glossaryEntry, learnName } from "@reharm/theory-core";
import { useEffect, useId, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { useNarrow } from "../../device/media";
import { useEscapeCapture } from "./useEscapeCapture";

interface Props {
  /** A glossary term or alias ("tritone sub", "ii"). Without an entry the children render plain. */
  term: string;
  /** What the text shows; defaults to `term`. */
  children?: ReactNode;
  /** "Learn it →": open that concept's lesson. Hidden when absent or the entry has no concept. */
  onLearn?: (conceptId: string) => void;
}

/** How long the mouse rests on a chip before its note opens. */
export const HOVER_MS = 300;

/**
 * A word with a short note behind it (spec §D): a dotted underline, no icon. Opens after
 * 300 ms of hover, on focus + Enter, or on a tap; the note holds the term, its ≤ 8-word gloss
 * and "Learn it →" when the entry names a concept. Esc (capture phase, so the page's own Esc
 * doesn't fire) or a tap outside closes it. On a phone the note opens as a bottom sheet.
 */
export function GlossaryChip({ term, children, onLearn }: Props) {
  const entry = glossaryEntry(term);
  const [open, setOpen] = useState(false);
  const byHover = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const narrow = useNarrow();
  const id = useId();

  const close = (refocus: boolean) => {
    setOpen(false);
    byHover.current = false;
    if (refocus) btn.current?.focus();
  };
  useEscapeCapture(open, () => close(true));

  // a tap or click outside closes it
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && (wrap.current?.contains(e.target) || note.current?.contains(e.target))) return;
      close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!entry) return <>{children ?? term}</>;

  const hoverIn = (e: RPointerEvent) => {
    if (e.pointerType !== "mouse" || open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      byHover.current = true;
      setOpen(true);
    }, HOVER_MS);
  };
  const hoverOut = (e: RPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (timer.current) clearTimeout(timer.current);
    if (byHover.current) close(false);
  };
  const click = () => {
    if (timer.current) clearTimeout(timer.current);
    // a click on a note the hover already opened keeps it open (and pins it)
    if (open && byHover.current) {
      byHover.current = false;
      return;
    }
    setOpen((o) => !o);
  };

  const learnable = entry.conceptId && onLearn ? entry.conceptId : null;
  const body = (
    <div
      ref={note}
      id={id}
      role="dialog"
      aria-label={entry.term}
      className={
        narrow
          ? "fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-paper-light px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-left font-hand text-base text-ink shadow-lg"
          : "absolute top-full left-0 z-40 mt-1 w-60 rounded-md border-2 border-ink bg-paper-light px-3 py-2 text-left font-hand text-sm text-ink shadow-md"
      }
    >
      <strong className="font-marker">{entry.term}</strong>
      <span className="block">{entry.gloss}</span>
      {learnable && (
        <button
          type="button"
          onClick={() => {
            close(false);
            onLearn!(learnable);
          }}
          className="mt-1 cursor-pointer font-marker text-pen underline-offset-2 hover:underline"
          aria-label={`Learn it: ${learnName(learnable)}`}
        >
          Learn it →
        </button>
      )}
    </div>
  );

  return (
    <span ref={wrap} className="relative inline" onPointerEnter={hoverIn} onPointerLeave={hoverOut}>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={click}
        className="cursor-help underline decoration-ink-soft decoration-dotted decoration-2 underline-offset-4 hover:decoration-ink"
      >
        {children ?? term}
      </button>
      {open && body}
    </span>
  );
}
