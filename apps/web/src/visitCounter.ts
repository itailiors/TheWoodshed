import { GOATCOUNTER_URL } from "./components/credits";
import { whenSettled } from "./settled";

/**
 * GoatCounter's visit count (see credits.ts), in the static demo build only: main.tsx calls this
 * behind `import.meta.env.PROD && MODE === "demo"`, so dev, `dev:demo` and the API build never
 * load it. The third-party script waits until the page has settled (`whenSettled`), so it never
 * competes with the first paint on a slow phone.
 */
export function installVisitCounter() {
  whenSettled(() => {
    const s = document.createElement("script");
    s.async = true;
    s.dataset.goatcounter = GOATCOUNTER_URL;
    s.src = "https://gc.zgo.at/count.js";
    document.body.appendChild(s);
  });
}
