import fc from "fast-check";
import { describe, it } from "vitest";
import { PROOFS } from "../src/testing";

// The same Proof objects the web app's Proof tab runs live in the browser.
describe("the engine's claims (also runnable in the app's Proof tab)", () => {
  for (const p of PROOFS) {
    it(`${p.title}: ${p.claim}`, () => {
      fc.assert(p.property(), { numRuns: 150 });
    });
  }
});
