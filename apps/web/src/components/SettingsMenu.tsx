import { useEffect, useId, useRef, useState } from "react";
import { ThemeSwitch } from "./ThemeSwitch";

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
      </div>
    </div>
  );
}
