import type { Rule } from "./ruleKit";
import { CORE_RULES } from "./rules";
import { ADVANCED_RULES } from "./rulesAdvanced";
import { oneNoteOnTop } from "./rulesOneNote";

/**
 * Every rule the engine runs (17), in priority order (earlier wins ties).
 * L1:   secondary dominant, related ii (the secondary ii–V emits L1 or L2)
 * L2:   ii–V into a target, tritone sub, passing diminished, minor line cliché,
 *       voicings (upper structure ♭VI and II, rootless ii–V–I)
 * L3:   gospel turnaround, backdoor ii–V, mediant dominant, ♭VI–♭VII–I, borrowed iv, common-tone diminished
 * L4:   Coltrane substitution, constant structure, one note on top
 */
export const RULES: Rule[] = [...CORE_RULES, ...ADVANCED_RULES, oneNoteOnTop];
