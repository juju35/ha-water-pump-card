// Renders the water pump cards with mock pumps and saves the README screenshots.
// Usage: npm install && npm run build && node scripts/screenshots/water-pump.mjs
import { pair, shoot } from "./harness.mjs";
import { setup, wsFor } from "./mock.mjs";

// Stills: animations: false keeps the water and the fan at a fixed moment, so a capture only changes when the card does.
const still = (file, s) => pair(file, { ...s, config: { animations: false, ...s.config } });
const scenes = ["sump", "sump-idle", "sump-alert", "well", "industrial", "offline"].flatMap((scene) => still(scene, { scene }));
await shoot({ prefix: "wp", tag: "water-pump-card", shots: [...scenes, ...still("well-night", { scene: "well", night: true })], setup, ws: wsFor });
await shoot({
  prefix: "wp-mini",
  tag: "water-pump-mini-card",
  shots: [...still("sump", { scene: "sump" }), ...still("alert", { scene: "sump-alert" }), ...still("zoom", { scene: "sump", open: ".zoom" })],
  setup,
  ws: wsFor,
});
