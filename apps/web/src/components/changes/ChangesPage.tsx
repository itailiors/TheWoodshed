import { LEVELS } from "@reharm/theory-core";
import { SketchBox, SketchFilters } from "../../design/rough";
import { paper, seedOf } from "../../design/tokens";
import type { MidiStatus } from "../../midi/useMidi";
import { ModeSwitch, type AppMode } from "../ModeSwitch";

/*
 * The Changes tab: harmony games with sound. Its first (and for now only) game is
 * "Make the Changes": you're on a chord, and you say where it wants to go next.
 *
 * Step 4 of the build: the tab and its page. The game itself (the road, the prompt chord, the
 * option cards, the keyboard) arrives in step 5, driven by theory-core's ears reducer.
 */

interface Props {
  midi: { status: MidiStatus; connect: () => void };
  onMode: (m: AppMode) => void;
}

export function ChangesPage({ onMode }: Props) {
  return (
    <div className="min-h-dvh p-3 text-ink md:p-5">
      <SketchFilters />
      <header className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ModeSwitch mode="changes" onMode={onMode} />
        <h1 className="ink-wobble font-marker text-2xl font-bold uppercase md:text-3xl">
          Make the Changes{" "}
          <span className="text-base font-normal normal-case text-ink-soft">· Where does this chord want to go?</span>
        </h1>
      </header>

      <SketchBox seed={seedOf("changes-intro")} fill={paper.light} strokeWidth={2} className="mx-auto max-w-2xl">
        <div className="space-y-3 p-4 md:p-6">
          <p className="font-hand text-lg">
            You're on a chord. Play or pick the root it wants to go to next, hear the move, and learn why it works: the landing, the
            setup, the fourths staircase.
          </p>
          <ol className="space-y-1 font-marker">
            {LEVELS.map((l) => (
              <li key={l.id}>
                {l.id}. {l.name}
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-soft">The game is being built: it arrives in the next update.</p>
        </div>
      </SketchBox>
    </div>
  );
}
