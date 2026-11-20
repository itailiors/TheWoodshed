import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * "⋯ More": the toolbar's occasional tools (Engine X-ray, Share, shortcuts, the pedal link)
 * folded behind one pill, so the first view leads with the tune, the dial and the moves (P6
 * persona review: 45 controls above the fold). A popover like ⚙: Esc or a click outside closes
 * it and focus goes back to the pill; picking an item closes it too.
 */
export function MoreMenu({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={`cursor-pointer rounded-full border-2 border-dashed border-ink px-3 py-0.5 font-marker hover:bg-paper-shade pointer-coarse:min-h-11 ${open ? "bg-paper-shade" : ""}`}
      >
        <span aria-hidden>⋯ </span>More
      </button>
      <div
        id={id}
        hidden={!open}
        role="group"
        aria-label="More tools"
        className="absolute left-0 top-full z-40 mt-2 flex w-max max-w-[min(20rem,calc(100vw-2rem))] flex-col items-start gap-2 rounded-lg border-2 border-ink bg-paper-light p-3 shadow-[3px_3px_0_var(--color-ink)]"
      >
        {open && children(() => setOpen(false))}
      </div>
    </div>
  );
}
