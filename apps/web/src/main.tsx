import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installAudioUnlock } from "./audio/unlock";
import { installQwertyKeys } from "./midi/qwerty";
import "./index.css";

installAudioUnlock();
installQwertyKeys();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
