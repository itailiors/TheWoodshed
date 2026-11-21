// Shared harness for the showcase clips. Records one Playwright context per clip against the
// STATIC DEMO BUILD (no /api, never writes the real database), draws a visible cursor and a
// caption strip into the page (headless video has no cursor), then trims the blank load off the
// front and converts to H.264 MP4 with the system ffmpeg. Videos are silent: Playwright records
// no audio.
import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

export const BASE = process.env.BASE ?? "http://localhost:4174";
export const OUT = "videos/clips";
const RAW = "videos/clips/raw";

export const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
// a Pixel 5 (393x851); the clip is upscaled 2x so it isn't tiny on a desktop player
export const PHONE = { ...devices["Pixel 5"] };

/** Runs in the page before any app script: cursor dot, click ripple, caption strip. */
function overlay() {
  const css = `
    #__cur{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
      background:rgba(200,60,40,.35);border:2px solid rgba(200,60,40,.9);pointer-events:none;z-index:2147483647;
      transition:transform .08s;display:none}
    #__cur.down{transform:scale(.7)}
    .__rip{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid rgba(200,60,40,.8);
      pointer-events:none;z-index:2147483646;animation:__rip .5s ease-out forwards}
    @keyframes __rip{to{transform:scale(3.2);opacity:0}}
    #__cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(90vw,980px);padding:10px 22px;
      border-radius:999px;background:rgba(27,36,96,.92);color:#fbf3e0;font:600 19px/1.35 system-ui,sans-serif;
      text-align:center;pointer-events:none;z-index:2147483645;opacity:0;transition:opacity .35s}
    #__cap.on{opacity:1}
    html.__captop #__cap{bottom:auto;top:96px}
    @media (max-width:500px){#__cap{font-size:15px;bottom:14px;padding:8px 14px;border-radius:14px}}`;
  const mount = () => {
    if (document.getElementById("__cur")) return;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
    const c = document.createElement("div");
    c.id = "__cur";
    const cap = document.createElement("div");
    cap.id = "__cap";
    document.body.append(c, cap);
    const at = (e) => {
      c.style.display = "block";
      c.style.left = e.clientX + "px";
      c.style.top = e.clientY + "px";
    };
    addEventListener("mousemove", at, true);
    addEventListener("pointerdown", (e) => {
      at(e);
      c.classList.add("down");
      const r = document.createElement("div");
      r.className = "__rip";
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }, true);
    addEventListener("pointerup", () => c.classList.remove("down"), true);
    window.__caption = (t) => {
      cap.textContent = t ?? "";
      cap.classList.toggle("on", !!t);
    };
  };
  if (document.body) mount();
  else addEventListener("DOMContentLoaded", mount);
}

/**
 * Record one clip. `fn(page, h)` drives it; recording is trimmed to start at `h.start()`
 * (call it once the page is ready), or at the first caption if start() isn't called.
 */
export async function clip(name, { device = DESKTOP, url = "/", ready, init, captionTop = false } = {}, fn) {
  mkdirSync(RAW, { recursive: true });
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  // the screencast is captured at CSS-pixel size; a phone clip is upscaled 2x by ffmpeg afterwards
  const size = { ...device.viewport };
  const upscale = device.viewport.width < 640;
  const context = await browser.newContext({ ...device, recordVideo: { dir: RAW, size } });
  const apiHits = [];
  context.on("request", (r) => {
    if (/^\/api(\/|$)/.test(new URL(r.url()).pathname)) apiHits.push(r.url());
  });
  await context.addInitScript(overlay);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const t0 = Date.now();
  let startAt = null;
  const h = {
    start: () => {
      if (startAt === null) startAt = (Date.now() - t0) / 1000;
    },
    caption: async (t, hold = 0) => {
      h.start();
      await page.evaluate(([x, top]) => {
        document.documentElement.classList.toggle("__captop", top);
        window.__caption?.(x);
      }, [t, captionTop]);
      if (hold) await page.waitForTimeout(hold);
    },
    wait: (ms) => page.waitForTimeout(ms),
    /** Glide the cursor to a locator (scrolling it into view), then click it. */
    click: async (loc, { pause = 350, steps = 22, position } = {}) => {
      await loc.scrollIntoViewIfNeeded();
      const b = await loc.boundingBox();
      if (!b) throw new Error(`no box for ${loc}`);
      const x = b.x + (position ? position.x : b.width / 2);
      const y = b.y + (position ? position.y : b.height / 2);
      await page.mouse.move(x, y, { steps });
      await page.waitForTimeout(pause);
      await page.mouse.down();
      await page.waitForTimeout(70);
      await page.mouse.up();
    },
    hover: async (loc, { pause = 300, steps = 22 } = {}) => {
      await loc.scrollIntoViewIfNeeded();
      const b = (await loc.boundingBox());
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps });
      await page.waitForTimeout(pause);
    },
    /** Smooth scroll of the window (or of the element under the cursor) by dy pixels. */
    scroll: async (dy, ms = 900) => {
      const n = Math.max(1, Math.round(ms / 30));
      for (let i = 0; i < n; i++) {
        await page.mouse.wheel(0, dy / n);
        await page.waitForTimeout(30);
      }
    },
  };
  await page.goto(BASE + url);
  if (ready) await ready(page);
  else await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForTimeout(600); // fonts and the first paint settle before the clip starts
  try {
    await fn(page, h);
    await page.waitForTimeout(800);
  } finally {
    await h.caption(null).catch(() => {});
    const video = page.video();
    await context.close();
    await browser.close();
    const raw = await video.path();
    const out = path.join(OUT, `${name}.mp4`);
    if (existsSync(out)) rmSync(out);
    const ss = Math.max(0, (startAt ?? 0) - 0.15).toFixed(2);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", ss, "-i", raw, ...(upscale ? ["-vf", "scale=iw*2:ih*2:flags=lanczos"] : []), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out]);
    rmSync(raw);
    if (apiHits.length) throw new Error(`${name}: the demo build made /api requests: ${apiHits.join(", ")}`);
    console.log(`recorded ${out} (trimmed ${ss}s)`);
  }
}

/** The mode tabs. */
export const modeTab = (page, name) => page.getByRole("tablist", { name: "Mode" }).getByRole("tab", { name });
export const tricks = (page) => page.getByRole("complementary").filter({ has: page.getByRole("heading", { name: /Reharm & tricks/i }) });
export const dial = (page) => page.getByRole("radiogroup", { name: "Reharm level" });
