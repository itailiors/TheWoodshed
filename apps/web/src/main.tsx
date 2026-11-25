import "./audio/quietTone"; // first: sets TONE_SILENCE_LOGGING before Tone can ever load
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installAudioUnlock } from "./audio/unlock";
import { installMidiMonitor } from "./midi/monitor";
import { installPedal } from "./midi/pedal";
import { installQwertyKeys } from "./midi/qwerty";
import { installTheme } from "./design/themes";
import { installVisitCounter } from "./visitCounter";
import "./index.css";

installTheme();
installAudioUnlock();
installQwertyKeys();
installPedal();
installMidiMonitor();
if (import.meta.env.PROD && import.meta.env.MODE === "demo") installVisitCounter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
