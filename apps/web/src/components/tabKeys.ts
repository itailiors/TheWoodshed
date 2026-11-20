import type { KeyboardEvent } from "react";

/**
 * Arrow keys in a tablist (WAI-ARIA tabs, manual activation): ← / → move focus to the previous /
 * next tab (wrapping), Home / End to the first / last; Enter or Space then picks it (the tab is a
 * button). Put it on the `role="tablist"` element, and give each tab `tabIndex={selected ? 0 : -1}`
 * (roving tabindex) so Tab enters the list once. Manual, not automatic: moving through the Mode
 * tabs mustn't switch screens on every arrow. `preventDefault` keeps the page's own ← / → (Study's
 * move stepping, a lesson's Back / Next) out of it.
 */
export function onTabListKey(e: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')].filter((t) => !t.hasAttribute("disabled"));
  const i = tabs.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const n = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[n].focus();
}
