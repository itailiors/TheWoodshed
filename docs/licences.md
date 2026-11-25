# Licences of third-party assets

Audited 2026-11-25 from primary sources (each repo's LICENSE/README and the soundfont authors' own notices).
The app ships none of these files: it **hot-links** them at runtime from the hosts below. The in-app
"Credits & licences" panel (⚙ Settings) and the README's "Credits & licences" section carry the same list;
the data lives in `apps/web/src/components/credits.ts`.

**Reharm Lab's own code:** there is no LICENSE file, so it is © Itai Lior, all rights reserved. The samples and
fonts below stay under their own licences.

## Samples (audio)

| Asset | Used for | Hosted at | Licence | Source of the licence |
|---|---|---|---|---|
| Salamander Grand Piano V3 (Yamaha C5), by Alexander Holm | Piano (`audio/engine.ts`) | `tonejs.github.io/audio/salamander/` (Tonejs/audio) | **CC BY 3.0** | `Tonejs/audio` → `salamander/README`: "Licence: CC-by … Author: Alexander Holm" |
| Musyng Kite soundfont, acoustic bass (MP3 render by gleitz) | Bass, 1st choice (`audio/band.ts`) | `gleitz.github.io/midi-js-soundfonts/MusyngKite/` | **CC BY-SA 3.0** | `gleitz/midi-js-soundfonts` README |
| Fluid R3 GM soundfont, acoustic bass, by Frank Wen (MP3 render by gleitz) | Bass, 2nd choice | `gleitz.github.io/midi-js-soundfonts/FluidR3_GM/` | **CC BY 3.0** per gleitz; **MIT** per the author | gleitz README; Frank Wen's README/COPYING, quoted in MuseScore `share/sound/FluidR3Mono_License.md` |
| FatBoy soundfont, acoustic bass (MP3 render by gleitz) | Bass, 3rd choice | `gleitz.github.io/midi-js-soundfonts/FatBoy/` | **CC BY-SA 3.0** | gleitz README (fatboy.site itself couldn't be fetched during the audit) |
| Fluid R3 GM drum kit, by Frank Wen (WebAudioFont conversion by Sergey Surikov) | Drums (`audio/band.ts`) | `surikov.github.io/webaudiofontdata/sound/128NN_0_FluidR3_GM_sf2_file.js` | **MIT** (sample data); the webaudiofontdata repo itself is MIT | `surikov/webaudiofontdata` README + LICENSE; FluidR3 README/COPYING |
| midi-js-soundfonts (the conversion/repo) | — | — | MIT | `gleitz/midi-js-soundfonts/LICENSE.txt` |

### Removed in this audit

| Kit | Why |
|---|---|
| `0_JCLive_sf2_file` (WebAudioFont) | No author or licence anywhere primary. webaudiofontdata's README names only FluidR3 and GeneralUserGS as its sources; its issue #4 asks exactly this question, and the reply is an unsourced guess ("public domain", "a South Korean community"). |
| `0_SBLive_sf2` (WebAudioFont) | Sound Blaster Live's bundled GM bank is Creative/E-mu's commercial soundfont; no free licence is published for it. |

Both were only fallbacks: if FluidR3 fails, the synth kit plays (`loadDrums` in `band.ts`).

### Attribution text (used in the app and README)

- Piano: "Salamander Grand Piano" by Alexander Holm, CC BY 3.0, via Tone.js.
- Bass: Musyng Kite (CC BY-SA 3.0), Fluid R3 GM by Frank Wen (CC BY 3.0 / MIT), FatBoy (CC BY-SA 3.0), rendered to MP3 by Benjamin Gleitzman's midi-js-soundfonts.
- Drums: Fluid R3 GM by Frank Wen (MIT), converted by Sergey Surikov's WebAudioFont.
- No changes were made to the samples; the app repitches them at playback.

## Fonts (self-hosted: `apps/web/src/assets/fonts/`, licence texts in `apps/web/public/fonts/OFL-*.txt`)

Google Fonts' own woff2 subsets (latin, latin-ext), served from the app's origin since the
mobile-perf pass (no render-blocking third-party stylesheet). Noto Music's "music" file is subset
further with fonttools to U+25CC, U+2669–266F and U+1D100–1D14F (the signs the app writes); none
of the three declares a Reserved Font Name, so the subset keeps its name. Still SIL OFL 1.1.

| Font | Designer | Licence | Source |
|---|---|---|---|
| Architects Daughter | Kimberly Geswein | SIL OFL 1.1 | `google/fonts` → `ofl/architectsdaughter/METADATA.pb`, `OFL.txt` |
| Kalam | Indian Type Foundry | SIL OFL 1.1 | `google/fonts` → `ofl/kalam/` |
| Noto Music | The Noto Project Authors (Google) | SIL OFL 1.1 | `google/fonts` → `ofl/notomusic/` |

## Can we redistribute or self-host?

| Asset | Self-host / redistribute? | Conditions |
|---|---|---|
| Salamander piano | Yes | Credit Alexander Holm, link the licence, say if changed. |
| Fluid R3 (bass and drums) | Yes | MIT: keep Frank Wen's copyright notice and the MIT text with the files. Credit as CC BY 3.0 too, since that's how gleitz labels the render. |
| Musyng Kite, FatBoy | Yes | CC BY-SA 3.0: credit, link the licence, and **share any modified samples under CC BY-SA**. Using them unmodified (or repitched at playback) doesn't put the app's code under BY-SA. |
| WebAudioFont / midi-js-soundfonts code | Yes | MIT notice. |
| The three fonts | Yes (self-hosted) | OFL: bundle `OFL.txt` (done: `public/fonts/OFL-*.txt`); don't sell the fonts on their own; a modified font can't keep its reserved name (none declared). |
| JCLive, SBLive | No | Licence unknown → not used. |

Self-hosting everything would remove the runtime dependency on three CDNs (and Google Fonts' visitor logging).
It's allowed by every licence above, but it isn't done yet; it's a decision for Itai (repo size vs. uptime).

## Open questions for Itai

1. **Musyng Kite and FatBoy are share-alike.** Fine for hot-linked, unmodified playback. If the bass is ever
   re-rendered, trimmed or baked into exported audio, those files must stay CC BY-SA. Switching the bass to
   FluidR3 first (MIT) would avoid the question entirely.
2. **FluidR3's licence is stated twice.** gleitz labels it CC BY 3.0; Frank Wen released it under MIT. Crediting
   it satisfies both.
3. **Self-host or keep hot-linking?** Hot-linking costs nothing but depends on GitHub Pages of three other repos.
