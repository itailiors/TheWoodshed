import type { LessonStep } from "@reharm/theory-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// a fake player with the real token rule: every start and every stop bumps the audition token
const fake = vi.hoisted(() => {
  const p = {
    token: 0,
    stops: 0,
    initFails: false,
    init: () => (p.initFails ? Promise.reject(new Error("no audio")) : Promise.resolve()),
    playScore: async () => ++p.token,
    currentAudition: () => p.token,
    stopScore: () => {
      p.stops++;
      p.token++;
    },
  };
  return p;
});
vi.mock("../../audio/player", () => ({ player: fake }));

const { playStep, stepAudioGen, stopStepAudio } = await import("./lessonAudio");

const step: LessonStep = { text: "x", highlight: [{ note: "B", label: "3rd" }], play: "interval" };
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("stopping a lesson cue", () => {
  beforeEach(() => {
    fake.token = 0;
    fake.stops = 0;
    fake.initFails = false;
  });

  it("cuts the step's own cue", async () => {
    playStep(step);
    await settle();
    stopStepAudio(stepAudioGen());
    expect(fake.stops).toBe(1);
  });

  it("never cuts an audition that took over after the cue (a move card's Before/After)", async () => {
    playStep(step);
    await settle();
    await fake.playScore(); // another audition starts: the cue's token is no longer current
    stopStepAudio(stepAudioGen());
    expect(fake.stops).toBe(0);
  });

  it("a failed audio engine stays silent, with no unhandled rejection", async () => {
    fake.initFails = true;
    expect(playStep(step)).toBe(true);
    await settle();
    stopStepAudio();
    expect(fake.stops).toBe(0);
  });
});
