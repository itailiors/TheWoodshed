import { useEffect, useRef } from "react";
import { SketchBox } from "../design/rough";
import { paper, seedOf } from "../design/tokens";
import { CODE_NOTICE, FONT_CREDITS, REPO_URL, SAMPLE_CREDITS, type Credit } from "./credits";

const link = "underline decoration-ink-faint underline-offset-2 hover:decoration-ink";

function CreditList({ title, credits }: { title: string; credits: Credit[] }) {
  return (
    <section className="mt-3">
      <h3 className="font-marker">{title}</h3>
      <ul className="mt-1 space-y-1.5 text-sm">
        {credits.map((c) => (
          <li key={c.work} data-credit={c.work}>
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className={`font-bold ${link}`}>
              {c.work}
            </a>
            <span className="text-ink-soft">, {c.by}</span>
            <span className="text-ink-faint"> · {c.usedFor} · </span>
            <a href={c.licenceUrl} target="_blank" rel="noopener noreferrer" className={link}>
              {c.licence}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The ⚙ "Credits & licences" card. Modal like the `?` card: Escape closes it, and keys don't
 * reach the page's shortcuts behind it. Links open in a new tab; nothing here makes a request.
 */
export function CreditsDialog({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" || (e.target instanceof Node && box.current?.contains(e.target))) return;
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-paper/70 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="credits-h" className="w-full max-w-lg">
        <SketchBox seed={seedOf("credits")} strokeWidth={2} fill={paper.light}>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="credits-h" className="ink-wobble font-marker text-xl font-bold uppercase">
                Credits &amp; licences
              </h2>
              <button type="button" autoFocus onClick={onClose} aria-label="Close" className="cursor-pointer font-marker text-lg text-ink-soft hover:text-ink pointer-coarse:min-h-11 pointer-coarse:min-w-11">
                ×
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-soft">The band's samples and the fonts load from their own hosts, unmodified (the app repitches samples as it plays).</p>
            <CreditList title="Samples" credits={SAMPLE_CREDITS} />
            <CreditList title="Fonts" credits={FONT_CREDITS} />
            <p className="mt-3 border-t-2 border-dashed border-ink-faint pt-2 text-xs text-ink-soft" data-code-notice>
              Reharm Lab:{" "}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={link}>
                source on GitHub
              </a>
              . {CODE_NOTICE}
            </p>
          </div>
        </SketchBox>
      </div>
    </div>
  );
}
