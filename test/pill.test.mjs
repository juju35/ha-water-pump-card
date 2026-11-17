// The status pill in Chromium (needs `npm run build`; skipped without Chromium), in en, fr, de, hu, el and ru, from
// 190 to 500 px, on the full card (banner and classic header) and the mini card (compact and expanded): on the title
// row only with the whole title beside it; else on its own line under the subtitle, its label whole; or its dot
// alone (always at 190 px). Nothing below the top of the banner's ground strip or out of the banner. The mini card's
// expand / collapse button is a 24 px round button 5 px from the banner's top right corner.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

let harness;
let mock;
try {
  harness = await import("../scripts/screenshots/harness.mjs");
  mock = await import("../scripts/screenshots/mock.mjs");
} catch {}
const built = existsSync(new URL("../dist/ha-water-pump-card.js", import.meta.url));
const browser = built ? await harness?.launch().catch(() => null) : null;

const VARIANTS = [
  ["water-pump-card", false, true],
  ["water-pump-mini-card", false, true],
  ["water-pump-mini-card", true, true],
  ["water-pump-card", false, false],
];

test("status pill: whole title beside it, whole label or dot alone, inside the banner; zoom button at the corner", { skip: !browser && "no Chromium or no build" }, async () => {
  const failures = [];
  try {
    for (const width of [190, 245, 300, 400, 460, 500]) {
      const page = await harness.openServedPage(browser, { theme: "light", width });
      for (const language of ["en", "fr", "de", "hu", "el", "ru"]) {
        for (const scene of ["sump", "sump-alert", "offline"]) {
          for (const [tag, zoom, ill] of VARIANTS) {
            for (const title of [undefined, "A very long name for the sump pump of the basement"]) {
              const { hass, config } = mock.setup({ scene, theme: "light", config: { animations: false, show_runs: false, ...(ill ? {} : { illustration: false }), ...(title ? { title } : {}) } });
              const out = await page.evaluate(
                async ({ tag, hass, config, zoom, ill, width, language }) => {
                  const frames = (n) => new Promise((r) => {
                    const step = () => (n-- > 0 ? requestAnimationFrame(step) : r());
                    step();
                  });
                  const root = document.getElementById("root");
                  root.innerHTML = "";
                  const el = document.createElement(tag);
                  el.setConfig({ type: `custom:${tag}`, ...config });
                  el.hass = { ...hass, language, locale: { language }, themes: { darkMode: false }, callService: async () => {} };
                  root.appendChild(el);
                  await frames(2);
                  // The first card in a language fetches its translations, then draws again.
                  if (!window.__langs?.has(language)) {
                    (window.__langs ??= new Set()).add(language);
                    await new Promise((r) => setTimeout(r, 300));
                    await frames(2);
                  }
                  if (zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
                  await frames(4);
                  const r = el.shadowRoot;
                  const res = [];
                  const head = r.querySelector(ill ? ".banner" : ".head");
                  const pill = head?.querySelector(ill ? ".bpill" : ".pill");
                  if (!pill) return ["no pill"];
                  const txt = pill.querySelector(".bpt, .pt");
                  const dotOnly = txt.getBoundingClientRect().width <= 1;
                  if (width <= 200 && !dotOnly) res.push("label shown");
                  if (!dotOnly && (txt.scrollWidth > txt.clientWidth + 0.5 || !txt.clientWidth)) res.push("label cut");
                  const name = head.querySelector(".title");
                  const nb = name.getBoundingClientRect();
                  const pb = pill.getBoundingClientRect();
                  const onRow = Math.abs(pb.top + pb.height / 2 - (nb.top + nb.height / 2)) < 3;
                  if (onRow && !dotOnly && name.scrollWidth > name.clientWidth + 0.5) res.push("title cut beside the pill");
                  if (!onRow && dotOnly) res.push("dot alone off the title row");
                  if (!onRow && pb.top < nb.bottom - 0.5) res.push("pill over the title");
                  const row = name.parentElement.getBoundingClientRect();
                  if (!onRow && width > 200 && name.scrollWidth + 8 + pb.width <= row.right - nb.left - 1) res.push("pill under the subtitle although it fits beside the title");
                  const bb = head.getBoundingClientRect();
                  if (pb.right > bb.right + 0.5) res.push("pill out of the header");
                  if (ill) {
                    const floor = head.querySelector(".ground").getBoundingClientRect().top;
                    for (const [what, e] of [["title", name], ["pill", pill], ["subtitle", head.querySelector(".subt, .rs")]]) {
                      const b = e?.getBoundingClientRect();
                      if (b && (b.bottom > floor + 0.5 || b.top < bb.top - 0.5)) res.push(`${what} out of the banner or over its ground strip`);
                    }
                    const z = head.querySelector(".zoom")?.getBoundingClientRect();
                    if (tag.includes("mini") && !z) res.push("no zoom button");
                    if (z && (Math.round(z.width) !== 24 || Math.round(z.height) !== 24 || Math.round(z.top - bb.top) !== 5 || Math.round(bb.right - z.right) !== 5))
                      res.push(`zoom ${Math.round(z.width)}x${Math.round(z.height)} at ${Math.round(z.top - bb.top)}/${Math.round(bb.right - z.right)}`);
                  }
                  return res;
                },
                { tag, hass, config, zoom, ill, width, language },
              );
              for (const f of out) failures.push(`${language} ${tag}${zoom ? " zoomed" : ""}${ill ? "" : " classic"} ${scene} ${width}px${title ? " long title" : ""}: ${f}`);
            }
          }
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, []);
});
