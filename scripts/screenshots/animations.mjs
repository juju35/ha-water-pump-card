// Records the animated states into screenshots/*.gif (needs ffmpeg).
// Usage: npm install && npm run build && node scripts/screenshots/animations.mjs
// CSS animations are paused and stepped frame by frame — each one by a fraction of its own cycle, so every GIF
// loops cleanly whatever the machine's speed.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cardClip, iconsFor, launch, mountCard, openPage, root } from "./harness.mjs";
import { setup, wsFor } from "./mock.mjs";

const FPS = 20;
const WIDTH = 460;

const frameName = (i) => `f${String(i).padStart(3, "0")}.png`;

// Every decoded frame (RGBA) and its timing, as ffmpeg's per-frame MD5 list: equal lists, same animation.
const decodedFrames = (file) =>
  execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-pix_fmt", "rgba", "-f", "framemd5", "-"], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");

// A deterministic GIF: frames stepped in paused animations (never the clock), the palette computed from those frames
// only, ordered (Bayer) dithering, bit-exact muxing. The file in place is only replaced when its decoded frames differ:
// GIF bytes can still vary with the ffmpeg build, and an unchanged animation must not show up as a change to commit.
const encode = (dir, out) => {
  const gif = join(dir, "out.gif");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%03d.png"),
    "-vf", `scale=${WIDTH + 32}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    "-fflags", "+bitexact", "-flags", "+bitexact", "-loop", "0", gif,
  ]);
  const target = `${root}${out}`;
  mkdirSync(`${root}screenshots`, { recursive: true });
  const same = existsSync(target) && decodedFrames(target) === decodedFrames(gif);
  if (!same) copyFileSync(gif, target);
  console.log(`${out}${same ? " (unchanged)" : ""}`);
};

// Steps every CSS animation of the page to `frac` of its own cycle, and every SVG clock (the bubbles in the
// tank, SVG animations) to `frac` of `seconds`: a GIF of one cycle loops seamlessly.
// document.getAnimations() does not reach into shadow roots here, so the cards' trees are walked by hand.
const step = (page, frac, seconds) =>
  page.evaluate(([f, secs]) => {
    const anims = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll("*")) {
        anims.push(...el.getAnimations());
        if (el.localName === "svg" && el.setCurrentTime) {
          el.pauseAnimations();
          el.setCurrentTime((3 + f) * secs);
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    for (const a of anims) {
      a.pause();
      const d = a.effect.getComputedTiming().duration;
      a.currentTime = (3 + f) * d;
    }
  }, [frac, seconds]);

// One cycle of the card's CSS animations, stepped frame by frame.
const recordCycle = async (page, dir, seconds) => {
  const clip = await cardClip(page, WIDTH);
  const frames = Math.round(FPS * seconds);
  for (let i = 0; i < frames; i++) {
    await step(page, i / frames, seconds);
    await page.screenshot({ path: join(dir, frameName(i)), clip, animations: "allow" });
  }
};

// ── The GIFs ─────────────────────────────────────────────────────────────────
const browser = await launch();

// The pumps at work, in both themes: <name>.gif light, <name>-dark.gif dark. Water runs up the sump pump's pipe, the
// well pump fills the tap, the industrial pump's fan turns (SVG animations, one loop of 2.4 s, stepped with the page's
// SVG clock).
for (const theme of ["light", "dark"]) {
  const dark = theme === "dark";
  const suffix = dark ? "-dark" : "";
  for (const scene of ["sump", "well", "industrial"]) {
    const name = `wp-${scene}`;
    const s = { scene, theme };
    const { hass, config } = setup(s);
    const page = await openPage(browser, { theme, width: WIDTH, icons: iconsFor([]), label: `${name}${suffix}`, ws: wsFor(s) });
    await mountCard(page, { tag: "water-pump-card", hass, config: { ...config, show_runs: false }, dark });
    await page.waitForTimeout(300);
    const dir = mkdtempSync(join(tmpdir(), "wp-frames-"));
    await recordCycle(page, dir, 2.4);
    encode(dir, `screenshots/${name}${suffix}.gif`);
    rmSync(dir, { recursive: true });
    await page.close();
  }
}

await browser.close();
