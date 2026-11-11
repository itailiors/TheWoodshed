import { Component, type ReactNode } from "react";

interface Props {
  /** Closes the panel that crashed (the rest of the app keeps running). */
  onClose: () => void;
  children: ReactNode;
}

/**
 * Catches a render error inside one drawer or panel, so a bug there shows a note instead of
 * blanking the whole app (the band, the lead sheet and your place in the tune survive it).
 */
export class PanelBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[panel] crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-ink/20 p-4" role="alertdialog" aria-labelledby="panel-crash-h">
        <div className="max-w-md space-y-3 rounded-lg border-2 border-ink bg-paper-light p-5 text-ink shadow-xl">
          <h2 id="panel-crash-h" className="font-marker text-xl">
            This panel hit a wrong note.
          </h2>
          <p className="text-[15px] text-ink-soft">The rest of the app is fine and still playing. Close this and try again; the details are in the console.</p>
          <p className="break-words font-mono text-xs text-ink-faint">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              this.props.onClose();
            }}
            className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 font-marker text-paper-light"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
}
