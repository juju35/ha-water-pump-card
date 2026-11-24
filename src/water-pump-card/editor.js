// ── Editor ───────────────────────────────────────────────────────────────────
import { WaterPumpCard } from "./card.js";

export const wpSchema = (booleans) => (lang) => [
  { name: "entity", selector: { entity: { domain: ["switch", "binary_sensor", "sensor", "input_boolean"] } } },
  { name: "title", selector: { text: {} } },
  { name: "navigation_path", selector: { navigation: {} } },
  { name: "kind", selector: { select: { mode: "dropdown", options: ["auto", ...WP_KINDS].map((value) => ({ value, label: rcT(WP_I18N, lang, `k_${value}`) })) } } },
  { name: "level", selector: { entity: { domain: "sensor" } } },
  { name: "pressure", selector: { entity: { domain: "sensor" } } },
  { name: "flow", selector: { entity: { domain: "sensor" } } },
  { name: "volume", selector: { entity: { domain: "sensor" } } },
  { name: "alarm", selector: { entity: { domain: "binary_sensor" } } },
  { name: "threshold", selector: { number: { min: 0, max: 10000, step: 1, mode: "box", unit_of_measurement: "W" } } },
  { name: "level_start", selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } } },
  { name: "level_stop", selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } } },
  { name: "level_alarm", selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } } },
  { name: "max_run", selector: { number: { min: 0, max: 1440, step: 1, mode: "box", unit_of_measurement: "min" } } },
  ...rcBooleans(...booleans),
  {
    name: "illustration_theme",
    selector: { select: { mode: "dropdown", options: ["auto", "day", "night"].map((value) => ({ value, label: rcT(WP_I18N, lang, `ed_theme_${value}`) })) } },
  },
  ...rcAdvanced(WP_I18N, lang, "language"),
];

export const WP_HELPERS = ["entity", "title", "level", "alarm", "threshold", "max_run", "zoom", "language"];

export const WaterPumpCardEditor = rcEditor({
  card: WaterPumpCard,
  helpers: WP_HELPERS,
  schema: wpSchema(["show_title", "illustration", "show_runs", "animations", "show_controls"]),
});

rcRegister(
  WaterPumpCard,
  WaterPumpCardEditor,
  "Water Pump Card",
  "A pump illustrated — sump pump, water pump, industrial pump: whether it pumps, the level of its pit with its marks, its runs over 24 hours, cycles, pressure, flow and alerts",
);
