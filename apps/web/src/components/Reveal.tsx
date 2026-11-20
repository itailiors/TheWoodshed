import { useId, useState, type ReactNode } from "react";

/**
 * One-click disclosure for a secondary panel. Closed, its children are NOT mounted: a folded
 * heatmap must not keep grading (and saving) the notes you play. The open/closed choice is
 * remembered per `storeKey` so a panel you use stays open.
 */
export function useRevealState(storeKey: string, defaultOpen = false) {
  const key = `reharm.reveal.${storeKey}`;
  const [open, setOpenState] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultOpen : v === "1";
    } catch {
      return defaultOpen;
    }
  });
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  };
  return [open, setOpen] as const;
}

interface Props {
  label: ReactNode;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function Reveal({ label, open, onToggle, children, className = "" }: Props) {
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onToggle(!open)}
        className="cursor-pointer rounded-full border-2 border-dashed border-ink-soft px-3 py-0.5 font-marker text-ink-soft hover:border-ink hover:text-ink"
      >
        {label} <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      <div id={id} hidden={!open}>
        {open && children}
      </div>
    </div>
  );
}
