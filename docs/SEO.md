# SEO: The Woodshed (Reharm Lab)

Maintained by the shared SEO expert (`claude-projects/SEO`, run `/seo-audit Woodshed` there).

- **Channel(s):** web app on GitHub Pages
- **Live URL:** https://itailiors.github.io/reharm-lab/ (the old /TheWoodshed/ URL 404s; the hub now links here)
- **Audience:** jazz pianists and comping players who want richer harmony
- **Competitors (3):** not researched yet (to do)
- **Primary keyword:** jazz reharmonization (to confirm)  **Secondary:** reharmonization practice, jazz chord substitution, comping coach
- **Last audit:** 2026-11-25  **Next optimize:** 2027-02-03

## Evidence (live page, 2026-11-25)
- Title: "Reharm Lab · a jazz reharmonization engine you can play"
- Description: "Turn the dial from L0 to L4 and hear a deterministic engine reharmonize jazz standards live: ..." (long, over 160 chars)
- Canonical, og:*, twitter:* all present and use the correct /reharm-lab/ URL. og-image.png returns 200 (1200x630 declared).
- Page body is `<div id="root"></div>` only: all content is JS-rendered. No `<noscript>`, no JSON-LD.
- /robots.txt and /sitemap.xml: 404.
- GitHub repo reharm-lab: no description, no topics (homepage set).

## Done (2026-11-25)
- Hub link fixed (portfolio-hub bf68077). Noscript block, JSON-LD, shorter meta description, sitemap.xml (this PR). GitHub repo description and topics set.
- Still open: items 2, 6, 9, 10 below (name decision, Search Console, content pages, cross-link with the daily game), plus submitting sitemap.xml.

## Open fixes (ranked, original audit; 1, 3, 4, 5, 7, 8 are done, see above)
1. **Hub link is broken (fixed).** `portfolio-hub/public/ecosystem.json` `ctaUrl` and README point to `itailiors.github.io/TheWoodshed/` (404 since the repo was renamed). Change to `/reharm-lab/` (also `repoUrl`). Effort S. Every visitor from the hub currently hits a 404.
2. **Name split.** Hub says "The Woodshed", the site says "Reharm Lab". Pick one public name, or use both in the title ("Reharm Lab (The Woodshed)") so people and search engines connect them. Effort S.
3. **JS-only content.** Crawlers see an empty page. Add a `<noscript>` block and static prerendered text (what it is, features, how it works) in index.html or prerender the landing view. Effort M.
4. **Structured data.** Add JSON-LD `SoftwareApplication` (WebApplication, free, offers, applicationCategory MusicApplication). Effort S. Validate with Rich Results Test.
5. **Sitemap.** robots.txt on a github.io project site is ignored (only the domain root counts), so add sitemap.xml and submit it in Search Console instead. Effort S.
6. **Search Console.** Verify the site and watch queries (not done, no access). Effort S.
7. **Meta description too long.** Trim to about 155 characters, lead with "jazz reharmonization". Effort S.
8. **GitHub repo.** Add description and topics (jazz, reharmonization, music-theory, web-audio, midi). Effort S.
9. **Content for search.** One page or post per concept people search ("tritone substitution", "backdoor ii-V", "Coltrane changes"). Effort L.
10. **Sibling site.** itailiors.github.io/reharm/ (daily reharm game) is separate: cross-link both, and decide which is the main brand. Effort S.

## Could not check
- Core Web Vitals (no Lighthouse run), Search Console data, rankings, competitors, backlinks.

## Metrics (monthly)
| Month | Impressions | Clicks | Visits |
|---|---|---|---|
| 2026-11 | n/a | n/a | n/a |
