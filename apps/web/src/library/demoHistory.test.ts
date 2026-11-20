import { chroma, CONCEPTS, conceptStates } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { pathStates } from "../learn/pathStates";
import { demoProgress } from "./demoHistory";
import fixture from "./demoHistory.json";

describe("the demo's sample notebook", () => {
  const now = Date.UTC(2026, 10, 19, 12);

  it("follows the passport's rules: clean once a key has a clean run, due once its time has passed", async () => {
    const p = await demoProgress(now);
    expect(p.concepts).toHaveLength(fixture.concepts.length);
    for (const c of fixture.concepts) expect((p.cleanKeys[c.ruleId] ?? []).includes(c.keyTonic)).toBe(c.cleanRuns > 0);
    for (const keys of Object.values(p.cleanKeys)) expect(keys).toEqual([...keys].sort((a, b) => chroma(a) - chroma(b)));

    const due = fixture.concepts.filter((c) => c.dueInDays <= 0).sort((a, b) => a.dueInDays - b.dueInDays);
    expect(p.due.map((d) => [d.ruleId, d.keyTonic])).toEqual(due.map((c) => [c.ruleId, c.keyTonic]));
    for (const d of p.due) expect(d.lastPlace).toEqual(fixture.places[d.ruleId as keyof typeof fixture.places]);
  });

  it("keeps the fixture's places and its improv runs, newest first", async () => {
    const p = await demoProgress(now);
    expect(p.places).toEqual(fixture.places);
    expect(p.recentImprov).toHaveLength(fixture.improv.length);
    const times = p.recentImprov.map((r) => new Date(r.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(p.recentImprov.every((r) => r.tuneId === fixture.tuneId)).toBe(true);
  });

  it("path states never read the seeded sample (rule 11): every concept stays New or Recommended first", async () => {
    const p = { ...(await demoProgress(now)), sample: true };
    // the guard is what keeps it out: read raw, the sample would lift some concept
    const raw = conceptStates(p, {}, new Date(now));
    expect(CONCEPTS.some((c) => !["new", "recommendedFirst"].includes(raw.get(c.id)!.state))).toBe(true);
    const { states } = pathStates(p, {}, new Date(now));
    for (const c of CONCEPTS) expect(["new", "recommendedFirst"], c.id).toContain(states.get(c.id)!.state);
  });
});
