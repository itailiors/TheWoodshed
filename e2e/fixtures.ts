import { expect, test as base } from "@playwright/test";

/**
 * Every test gets a `apiRequests` list and fails at the end if the page asked `/api` for
 * anything: the static demo build must make zero API requests (CLAUDE.md rule 11).
 */
export const test = base.extend<{ apiRequests: string[] }>({
  apiRequests: [
    async ({ page }, use) => {
      const hits: string[] = [];
      page.on("request", (req) => {
        if (/^\/api(\/|$)/.test(new URL(req.url()).pathname)) hits.push(`${req.method()} ${req.url()}`);
      });
      await use(hits);
      expect(hits, "the demo build must make no /api requests").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** The handle `installFakeMidi` leaves on `window`, for `page.evaluate`. */
export interface FakeMidi {
  /** Deliver raw MIDI bytes from the fake keyboard. */
  send(bytes: number[]): void;
  /** Pull the cable: the input leaves the map, goes "disconnected", and onstatechange fires. */
  unplug(): void;
}

/**
 * Replace `navigator.requestMIDIAccess` with a fake that has one input, "Fake Keys"
 * (the CLAUDE.md recipe: `{ inputs: Map, onstatechange }`). Runs before any page script.
 */
export function installFakeMidi() {
  const input = {
    id: "fake-1",
    name: "Fake Keys",
    manufacturer: "e2e",
    type: "input",
    state: "connected",
    connection: "open",
    onmidimessage: null as ((e: { data: Uint8Array; timeStamp: number }) => void) | null,
  };
  const access = {
    inputs: new Map<string, typeof input>([[input.id, input]]),
    outputs: new Map(),
    sysexEnabled: false,
    onstatechange: null as ((e: { port: typeof input }) => void) | null,
  };
  Object.defineProperty(Navigator.prototype, "requestMIDIAccess", {
    configurable: true,
    value: () => Promise.resolve(access),
  });
  const fake: FakeMidi = {
    send: (bytes) => input.onmidimessage?.({ data: new Uint8Array(bytes), timeStamp: performance.now() }),
    unplug: () => {
      access.inputs.delete(input.id);
      input.state = "disconnected";
      input.connection = "closed";
      access.onstatechange?.({ port: input });
    },
  };
  (window as unknown as { __fakeMidi: FakeMidi }).__fakeMidi = fake;
}
