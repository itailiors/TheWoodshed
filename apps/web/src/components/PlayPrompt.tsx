import { useEffect } from "react";
import { SketchBox } from "../design/rough";
import { paper, seedOf } from "../design/tokens";

interface Props {
  title: string;
  /** "Level 3 · in B♭ · 132 bpm" */
  detail: string;
  onPlay: () => void;
  onClose: () => void;
}

/**
 * A `play=1` link can't start the band by itself: browsers only let audio start from a click.
 * So the link opens on this: one big ▶ that is that click. "Just look" (or Escape, or a click
 * on the backdrop) leaves the page as the link set it up, silent.
 */
export function PlayPrompt({ title, detail, onPlay, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-paper/70 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="play-prompt-h" className="w-full max-w-sm">
        <SketchBox seed={seedOf("play-prompt")} strokeWidth={2} fill={paper.light}>
          <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
            <h2 id="play-prompt-h" className="ink-wobble font-marker text-2xl font-bold uppercase leading-tight">
              {title}
            </h2>
            <p className="text-sm text-ink-soft">{detail}</p>
            <button
              type="button"
              autoFocus
              onClick={onPlay}
              aria-label={`Play ${title}`}
              className="grid h-20 w-20 cursor-pointer place-items-center rounded-full border-[3px] border-ink bg-ink text-3xl text-paper-light hover:-rotate-3 focus-visible:outline-offset-4"
            >
              ▶
            </button>
            <button type="button" onClick={onClose} className="cursor-pointer font-marker text-sm text-ink-soft underline decoration-dashed hover:text-ink">
              Just look
            </button>
          </div>
        </SketchBox>
      </div>
    </div>
  );
}
