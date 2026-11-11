import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installAudioUnlock } from "./audio/unlock";
import { installMidiMonitor } from "./midi/monitor";
import { installPedal } from "./midi/pedal";
import { installQwertyKeys } from "./midi/qwerty";
import "./index.css";

installAudioUnlock();
installQwertyKeys();
installPedal();
installMidiMonitor();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
