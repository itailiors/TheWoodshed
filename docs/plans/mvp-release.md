# Reharm Lab MVP release checklist

Written 2026-11-25. **Goal:** a free, zero-cost public release to build a userbase and gather feedback.
The shippable artefact is the static demo at https://itailiors.github.io/reharm-lab/, deployed by CI on every green push to `main`.

## Decisions (Itai, 2026-11-25)
- **Scope.** A free portfolio release. Nothing in it may cost money to run: no hosted API, no accounts. Freemium comes later (a piano teacher, AI-built lessons), so don't design that path out.
- **Name.** Reharm Lab. The repo has been renamed to `itailiors/reharm-lab` (#16).
- **Real musicians' names.** Allowed only as a style credit ("in the style of …") or as a standard theory term ("Coltrane substitution", "Bill Evans rootless"). Never as a persona, a badge, an endorsement, a likeness or a marketing headline.
- **Tune titles and changes, yes; melodies and solos, no.** Titles and chord changes aren't copyrightable, so lick titles may reference tunes ("So What Cool Space"), because that's what players search for (Itai, 2026-11-25). Melodies (heads) and transcribed solos of copyrighted tunes never ship. Get a quick IP-lawyer check before the freemium launch.
- **Harmony Catcher.** Post-MVP. Ship the 7d toggle labelled beta. Build 7e/7f later on the local store.

## Already done (checked in the code, so don't rebuild)
- **Local-first progress.** `apps/web/src/library/localPractice.ts` keeps Coach, heatmap and Changes history in IndexedDB, falling back to memory. The strategy doc's priority #1 is therefore met.
- **Playwright golden paths with axe** (`e2e/`, `npm run e2e`). CI runs them against the demo build.
- **Built and live:** deep links and Share, the OG/Twitter tags, the favicon, the audio-blocked pill, a quiet console, the sustain policy and focus rings.

## P0: blocks the release
Owner key: C = Claude can do and verify it alone; I = needs Itai.

**Status 2026-11-25:** done: 1–5 (#20–#23), 7 (audit: e2e 76/76, Lighthouse a11y/BP/SEO 100, perf 67 mobile / 85 desktop; console fix #19), 10 (GoatCounter, #23), and the Warm club option from 11. Left: 6 (GIF), the rest of 8, the ⚙ counters, and 12.

1. **Licences and credits** (C research, I decide)
   - **Audit each runtime sample source.** All four are hot-linked from third-party GitHub Pages:
     - Salamander piano: CC-BY 3.0, so attribution is required;
     - gleitz MusyngKite, FluidR3_GM and FatBoy bass;
     - surikov webaudiofont drum kits FluidR3, JCLive and SBLive. The SBLive kit's origin is unclear, so drop it if it can't be cleared.
   - **Fonts:** Google Fonts (Architects Daughter, Kalam, Noto Music) are all OFL. Credit them.
   - **Credits panel:** add one to the app (Settings ⚙ → "Credits & licences") and a matching README section.
   - **Code licence (I):** the repo has no `LICENSE`, which means all rights reserved. That fits the freemium plan; say so explicitly in the README.
2. **Musician-name policy applied** (C, then I checks)
   - ~~Rename the lick titles~~ Done in #20; the original tune-referencing titles were then restored on Itai's call. Credits read "in the style of X".
   - The licks are 4-note chord-degree cells, not quoted melodies (checked 2026-11-25).
3. **Harmony Catcher "beta" label** on the 🕵️ Catcher toggle, plus a one-line note in the README (C).
4. **A feedback channel** (C builds, I picks where it goes). The release exists to get feedback, and today there's no way to send any.
   - Add a "💬 Feedback" link in Settings and in the README footer.
   - Zero-cost options: GitHub Issues with an issue template, or a free form (Tally or Google Forms).
5. **Accuracy pass** (C)
   - **OG card:** it says "11 rules · 8 claims". Re-count from `RULES` and `PROOFS`, re-render, and consider generating the numbers.
   - **README:** "Fourteen deterministic rules" needs re-counting since secondaryDominant, mediantDominant and oneNoteOnTop landed. Update the feature list and the Musician's Wishlist status.
   - **STATE_OF_THE_UNION** §4/§5: record Harmony Catcher 7a–7d, the rename, and this checklist.
6. ~~**The 20-second demo GIF** at `docs/media/demo.gif`: the dial turning, chords moving, proofs going green (I records; C can storyboard and script the fake-MIDI shots).~~ Done: cut from Itai's clips 01, 02, 04 and 10 (19 s, 880×550, 10 fps, 4.9 MB) and set as the README hero.
7. **Release hygiene on the deployed site** (C)
   - `npm run e2e` green.
   - Axe has no violations on every mode.
   - Lighthouse (perf, a11y, best practices, SEO) recorded; fix anything red.
   - Bundle size noted; the initial JS shouldn't regress.
   - The console is empty in production.
   - Every mode works at about 400 px.
   - Deep links work under `/reharm-lab/`.
   - The OG preview renders (paste the link into a card validator).
8. **Hardware checks** (I, at the piano)
   - ~~iOS/Safari audio unlock, the sustain and expression pedals, the Coach with a real MIDI keyboard~~: done (Itai tested them over the past two weeks while building).
   - Still to test in depth: Harmony Catcher with a real keyboard, real iReal imports, and Firefox (no Web MIDI: is the fallback message clear?).

## P1: before announcing widely
9. **Self-host the samples on Pages.** It's free, and it removes the dependency on three other people's Pages sites. Only for sources whose licences allow redistribution (follows from 1).
10. **Privacy-friendly free analytics** (I decides): GoatCounter or Cloudflare Web Analytics, with no cookies and a one-line privacy note. Today usage is only counted locally (⚙ counters). If declined, the feedback channel is the only signal.
11. **Read the ⚙ counters** (from about 2026-11-27) ~~and the Warm club band-tone A/B~~: merged as an opt-in "Band sound" option (Clean stays the default).
12. **Version tag** `v1.0.0` and a GitHub Release with notes generated from `git log`.

## Launch
13. Post using the plan in `App-Marketing-HQ/docs/marketing/social-strategy.md` (r/jazzpiano, Reels/Shorts). That plan's "verify before filming" items overlap step 8.

## Post-MVP (scoped out on purpose)
- **Harmony Catcher:** 7e persistence on the local store, 7f "Your vocabulary", the Rough.js stamp, and stamp → move card.
- **Notion ideas:**
  - more songs (rights rule 0);
  - Standard of the Day;
  - easier reharm switching;
  - drums on new songs;
  - "check reharm logic";
  - the possible duplicate tritone sub in the Coach list. Check this one before release, because if it's real it's a visible bug.
- **Freemium track:** the piano teacher, AI-built lessons, then accounts and sync.

## Suggested order
1 → 2 → 3 → 5 (C, one PR each), then 4 once Itai picks the channel. Then 7, with Itai doing 6 and 8 in parallel. Then P1, then the launch.
