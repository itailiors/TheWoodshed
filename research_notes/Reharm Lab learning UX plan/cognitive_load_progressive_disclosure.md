# Cognitive load theory and progressive disclosure in interactive (music) learning apps

Research notes for the Reharm Lab redesign. Compiled 2026-11-20. Source quality is noted inline: [primary] = peer-reviewed paper or the company's own blog/site; [secondary] = handout/summary of primary work; [anecdotal] = third-party review, fan wiki, forum, or a competitor's blog.

## 1. What cognitive load theory and Mayer's principles say about how much to show per step, and how to adapt for beginners vs intermediates

### Takeaway
Working memory holds about 4 chunks. The fix for novices is to segment, pre-train names and parts, signal, and put labels on the diagram rather than beside it. The same supports become redundant and measurably harmful for experienced learners (expertise reversal), so guidance has to fade or adapt to the learner's level. Uniform, maximally explained screens are the wrong default for an intermediate audience.

### Cited Findings
**Working-memory capacity**
- Cowan (2001) reviewed evidence across verbal/non-verbal, visual/auditory and spatial/temporal material. He concluded that the capacity of the focus of attention averages **about 4 chunks** in normal adults, and that Miller's "7" was a rough rhetorical estimate. [primary] — [Cowan 2001, BBS 24(1) 87–114 (ResearchGate)](https://www.researchgate.net/publication/11830840_The_magical_number_4_in_short-term_memory_A_reconsideration_of_mental_storage_capacity)
- The "4" is disputed at the edges. Pascual-Leone's commentary argued 4 may underestimate capacity because procedural resources weren't counted. A 2023 Journal of Cognition paper frames 4 vs 7 as depending on what is counted. [primary] — [Semantic Scholar record](https://www.semanticscholar.org/paper/The-magical-number-4-in-short-term-memory:-A-of-Cowan/c8f359b3967ddef8e6d7f6ad58213a543d33ea22); [J. Cognition 2023](https://journalofcognition.org/articles/10.5334/joc.387)

**Core CLT architecture**
- The canonical update of CLT is Sweller, van Merriënboer & Paas (2019), "Cognitive Architecture and Instructional Design: 20 Years Later", Educ. Psych. Review 31, 261–292. It argues that most instructional design still "proceeds as though working memory and long-term memory did not exist". [primary] — [ERIC EJ1217401](https://eric.ed.gov/?id=EJ1217401); [Erasmus record](https://pure.eur.nl/en/publications/cognitive-architecture-and-instructional-design-20-years-later/)
- Experts hold hierarchically organized schemas. These let them treat a whole configuration of elements as **one** element in working memory, so "increasing one's level of expertise in a domain is a major means of reducing working memory load". [primary] — [Kalyuga, Ayres, Chandler & Sweller 2003, Educ. Psychologist 38(1) 23–31 (PDF mirror)](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Element interactivity is relative to the learner.** "An assessment of element interactivity is always relative to the level of expertise of an intended learner." The same material can be many interacting elements for a novice and a single schema for an expert. [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)

**Split attention, the redundancy effect and expertise reversal**
- **Split attention vs redundancy.**
  - For novices, text physically integrated into a diagram beats text separated from it (split-attention effect).
  - If either source is intelligible on its own, *eliminating* the redundant source beats integrating it. Chandler & Sweller (1991) found a diagram alone beat a diagram plus text that restated it.
  - Identical on-screen text plus narration was worse than narration alone (Craig et al. 2002; Kalyuga et al. 2000; Mayer et al. 2001).
  - [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Concrete reversal** (Kalyuga, Chandler & Sweller 1998). Inexperienced electrical trainees needed text integrated into circuit diagrams and couldn't understand a diagram-only format. *More experienced trainees performed significantly better with the diagram-only format and reported lower mental effort*: for them the text was redundant. [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Redundant text is hard to ignore.** Redundant information "is frequently difficult to ignore". Experts who try to skip it still pay a cross-referencing cost, so a visible explanation the expert doesn't need is not neutral. Yeung, Jin & Sweller (1998) found that explanatory notes integrated into a text helped low-competence readers but "retarded learning" for knowledgeable ones. [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Modality reversal** (Kalyuga et al. 2000). Novices benefited most from a diagram with simultaneous *auditory* explanation. After further training the audio's advantage disappeared, and later the diagram-only condition won, a full reversal. [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)

**Worked examples and fading**
- **Worked examples vs problem solving reverses with expertise.**
  - Kalyuga, Chandler, Tuovinen & Sweller (2001): trade apprentices learned more from worked examples at first. With more experience the advantage vanished, and eventually problem solving was superior.
  - Tuovinen & Sweller (1999): worked examples helped database novices; there was no difference for those with prior familiarity.
  - [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Fading beats an abrupt switch.** Renkl, Atkinson et al. found detailed worked examples best for novices, but "they should be gradually faded out" and replaced by problems. Renkl, Atkinson, Maier & Staley (2002) found fading *superior to an abrupt switch* from examples to problems (the "guidance-fading effect"). [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Fading rate and adaptive placement.**
  - Kalyuga & Sweller (2004) used backward fading at one step per example vs a slow condition at one step per two examples.
  - Their Rapid Dynamic Assessment placed learners at the right faded-example level. The adaptive version beat a yoked non-adaptive control (Kalyuga & Sweller 2005).
  - [primary/secondary summary] — [Salden et al., Instructional Science special issue (PDF)](http://www.cee.uma.pt/ron/Salden%20et%20al.%20-%20The%20Expertise%20Reversal%20Effect%20and%20Worked%20Examples.pdf); [Kalyuga & Renkl 2010 special-issue intro](https://link.springer.com/article/10.1007/s11251-009-9102-0)
- **Adaptive fading in a tutor.** Salden et al. used geometry in the Cognitive Tutor. Individualized (adaptive) fading beat fixed fading and plain tutored problem solving on immediate and one-week-delayed posttests in the lab. In the classroom it won only on the delayed test. [primary] — [Salden et al. PDF](http://www.cee.uma.pt/ron/Salden%20et%20al.%20-%20The%20Expertise%20Reversal%20Effect%20and%20Worked%20Examples.pdf)

**High-interactivity material and learner control**
- **Isolated elements first, then interacting.** Pollock, Chandler & Sweller (2002): for very high-interactivity material, novices learned better from a two-phase method. Elements were shown in isolation first (deliberately dropping the relations), then the full interacting version. The benefit disappeared for experienced learners. [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Learner-paced segments.** Mayer & Chandler (2001) let novices control an animation's pace segment by segment first. This beat starting them on the full high-interactivity animation, and they did better on the later uncontrolled presentation and on transfer. [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Imagination effect reverses.** Asking learners to *imagine* the procedure beat studying worked examples for knowledgeable learners, and hurt novices (Cooper, Tindall-Ford, Chandler & Sweller 2001). [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **The authors' bottom line.** "Instructional design should be tailored to the level of experience of intended learners. Without such tailoring, the effectiveness of instructional designs is likely to be random." [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)

**Mayer's multimedia principles: median effect sizes (d)**
- **Mayer (2021), 3rd ed., via a UNH handout** [secondary]:
  - coherence (cut extraneous material): 18 of 19 tests, d = 0.86;
  - verbal signaling: 15 of 16, d = 0.69;
  - visual signaling: 11 of 12, d = 0.71;
  - pre-training: 10 of 10, d = 0.78.
  - [UNH "Research-Based Principles for Designing Multimedia Instruction" (Mayer)](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-research-based-principles-for-designing-multimedia-instruction-mayer.pdf)
- **Cambridge Handbook of Multimedia Learning, 2nd ed. (2014)** [primary, abstracts]:
  - coherence: 23 of 23 tests, d = 0.86;
  - signaling: 24 of 28, d = 0.41;
  - segmenting: median d = 0.79;
  - pre-training: median d = 0.75;
  - spatial contiguity: 22 of 22, d = 1.10;
  - temporal contiguity: 9 of 9, d = 1.22.
  - [Ch. 11 Segmenting/Pre-training/Modality](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-managing-essential-processing-in-multimedia-learning-segmenting-pretraining-and-modality-principles/4110A2275F6DCD02DAB1F8B37BA7E5CE); [Ch. 12 Coherence/Signaling/Redundancy/Contiguity](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/CD5B7AE1279A9AB81F8EEBB53DBEC86E); [UVic chapter PDF](https://edtechuvic.ca/wp-content/uploads/sites/11/2022/09/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles.pdf)
- **Effect sizes vary by edition.**
  - Segmenting ranges 0.67–0.98 and pre-training 0.75–0.92 across editions. An earlier Handbook chapter gives segmenting 3/3 tests, d = 0.98; pre-training 7/7, d = 0.92; modality 21/21, d = 0.97.
  - Signaling shifts most (0.41 to 0.71). Coherence is stable at ~0.86.
  - Mayer himself notes these principles are boundary-conditioned: they are strongest for low-prior-knowledge learners and for complex, fast-paced material.
  - [primary/secondary] — [UVic segmenting/pre-training chapter PDF](https://edtechuvic.ca/edci337/wp-content/uploads/sites/11/2022/09/principles-for-managing-essential-processing-in-multimedia-learning-segmenting-pre-training-and-modality-principles.pdf)
- **Individual differences.** Mayer (2001) found inexperienced learners "benefitted far more" from well-designed presentations than high-knowledge learners and called this the "individual differences principle". [primary, as reported] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)

### Inferences
**Per-step budget and diagrams**
- **Budget per step: one new idea and at most ~4 new elements in the focus of attention.** For a reharm card that means, for example, the *target chord*, the *substitute*, the *one changed interval/voice-leading line*, and the *melody note it must survive*. Everything else (scale lists, full voicing spellings, rule id, history) goes behind a details control.
- **Lead sheet + keyboard + text is a split-attention setup.** For novices, annotate *on* the keyboard and lead sheet: color the guide tones, label the moving voice in place. Don't describe it in a separate paragraph. For intermediates, the annotated diagram alone (or diagram + one-line rule) is likely *better* than diagram + paragraph (Kalyuga 1998 electrical-diagram result).

**Explanations should adapt to the learner**
- **The current "wall of jargon" is the redundancy effect for intermediates.** For an intermediate like Itai, each paragraph restating what the keyboard already shows costs effort, and per the 2003 review he can't simply ignore it.
- **The text needs an expertise-adaptive default:**
  - beginners: short worked-example steps;
  - intermediates: a single "recreate rule" line, with the full Deep Dive on demand.
  - The existing `{summary, deepDive, recreateRule}` schema already maps onto this fading ladder.
- **Pre-training is cheap and effective (d ≈ 0.75–0.92).** Teach the 3–5 component names a move depends on (e.g. "guide tones", "tritone sub", "target chord") in a tiny separate step *before* the move explanation, so the explanation itself isn't also teaching vocabulary.
- **Fade worked examples backward.** First move: fully shown and heard. Next: the learner supplies the last step, e.g. picks the resolving voice. Then the learner builds the move from the rule. Use one step per example, or slower for a hard rule. Prefer adaptive fading driven by the existing SM-2 grades per `(ruleId, keyTonic)` over a fixed schedule.
- **Isolated then interacting.** For L3/L4 moves with many interacting voices, first show the moving voices in isolation, e.g. only the 3rd→7th line. Then show the full voicing in context.

### Gaps
- No quantified "words per screen" rule exists in the CLT literature itself. CLT gives element counts (~4 chunks), not word counts.
- No study found that applies expertise reversal specifically to music-theory or jazz-harmony instruction.
- Mayer's effect sizes per edition couldn't all be matched to principles from the 2008 American Psychologist paper. The handout line "13/15 tests, d = 1.00" could not be attributed with certainty (possibly modality).

## 2. How top learning products pace a lesson (one idea per screen, interaction before explanation, words per card, test-outs)

### Takeaway
The pattern across Brilliant, Duolingo (incl. Music), Hooktheory and the better piano apps is the same: short, interaction-first steps; sound and visual before text; very little prose; real music as the example. Skipping ahead is handled by *tests* (Duolingo "Jump here", Yousician skill tests, Khan unit tests and course challenges) rather than by trusting a self-reported level. Exact words-per-card figures are not published by any of these companies.

### Cited Findings
**Brilliant**
- Brilliant describes itself as "learn by doing - there are no videos, everything is interactive". It claims interactive learning is "6x more effective", a figure that links to a MOOC study in an EducationWorld article. [primary marketing; the 6x claim is weakly sourced] — [brilliant.org/llms.txt](https://brilliant.org/llms.txt)
- Brilliant's own description (older copy) is "a delightful experience of guided discovery… think and reason from first principles". It also says it tracks mastered concepts and builds practice sets from progress. [primary marketing] — [brilliant.org/cs](https://brilliant.org/cs/)
- Third-party reviews describe Brilliant as "problem-first": it doesn't explain the concept at the start of a lesson. Lessons are short sequences of problems and visualizations, and the learner makes a prediction before seeing the answer. [anecdotal] — [Nibble review 2026](https://nibble-app.com/blog/is-brilliant-worth-it); [Beginners in AI 2026](https://beginnersinai.org/brilliant-explained/)
- When a user answers wrong, Brilliant's explanation is often itself interactive (explore the solution rather than read it). [anecdotal UI teardown] — [ScreensDesign UI breakdown](https://screensdesign.com/showcase/brilliant-learn-by-doing)

**Duolingo Music**
- Launch post (DuoCon, Oct 2023): instead of "lengthy videos or long-form text explaining musical concepts", learners do game-like exercises. Each lesson builds playing, sight-reading and listening, culminating in full songs. [primary] — [Duolingo blog: Duolingo Music is here](https://blog.duolingo.com/music-course/)
- Duolingo's curriculum lead Karen Chow said the course introduces music step by step so learners aren't swamped. Exercises include completing a sequence and matching notes to piano audio. [secondary press] — [TechRadar](https://www.techradar.com/computing/software/duolingos-new-music-platform-will-teach-you-the-basics-of-playing-tunes)
- Notes are learned first on an on-screen keyboard, *then* on the staff. Engineering Director Vanessa Jameson said learning scientists, music experts and engineers built the course together. [secondary press] — [Technical.ly](https://technical.ly/startups/duolingo-music-launch-duocon/)
- In a Sony Music partnership, each section of the path has a popular song chosen to fit the notes and skills being learned. [primary] — [Duolingo blog: popular songs](https://blog.duolingo.com/popular-songs-music-course/)
- A competitor's blog reports a February 2025 reorganization that expanded the course to 274 units and removed bass clef. [anecdotal, competitor, possibly biased] — [StaffReader 2026](https://blog.staffreader.app/does-duolingo-music-teach-reading/)
- A reviewer notes the course doesn't appear to teach key signatures, even though songs use G, D and B♭. [anecdotal] — [Dillon Mok](https://dillonmok.com/blog/duolingo-music-course/)

**Hooktheory**
- Hooktheory I teaches chords, harmony and melody through real pop songs, with "dozens of audiovisual examples" playing along. It uses piano-roll-style notation, not sheet music, and needs no prior reading ability. It was written to be used with Hookpad so readers immediately create with each concept. [primary] — [Hooktheory I page](https://www.hooktheory.com/books/one)
- Size: 6 chapters, 41 exercises and 94 (or 88, depending on the page) audiovisual examples. Across books I+II there are 315 examples and 124 exercises. That works out to roughly 2–2.5 heard examples per exercise. [primary; counts differ between pages] — [Hooktheory I page](https://www.hooktheory.com/books/one); [Hooktheory pricing](https://www.hooktheory.com/books/pricing)
- Origin: UC Berkeley PhD students asking "What if we taught music theory using real popular songs instead of abstract exercises?" [secondary] — [Try It Randomly overview](https://tryitrandomly.org/hooktheory-master-music-theory-through-the-songs-you-love/)

**Open Studio**
- Open Studio is layered. It has starter courses (Jazz Piano Jump-Start: 7 lessons + Guided Practice), a "Core Piano Pathway" (24+ courses "so you always know what's next"), skill pathways by single skill (rhythm, voicings…) each running beginner to advanced, and weekly tune lessons. Five skill areas run through everything. "Every lesson includes guided practice with the Open Studio trio." [primary] — [Open Studio: Jazz Piano Foundations](https://www.openstudiojazz.com/courses/jazz-piano-foundations/); [Jazz Piano for Beginners](https://www.openstudiojazz.com/courses/jazz-piano-for-beginners/)
- Lesson format: Peter Martin plays part of the tune, then stops for commentary. Synced notation runs in Soundslice with slow-down/loop and an overhead hand camera. Users call the transcriptions the "secret sauce". [anecdotal] — [Piano World forum](https://forum.pianoworld.com/ubbthreads.php/topics/3564061/peter-martins-open-studio.html); [Reviews.io](https://www.reviews.io/company-review/store/open-studio-jazz/12206155)
- The gospel course has lessons under 30 minutes, split into 5 difficulty levels. [primary marketing] — [Elements of Gospel Piano](https://www.openstudiojazz.com/courses/elements-of-gospel-piano/)

**Test-outs and placement in other apps**
- **Duolingo test-outs.**
  - "Jump here?" (formerly test-out/skip) lets a learner skip one or more units by passing a test on the skipped lessons. It no longer costs gems.
  - At course start learners can take a placement test. A placement can't be undone, though placed-out lessons stay reviewable.
  - [anecdotal fan wiki + reviewers] — [Duolingo Fandom wiki "Jump here?"](https://duolingo.fandom.com/wiki/Jump_here%3F); [duoplanet units & checkpoints](https://duoplanet.com/duolingo-units-and-checkpoints/)
- **Yousician.** At start the learner picks a level ("first timer", "beginner", "intermediate pianist", "advanced player", "casual"). Levels unlock in order, but "you can challenge any level… by doing a quick skill test". Acing a lesson first try prompts a skill test to skip ahead. [anecdotal review] — [Piano Dreamers Yousician review](https://www.pianodreamers.com/yousician-piano-review/)
- **Simply Piano.** It has no placement test for returners, and stages inside a course can't be skipped. Reviewers list this as a frustration. One older source says whole courses can be skipped. Reviewers praise its gentle, clean onboarding for true beginners. [anecdotal, partly conflicting] — [The Upcoming, Nov 2026](https://www.theupcoming.co.uk/2026/11/11/the-seven-best-piano-learning-apps-for-adult-beginners/); [Pianoers review 2026](https://pianoers.com/simply-piano-review-the-honest-truth-about-learning-piano-with-an-app/)
- **Skoove.** The onboarding questionnaire suggests a starting lesson, but every course stays open from day one. [anecdotal] — [The Upcoming, Nov 2026](https://www.theupcoming.co.uk/2026/11/11/the-seven-best-piano-learning-apps-for-adult-beginners/)

### Inferences
**Structure each move as a short step sequence**
- The common lesson grammar is: **hear it → do or predict it → name it → (optional) read about it.** For Reharm Lab, a move card could open with "play original / play reharm" A/B audio on the lead sheet. Then: "which voice moved?" (tap the key). Then one sentence naming the move. Then the Deep Dive behind a disclosure.
- Hooktheory's ratio of more heard examples than exercises, all from real songs, suggests each rule should ship with 2+ musical instances. Reharm Lab already has the material: the same rule applied at different bars and keys.
- Open Studio's model (play a tune, stop and comment, synced notation, loop) is the closest analog for an intermediate jazz audience. Commentary is *anchored to a moment in the music*, not presented as a standalone essay. That argues for explanations attached to a bar/beat on the lead sheet with playback, not a side panel of prose.

**Placement and test-outs**
- "I already know this" should be a short **performance test** (play/identify the move), not a checkbox. Both Duolingo and Yousician gate skips behind a test.
- Itai, or any intermediate, should be able to test out of L1–L2 instantly. A non-undoable placement (Duolingo) is a known complaint vector, so keep placement reversible.

### Gaps
- No primary source found for **Brilliant's** internal lesson-design rules (words per screen, steps per lesson). Brilliant's blog didn't surface any design write-up. All "problem-first" claims are third-party.
- **musictheory.net** lesson pages are JS-rendered and couldn't be fetched. Its pacing (one sentence/diagram per "Next" click) is from general knowledge only and is unverified here.
- **Melodics** onboarding/placement, and **Hooktheory TheoryTab**'s explanation density, weren't covered by any source found.
- No company publishes a words-per-card number. The ~1–3 sentences per step claim is unverified for every app listed.
- No primary Duolingo source on how Duolingo Music handles placement/test-outs specifically (vs language courses).

## 3. Progressive disclosure UI patterns: staged disclosure, details on demand, the 2-level rule, and when it helps vs hurts

### Takeaway
NN/g's guidance (Nielsen, 2006): show the few most important options first and defer advanced or rare features to a clearly labeled secondary level. Never go beyond 2 levels. Use staged (wizard-like) disclosure only when steps are independent. It hurts when things users need to compare or alternate between get split across screens.

### Cited Findings
**NN/g guidance** (all from [NN/g, Nielsen 2006](https://www.nngroup.com/articles/progressive-disclosure/), primary)
- Progressive disclosure "defers advanced or rarely used features to a secondary screen". It improves learnability, efficiency and error rate: novices avoid mistakes, and experts save time not scanning rarely used features.
- Research cited there: limiting initial features does *not* create a restrictive mental model. Prioritizing features helps users understand the system better.
- **2-level rule:** designs with more than 2 levels "typically have low usability" because users get lost. If you need 3+, simplify first.
- **Make the advanced path obvious.** Put it in a visible spot with a label that tells users what's behind it. Multiple routes to the secondary options are rarely a good idea.
- **Choose the primary set by frequency of use**, using task analysis and field studies for new designs, analytics for existing ones, and instrumented feature usage for apps.
- **Staged disclosure** (wizards, linear steps) works when a task splits into steps with little interaction between them. It is problematic when steps are interdependent and users must alternate.
- **Counter-example:** a hotel site put all stages on one screen. That worked for comparing rooms and prices (frequent back-and-forth), but the payment fields caused errors during exploration.

**Related**
- The "one interaction per concept" and "label the diagram, don't use a legend" guidance from instructional-design writers mirrors segmenting and spatial contiguity. [secondary] — [eCampusOntario Pressbooks](https://ecampusontario.pressbooks.pub/interactivelearningpath/chapter/chapter-5-building-interactive-content-from-principles-to-practice/); [Mindstamp](https://mindstamp.com/blog/instructional-design-principles)

### Inferences
**What stays primary and what moves behind disclosure**
- **Primary level** (always visible on a move): lead sheet with the changed bars highlighted, A/B play, the keyboard showing the voicing with the moving voice marked, one-line summary.
- **Secondary level** (one click, clearly labeled, e.g. "Why it works"): Deep Dive prose, scale choices, rule id/trace, alternative voicings.
- Never a third nested level. The Proof/trace views belong in a separate developer/advanced mode, not nested inside a move.

**Where not to disclose, and staged flows**
- **Don't hide comparison material.** NN/g's hotel example maps directly onto comparing original vs reharm. Keep both versions in the same view (A/B toggle on the same lead sheet). Don't put them on separate screens or in a collapsed panel.
- A guided "learn this move" flow can be staged (hear → spot → name → play), because those steps are sequential. Free exploration of the pathway should *not* be a wizard, because users alternate between bars and moves.
- Use Reharm Lab's own interaction logs, for example which drawers/panels are opened, to decide what's primary.

### Gaps
- The NN/g progressive-disclosure article is from 2006. No newer NN/g article with quantified data on disclosure in *learning* apps was retrieved, so the 2-level rule is expert guidance rather than a controlled-study result.
- No controlled evidence found on collapsed "advanced" panels specifically in educational interfaces (vs. productivity UIs).

## 4. Skill trees, soft prerequisites and learner autonomy (Duolingo path, Khan mastery, SDT)

### Takeaway
Duolingo replaced its free-choice skill tree with a linear path (rolled out from summer 2022, to everyone on 1 Nov 2022). Its stated reasons: simplify the app, make the recommended learning order the default, and make spaced review part of forward progress. It reports better reading/listening outcomes, at the cost of complaints about lost freedom. Khan Academy and Yousician let learners skip ahead by *proving* mastery. SDT research (Patall 2008 meta-analysis) says choice raises intrinsic motivation, effort and performance, most strongly with 2–4 choices. The evidence-backed compromise: a recommended default path, plus test-gated skips, plus small meaningful choices.

### Cited Findings
**Duolingo's 2022 path**
- Duolingo's announcement thread (29 Aug 2022): lessons were reordered "so that you learn a mix of concepts – we've previously recommended this exact learning method, so we made it the default". Stories moved into the path. [primary] — [Duolingo on X](https://x.com/duolingo/status/1564270050734997505)
- Luis von Ahn: the path ensures a mix of concepts in a specific order (the "hover method"). "We wanted to make review feel essential to forward progress, rather than the old home screen which forced you to 'go back' to older lessons." [primary] — [von Ahn on LinkedIn](https://www.linkedin.com/posts/luis-von-ahn-duolingo_introducing-the-new-duolingo-learning-path-activity-6968265635290087424-_Zm0)
- Von Ahn to NBC: "to simplify Duolingo and also to make it so that new users understood how to best use Duolingo". The path builds in timed reviews that used to be at the user's discretion. It rolled out to new users first. [secondary press interview] — [NBC News](https://www.nbcnews.com/tech/tech-news/duolingos-update-redesign-luis-von-ahn-interview-rcna44655)
- Launched for all learners **1 Nov 2022**. Each path circle = one crown level of an old skill. Learners who used to "gold" a skill before moving on would find it different. [primary] — [Duolingo blog: new home screen](https://blog.duolingo.com/new-duolingo-home-screen-design)
- Duolingo's efficacy blog reports that learners on the new path had higher reading and listening scores than those on the old design. [primary, company-run study] — [Duolingo blog: efficacy results](https://blog.duolingo.com/results-duolingo-efficacy-studies)
- Criticism: the path "doesn't have the same freedom and flexibility of the tree", and practice opportunities are fewer. [anecdotal] — [duoplanet review](https://duoplanet.com/duolingo-new-learning-path-review/)
- Earlier context (2018): crown levels gave a choice between going deeper on a skill and moving on. [secondary press] — [TechCrunch 2018](https://techcrunch.com/2018/04/09/duolingo-adds-new-language-exercises-and-revamps-its-leveling-system)

**Khan Academy mastery**
- Each skill is worth 100 points:
  - Familiar (50) = ≥70% in practice, or correct on a quiz/unit test;
  - Proficient (80);
  - Mastered (100) = correct on the unit test while Proficient.
- "If you already know some of the content in the unit, it's totally fine to jump ahead to a Quiz or unit test and prove your knowledge."
- Wrong answers on quizzes/tests can drop a level. Wrong answers in practice never do.
- [primary, support forum staff post, 2018] — [Khan Academy Unit Mastery update](https://support.khanacademy.org/hc/en-us/community/posts/115001845151-Update-May-2018-New-Unit-Mastery-beta-testing)
- Course Challenges remain "an efficient way for a learner with lots of prerequisite knowledge to level up". Since Sept 2018 they no longer form a separate 20% of course mastery. [primary, 2018] — [Khan Academy mastery mechanics Sept 2018](https://support.khanacademy.org/hc/en-us/community/posts/360023249611-Update-Mastery-Mechanics-Changes-September-2018)
- District materials: students "slow down and dig into skills where they need support or skip ahead when they show proficiency". [primary marketing] — [Khan Academy Districts: mastery learning](https://districts.khanacademy.org/mastery-learning)

**Self-determination theory: choice**
- Patall, Cooper & Robinson (2008), a meta-analysis of 41 studies: choice enhanced intrinsic motivation, effort, task performance and perceived competence. Effects were stronger:
  - when **2 to 4 successive choices** were given;
  - for *instructionally irrelevant* choices (vs choosing between activities/versions);
  - with no reward after the choice;
  - vs the most controlling comparison conditions;
  - for children vs adults.
  - [primary] — [Patall et al. 2008 PDF (selfdeterminationtheory.org)](https://selfdeterminationtheory.org/wp-content/uploads/2019/10/2008_PatallCooperRobinson_PsychBulletin.pdf); [ERIC EJ787695](https://eric.ed.gov/?id=EJ787695)
- Effects of choice are not uniformly positive; some kinds of choice don't raise motivation. [secondary] — [ERIC EJ1086332](https://files.eric.ed.gov/fulltext/EJ1086332.pdf)

### Inferences
**Default path, test-gated skips, small choices**
- **Default to a recommended path with interleaved review** (Duolingo's justification). Keep **soft** locks: anything ahead can be opened by a quick performance check (Khan/Yousician), and an intermediate can browse freely.
- Reharm Lab's L1–L4 levels and SM-2 schedule per `(ruleId, keyTonic)` already resemble Khan's mastery points. A "Familiar / Proficient / Mastered" display per rule would be a cheap, legible map.
- **Offer 2–4 meaningful but low-stakes choices per session** (which tune, which key, which of three suggested moves). Avoid a wall of options: the Patall moderator analysis says the motivational benefit peaks at 2–4 choices.
- Making review "part of forward progress" fits jazz practice: a due SM-2 item can be woven into the next tune's pathway rather than shown in a separate "review" tab.

### Gaps
- No controlled study found that compares hard vs soft prerequisite locks directly in a learning app. The Patall evidence concerns choice in general, not gating.
- Duolingo's efficacy comparison is company-run. Its methodology and effect size weren't retrieved.
- Brilliant's course maps and any Khan Academy prerequisite-*recommendation* engine (vs. mastery mechanics) weren't covered by sources found.
- Khan mastery mechanics are from 2018–2022 support posts and may have changed by 2026.

## 5. Worked examples, "hear it before you name it", and retrieval/spacing in music apps

### Takeaway
Music pedagogy converges on sound before symbol: Gordon's Music Learning Theory, and before it Pestalozzi, Dalcroze, Kodály, Orff and Suzuki. Gordon's skill sequence puts aural discrimination before verbal and symbolic association, and inference/theoretical understanding last. Duolingo Music, Hooktheory and Open Studio all lead with heard and played examples. Combined with CLT worked-example fading and Duolingo-style built-in review, this suggests every reharm concept should be *heard and played before it is named or explained*.

### Cited Findings
**Gordon's Music Learning Theory**
- Gordon defines audiation as "hearing and comprehending in one's mind the sound of music that is not, or may never have been, physically present… not imitation or memorization", and as "to music what thought is to language". [primary/secondary] — [Gordon MLT (Wikipedia)](https://en.wikipedia.org/wiki/Gordon_music_learning_theory); [Gordon, "Roots of Music Learning Theory and Audiation"](https://scholarcommons.sc.edu/cgi/viewcontent.cgi?article=1000&context=gordon_articles)
- **Skill learning sequence.**
  - *Discrimination learning* comes first: aural/oral → verbal association → partial synthesis → symbolic association → composite synthesis.
  - *Inference learning* follows: generalization → creativity/improvisation → theoretical understanding.
  - Discrimination is the readiness for inference. In inference learning the learner is *not told* the answer.
  - [primary/secondary] — [GIA "Quick and Easy Introductions" PDF](https://giamusic.com/page-images/G-8418_Quick%20and%20Easy%20Introductions.pdf); [Alliance for Active Music Making: The Gordon Approach](https://www.allianceamm.org/resources/gordon/)
- **Theory comes last.** Gordon puts sound before symbol, comprehension before notation, and audiation before performance. *Theoretical understanding is the last stage.* [secondary] — [College Music Symposium essay](https://symposium.music.org/volume-31/forum-essays-1752877059/music-learning-theory-in-collegiate-music-education)
- **Older pedigree.** Sound before symbol predates Gordon (Pestalozzi, Dalcroze, Kodály, Orff, Suzuki). Gordon systematized it with research. He borrowed "spiraling" between discrimination and inference from Bruner. [secondary] — [Gordon MLT (Wikipedia)](https://en.wikipedia.org/wiki/Gordon_music_learning_theory)

**Sound first in the apps**
- **Duolingo Music:** notes first on a keyboard, then on the staff. Exercises match notes to piano audio. Songs are chosen per section to fit the skills taught. [primary/secondary] — [Technical.ly](https://technical.ly/startups/duolingo-music-launch-duocon/); [Duolingo blog: popular songs](https://blog.duolingo.com/popular-songs-music-course/)
- **Hooktheory:** every concept is demonstrated in a real song with synchronized audiovisual playback before or alongside exercises. [primary] — [Hooktheory I](https://www.hooktheory.com/books/one)

**Worked examples and review**
- **Worked examples** (CLT): best for novices, faded to problems as expertise grows; fading beats an abrupt switch. [primary] — [Kalyuga et al. 2003](https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/The%20Expertise%20Reversal%20Effect.pdf)
- **Retrieval/spacing as product design:** Duolingo's path made strategically timed review a default part of progress rather than optional. [secondary/primary] — [NBC News](https://www.nbcnews.com/tech/tech-news/duolingos-update-redesign-luis-von-ahn-interview-rcna44655); [von Ahn LinkedIn](https://www.linkedin.com/posts/luis-von-ahn-duolingo_introducing-the-new-duolingo-learning-path-activity-6968265635290087424-_Zm0)

### Inferences
**A move card in Gordon's order**
1. **Hear:** A/B playback of original vs reharm over the band.
2. **Discriminate:** "which bar changed?" / "which voice moved?"
3. **Verbal association:** name it ("tritone sub into the ii").
4. **Symbolic association:** spelling and lead-sheet symbol.
5. **Generalize/improvise:** apply it in a new key or bar.
6. **Theory:** why it works, i.e. the Deep Dive, last and optional.

Today the app tends to open at step 6. That is the inverse of MLT and the likely cause of the "wall of jargon" feel.

**Practice in Coach and Changes**
- For Itai-level users, the Coach and "Make the Changes" game are already *inference-level* tasks (problems, not worked examples). Per expertise reversal, intermediates should be routed there quickly. Novices get worked examples (hear + see the voicing played) first.
- Interleave due SM-2 items into the next session's pathway rather than presenting a separate "review" queue.

### Gaps
- No controlled study found that compares sound-first vs symbol-first ordering *within a music app*. Gordon's MLT support is largely practitioner/theoretical, and its experimental base wasn't retrieved here.
- No published data from Yousician, Simply Piano or Melodics on spacing/retrieval algorithms.
- Suzuki-specific sources weren't retrieved beyond its mention as a sound-before-symbol precursor.

## 6. Quantified rules of thumb (consolidated)

### Takeaway
Few hard numbers exist. The defensible ones:
- about 4 chunks in working memory (Cowan);
- no more than 2 disclosure levels (NN/g, expert guidance);
- 2–4 choices maximize the motivational effect of choice (Patall);
- fading one worked-example step per example, halved for slow fading (Kalyuga & Sweller);
- Mayer's medians to prioritize by: coherence d ≈ 0.86, spatial contiguity ≈ 1.10, temporal contiguity ≈ 1.22, pre-training ≈ 0.75–0.92, segmenting ≈ 0.67–0.98, signaling ≈ 0.41–0.71.

There is no evidence-based "words per screen" number.

### Cited Findings
- ~4 chunks of focus-of-attention capacity — [Cowan 2001](https://www.researchgate.net/publication/11830840_The_magical_number_4_in_short-term_memory_A_reconsideration_of_mental_storage_capacity)
- ≤2 levels of progressive disclosure — [NN/g 2006](https://www.nngroup.com/articles/progressive-disclosure/)
- 2–4 successive choices give the strongest effect of choice — [Patall et al. 2008](https://selfdeterminationtheory.org/wp-content/uploads/2019/10/2008_PatallCooperRobinson_PsychBulletin.pdf)
- Backward fading at 1 step per example (slow: 1 step per 2 examples) — [Salden et al. summary](http://www.cee.uma.pt/ron/Salden%20et%20al.%20-%20The%20Expertise%20Reversal%20Effect%20and%20Worked%20Examples.pdf)
- Mayer median effect sizes as listed in §1 — [UNH handout](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-research-based-principles-for-designing-multimedia-instruction-mayer.pdf); [Cambridge Handbook ch. 12](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/CD5B7AE1279A9AB81F8EEBB53DBEC86E)
- Khan mastery thresholds: Familiar at ≥70% practice correct; 50/80/100 points — [Khan Academy 2018](https://support.khanacademy.org/hc/en-us/community/posts/115001845151-Update-May-2018-New-Unit-Mastery-beta-testing)
- Duolingo "Jump here" tests: 5 hearts within a section, 3 when jumping sections [anecdotal] — [Duolingo Fandom wiki](https://duolingo.fandom.com/wiki/Jump_here%3F)

### Inferences
**Screen budget for a Reharm Lab move view**
- ≤4 highlighted things at once: changed chord(s), moving voice, melody note, target.
- One sentence of always-visible text.
- One "Why it works" disclosure.
- One A/B audio control.
- 2–4 suggested next moves, not the whole pathway list.

**Skips and fading**
- A placement/"test out" for L1–L2 should take one short performance check per rule family, not a questionnaire.
- Use SM-2 ease/grades to switch a rule's card from worked-example mode to problem mode (adaptive fading), rather than a fixed count.

### Gaps
- No primary source gives a words-per-card or words-per-screen figure for Brilliant, Duolingo, Hooktheory or musictheory.net. Any such number in the final plan would be a design choice, not a research finding.
- Cowan's 4 is for unchunked items. For an intermediate jazz pianist, "Dm7–G7–Cmaj7" may be one chunk, so the budget should be counted in *new* elements for that learner (consistent with Kalyuga's relativity of element interactivity).
