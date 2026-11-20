# How Reharm Lab currently explains reharmonization (codebase audit, 2026-11-20)

Scope: read-only inspection of the local repo at `C:/Users/itail/Documents/claude-projects/TheWoodshed` (branch `main`, clean, HEAD `19ddf67`). All "sources" below are repo paths with line numbers (relative to the repo root). Template strings are quoted as written in code; `${…}` placeholders are filled per tune/key at runtime. Rendered examples come from the shipped demo file `apps/api/demo/explanations.json` (Co-op Blues in F).

## Q1. Where does explanation text come from? (every source, with paths)

### Takeaway
There are six independent explanation layers for the same move, all hand-written in TypeScript except the optional Claude Deep Dive. The rule's template text (`text.summary/theory/recreateRule/insight`) and static `pedagogy` block live inside each rule in theory-core; the Coach adds per-chord `stepCue`s in `coach.ts`; the Changes ear-game has its own separate copy; the LLM only rewrites the engine's `draft` when an API key exists. The public demo ships no Claude text at all: its Deep Dives are the engine template text again.

### Cited Findings

**Layer A: per-proposal template text (`MoveText`) inside each rule**
- `MoveText = { summary; theory; recreateRule; insight? }` — [packages/theory-core/src/types.ts:122-127](packages/theory-core/src/types.ts)
- Each `Rule.propose()` returns a `Proposal` whose `text` is built with template strings using `ps()` (pretty symbol) and `pn()` (pretty note) — [packages/theory-core/src/ruleKit.ts:19-42](packages/theory-core/src/ruleKit.ts)
- Rule files: `rules.ts` (7 core rules), `rulesAdvanced.ts` (9 rules), `rulesOneNote.ts` (1 rule); registered in order in `ruleset.ts` — [packages/theory-core/src/ruleset.ts:12](packages/theory-core/src/ruleset.ts)
- Rendered in the Study move card: `summary` always visible (MoveCard.tsx:78), `theory` when expanded (:84), "Recreate it" box with `recreateRule` (:114-119), "💡 {insight}" (:121-125). Card header shows `CATEGORY_LABEL · L{level} · {styleTags.join(", ")}` (raw slugs such as `modal-interchange`, `bill-evans`) — [apps/web/src/components/MoveCard.tsx:50-125](apps/web/src/components/MoveCard.tsx)
- Card also shows melody-check chips `melody {note} = {role} ✓` and the warning "⚠ no melody entered here, so check it against your lead sheet", a "Voice leading" list `from → to (±n)`, and a keyboard with guide tones accented — [apps/web/src/components/MoveCard.tsx:86-112](apps/web/src/components/MoveCard.tsx)

**Layer B: static per-rule `pedagogy` block**
- `RulePedagogy = { formula; whenToUse; whyItWorks; bandstandCue }` with doc comments: formula = "Short roman-numeral / degree formula", whenToUse "(max ~12 words)", whyItWorks "Punchy 1-sentence acoustic/voice-leading reason … (max ~30 words)", bandstandCue "Mental shortcut to find the voicing on the bandstand in real time" — [packages/theory-core/src/types.ts:111-120](packages/theory-core/src/types.ts)
- `Rule = { id; name; pedagogy?; propose() }` — no level/category/tags/prereqs on the Rule itself — [packages/theory-core/src/ruleKit.ts:34-39](packages/theory-core/src/ruleKit.ts)
- Shown in: Coach "💡 Why this works · {formula}" card (`WhyThisWorksCard`): whyItWorks bold, then "When to use:", "Bandstand cue:", "In {key}: {move.text.summary}" — [apps/web/src/components/coach/CoachDrill.tsx:535-594](apps/web/src/components/coach/CoachDrill.tsx); on phones folded in a `<details>` (:521-528)
- Coach concept list: `{r.name}` + `L{level} · {formula}` — [apps/web/src/components/coach/CoachPage.tsx:270-275](apps/web/src/components/coach/CoachPage.tsx); active-rule line `{formula} · {whenToUse}` (:473-475)
- Study "Chord by chord" selector: option sub-line `{formula} · {whyItWorks}` (falls back to `text.summary`), and native `title` tooltip = formula + whyItWorks + "When to use: …" — [apps/web/src/components/ChordMoveSelector.tsx:71-79, 341-353](apps/web/src/components/ChordMoveSelector.tsx)

**Layer C: Coach per-step cues (`StepCue {role, whyHere}`)**
- Hand-written switch per ruleId in `buildStepCue`; default for unlisted rules is generic "Voice-lead guide tones (…) smoothly toward …" — [packages/theory-core/src/coach.ts:10-169](packages/theory-core/src/coach.ts)
- Rendered as `title` tooltip on each chord in the drill (CoachDrill.tsx:314) and "Active step — {role}: {whyHere}" in the Why card (CoachDrill.tsx:584-591)
- Rules WITH custom cues: tritoneSub, secondaryTwoFive, secondaryDominant, mediantDominant, rootlessTwoFiveOne, upperStructureBVI, upperStructureII, minorLineCliche, oneNoteOnTop, gospel.halfStepTurnaround, backdoorTwoFive. Rules falling to the generic default: passingDiminished, flatSixFlatSeven, borrowedIv, commonToneDiminished, coltraneSubstitution, constantStructure — [packages/theory-core/src/coach.ts:52-168](packages/theory-core/src/coach.ts)

**Layer D: Claude Deep Dive (`/api/explain`)**
- `ExplanationSchema = z.object({ summary: z.string(), deepDive: z.string(), recreateRule: z.string() })` — [apps/api/src/explain.ts:21-25](apps/api/src/explain.ts)
- `buildFacts(tune, move)` sends: `tune {title, key, meter, feel}`; `move {name (=move.title), ruleId, category, level, styleTags, bars, original[], replacement[{chord, beats}], resolvesTo, voicingHint{lh,rh}, voiceLeading["X → Y (+n, lands on the D)"], melodyCheck[{over, note, role, verdict}], melodyVerified}`; `engineFacts` (= `move.facts`, notes prettified); `scales` per replacement chord (`name, notes, parent, avoidAsLongNotes`, `guideTones`, `guideToneTargets`); `draft: move.text` (summary/theory/recreateRule/insight). Note: the rule's `pedagogy` block is NOT sent — [apps/api/src/explain.ts:39-73](apps/api/src/explain.ts)
- Model `process.env.EXPLAIN_MODEL || "claude-opus-5-5"`, effort medium, zod output format, server-side fallback beta, system prompt cached; cache key = sha256(PROMPT_VERSION|MODEL|facts) in `apps/api/.cache/explanations.json` — [apps/api/src/explain.ts:19, 76-116](apps/api/src/explain.ts)
- `PROMPT_VERSION = "2026-11-11.1"` — [apps/api/src/prompt.ts:5](apps/api/src/prompt.ts)
- UI: "✍ Deep dive" button → box headed "Deep dive": bold summary, paragraphs split on blank lines, "Rule of thumb: {recreateRule}", footer "Written by {model} from the engine's computed facts · cached", "rewrite" link. No-key copy: "✍ Deep dive needs a Claude key. The engine's own explanation above is the full analysis. To have Claude write it up as a lesson, add ANTHROPIC_API_KEY to apps/api/.env and restart the API." — [apps/web/src/components/DeepDive.tsx:62-114](apps/web/src/components/DeepDive.tsx)

**Layer E: demo Deep Dives (pre-generated file)**
- `apps/api/demo/explanations.json` has `"source": "template"`, `"tuneId": "coop-blues"`, generated 2026-11-19, 18 entries, every `"model": "Reharm Lab engine"` — i.e. NO Claude-written text ships — [apps/api/demo/explanations.json:1-6](apps/api/demo/explanations.json)
- Web demo fallback builds `deepDive = [move.text.theory, move.text.insight].join("\n\n")`, `model: "Reharm Lab engine"` — so in the public demo the "Deep dive" box repeats the move card's theory/insight verbatim — [apps/web/src/demo.ts:26-38](apps/web/src/demo.ts)
- Regeneration commands: `npm run demo:generate -w @reharm/api -- --template` (free) vs without flag (Claude, costs budget, ask first) — [docs/STATE_OF_THE_UNION.md:321-322](docs/STATE_OF_THE_UNION.md); STATE_OF_THE_UNION lists "Claude-written demo Deep Dives (ask before spending)" as still open (:305)

**Layer F: other hand-written UI copy that teaches**
- `FUNCTION_WORD` (Roman-numeral function glosses): `T: "home: the chord at rest"`, `PD: "pre-dominant: leads toward the V"`, `D: "tension: wants to resolve"`, `passing: "passing: connects two chords"`, `chromatic: "chromatic colour"`, `modal: "borrowed / modal colour"` — [apps/web/src/components/ChordMoveSelector.tsx:15-22](apps/web/src/components/ChordMoveSelector.tsx); reused by `ChordFactsCard` ("{bar} · as written, no move here", roman + function word, chord tones by degree) — [apps/web/src/components/ChordFactsCard.tsx:13-41](apps/web/src/components/ChordFactsCard.tsx)
- `ImprovCard` "Improvising (right hand)": top scale name, "from {parent} · {why}", "Land on: X → Y", "also: …" — [apps/web/src/components/ImprovCard.tsx:7-50](apps/web/src/components/ImprovCard.tsx); scale `why` strings are in `scales.ts` (e.g. Lydian dominant: "For dominants that don't resolve down a 5th (tritone subs, ♭VII7, IV7). The ♯11 replaces the avoid-note 4th."; altered: "Every tension altered (♭9 ♯9 ♯11 ♭13). Maximum pull into the next chord, especially a minor one.") — [packages/theory-core/src/scales.ts:14-85](packages/theory-core/src/scales.ts)
- Melody-filter rejection reasons (per instance): "`{note}` is the natural `{n}` — it clashes with the `{alt}` in `{sym}`" and "`{note}` is the `{role}` of `{sym}` — a half step above the `{degree}` (`{note}`)" — [packages/theory-core/src/melody.ts:60-77](packages/theory-core/src/melody.ts)
- Level dial tooltip: `L{n} {label}: {densityLabel}` e.g. "up to 1 move per 8 bars", "every spot that works", "the tune as written" — [apps/web/src/components/LevelDial.tsx:58](apps/web/src/components/LevelDial.tsx), [packages/theory-core/src/pathway.ts:23-28](packages/theory-core/src/pathway.ts)
- Changes ear-game ("Make the Changes"): per-motion `hint/right/wrong/why` copy using mental-model names ("the landing", "the setup", "the fourths staircase", "the turnaround door") — [packages/theory-core/src/ears/motions.ts:145-199](packages/theory-core/src/ears/motions.ts); "real jazz move" alt lines for tritone sub/backdoor/passing dim (:221-247); level names/mastery (:273-299); blurbs `1: "V → I, the landing"`, `2: "ii → V → I, the setup"`, `3: "the whole staircase, and the turnaround"` — [apps/web/src/components/changes/Controls.tsx:58-62](apps/web/src/components/changes/Controls.tsx)
- Voicing style hints, e.g. shell "Root, 3rd and 7th only: the lean bebop sound.", drop2 "Four voices, the second from the top dropped an octave: open and singing.", close "Guide tones and colours packed inside an octave." — [packages/theory-core/src/voicing.ts:102-108](packages/theory-core/src/voicing.ts)
- Practice HUD: "Guide tones:" list and "Don't hold:" (avoid notes in red) — [apps/web/src/components/practice/ChordHUD.tsx:61-75](apps/web/src/components/practice/ChordHUD.tsx); heatmap legend "guide-tone landing", "enclosure (cross-hatched)", summary "N held avoid notes: resolve them by step." — [apps/web/src/components/practice/ImprovHeatmap.tsx:904-946](apps/web/src/components/practice/ImprovHeatmap.tsx)
- Coach footer: "Think in function, not finger shapes: “{title}”. The engine has re-spelled every chord and voicing for {key}." — [apps/web/src/components/coach/CoachDrill.tsx:502](apps/web/src/components/coach/CoachDrill.tsx)
- "Ghost Master" exists only as code comments / audio synth for call-and-response (`motif.ts`, `band.ts`); no teaching copy was found for it — [packages/theory-core/src/motif.ts:17, 215](packages/theory-core/src/motif.ts)

### Inferences
- The same concept is explained in 6+ voices with no shared source (MoveCard text, pedagogy, stepCue, chord-selector line, Deep Dive, Changes alt line). Wording, register and even chord-symbol style drift between them (see Q2). A rewrite will touch several files per concept unless a single concept/glossary module is introduced.
- `pedagogy` is generic (key-free) while `text` is key-specific; Claude never sees `pedagogy`, so the Deep Dive cannot align with the Coach's "Why this works" card.
- In the demo build (the only public build), the Deep Dive adds nothing over the card, yet is labelled as a deeper lesson.

### Gaps
- Did not read `apps/api/scripts/generate-demo.ts` or `apps/api/src/demo.ts` line by line; behaviour inferred from the JSON header, STATE_OF_THE_UNION and `apps/web/src/demo.ts`.
- No real Claude-written Deep Dive output exists in the repo to quote (the `.cache` file is git-ignored and was not read).

## Q2. Verbatim current copy for tritone sub, secondary dominant / secondary ii–V, and backdoor ii–V; full system prompt

### Takeaway
The engine copy is accurate, compact and interval-based, but written for players who already own the vocabulary (tritone, ♭7, guide tones, Lydian dominant, melodic minor). Quoted below in full from every place each move appears.

### Cited Findings

#### Tritone substitution (`dominant.tritoneSub`, level 2, category `dominant-sub`, styleTags `["bebop"]`)
- **Rule name:** "Tritone substitution"; **card title:** "Tritone sub" — [packages/theory-core/src/rules.ts:167-186](packages/theory-core/src/rules.ts)
- **pedagogy** — [rules.ts:170-175](packages/theory-core/src/rules.ts):
  - formula: "V7 → ♭II7 → I"
  - whenToUse: "Any dominant 7th chord resolving down a perfect 5th."
  - whyItWorks: "Dominant chords a tritone apart share the exact same 3rd and ♭7 (with roles swapped), so the tritone still resolves while the bass slides down by half step."
  - bandstandCue: "Keep your original V7 guide-tone shell (3rd & ♭7) and put the root a half step above the target chord."
- **text (template)** — [rules.ts:190-201](packages/theory-core/src/rules.ts):
  - summary: "Swap ${ps(chord)} for ${ps(sub)}, the dominant a tritone away."
  - theory: "${ps(chord)} and ${ps(sub)} share the same tritone: ${pn(o3)}–${pn(o7)} (3rd and ♭7 of ${pn(chord.root)}7) are ${pn(s7)}–${pn(s3)} (♭7 and 3rd of ${pn(subRoot)}7), the same keys spelled differently. That interval is what makes a dominant want to resolve, so the substitute still lands on ${ps(next)}. The difference is the bass, which now slides down a half step (${pn(subRoot)} → ${pn(next.root)}) instead of falling a 5th."
  - recreateRule: "Any dominant 7 can be replaced by the dominant 7 a tritone (♭5) away. The 3rd and ♭7 swap roles, and the bass moves by a half step."
  - insight: "${pn(subRoot)} Lydian dominant uses exactly the same 7 notes as ${pn(chord.root)} altered: both are modes of ${pn(mm)} melodic minor. Soloing over the sub is the same as playing altered over the original."
- **engineFacts sent to Claude:** `{ original, sub, sharedTritone: [o3, o7], parentMelodicMinor }` — [rules.ts:189](packages/theory-core/src/rules.ts)
- **Coach stepCue** — [packages/theory-core/src/coach.ts:53-57](packages/theory-core/src/coach.ts): role "Tritone sub (♭II7 · ${sym})"; whyHere "Shares the exact 3rd & ♭7 tritone (${gts}) with ${orig0 ?? "the V7"}, while the bass ${root} slides down a half step${nextSym ? ` into ${nextSym}` : ""}."
- **Changes ear-game alt line:** "A real jazz move: ${ps(p)} is the tritone sub, sliding down a half step into home." (code comment: "♭II7 shares V7's tritone and slides down into I"); UI name "the tritone sub" — [packages/theory-core/src/ears/motions.ts:222-228](packages/theory-core/src/ears/motions.ts), [apps/web/src/components/changes/GamePieces.tsx:52](apps/web/src/components/changes/GamePieces.tsx), [apps/web/src/components/changes/ChangesPage.tsx:369](apps/web/src/components/changes/ChangesPage.tsx)
- **Gospel turnaround reuses the concept:** theory "…${ps(approach)} is the tritone sub of ${root}7, voiced as a 13(♯11) cluster a half step above ${next}…"; stepCue "Tritone-sub cluster a half step above ${nextSym ?? "home"}; every upper voice slides down by semitone or holds common tones." — [rules.ts:286-289](packages/theory-core/src/rules.ts), [coach.ts:148-151](packages/theory-core/src/coach.ts)
- **Rendered demo (Co-op Blues bar 10, C7 → F6)** — [apps/api/demo/explanations.json:61-66](apps/api/demo/explanations.json):
  - summary: "Swap C7 for G♭9, the dominant a tritone away."
  - deepDive: "C7 and G♭9 share the same tritone: E–B♭ (3rd and ♭7 of C7) are F♭–B♭ (♭7 and 3rd of G♭7), the same keys spelled differently. That interval is what makes a dominant want to resolve, so the substitute still lands on F6. The difference is the bass, which now slides down a half step (G♭ → F) instead of falling a 5th.\n\nG♭ Lydian dominant uses exactly the same 7 notes as C altered: both are modes of D♭ melodic minor. Soloing over the sub is the same as playing altered over the original."
  - recreateRule: "Any dominant 7 can be replaced by the dominant 7 a tritone (♭5) away. The 3rd and ♭7 swap roles, and the bass moves by a half step."
  - Other instances: bar 8.3 "Swap D7(♭9) for A♭9…" and bar 11.3 "Swap D7 for A♭9…" (:43-48, :103-108).

#### Secondary dominant (`functional.secondaryDominant`, level 1, category `functional`, styleTags `["standard","bebop","gospel"]`)
- **Rule name:** "Secondary dominant"; **title:** "Make it the V of ${roman}" or "Make it the V of ${ps(next)}" — [rules.ts:98-143](packages/theory-core/src/rules.ts)
- **pedagogy** — [rules.ts:101-107](packages/theory-core/src/rules.ts):
  - formula: "vi7 → VI7(♭9) → ii"
  - whenToUse: "Any chord whose root falls a 5th into the next chord, as long as it isn't already a dominant."
  - whyItWorks: "Keep the root and make the chord a dominant: its 3rd becomes the leading tone of the next chord's root, so a diatonic step turns into a resolution."
  - bandstandCue: "Same bass note, raise the minor 3rd a half step (or flatten the major 7th): you're now playing the V of the next chord."
- **text (template)** — [rules.ts:149-161](packages/theory-core/src/rules.ts):
  - summary: "Play ${ps(chord)} as ${ps(dom)}, the dominant of ${ps(next)}."
  - theory: "${ps(chord)} already sits a 5th above ${ps(next)}, so one change is enough: ${change || `add the ♭7 (${pn(seventh.note)})`}, and it becomes ${ps(next)}'s own dominant. ${pn(third.note)}, the new 3rd, is a half step below ${pn(next.root)}: the leading tone of the chord you're about to land on. Guide tones: ${gtChain}." + (minor target) " The target is minor, so the dominant takes the ♭9 (${…}) from ${pn(next.root)} harmonic minor." where `change` = "its X rises to Y" / "its X drops to Y"
  - recreateRule: "If a chord's root falls a 5th into the next chord, you can keep the root and make it a dominant 7: raise a minor 3rd, flatten a major 7th. Add the ♭9 when the target is minor."
  - insight (minor target): "Over ${ps(dom)}, play ${pn(chord.root)} Phrygian dominant: the 5th mode of ${pn(next.root)} harmonic minor." / (major): "This is the first step of backing up the circle: give the ${ps(dom)} its own related ii and you have the full secondary ii–V."
- **Coach stepCue:** role "Secondary V7 (${sym})"; whyHere "Same root as ${orig0}: ${change}. That ${leadingTone} is the leading tone into ${next}." (change = "raise X to Y" / "drop X to Y" / "play it as a dominant") — [coach.ts:69-81](packages/theory-core/src/coach.ts)
- **Demo:** no entry — the rule never fires on Co-op Blues (head's ♭3 blue note rejects it) — [docs/STATE_OF_THE_UNION.md:289-290](docs/STATE_OF_THE_UNION.md)

#### Secondary ii–V / related ii (`functional.secondaryTwoFive`, level 1 or 2 depending on branch, category `functional`)
- **Rule name:** "Secondary ii–V" — [rules.ts:19-27](packages/theory-core/src/rules.ts)
- **pedagogy**: formula "V7 → ii7 – V7 → I"; whenToUse "Before any major or minor target chord (or solitary V7) with at least 2 beats."; whyItWorks "Splitting one chord into a fifth-falling ii–V doubles harmonic momentum and creates a smooth 7th → 3rd guide-tone chain."; bandstandCue "From the target chord, go up a 5th for V7 and another 5th (or a whole step above the target) for ii." — [rules.ts:22-27](packages/theory-core/src/rules.ts)
- **Branch 1, L1, title "Add the related ii"** (dominant already present) — [rules.ts:52-70](packages/theory-core/src/rules.ts):
  - summary: "Put the related ii in front of the dominant: ${ps(iiChord)} → ${ps(vChord)} → ${ps(next)}."
  - theory: "${ps(chord)} already resolves down a 5th to ${ps(next)}. Every dominant has a \"related ii\", the minor chord a 5th above its root. Inserting it turns one chord into a full ii–V and doubles the forward motion." + (minor) " The target is minor, so the ii is half-diminished (${ps(iiChord)}), borrowed from ${pn(next.root)} harmonic minor." + " Guide tones: ${gtChain}."
  - recreateRule: "Any dominant can borrow its related ii: the minor 7 chord a 5th above its root (m7♭5 if the target is minor)."
- **Branch 2, L2, title "ii–V into the ${roman}" / "ii–V into ${ps(next)}"** — [rules.ts:73-91](packages/theory-core/src/rules.ts):
  - summary: "Replace ${ps(chord)} with the target's own ii–V: ${ps(iiChord)} → ${ps(vChord)} → ${ps(next)}."
  - theory: "${ps(next)}${r ? ` is the ${r} chord.` : "."} Putting its own ii–V in front briefly makes it sound like home: ${pn(V)} is a perfect 5th above ${pn(next.root)}, and ${pn(ii)} is a 5th above that. The guide tones barely move: ${gtChain}. You give up the colour of ${ps(chord)} and get the strongest pull in tonal harmony instead: the root falls a 5th, twice."
  - recreateRule: "Any major or minor chord can get its own ii–V: from the target, go up a 5th for the V and another 5th for the ii."
- **Coach stepCues:** "Related ii (${sym})" / "Sets up the dominant a 5th below (${nextSym ?? "V7"}); lock in guide tones ${gts}."; "Secondary V7 (${sym})" / "The 7th of ${ii} drops a half step to become the 3rd of ${sym} (${gts}), pulling into ${nextSym ?? "the target"}." — [coach.ts:58-68](packages/theory-core/src/coach.ts)
- **Rendered demo** — [apps/api/demo/explanations.json:13-18, 97-102](apps/api/demo/explanations.json):
  - bar 2.1: summary "Replace B♭7 with the target's own ii–V: Gm9 → C7(♭9) → F6." deepDive "F6 is the I chord. Putting its own ii–V in front briefly makes it sound like home: C is a perfect 5th above F, and G is a 5th above that. The guide tones barely move: B♭ → B♭ → A, F → E → F. You give up the colour of B♭7 and get the strongest pull in tonal harmony instead: the root falls a 5th, twice."
  - bar 11.3: summary "Put the related ii in front of the dominant: Am7♭5 → D7(♭9) → Gm7." deepDive "D7 already resolves down a 5th to Gm7. Every dominant has a \"related ii\", the minor chord a 5th above its root. Inserting it turns one chord into a full ii–V and doubles the forward motion. The target is minor, so the ii is half-diminished (Am7♭5), borrowed from G harmonic minor. Guide tones: C → C → B♭, G → F♯ → F."
- **Changes ear-game equivalent ("the setup")**: why "${from} is the ii of ${tonic}: it walks you to the edge, and ${to} leans over it. The roots drop a fifth, and the 7th of ${from} slides down a half step to become the 3rd of ${to}." — [packages/theory-core/src/ears/motions.ts:157-167](packages/theory-core/src/ears/motions.ts)

#### Backdoor ii–V (`modal.backdoorTwoFive`, level 3, category `modal`, styleTags `["modal-interchange","standard"]`)
- **Rule name / title:** "Backdoor ii–V" — [packages/theory-core/src/rulesAdvanced.ts:35-55](packages/theory-core/src/rulesAdvanced.ts)
- **pedagogy**: formula "iv7 → ♭VII9 → Imaj7"; whenToUse "Replacing a V7 resolving to a major tonic."; whyItWorks "Borrowed from the parallel minor, ♭VII7 replaces the leading-tone tritone pull with a darker whole-step bass rise and common-tone warmth."; bandstandCue "Play the minor 7th on the 4th degree of the target key, then drop the 7th to make the dominant a whole step below I." — [rulesAdvanced.ts:38-43](packages/theory-core/src/rulesAdvanced.ts)
- **text**: summary "Come in through the back door: ${chords.map(ps).join(" → ")} → ${ps(next)}, instead of ${ps(chord)} → ${ps(next)}."; theory "${iv and }${ps(bVII)} are borrowed from ${pn(T)} minor (iv and ♭VII7). ${ps(bVII)} has no leading tone. Its ♭7 (${…}) falls a half step to ${…}, the 5th of ${pn(T)}, its 3rd (${…}) moves a step into the tonic chord, and the root rises a whole step home. It's a darker, bluesier cadence than ${ps(chord)} → ${ps(next)}, with no tritone resolving."; recreateRule "For a major I, approach from iv m7 → ♭VII7: the minor chord a 4th above the tonic, then the dominant a whole step below it." — [rulesAdvanced.ts:60-68](packages/theory-core/src/rulesAdvanced.ts)
- **Coach stepCues:** "Borrowed iv (${sym})" / "Minor iv borrowed from the parallel minor; prepares the ♭VII7 backdoor dominant (${nextSym ?? "♭VII7"})."; "Backdoor ♭VII7 (${sym})" / "Whole step below ${nextSym ?? "I"}; its ♭7 falls a half step to the 5th of the tonic while the root steps up a whole tone." — [coach.ts:152-162](packages/theory-core/src/coach.ts)
- **Changes alt line:** "A real jazz move: a perfect fifth down to ${ps(p)}, the backdoor that slips into ${tonic} from a whole step below. It steps outside the key for a moment, though." — [motions.ts:229-239](packages/theory-core/src/ears/motions.ts)
- **Rendered demo (bar 10.1)**: summary "Come in through the back door: B♭m7 → E♭9 → F6, instead of C7 → F6."; deepDive "B♭m7 and E♭9 are borrowed from F minor (iv and ♭VII7). E♭9 has no leading tone. Its ♭7 (D♭) falls a half step to C, the 5th of F, its 3rd (G) moves a step into the tonic chord, and the root rises a whole step home. It's a darker, bluesier cadence than C7 → F6, with no tritone resolving."; recreateRule as above — [apps/api/demo/explanations.json:73-78](apps/api/demo/explanations.json)

#### Bonus: passing diminished and Coltrane (short)
- Passing diminished pedagogy whyItWorks: "Ascending, ♯I°7 acts as a rootless V7(♭9) of the target chord; descending, the symmetrical °7 bridges the whole step so every voice moves by semitone."; recreateRule "Between two chords a whole step apart, put a diminished 7th on the half step in between, so the bass walks chromatically." — [rulesAdvanced.ts:195-232](packages/theory-core/src/rulesAdvanced.ts)
- Coltrane pedagogy whyItWorks: "Divides the octave symmetrically into major 3rds (an augmented triad of tonic centers), tonicizing each center with its own V7 before landing on I."; recreateRule "Over ii–V–I, tonicize the keys a major 3rd apart: V7–I into ♭VI, V7–I into III, then the real V7–I." — [rulesAdvanced.ts:274-310](packages/theory-core/src/rulesAdvanced.ts)

#### Full `/api/explain` system prompt (verbatim) — [apps/api/src/prompt.ts:7-38](apps/api/src/prompt.ts)

> You are the theory voice of Reharm Lab, a practice app for jazz pianists. The app's deterministic theory engine has already analysed a jazz standard, proposed a reharmonization move, and computed every musical fact about it: the chord symbols, the spelled pitches, the voice leading, the melody check and the right-hand scale options. Your job is to turn those facts into teaching text that helps one specific reader internalize the move well enough to play it on the bandstand, in any key, without the app.
>
> ## The reader
>
> An advanced jazz pianist. They know their ii–Vs, shell voicings, guide tones and the modes of melodic minor. They are now working on the harmonic vocabulary of players such as Bill Evans (voice-led reharmonization, rootless voicings, inner-voice motion) and Shaun Martin (gospel reharmonization, sus and slash-chord dominants, half-step planing, chromatic approach chords). Write to them as one musician talking to another: analytical, precise, and encouraging. Do not define basic terms. Do not flatter, and do not open with praise of the move or the tune.
>
> ## What you receive
>
> A JSON object inside <facts> tags with:
> - tune: title, key, meter and feel.
> - move: the move's name, category and level, the bar span, the original chord(s), the replacement chord(s), the chord the move resolves into, any voicing hint (left-hand and right-hand notes), the voice-leading motions in semitones, and the melody check (each melody note's role over the new chord). melodyVerified is false when no melody was entered for those bars.
> - engineFacts: rule-specific facts (for example the shared tritone of a tritone substitution, or the triad of an upper-structure voicing).
> - scales: for each replacement chord, the ranked right-hand scales with their notes and parent scales, plus guide tones and where they resolve.
> - draft: the engine's own template wording. Treat it as a correct but plain first draft that you are improving, not as text to paraphrase line by line.
>
> ## Accuracy rules
>
> The facts are the ground truth. Every note name, chord symbol, interval and scale you mention must appear in the facts or follow directly from them. Spell notes exactly as the facts spell them (a G7 altered scale contains A♯, not B♭). Write accidentals as ♭ and ♯, and chord symbols in the facts' style (B♭7(♭9), E♭/F, Dm7♭5). Do not invent melody notes, voicings, recordings, quotes or biographical claims. You may describe what is characteristic of Bill Evans's or Shaun Martin's general approach when it genuinely illuminates the move, but never attribute a specific recording, performance or statement to them. If melodyVerified is false, say once, briefly, that the player should check the move against the melody in their own lead sheet. If something in the facts looks musically surprising, explain it as given rather than correcting it.
>
> ## What to write
>
> Return a JSON object with exactly these three fields:
>
> summary: one or two sentences, at most 45 words. Name the move, what it replaces, and the single most important reason it works. Plain prose.
>
> deepDive: 150 to 260 words in two or three short paragraphs separated by a blank line. Plain prose with no headings, bullets or markdown. Cover, in an order that reads naturally:
> 1. The harmonic function: what the original chord was doing, and how the new chord(s) keep, redirect or intensify that function.
> 2. The voice leading: name the moving voices and their distances from the facts, so the reader hears why it sounds smooth (or deliberately tense).
> 3. How to hear and play it: one concrete tip about voicing or touch, and how the right hand can use the top-ranked scale, pointing at the guide-tone targets.
> End with one sentence on where else this move works in the standard repertoire, described by harmonic situation (for example "any V7 that resolves to a minor ii") rather than by naming specific songs.
>
> recreateRule: one imperative sentence of at most 35 words that works in any key. Use intervals, degrees and chord functions, never note names.

### Inferences
- Copy quirks a rewrite should fix:
  - Rendered tritone-sub text spells the shared tritone "E–B♭ … are F♭–B♭". It follows the spelling rule, but it is jarring for a learner; the template also mixes "G♭9" (summary) with "G♭7" (theory) for the same chord.
  - The engine recreateRules use "♭5" and "tritone" without defining them. The prompt forbids defining basic terms ("Do not define basic terms"), and its reader model is fixed at "advanced". There is no audience or level parameter in `buildFacts` or the prompt, so the Deep Dive cannot adapt to a beginner.
  - The prompt says the recreateRule must use no note names. The engine's own template recreateRules already comply.
  - The pedagogy formula for secondary dominant ("vi7 → VI7(♭9) → ii") shows only one example case. Formula notation mixes Roman numerals with chord qualities ("iv7 → ♭VII9 → Imaj7").
  - Register shifts between voices. The Changes game's warm mental models ("the landing", "walks you to the edge … leans over it") differ from the Study card's terse interval prose. The Coach's whyHere uses "&" and semicolons.

### Gaps
- Could not quote a real Claude-written Deep Dive for any move, because none is committed (see Q1 gaps).

## Q3. Jargon in user-facing copy, and whether it is defined in-app

### Takeaway
There is no glossary, tooltip-definition system or concepts module for terms. A grep for glossary/definition/`<abbr` found nothing user-facing. A few terms are glossed inline once, inside a specific move's text. Most jargon appears bare, including the raw styleTag slugs on every move card.

### Cited Findings
- No glossary/definitions anywhere in `packages/*/src` or `apps/*/src` (the only hits for "definition" are about proof definitions) — [packages/theory-core/src/testing/proofs.ts:14](packages/theory-core/src/testing/proofs.ts), [apps/web/src/components/xray/ProofPanel.tsx:17, 64](apps/web/src/components/xray/ProofPanel.tsx)
- `concepts.ts` is a practice-history registry (ruleId prefixes `ear:`/`shape:` → family heading and `conceptName`), not a glossary — [packages/theory-core/src/concepts.ts:8-83](packages/theory-core/src/concepts.ts)

Term inventory (where used → whether defined):
- **guide tones**: MoveCard theory "Guide tones: …" (rules.ts:66, :86, :154), Practice HUD "Guide tones:" (ChordHUD.tsx:64), heatmap "guide-tone landing" (ImprovHeatmap.tsx:904), X-ray tooltip "(10 = the guide tones barely move)" (XRayPipeline.tsx:281), Voicings legend "guide tones (3, 7)" (VoicingsPage.tsx:721). **Partly defined**: only the Voicings legend implies the degrees, and the bandstandCue says "guide-tone shell (3rd & ♭7)" (rules.ts:174). The definition "3rd (or sus 4th) and 7th" exists only as a code comment (coach.ts:22).
- **tritone**: tritone sub text and pedagogy, gospel turnaround, backdoor ("with no tritone resolving"). **Never defined as an interval**. Its function is glossed once ("That interval is what makes a dominant want to resolve") in rules.ts:195.
- **Roman numerals / ♭II7, ♭VII7, iv, III7, ♯I°7**: in every `pedagogy.formula` and titles like "ii–V into the IV". **Not explained.** ChordFactsCard and the chord selector show the roman numeral plus a FUNCTION_WORD gloss (ChordMoveSelector.tsx:15-22). The Changes game teaches numerals implicitly through function chips (ii/V/I…) — [packages/theory-core/src/ears/judge.ts:84-87](packages/theory-core/src/ears/judge.ts)
- **function words (T/PD/D)**: **defined** via FUNCTION_WORD ("home: the chord at rest", "pre-dominant: leads toward the V", "tension: wants to resolve").
- **related ii**: **defined inline** in its own move ("the minor chord a 5th above its root"), rules.ts:63.
- **leading tone**: secondary dominant, backdoor ("has no leading tone"), pedagogy. **Glossed once** in the secondary-dominant theory ("a half step below … the leading tone of the chord you're about to land on"), rules.ts:153.
- **avoid note**: ChordHUD "Don't hold:", heatmap "held avoid notes", scale whys ("the avoid-note 4th"), melody chips/rejections. **Not defined in UI.** The rule ("a half step above a chord tone … except over a dominant's root (b9) or 5th (b13)") is only a code comment in melody.ts:36-40. Per-instance rejection reasons do explain the clash.
- **upper structure** (♭VI / II triad): titles and pedagogy. **Not defined as a term.** The theory explains the mechanism ("a plain B♭ triad … reads as ♭13, root and ♯9"), rules.ts:242-245.
- **Lydian dominant / altered / melodic minor / harmonic minor / Phrygian dominant / Aeolian**: insights, Improv card, scale whys. **One-line glosses** exist in scales.ts `why` for each scale, but "mode of melodic minor" is never explained.
- **borrowed / parallel minor / modal interchange**: backdoor, borrowed iv, ♭VI–♭VII ("borrowed from F minor"). **Glossed inline** ("borrowed from F minor", "F Aeolian, the parallel minor", rulesAdvanced.ts:150). The slug `modal-interchange` appears raw in the card header.
- **rootless, Type A / Type B**: rootless ii–V–I. **Defined by degree formula** (♭3–5–♭7–9 / ♭7–9–3–13), rules.ts:302-353. The "close" voicing label "Close (rootless)" is not defined.
- **shell**: pedagogy and voicings. **Defined** in the Voicings hint "Root, 3rd and 7th only" (voicing.ts:105).
- **drop 2 / drop 3 / three-zone / quartal / spread**: **defined** in voicing hints (voicing.ts:102-108).
- **constant structure / planing**: **defined inline** ("keeps one chord shape and moves it in parallel"), rulesAdvanced.ts:348. "planing" appears as a raw styleTag.
- **appoggiatura**: common-tone °7. **Glossed** ("tension that dissolves into the chord you were already on"), rulesAdvanced.ts:265.
- **tonicize**: Coltrane recreateRule/pedagogy. **Not defined.**
- **enclosure**: heatmap legend "enclosure (cross-hatched)". **Not defined** (ImprovHeatmap.tsx:918).
- **extensions/alterations (♭9, ♯9, ♯11, ♭13, 13(♯11), sus, 6/9, m7♭5, °7)**: everywhere. **Not defined.** The degree names in the Coach (DEGREE_NAME / INTERVAL_NAME) only label notes (CoachDrill.tsx:597-599).
- **"the Family"** (mediant dominant): **explained** in the insight ("The whole Family over the same E°7: …"), rulesAdvanced.ts:116-117.
- **category labels** ("Dominant sub", "Modal", "Symmetric", "Chromatic", "Voicing", "Gospel", "Functional"): **undefined labels** — [apps/web/src/design/tokens.ts:47-56](apps/web/src/design/tokens.ts)
- **styleTags** shown raw: `bebop`, `standard`, `modal-interchange`, `lydian-dominant`, `bill-evans`, `planing`, `pedal`, `cinematic`, `neo-soul`, `stride`, `coltrane` — rendered via `move.styleTags.join(", ")` — [apps/web/src/components/MoveCard.tsx:54](apps/web/src/components/MoveCard.tsx)
- **Level labels** "Original / Functional / Bebop / Gospel / Modern": **not explained** beyond the density tooltip (tokens.ts:58-64, LevelDial.tsx:58). A visible e2e string: "Level 0 shows the tune as written." (e2e/golden.spec.ts:38).

### Inferences
- The strongest existing beginner-friendly vocabulary lives in the Changes game (motions.ts) and the voicing hints. The Study and Coach layers assume an advanced reader. That matches the prompt's stated reader and the user profile in CLAUDE.md ("skip basic theory definitions"), but not a general audience for the public demo.
- A glossary could be keyed to the existing `pedagogy`/`text` strings by term, so definitions render on hover/tap without rewriting every template.

### Gaps
- Did not exhaustively read PracticeMode, VoicingsPage, PracticeDashboard, EngineXRay or LeadSheet copy. Jargon there was sampled via grep only.

## Q4. Concept/prerequisite metadata, levels L1–L4, DENSITY, and the full ruleId list

### Takeaway
Rules carry only `id`, `name` and an optional `pedagogy`. Level, category and styleTags are set per proposal (one rule can emit two levels). There are no prerequisites, difficulty scores, concept dependencies or "learn this first" links. Levels are "spice-dial" positions that also cap move density; they are not a curriculum. The UI level names (Functional/Bebop/Gospel/Modern) do not match which rules sit at each level.

### Cited Findings
- `Rule { id; name; pedagogy?; propose }`; `Proposal { level: 1|2|3|4; category: MoveCategory; styleTags: string[]; … }` — [packages/theory-core/src/ruleKit.ts:19-39](packages/theory-core/src/ruleKit.ts)
- `MoveCategory = "functional" | "dominant-sub" | "chromatic" | "modal" | "symmetric" | "gospel" | "voicing"` — [packages/theory-core/src/types.ts:82-89](packages/theory-core/src/types.ts)
- DENSITY: `1: {windowBars: 8, maxMoves: 1}`, `2: {4, 1}`, `3: {4, 2}`, `4: {4, Infinity}`. Doc comment: "Turning the dial up means more adventurous moves *and* more of them: a reharm that touches every bar stops sounding like the tune." `LEVEL_WEIGHT = 2`, `VARIETY_PENALTY = 1.5` — [packages/theory-core/src/pathway.ts:7-28](packages/theory-core/src/pathway.ts)
- Ranking `level×2 + score − 1.5×(earlier uses of the rule)`; user picks forced in — [CLAUDE.md §2 rule 6](CLAUDE.md)
- UI level labels: `{0 "Original"}, {1 "Functional"}, {2 "Bebop"}, {3 "Gospel"}, {4 "Modern"}` — [apps/web/src/design/tokens.ts:58-64](apps/web/src/design/tokens.ts)
- The doc comment in ruleset.ts is stale: "L1–2: functional, dominant subs, passing diminished, upper structures / L3: gospel turnaround, backdoor ii–V, ♭VI–♭VII–I, borrowed iv, common-tone diminished / L4: Coltrane substitution, constant structure, one note on top". It omits secondaryDominant, mediantDominant, rootless, upperStructureII and minorLineCliche — [packages/theory-core/src/ruleset.ts:6-11](packages/theory-core/src/ruleset.ts). STATE_OF_THE_UNION still says "11 rules" (:43, :180).
- Selector warns when a pick exceeds the dial: "Spicier than the dial (L{level}): it goes in because you picked it." — [apps/web/src/components/ChordMoveSelector.tsx:346-350](apps/web/src/components/ChordMoveSelector.tsx)
- Changes game has its own 3-level progression with mastery criteria (e.g. L2 "10 right in a row at Open with the function named, in all three keys."). It is the only place with explicit mastery/prerequisite semantics ("next up") — [packages/theory-core/src/ears/motions.ts:273-299](packages/theory-core/src/ears/motions.ts), [apps/web/src/components/changes/Controls.tsx:31-56](apps/web/src/components/changes/Controls.tsx)
- The practice-history SM-2 is per `(ruleId, keyTonic)`; the passport is split by concept family (reharm / ear / shape) — [packages/theory-core/src/concepts.ts:18-39](packages/theory-core/src/concepts.ts)
- The test asserts 17 rules all have pedagogy and step cues — [packages/theory-core/test/practice.test.ts:133-145](packages/theory-core/test/practice.test.ts)

**Full ruleId list (RULES order = priority), with emitted level, category and source line:**

| # | ruleId | name | level | category | source |
|---|---|---|---|---|---|
| 1 | functional.secondaryTwoFive | Secondary ii–V | L1 ("Add the related ii") / L2 ("ii–V into …") | functional | rules.ts:19, 55, 76 |
| 2 | functional.secondaryDominant | Secondary dominant | L1 | functional | rules.ts:98, 144 |
| 3 | dominant.tritoneSub | Tritone substitution | L2 | dominant-sub | rules.ts:167, 185 |
| 4 | voicing.upperStructureBVI | Upper-structure triad | L2 | voicing | rules.ts:208, 234 |
| 5 | gospel.halfStepTurnaround | Gospel turnaround | L3 | gospel | rules.ts:254, 278 |
| 6 | voicing.rootlessTwoFiveOne | Rootless ii–V–I | L2 | voicing | rules.ts:298, 334 |
| 7 | voicing.upperStructureII | Upper-structure II (Lydian dominant) | L2 | voicing | rules.ts:360, 383 |
| 8 | chromatic.passingDiminished | Passing diminished | L2 | chromatic | rulesAdvanced.ts:195, 217 |
| 9 | modal.backdoorTwoFive | Backdoor ii–V | L3 | modal | rulesAdvanced.ts:35, 55 |
| 10 | dominant.mediantDominant | Mediant dominant (the Family) | L3 | dominant-sub | rulesAdvanced.ts:74, 94 |
| 11 | modal.flatSixFlatSeven | ♭VI–♭VII–I | L3 | modal | rulesAdvanced.ts:124, 142 |
| 12 | modal.borrowedIv | Borrowed iv | L3 | modal | rulesAdvanced.ts:160, 177 |
| 13 | chromatic.commonToneDiminished | Common-tone diminished | L3 | chromatic | rulesAdvanced.ts:237, 255 |
| 14 | symmetric.coltraneSubstitution | Coltrane substitution | L4 | symmetric | rulesAdvanced.ts:274, 296 |
| 15 | chromatic.constantStructure | Constant structure | L4 | chromatic | rulesAdvanced.ts:315, 339 |
| 16 | chromatic.minorLineCliche | Minor line cliché | L2 | chromatic | rulesAdvanced.ts:358, 385 |
| 17 | melody.oneNoteOnTop | One note on top | L4 | chromatic | rulesOneNote.ts:116, 188 |

(Rows 1–7 from [packages/theory-core/src/rules.ts](packages/theory-core/src/rules.ts), 8–16 from [packages/theory-core/src/rulesAdvanced.ts](packages/theory-core/src/rulesAdvanced.ts), 17 from [packages/theory-core/src/rulesOneNote.ts](packages/theory-core/src/rulesOneNote.ts).)

Ear-game concept ids (separate system): `ear:landing`, `ear:setup`, `ear:staircase`, `ear:door`; voicing concept ids `shape:<style>:<quality>[+alt…]` — [packages/theory-core/src/ears/motions.ts:303-317](packages/theory-core/src/ears/motions.ts), [packages/theory-core/src/concepts.ts:49-51](packages/theory-core/src/concepts.ts)

### Inferences
- The label/level mismatch is concrete. L2 "Bebop" holds voicing rules (rootless, both upper structures) and the Bill-Evans-tagged minor line cliché. L3 "Gospel" holds four modal-interchange/borrowed moves plus the mediant, and only one gospel rule. L4 "Modern" holds One note on top (tagged bill-evans/ballad). Labels describe a style flavour; the level semantics are actually "adventurousness + density".
- A prerequisite graph is natural to add next to `pedagogy`. Examples: tritone sub → gospel turnaround / mediant dominant ("the Family"); secondary dominant → secondary ii–V; borrowed iv → backdoor. The existing insights already cross-reference these ("This is the first step of backing up the circle…", "The tritone sub and the backdoor ♭VII7 are two of its members"). Because level is per-proposal, any per-rule "difficulty" field would need to reconcile with secondaryTwoFive's dual L1/L2.

### Gaps
- Did not verify how CoachPage derives `level`/`category` for its concept list (rules have no static level); likely from `conceptDrillSteps` proposals (coach.ts:226), not confirmed.

## Q5. Tests, goldens and e2e that assert visible text; glossary/concepts module

### Takeaway
Few tests pin explanation prose. What is pinned: some titles, rejection-reason fragments, `conceptName` equals `rule.name`, non-emptiness of pedagogy and step cues, Changes-game copy constraints, a handful of e2e UI strings, and the demo-explanation API contract. A rewrite of `text.*` or `pedagogy.*` mostly needs the demo JSON regenerated. There is no glossary module; `concepts.ts` is an id/name registry.

### Cited Findings
- `someday.golden.test.ts:15` — `find("functional.secondaryTwoFive", 2)!.title` toBe "ii–V into the IV"; `:44` reason toMatch `/♭9 of Dm7♭5/` — [packages/theory-core/test/someday.golden.test.ts](packages/theory-core/test/someday.golden.test.ts)
- `coopBlues.golden.test.ts:75-79` — rejection reasons toMatch `/natural 5/`, `/♯9 of B9/`, `/♭9 of D♭maj7/`. It also pins accepted rules and move counts per level (L0 none → L1 1 → L2 3 → L3 4 → L4 12 per STATE_OF_THE_UNION:229) — [packages/theory-core/test/coopBlues.golden.test.ts](packages/theory-core/test/coopBlues.golden.test.ts)
- `advancedRules.test.ts:325, 398` — reasons toMatch `/B/`, `/A/` — [packages/theory-core/test/advancedRules.test.ts](packages/theory-core/test/advancedRules.test.ts)
- `concepts.test.ts:41-65` — `conceptName(r.id) === r.name` for every rule; "Shells · 7(♭9)", "Drop 2 · m7♭5"; ear names equal `EAR_MOTION_NAME` — [packages/theory-core/test/concepts.test.ts](packages/theory-core/test/concepts.test.ts)
- `practice.test.ts:133-145` — all 17 rules have non-empty `pedagogy.formula` and `whyItWorks`; every step has non-empty `stepCue.whyHere` — [packages/theory-core/test/practice.test.ts](packages/theory-core/test/practice.test.ts)
- `ears.motions.test.ts:118-142, 179` — every motion's hint/right/wrong/why > 10 chars, never contains `undefined|NaN|V/|#`, never engine spelling `/\b[A-G]b/`; staircase hint matches `/wider/` only at the hop; alt lines match `/real jazz move/` — [packages/theory-core/test/ears.motions.test.ts](packages/theory-core/test/ears.motions.test.ts)
- `apps/api/test/api.test.ts:46-99` — demo `/explain`: a fixture hit returns `{summary:"S",deepDive:"D",recreateRule:"R", source:"demo-claude"}`; a miss returns `move.text.summary`/`recreateRule` with `source:"demo-template"`; transposed and other-tune ids fall back to template — [apps/api/test/api.test.ts](apps/api/test/api.test.ts)
- Proofs (8 claims) run in CI and the browser Proof tab; titles and claims are user-visible — [packages/theory-core/src/testing/proofs.ts](packages/theory-core/src/testing/proofs.ts), [packages/theory-core/test/proofs.test.ts:8](packages/theory-core/test/proofs.test.ts)
- e2e (Playwright on the static demo, `npm run e2e`, not part of `npm test`): asserts "Level 0 shows the tune as written.", `/^\d+ moves? · /` in the "Reharm & tricks" panel, radio names `/^L0\b/`…`/^L4\b/`, "Where does it want to go?", list "Where does it go?", button "why?", heading `/Make the Changes/`, group "How much help" → "Guided", `/\d+ pts · streak \d+/`, MIDI toast strings — [e2e/golden.spec.ts:9-122](e2e/golden.spec.ts)
- Demo Deep Dive file must be regenerated after any `text.*` change: `npm run demo:generate -w @reharm/api -- --template`. CLAUDE.md requires regenerating it when the reference tune changes — [docs/STATE_OF_THE_UNION.md:321](docs/STATE_OF_THE_UNION.md), [CLAUDE.md §2 rule 0](CLAUDE.md)
- `PROMPT_VERSION` must be bumped when the prompt changes (part of the cache key) — [apps/api/src/prompt.ts:1-5](apps/api/src/prompt.ts)
- Test web files (`deepLink.test.ts`, `themes.test.ts`, `verdictMarks.test.ts`, `demoHistory.test.ts`, `historyBrowser.test.ts`, `bandFeel.test.ts`) contain no explanation-text assertions per grep — [apps/web/src](apps/web/src)

### Inferences
- Renaming rule `name`s is safe for tests (concepts.test compares to `r.name` dynamically). It would change passport names and `demoHistory.json` labels only if those store names; they store ruleIds.
- Changing the secondaryTwoFive L2 title format breaks `someday.golden.test.ts:15`. Changing the melody.ts reason wording breaks the golden regexes. Changing the Changes motion copy must keep the ears.motions constraints (no "V/", flat spelling, `/wider/`, `/real jazz move/`). Changing the dial/L0 copy or the "N moves ·" line breaks e2e.
- Explanation layers that have NO tests are free to rewrite: MoveCard text, pedagogy content (non-empty only), stepCue content (non-empty only), DeepDive UI copy and the system prompt. For these, quality would have to be guarded by a new test, such as a term-must-be-glossed lint.

### Gaps
- Did not check whether any test verifies that `apps/api/demo/explanations.json` is in sync with current engine text. None was seen in the grep, so a stale demo file may go unnoticed.
- Did not read `e2e/README.md` or `e2e/fixtures.ts`.
