import { useEffect, useId, useRef, useState } from "react";
import { PANEL_LABEL, readPanelOpens, resetPanelOpens } from "../usage/panelOpens";
import { ThemeSwitch } from "./ThemeSwitch";

/** The panel-open tally: which folded panels you actually open. Read fresh each time the menu opens. */
function PanelUse() {
  const [counts, setCounts] = useState(readPanelOpens);
  const rows = Object.entries(counts)
    .filter(([name]) => PANEL_LABEL[name])
    .sort((a, b) => b[1].opens - a[1].opens);
  return (
    <section aria-label="Panel use" className="mt-3 border-t-2 border-dashed border-ink-faint pt-2 text-sm">
      <h3 className="font-marker">Panels you open</h3>
      <p className="text-xs text-ink-faint">Counted in this browser only, never sent.</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-ink-soft">Nothing opened yet.</p>
      ) : (
        <>
          <ul className="mt-1 space-y-0.5">
            {rows.map(([name, c]) => (
              <li key={name} className="flex justify-between gap-4">
                <span>{PANEL_LABEL[name]}</span>
                <span className="font-marker tabular-nums">{c.opens}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              resetPanelOpens();
              setCounts({});
            }}
            className="mt-1 cursor-pointer text-xs text-ink-soft underline hover:text-ink"
          >
            Reset counts
          </button>
        </>
      )}
    </section>
  );
}

/**
 * One ⚙ in the header instead of controls you set once and forget (the colour scheme today).
 * A popover: Escape or a click outside closes it, and focus goes back to the button.
 */
export function SettingsMenu() {
  const [open, setOpenState] = useState(false);
  // the header wraps on phones and can put the ⚙ at the left edge: open toward the side with room
  const [alignLeft, setAlignLeft] = useState(false);
  const setOpen = (v: boolean) => {
    if (v && button.current) setAlignLeft(button.current.getBoundingClientRect().right < window.innerWidth / 2);
    setOpenState(v);
  };
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
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen(!open)}
        className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-ink font-marker hover:bg-paper-shade ${open ? "bg-paper-shade" : ""}`}
      >
        <span aria-hidden>⚙</span>
      </button>
      <div
        id={id}
        hidden={!open}
        role="group"
        aria-label="Settings"
        className={`absolute ${alignLeft ? "left-0" : "right-0"} top-full z-40 mt-2 w-max rounded-lg border-2 border-ink bg-paper-light p-3 shadow-[3px_3px_0_var(--color-ink)]`}
      >
        <div className="flex items-center gap-3 font-marker text-sm">
          <span>Colours</span>
          <ThemeSwitch />
        </div>
        {open && <PanelUse />}
      </div>
    </div>
  );
}
