import { useEffect, useSyncExternalStore } from "react";
import { SketchBox } from "../design/rough";
import { paper, pen, seedOf } from "../design/tokens";

/*
 * Toasts as notes pinned to the margin: a sketched paper slip, slightly askew, that
 * fades out on its own. `toast()` can be called from anywhere (React or not).
 */

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "warn";
  /** ms before it dismisses itself; 0 = stays until closed. */
  ttl: number;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, { tone = "info", ttl = 7000 }: { tone?: Toast["tone"]; ttl?: number } = {}) {
  // The same note twice in a row (e.g. a retry) just stays up, instead of stacking.
  if (toasts.some((t) => t.text === text)) return;
  toasts = [...toasts, { id: nextId++, text, tone, ttl }].slice(-3);
  emit();
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

function Slip({ t }: { t: Toast }) {
  useEffect(() => {
    if (!t.ttl) return;
    const timer = setTimeout(() => dismissToast(t.id), t.ttl);
    return () => clearTimeout(timer);
  }, [t]);
  const seed = seedOf(`toast-${t.id}`);
  return (
    <SketchBox
      seed={seed}
      fill={paper.light}
      stroke={t.tone === "warn" ? pen.red : "currentColor"}
      className={`animate-ink-in pointer-events-auto w-full max-w-md ${seed % 2 ? "rotate-[0.6deg]" : "-rotate-[0.5deg]"}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span aria-hidden className="font-marker text-lg leading-none" style={{ color: t.tone === "warn" ? pen.red : undefined }}>
          {t.tone === "warn" ? "!" : "✎"}
        </span>
        <p className="flex-1 text-[15px] leading-snug">{t.text}</p>
        <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="cursor-pointer font-marker text-ink-soft hover:text-ink">
          ×
        </button>
      </div>
    </SketchBox>
  );
}

/** Render once near the root. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts);
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 text-ink"
    >
      {list.map((t) => (
        <Slip key={t.id} t={t} />
      ))}
    </div>
  );
}
