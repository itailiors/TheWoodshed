# Teacher-voice copywriting: turning reharm jargon into warm, memorable plain English

Scope: research notes for a style guide covering (a) hand-written UI copy and (b) the `/api/explain` LLM prompt that writes `{summary, deepDive, recreateRule}` from computed facts. Target register: "a great jazz teacher teaching a smart kid: simple and memorable, never dumbed down or dry." Direct quotes are kept under 15 words; everything else is paraphrase.

## 1. Plain-language writing guidance: checkable rules

### Takeaway
The government and industry guides converge on a small set of measurable rules: average about 15 words per sentence and split anything over 25, at most 5 sentences per paragraph, active voice, everyday words, and every technical term explained the first time it appears and then used consistently. NN/g adds that experts also prefer plain language, and that the most important point should come first.

### Cited Findings
- **Sentence length.** GOV.UK says to "split up sentences that are over 25 words long" and keep paragraphs to 5 sentences or fewer. Plain English is mandatory across GOV.UK. — [GOV.UK: Use clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- **Why 25 words.** GOV.UK cites Ann Wylie's summary of the research: at an average of 14 words per sentence, readers understand more than 90%. At 25 words sentences become difficult, and at 29 or more very difficult. — [Inside GOV.UK blog, 2014](https://insidegovuk.blog.gov.uk/2014/08/04/sentence-length-why-25-words-is-our-limit/)
- **Averages.** One council style guide says to average 15 words per sentence and break up anything over 25. — [Nottinghamshire digital design manual](https://www.nottinghamshire.gov.uk/global-content/digital-design-manual/style-guide)
- OPM recommends averaging 15–20 words per sentence, in simple, active, affirmative, declarative sentences. A DoD course says usually fewer than 20 words. — [OPM Plain Language](https://www.opm.gov/information-management/plain-language/); [DoD Plain Language course](https://www.esd.whs.mil/Portals/54/Documents/DD/plain_language/PlainLanguageCourse.pdf?ver=2017-04-04-163823-677)
- **Keep subject, verb and object close together.** The Federal guidelines' line is "it's not a crime to use lots of periods." — [Federal Plain Language Guidelines (2011)](https://www.fda.gov/media/85771/download)
- **Defining terms (Federal guidelines):** define a word where you use it; don't define words you don't use; don't define what is obvious to the reader; never give a word a meaning other than its common one. Use one term per concept, because synonyms confuse readers. — [Federal Plain Language Guidelines](https://www.fda.gov/media/85771/download)
- **Technical terms.** The National Archives: use everyday words, and explain unavoidable technical terms on first reference. — [NARA Top 10 Principles](https://www.archives.gov/open/plain-writing/10-principles.html)
- The DoD course adds that once you have defined a term, check whether the definition itself can replace the term. — [DoD course](https://www.esd.whs.mil/Portals/54/Documents/DD/plain_language/PlainLanguageCourse.pdf?ver=2017-04-04-163823-677)
- **GOV.UK word rules:** specialist terms are allowed but must be explained the first time they appear. Prefer short common words ("buy", not "purchase"). Words ending in "-ion" and "-ment" make sentences longer, so rephrase them. Use the active voice, but passive is acceptable when the outcome matters more than the actor. GOV.UK suggests checking drafts with the Hemingway app. — [GOV.UK: Use clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- **Experts want plain language too.** NN/g argues that clear writing raises perceived credibility. In its example, a doctorate-level nurse practitioner preferred the casual, well-formatted version of a medical article. The same article warns that over-defining terms can alienate experts, who may decide the content isn't meant for them. — [NN/g: Plain Language Is for Everyone, Even Experts](https://www.nngroup.com/articles/plain-language-experts/)
- **Mailchimp's voice** is defined in "X but not Y" pairs, for example "Fun but not silly", "Expert but not bossy" and "Smart but not stodgy". The guide separates a constant voice from a tone that changes with the situation. It says to use active voice and positive language, and to be clear before being entertaining. — [Mailchimp Content Style Guide (mirror)](https://codepen.io/mcbzz/pen/ZjRVpv); [GitHub fork](https://github.com/taml/style-guide/blob/master/02-voice-and-tone.html.md)
- Help Scout uses the same pattern: have fun, but never in a way that undermines the core message. — [Help Scout Content Style](https://slab.com/library/templates/helpscout-content-style/)

### Inferences
- Candidate hard rules for Reharm Lab: summary ≤ 20 words; no sentence over 25 words anywhere; average about 15 words in the deep dive; at most 5 sentences per paragraph; active voice, with the chord or note as the subject ("D♭7 slides into C").
- "One term per concept" maps directly onto the domain: pick "tritone sub" or "♭II7", not both alternately; say "guide tones" consistently, not sometimes "3rds and 7ths" and sometimes "shell".
- An "X but not Y" voice chart would fit the brief well, e.g. "Warm but not cute · Precise but not academic · Playful but not jokey · Confident but not hype-y · Brief but not curt".
- NN/g's warning matters for Itai's audience of advanced players: gloss a term in a short clause or a tooltip, never with a paragraph-long definition.

### Gaps
- I didn't fetch primary voice guides from Duolingo or Brilliant, and found no verified rules from either. Don't cite them without fetching their guides first.
- GOV.UK's guidance sets no reading-age target. A Flesch-Kincaid target for this app would be our own choice, not sourced.

## 2. Explanation design from science communication and teaching

### Takeaway
The research supports five principles: start concrete and then fade toward the abstract symbol; let the sound come before the name; use analogies but say where they break down; fight the curse of knowledge with concrete language; and remember that step-by-step worked explanations help novices but can become redundant, even harmful, for experts. The last point argues for progressive disclosure tied to the user's level.

### Cited Findings
- **Concreteness fading.** Teaching moves from concrete material, through an intermediate representation, to the abstract symbol. In three experiments, children taught this way transferred their learning better than those taught concretely only, abstractly only, or in the reverse order. — [Fyfe, McNeil & Borjas 2015](https://www.researchgate.net/publication/268692319_Benefits_of_concreteness_fading_for_children's_mathematics_understanding); [McNeil & Fyfe 2012](https://www.researchgate.net/publication/234007102_Concreteness_fading_promotes_transfer_of_mathematical_knowledge)
- The 2014 systematic review lists four claimed benefits. Concreteness fading grounds opaque symbols in familiar things, gives embodied experience, leaves memorable images to fall back on, and helps learners strip away surface features. The review admits the evidence is mostly indirect and limited to math and science. — [Fyfe et al. 2014, Educational Psychology Review](https://www.semanticscholar.org/paper/Concreteness-Fading-in-Mathematics-and-Science-a-Fyfe-McNeil/ffb3ab8423e537ca202757efc00f8e331b03f379)
- **Sound before sign.** Pestalozzi's followers and Lowell Mason taught sound before sign: sing first, read later, and give theory only after practice, as something drawn out of it. Edwin Gordon's Music Learning Theory sequence is sound, then sign, then sight, then theory, built on audiation (hearing and understanding music without physical sound). — [German Gordon Society](https://www.gordon-gesellschaft.de/edwin-gordons-music-learning-theory-eine-einfuehrung/); [Wikipedia: Gordon MLT](https://en.wikipedia.org/wiki/Gordon_music_learning_theory); [Cal State thesis on sight-singing](https://scholarworks.calstate.edu/downloads/kd17cv44m). Several of the remaining sources are secondary or informal.
- **Curse of knowledge.** In Newton's 1990 tapper/listener study, tappers predicted listeners would name the song 50% of the time. Listeners managed 2.5% (3 of 120). Chip Heath calls the effect the "arch villain" of *Made to Stick*. — [NPR interview with the Heaths, 2007](https://www.npr.org/2007/02/19/7486659/the-secret-behind-why-ideas-stick)
- **The Heaths' remedy is concreteness, not dumbing down:** find a universal language, which will be concrete (sensory, already experienced). Link the new idea to something familiar (the "Jaws on a spaceship" pitch). The book calls accuracy to the point of uselessness a symptom of the curse, and suggests analogies as a fix. The full framework is SUCCESs: Simple, Unexpected, Concrete, Credible, Emotional, Stories. — [Made to Stick notes (Nat Eliason)](https://www.nateliason.com/notes/made-stick-chip-dan-heath); [NPR](https://www.npr.org/2007/02/19/7486659/the-secret-behind-why-ideas-stick)
- **Analogies cut both ways.** Glynn calls them "double-edged swords": they help understanding, but can plant misconceptions that are hard to detect. His Teaching-With-Analogies model includes an explicit step, "indicate where analogy breaks down", because every mapping fails somewhere. Pick analogs that share many features with the target. A sketchy, abandoned analogy breeds misconceptions. — [Glynn et al., ERIC ED373306](https://files.eric.ed.gov/fulltext/ED373306.pdf); [Glynn 2008 chapter](http://osu-wams-blogs-uploads.s3.amazonaws.com/blogs.dir/548/files/2010/10/Glynn2008MakingScienceConceptsMeaningful.pdf)
- **Multiple analogies** for one concept, and having learners generate their own, also reduce misconceptions. — [Glynn TWA model (ResearchGate)](https://www.researchgate.net/publication/234709009_The_Teaching-with-Analogies_Model_Build_Conceptual_Bridges_with_Mental_Models)
- **Worked examples and expertise reversal.** Worked examples beat problem-solving for novices, but the effect disappears and then reverses as expertise grows. For experienced learners the worked steps are redundant and add load on working memory. — [Clark, Kirschner & Sweller 2012, American Educator](https://www.aft.org/sites/default/files/Clark.pdf)
- Kalyuga's 2009 special issue reports that explanatory notes helped novice Shakespeare readers but hurt experts, because the experts couldn't ignore the redundant explanations. — [Kalyuga 2009, Instructional Science](https://link.springer.com/article/10.1007/s11251-009-9102-0)
- Caveat: one legal-reasoning study found no reversal. The suggested remedy is "faded" worked examples. — [ScienceDirect 2012](https://www.sciencedirect.com/science/article/abs/pii/S0361476X12000677); [Wikipedia: Expertise reversal effect](https://en.wikipedia.org/wiki/Expertise_reversal_effect)
- **Musical forces as a research-backed metaphor set.** Steve Larson argues that listeners actually experience melody in terms of three forces:
  - gravity: notes above a stable platform tend to descend;
  - magnetism: unstable notes pull to the nearest stable pitch, and the pull is stronger the closer the goal;
  - inertia: patterns tend to continue.

  He also applied the model to jazz melody. — [Indiana University Press: Musical Forces](https://iupress.org/9780253356826/musical-forces/); [Larson 2002, "Musical Forces, Melodic Expectation, and Jazz Melody"](https://www.researchgate.net/publication/240759790_Musical_Forces_Melodic_Expectation_and_Jazz_Melody)
- Critics note that the forces model makes music sound passive. Hatten adds "agential energies": a line can fight gravity as well as give in to it. BaileyShea points out that inertia isn't strictly a force. — [MTO 18.3 Hatten](https://mtosmt.org/issues/mto.12.18.3/mto.12.18.3.hatten.html); [MTO 18.3 BaileyShea](https://mtosmt.org/issues/mto.12.18.3/mto.12.18.3.baileyshea.html)

### Inferences
- **Concreteness fading as an explanation template.** Steps, in order:
  1. Hear it (play the before/after; the app can already do this).
  2. See it on the keys (the two guide tones held while the root slides).
  3. Name it once ("that's a tritone sub").
  4. The rule ("any dominant can trade places with the dominant a tritone away").

  This matches "sound first, name second" and the existing `summary → deepDive → recreateRule` triple.
- **Expertise reversal** supports gating detail by level. An L3/L4 user who has seen a rule several times should get the one-line summary, with steps collapsed by default. The deep dive should be opt-in, not forced. SM-2 history (practice count per rule) could drive the default disclosure state.
- **Analogies.** Larson's gravity, magnetism and inertia are a vetted metaphor family. Use them consistently: magnetism is the half-step pull of a guide tone to its target, gravity is descending resolution, inertia is a sequence or pattern continuing. Following Glynn, any analogy in copy should get one clause on where it breaks down, or be tied to the actual notes right away.
- **Curse of knowledge for the LLM.** The facts payload is the "tapped song". The prompt should require every claim to point at a specific, audible note ("the B in G7 becomes the C♭ in D♭7"), not stay abstract ("shares guide tones").

### Gaps
- I didn't find a primary source for "the Feynman technique" (it is a popular paraphrase of Feynman's habits, not something he wrote down). Cite it as folk practice or leave it out.
- I found no controlled study of concreteness fading or expertise reversal in music-theory instruction specifically. The evidence is from math and science (Fyfe) or general instructional design (Sweller and Kalyuga).
- I didn't source a "why before how" study separately. It is consistent with Made to Stick and Galper (see §3) but isn't directly evidenced here.

## 3. How admired jazz and music educators phrase things

### Takeaway
The educators I could verify share three habits: they start from what the listener already hears (Bernstein's Lone Ranger opening, Collier's "you already know high and low"); they use real terms without apology (Bernstein named counterpoint to children); and they frame harmony as motion toward a target (Galper's "beat one is the last beat", Larson's forces, Hooktheory's "home base"). For the tritone sub, every source rests on the same idea: the same tritone (3rd and 7th, swapped) on a different root, so the bass slides by half step.

### Cited Findings
- **Leonard Bernstein (Young People's Concerts, 1958–72, 53 concerts).** He opened the first concert with the William Tell Overture, which the kids knew as *The Lone Ranger* theme. He stopped it, let them shout the name, and used that moment to argue that music doesn't tell stories, it just is. — [Open Culture](https://www.openculture.com/2012/11/leonard_bernsteins_first_young_peoples_concert_at_carnegie_hall_asks_what_does_music_mean.html); [The Classical Station](https://theclassicalstation.org/news/leonard-bernstein-and-his-young-peoples-concerts/)
- Bernstein used real terms (orchestration, concerto, counterpoint) and attacked the dumbed-down "music appreciation racket". He taught the Dorian mode with the Beatles' "And I Love Her" and Mixolydian with the Kinks' "You Really Got Me". — [Interlude.hk](https://interlude.hk/leonard-bernsteins-young-peoples-concerts-born-on-august-25-1918making-classical-music-irresistible/); [The Attic](https://www.theattic.space/home-page-blogs/2023/4/13/music-maestro-master-teacher)
- Allen Shawn argues the concerts disproved the assumption that children need speed and obviousness. They taught by taking viewers somewhere unexpected. — [Tablet Magazine (sponsored book excerpt)](https://tabletmag.com/jewish-arts-and-culture/books/184216/bernstein-shawn-yaleup)
- **Jacob Collier, Switched On Pop, 2026:**
  - "Harmony is about tension and release."
  - "Harmony's about relationships."
  - The whole of harmony is built from things you already know intuitively: high/low, bright/dark, thick/thin, rough/smooth.
  - "What I'm playing with, really, is your expectation."
  - "Feeling moves faster than thought."

  — [Switched On Pop Substack](https://switchedonpop.substack.com/p/the-world-doesnt-need-more-good-musicians)
- Collier, MusicRadar: unless music is "fundamentally simple, it doesn't really move anyone." — [MusicRadar](https://www.musicradar.com/news/jacob-collier-interview)
- **Hal Galper (Forward Motion).** Beat one is the strongest beat, so it's where ideas end. In his words, it "is the last beat of the bar". Lines should point *toward* target notes on 1 and 3, not trail away from them. The targets together form an "inner guide tone melody". Practice tip: play the target notes first, in tempo. — [halgalper.com: Understanding Forward Motion](https://halgalper.com/articles/understanding-forward-motion/)
- **Barry Harris.** A former student paraphrases his teaching as "the rules are more important than the scales". His six-diminished vocabulary is concrete and verb-based: a chord is "a major 6th with two borrowed" diminished notes, and chords are things you "move". He communicated pleasure in the music: "it's so much fun once you get started." — [jazzguitar.be forum (paraphrase, secondary)](https://www.jazzguitar.be/forum/theory/37291-barry-harris-interesting-but.html); [Kingstone, Barry Harris Harmonic Method for Guitar (archive.org)](https://archive.org/stream/alan-kingstone-the-barry-harris-harmonic-method-for-guitar/Alan%20Kingstone%20-%20The%20Barry%20Harris%20Harmonic%20Method%20for%20Guitar_djvu.txt); [Friends of Barry slides](http://www.friendsofbarry.com/presentations/nyc_slides.pdf)
- The Barry Harris method archive organises his teaching as "stages" and "ideas" in his own words, with headings such as "making chords move". — [barryharrismethod.com](https://barryharrismethod.com/)
- **Hooktheory.**
  - Teaches chord function with numbers because "a 'one' chord is always a 'one' chord" in any key.
  - Uses colour coding instead of staff notation, and pop songs as listening examples.
  - Titles a section "The I chord: home base".
  - Its reference copy says the augmented V "intensifies the pull toward the I chord".

  — [Hooktheory FAQ](https://www.hooktheory.com/faq); [Hooktheory I section](https://book-one.hooktheory.com/section/the-I-chord-home-base); [Hooktheory chord-quality reference](https://www.hooktheory.com/support/musicreference?concept=music-concepts-chord-quality); [Musical-U review](https://www.musical-u.com/learn/review-hooktheory-music-theory-book/)
- **Peter Martin (Open Studio).** His beginner course leads with "listen & imitate", groove and swing, then shell voicings. The advanced method uses an overhead keyboard view and "Living Notation", so you see every note as he plays it. — [Open Studio: Jazz Piano for Beginners](https://www.openstudiojazz.com/courses/jazz-piano-for-beginners/); [Open Studio: Jazz Piano Method](https://www.openstudiojazz.com/courses/jazz-piano-method/)
- **How the tritone sub is explained (consensus wording):**
  - The two dominants share the same tritone. G7's B and F are D♭7's F and C♭(B), with the 3rd and 7th swapping roles.
  - That shared tritone carries the dominant's tension, so either chord pulls to C.
  - What changes is the bass, which now slides chromatically (Dm7 → D♭7 → C).

  — [Open Music Theory: Substitutions](https://viva.pressbooks.pub/openmusictheory/chapter/substitutions/); [Wikipedia: Tritone substitution](https://en.wikipedia.org/wiki/Tritone_substitution); [music-theory-practice.com](https://music-theory-practice.com/guides/tritone-substitution-explained)
- One teaching site offers an ear test: if you can't reliably tell which dominant was played, the sub is working. — [Jazzify blog](https://en.jazzify.jp/blog/jazz-piano-tritone-substitution/) (a minor source)
- Open Music Theory notes the sub sounds best when V7 is actually resolving to I. — [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/chapter/substitutions/)

### Inferences
- **Recurring metaphor families** (use one family per explanation and keep it):
  1. *Home / away / pull*: Hooktheory's "home base", "pull toward I".
  2. *Forces*: Larson's gravity and magnetism, "leading tone leans into home".
  3. *Target / arrival*: Galper's "beat one is where the phrase lands".
  4. *Same engine, different chassis*: the tritone sub as the same tension on a new root.
  5. *Moving and borrowing*: Barry Harris, where chords are things you move and notes are borrowed.
- **A possible tritone-sub line in the target register** (my draft, not sourced): "Keep G7's two tense notes, B and F, and slide the bass down a half step to D♭. Same pull into C, smoother walk in the bass." That's 25 words, two sentences, concrete notes, no unexplained jargon, and it names the payoff.
- The Bernstein lesson for an advanced audience: use the real term, but hang it on something already heard (a famous recording, or the user's own tune bar). Never talk down.
- Galper-style framing suits the app's move ids (`ruleId@bar.beat`): describe the move by where it *lands* ("so beat 1 of bar 9 arrives on C").

### Gaps
- I couldn't verify a short characteristic quote or specific tritone-sub explanation from Adam Neely, Rick Beato, Kenny Werner (*Effortless Mastery*), 8-bit Music Theory, David Bennett or Charles Cornell. Searches returned no primary page. Adam Neely's tritone video found in search is about the history of the interval, not the substitution.
- No verified Peter Martin "guide tones" lesson wording.
- The Barry Harris quotes are second-hand (forum paraphrase, guitar-book author). For verbatim quotes, use barryharrismethod.com's lecture archive.
- The Collier wording comes from a list-style article (Switched On Pop), not a full transcript.

## 4. Tone: warmth without condescension, no filler or hype, handling jargon

### Takeaway
Warmth comes from addressing the reader directly, using concrete sensory language and naming the musical payoff. Condescension comes from over-explaining what the reader already knows, which the expertise-reversal and NN/g findings both warn against. Handling jargon is a three-beat pattern: name it once, gloss it in a clause, then use it consistently.

### Cited Findings
- Mailchimp separates voice (constant) from tone (situational). Its key pairs are "Expert but not bossy" and "Smart but not stodgy". Clarity beats entertainment. — [Mailchimp style guide mirror](https://codepen.io/mcbzz/pen/ZjRVpv)
- Over-defining terms alienates experts. NN/g suggests other ways to support novices without slowing experts down. — [NN/g](https://www.nngroup.com/articles/plain-language-experts/)
- Redundant explanation actively hurts high-knowledge readers. — [Kalyuga 2009](https://link.springer.com/article/10.1007/s11251-009-9102-0)
- Federal guidelines: don't define the obvious, define where used, and use one term consistently. — [Federal PL Guidelines](https://www.fda.gov/media/85771/download)
- GOV.UK: explain specialist terms the first time they appear, and replace vague buzzwords with the specific action. — [GOV.UK](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- Bernstein shows that using real terms with children isn't condescension; dumbing down is. — [Interlude.hk](https://interlude.hk/leonard-bernsteins-young-peoples-concerts-born-on-august-25-1918making-classical-music-irresistible/)
- Heath: the goal is not to "dumb things down" but to be concrete. — [Made to Stick notes](https://www.nateliason.com/notes/made-stick-chip-dan-heath)

### Inferences (proposed rules; unsourced as exact numbers)
- **Jargon rule.** First use: term plus a gloss of 8 words or fewer in the same sentence ("the guide tones, the 3rd and 7th that define the chord"). After that, the bare term. At most one new term per step and two per explanation.
- **Assumed knowledge for Itai's level.** Don't define chord symbols, ii–V–I, the 3rd and 7th, or what a dominant is. Do gloss rule-specific names (e.g. "backdoor ii–V", "Coltrane matrix").
- **Warmth markers.** Use second person ("you"), name what the ear gets ("smoother bass line", "a darker landing"), and put one vivid verb per sentence (slides, leans, lands, borrows).
- **Banned filler and hype** (proposed list):
  - "simply", "just" (when it implies easy), "of course", "obviously", "basically", "essentially";
  - "magical", "lush", "beautiful", "rich" (unless tied to a specific note), "sophisticated", "spice up", "jazzy";
  - "game-changer", "secret", "unlock";
  - "In this move we will…", "Let's dive in", "It's important to note".
- **Encouragement without flattery.** State the result ("now bar 9 lands on C from a half step above"), not praise ("great choice!").

### Gaps
- I found no empirical study on condescension perception in instructional microcopy. The banned-phrase list is synthesized from style-guide principles, not from a source that lists these phrases.

## 5. UI microcopy: progressive explanation, headline-first, scannable steps

### Takeaway
NN/g's inverted pyramid (the main point first, so readers get it however little they read) and progressive disclosure (defer the detail, keep it available) map directly onto a three-level card: a one-line summary, then numbered atomic steps, then an optional deep dive. Keep it to two disclosure levels per interaction if possible.

### Cited Findings
- Inverted pyramid: put the most important information first, so readers get the main point however much they read. Front-load headlines, make the first sentence of each paragraph the most important, and make the first words of each sentence carry information. Consider a summary or list of key points. — [NN/g: Inverted Pyramid](https://www.nngroup.com/articles/inverted-pyramid/)
- NN/g found that generative-AI answers are hit-or-miss at front-loading. Its example is an AI answer that put its summary at the end; the human-edited version opens with it. — [NN/g: Product-Specific GenAI Needs to Write for the Web](https://www.nngroup.com/articles/genai-write-for-the-web/)
- Progressive disclosure defers advanced or rarely used material to a secondary level. It improves learnability, efficiency and error rate without removing capability for experts. — [NN/g via Wikipedia summary](https://en.wikipedia.org/wiki/Progressive_disclosure); [NN/g plain-language article (formatting tips)](https://www.nngroup.com/articles/plain-language-experts/)
- The "max 2 levels" figure is a third-party paraphrase of NN/g, not verified. — [secondary summary](https://adroit.io/field-notes/progressive-disclosure-2026)
- Online readers scan, and key messages get missed unless they are succinct and formatted for scanning (highlighted keywords, summaries). — [NN/g](https://www.nngroup.com/articles/plain-language-experts/)
- Galper's practice advice, "play the target notes first", is a musical form of headline-first: state where it lands, then fill in the approach. — [halgalper.com](https://halgalper.com/articles/understanding-forward-motion/)

### Inferences (proposed card spec)
- **Headline (summary): ≤ 15–20 words.** It must contain:
  1. the before→after chords,
  2. the one musical effect,
  3. no unglossed jargon.

  Pattern: "[Swap/Add X] for [Y] so [the ear gets Z]."
- **Steps: 3–5 numbered steps, ≤ 20 words each, one action or idea per step, at most one new term per step.** Start each step with a verb or a concrete note name. The last step is always the landing.
- **Deep dive** (collapsed by default for experienced users): why it works (the shared notes, the voice leading), where else to use it, and when it fails (melody clash, mirroring the melody-filter reason).
- **Recreate rule:** one imperative sentence that transfers to any key ("Over any V7 going to I, play the dominant a half step above the target.").
- **Pair the copy with an affordance** ("▶ hear before/after", "show on keys") so that sound comes before the name.

### Gaps
- I didn't fetch NN/g's original progressive-disclosure article directly (only the summaries). Verify before citing the "2 levels" claim.
- No source found with specific word caps for tooltip or card microcopy. The numbers above are derived from the sentence-length research.

## 6. Prompting LLMs to write in this register

### Takeaway
Anthropic's current guide says three things: say what to do rather than what not to do; explain *why* a rule exists so the model can generalize; and steer tone with 3–5 relevant, diverse, tagged examples. It also notes that the prompt's own style rubs off on the output. Combined with the rules above, that suggests a system prompt with brief reasons, positive rules, a short banned-phrase list as a backstop, hard length caps, and few-shot examples drawn from varied moves.

### Cited Findings
- **Give the reason behind a rule.** Context or motivation behind instructions helps Claude give more targeted responses. Anthropic's example replaces a bare "NEVER use ellipses" with the reason (text-to-speech). "Claude can generalize from the explanation." — [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Examples.** Examples are "one of the most reliable ways" to steer format, tone and structure. They should be relevant (mirror the real use case), diverse (vary enough to avoid unintended patterns) and structured (in `<example>` tags). Use 3–5 for best results. — [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Positive instructions and style matching.** "Tell Claude what to do instead of what not to do". Also, the formatting style of the prompt influences the response style, so match the prompt's style to the output you want. — [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **Worked examples with thinking.** Multishot examples shape how Claude approaches similar problems. Present each as problem, method, and expected answer. — [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- **LLM output and front-loading.** LLM output often fails to front-load the answer, so it should be explicitly instructed. — [NN/g GenAI article](https://www.nngroup.com/articles/genai-write-for-the-web/)

### Inferences (proposed prompt rules for `/api/explain`, compatible with CLAUDE.md rule 2: prose only, keep the facts' spelling)
- **Persona with a reason.** For example: "You're a jazz piano teacher talking to a strong player at the keyboard. They know chord symbols and ii–V–I; they want to hear why this move works and how to reuse it. Short, concrete sentences help because they read this mid-practice, hands on the keys."
- **Positive rules plus reasons:**
  - Lead with what the ear gets.
  - Name at least two specific notes from the facts.
  - Every sentence ≤ 25 words, and the summary ≤ 20.
  - Introduce at most two terms, each glossed in a few words on first use.
  - Use one metaphor family at most, and tie it to actual notes in the same sentence.
  - Write the recreate rule as one key-agnostic imperative.
- **Banned-phrase list as a backstop,** framed with the reason ("these read as filler or hype to an experienced player"). Validate it in code too: a post-check regex over the Zod output, with a retry or log.
- **Few-shot.** 3–5 `<example>` pairs of facts → JSON, deliberately varied: a tritone sub, a backdoor ii–V, a passing diminished, and a rejected or limited case. Variety keeps the model from copying one template's phrasing (Anthropic's "diverse" criterion). Keep examples in `<examples>` so they're distinguishable from facts.
- **Since the prompt's style rubs off,** write the system prompt itself in the target register: short sentences, no hype.
- **Bump `PROMPT_VERSION`** when this lands (per CLAUDE.md rule 2).
- **Checkable acceptance criteria for an eval or proof:** average sentence length ≤ 15 words; max ≤ 25; summary ≤ 20 words; count of banned phrases = 0; at least two note names from `buildFacts` present; the facts' spelling preserved (already a requirement).

### Gaps
- I found no published study on the best banned-phrase lists for LLM explanation tone. The list here is a synthesis.
- I didn't verify whether few-shot examples in the system prompt interact badly with the structured-output (Zod) format. Test that empirically.
- I didn't fetch the model-specific page on Opus 5.x verbosity (linked from the main guide). Check it if the explain model's verbosity drifts.
