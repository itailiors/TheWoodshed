import { useState } from "react";
import { SketchBox } from "../design/rough";
import { paper, pen } from "../design/tokens";
import { checkApi, useApiStatus } from "../library/apiStatus";

/**
 * A note pinned above the lead sheet when the API can't be reached. It says exactly what is
 * paused (library, import, deep dives) and, just as important, what still works, because
 * everything musical runs in the browser.
 */
export function OfflineBanner() {
  const api = useApiStatus();
  const [retrying, setRetrying] = useState(false);
  if (api.state !== "offline") return null;

  const retry = async () => {
    setRetrying(true);
    await checkApi();
    setRetrying(false);
  };

  return (
    <SketchBox seed={404} stroke={pen.red} fill={paper.light} className="animate-ink-in mb-5 -rotate-[0.3deg]">
      <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <span aria-hidden className="font-marker text-2xl leading-none" style={{ color: pen.red }}>
          !
        </span>
        <div className="min-w-0 flex-1 text-[15px] leading-snug">
          <p className="font-marker" style={{ color: pen.red }}>
            {api.browserOffline ? "You're offline." : "Can't reach the Reharm Lab API."}
          </p>
          <p className="text-ink-soft">
            The setlist, iReal import and deep dives are paused. The lead sheet, reharm dial, playback, Coach and heatmap all keep working.
            {!api.browserOffline && import.meta.env.DEV && (
              <>
                {" "}
                Start it with <code className="font-mono text-xs">npm run dev:api</code>.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 font-marker hover:bg-paper-shade disabled:cursor-wait"
        >
          {retrying ? "checking…" : "Retry"}
        </button>
      </div>
    </SketchBox>
  );
}
