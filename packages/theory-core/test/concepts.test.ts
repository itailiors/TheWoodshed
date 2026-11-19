import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { QUALITIES } from "../src/chords";
import { CONCEPT_FAMILIES, conceptFamily, conceptKind, conceptName, parseShapeRuleId, shapeRuleId } from "../src/concepts";
import { earRuleId, EAR_MOTION_NAME, MOTIONS, type EarMotionId } from "../src/ears/motions";
import { RULES } from "../src/ruleset";
import { VOICING_STYLES } from "../src/voicing";

const style = fc.constantFrom(...VOICING_STYLES.map((s) => s.id));
const quality = fc.constantFrom(...QUALITIES);
const alterations = fc.subarray(["b9", "#9", "#11", "b13", "b5", "#5"]);

describe("concept registry (rule-id prefixes)", () => {
  it("a shape id round-trips: style, quality and alterations come back out", () => {
    fc.assert(
      fc.property(style, quality, alterations, (s, q, a) => {
        const id = shapeRuleId(s, q, a);
        expect(id.startsWith("shape:")).toBe(true);
        expect(id.length).toBeLessThanOrEqual(100); // the API's ruleId limit
        expect(parseShapeRuleId(id)).toEqual({ style: s, quality: q, alterations: a });
        expect(conceptKind(id)).toBe("shape");
      }),
    );
  });

  it("m7b5 is a quality, not m7 with a ♭5 (the separator keeps them apart)", () => {
    expect(shapeRuleId("shell", "m7b5")).not.toBe(shapeRuleId("shell", "m7", ["b5"]));
    expect(parseShapeRuleId(shapeRuleId("shell", "m7", ["b5"]))).toEqual({ style: "shell", quality: "m7", alterations: ["b5"] });
  });

  it("rejects shape ids with an unknown style or quality", () => {
    expect(parseShapeRuleId("shape:bogus:maj7")).toBeNull();
    expect(parseShapeRuleId("shape:shell:nope")).toBeNull();
    expect(parseShapeRuleId("shape:shell")).toBeNull();
    expect(parseShapeRuleId("ear:landing")).toBeNull();
  });

  it("every reharm rule is a reharm concept, every motion an ear concept", () => {
    for (const r of RULES) {
      expect(conceptKind(r.id)).toBe("reharm");
      expect(conceptName(r.id)).toBe(r.name);
    }
    for (const m of Object.keys(MOTIONS) as EarMotionId[]) {
      expect(conceptKind(earRuleId(m))).toBe("ear");
      expect(conceptName(earRuleId(m))).toBe(EAR_MOTION_NAME[m]);
    }
  });

  it("names a shape by family and chord quality, in pretty spelling", () => {
    expect(conceptName(shapeRuleId("shell", "7", ["b9"]))).toBe("Shells · 7(♭9)");
    expect(conceptName(shapeRuleId("drop2", "m7b5"))).toBe("Drop 2 · m7♭5");
  });

  it("each family has its own prefix, chart and passport heading; only reharm has no prefix", () => {
    const prefixes = CONCEPT_FAMILIES.map((f) => f.prefix).filter(Boolean);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(CONCEPT_FAMILIES.filter((f) => f.prefix === null).map((f) => f.kind)).toEqual(["reharm"]);
    expect(conceptFamily("ear").chart).toBe("changes");
    expect(conceptFamily("shape").chart).toBe("voicings");
    for (const f of CONCEPT_FAMILIES) expect(f.heading).toBeTruthy();
  });

  it("an unknown id is a reharm concept named as itself (old rows don't crash the passport)", () => {
    expect(conceptKind("someRetiredRule")).toBe("reharm");
    expect(conceptName("someRetiredRule")).toBe("someRetiredRule");
  });
});
