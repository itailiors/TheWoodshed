import type { Rule } from "./ruleKit";
import { CORE_RULES } from "./rules";
import { ADVANCED_RULES } from "./rulesAdvanced";

/**
 * Every rule the engine runs, in priority order (earlier wins ties).
 * L1–2: functional, dominant subs, passing diminished, upper structures
 * L3:   gospel turnaround, backdoor ii–V, ♭VI–♭VII–I, borrowed iv, common-tone diminished
 * L4:   Coltrane substitution, constant structure
 */
export const RULES: Rule[] = [...CORE_RULES, ...ADVANCED_RULES];
