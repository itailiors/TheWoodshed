import { decodeSymbol, glossaryEntry, learnName } from "@reharm/theory-core";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { useNarrow } from "../../device/media";
import { useEscapeCapture } from "./useEscapeCapture";

interface Props {
  /** A glossary term or alias ("tritone sub", "ii"). Without an entry the children render plain. */
  term?: string;
  /**
   * A chord symbol ("G7(♭9)"): the chip is the decoder, and its note breaks the symbol into its
   * parts (theory-core's `decodeSymbol`). Not a symbol: the children render plain.
   */
  symbol?: string;
  /** What the text shows; defaults to the term or symbol. Keep it plain text (no elements inside the chip). */
  children?: ReactNode;
  /**
   * "Learn it →": open that concept's lesson. Default: the Coach deep link (`#coach/<id>`), so a
   * chip on any screen can route there; Coach passes its own (with the return banner).
   */
  onLearn?: (conceptId: string) => void;
}

/** How long the mouse rests on a chip before its note opens. */
export const HOVER_MS = 300;
/** The note's width on a desktop, px. */
const NOTE_W = 256;

/** The default "Learn it →": Coach on that concept, through the `#coach/<conceptId>` deep link App listens for. */
export const learnByLink = (conceptId: string) => {
  window.location.hash = `coach/${conceptId}`;
};

/**
 * A word with a short note behind it (spec §D): a dotted underline, no icon. Opens after
 * 300 ms of hover, on focus + Enter, or on a tap; the note holds the term, its ≤ 8-word gloss
 * and "Learn it →" when the entry names a concept. Esc (capture phase, so the page's own Esc
 * doesn't fire) or a tap outside closes it. On a phone the note opens as a bottom sheet.
 * With `symbol` it's the chord-symbol decoder: the note lists the symbol's parts and notes.
 */
export function GlossaryChip({ term, symbol, children, onLearn = learnByLink }: Props) {
  const entry = term ? glossaryEntry(term) : undefined;
  const decoded = !entry && symbol ? decodeSymbol(symbol) : null;
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

  // on a desktop the note is fixed to the viewport next to the chip, so a clipping box (the
  // Practice HUD, a scrolling list) can't cut it off; it follows the chip on scroll and resize
  const [pos, setPos] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!open || narrow) return setPos(null);
    const place = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - NOTE_W - 8));
      // below the chip, or above it when the space below is short
      setPos(window.innerHeight - r.bottom < 180 && r.top > 180 ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, narrow]);

  if (!entry && !decoded) return <>{children ?? term ?? symbol}</>;

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

  const learnable = entry?.conceptId ?? null;
  const title = entry ? entry.term : decoded!.symbol;
  const body = (
    <div
      ref={note}
      id={id}
      role="dialog"
      aria-label={title}
      data-chip-note={entry ? "term" : "symbol"}
      style={narrow ? undefined : { width: NOTE_W, ...(pos ?? { visibility: "hidden" }) }}
      className={
        narrow
          ? "fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-paper-light px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-left font-hand text-base font-normal normal-case tracking-normal text-ink shadow-lg"
          : "fixed z-50 rounded-md border-2 border-ink bg-paper-light px-3 py-2 text-left font-hand text-sm font-normal normal-case tracking-normal text-ink shadow-md"
      }
    >
      <strong className="font-marker">{title}</strong>
      {entry ? (
        <span className="block">{entry.gloss}</span>
      ) : (
        <ul className="mt-0.5 space-y-0.5">
          {decoded!.parts.map((p, i) => (
            <li key={i}>
              <span className="font-marker">{p.text}</span> {p.meaning}
              {p.notes.length > 0 && !p.meaning.includes("(") && p.notes.join("") !== p.text.replace(/^\//, "") ? ` (${p.notes.join(", ")})` : ""}
            </li>
          ))}
        </ul>
      )}
      {learnable && (
        <button
          type="button"
          onClick={() => {
            close(false);
            onLearn(learnable);
          }}
          className="mt-1 cursor-pointer font-marker text-pen underline-offset-2 hover:underline pointer-coarse:min-h-11"
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
        data-chip={entry ? "term" : "symbol"}
        onClick={click}
        className="cursor-help underline decoration-ink-soft decoration-dotted decoration-2 underline-offset-4 hover:decoration-ink"
      >
        {children ?? term ?? symbol}
      </button>
      {open && body}
    </span>
  );
}
