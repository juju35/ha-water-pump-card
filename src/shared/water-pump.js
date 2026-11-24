// ── Water pump ───────────────────────────────────────────────────────────────
// A pump is read from what tells it runs — its switch, a running binary sensor, or its power sensor (running above
// `threshold`) — and from the other sensors of its device: the level of its pit or tank (%), the pressure, the flow,
// today's pumped volume, an alarm. `entity` is any of the first three; `level`, `pressure`, `flow`, `volume` and
// `alarm` override the discovery. Its kind — a sump pump, a water pump (well, booster), an industrial pump — is found
// from its name, else set with `kind`: it decides the illustration.
import { rcPerRegistry } from "./discovery-rules.js";

export const WP_KIND_NAMES = [
  ["sump", /sump|relevage|lift|drain|vide.?cave|eaux us[ée]es|tauchpumpe|hebeanlage|abwasser|sumidero|achique|sommergibile|sollevamento|dompel|pompa zatapial|przepompown|esgoto|drenaj|dr[aă]naj|pumpebrønd|dränkbar|länspump|дренаж|канализац|szennyvíz|drenážn|kalov|ponorn|drenas|αποστράγγισ/],
  ["industrial", /industri|process|procédé|prozess|proceso|processo|procesow|proces|centrifug|zentrifug|centrífug|pompe de circulation|circulation|umwälz|circolazione|circulación|circulatie|cyrkulac|circula[tț]i|cirkulation|циркулац|keringet|obehov|cirkulačn|obtočn|cirkulācij|κυκλοφορ/],
  ["well", /well|puits|forage|surpresseur|booster|hydrophore|brunnen|druckerh|hauswasser|pozo|grupo de presión|pozzo|autoclave|waterpomp|hydrofoor|studni|hydrofor|po[cç]o|pressuriz|fântân|hidrofor|brønd|trykforøg|brunn|tryckstegr|кладен|хидрофор|колод|скважин|насосная станция|kút|házi vízmű|studň|domáca vodáreň|domácí vodárna|vodnjak|hidropostaj|aka|hidrofors|γεώτρησ|πιεστικό|arrosage|irrigation|bewässerung|riego|irrigazione|beregening|nawadnian|rega|iriga[tț]i|vanding|bevattning|напояв|полив|öntöz|zavlažov|zalivan|laistīšan|άρδευσ|potable/],
];
export const WP_KINDS = [...WP_KIND_NAMES.map(([k]) => k), "pump"];
export const wpKindOf = (text) => WP_KIND_NAMES.find(([, re]) => re.test(String(text || "").toLowerCase()))?.[0] || "pump";
// A pump running longer than this without a stop is an alert (minutes), by kind.
export const WP_MAX_RUN = { sump: 10, well: 30, industrial: 0, pump: 30 };

export const wpNum = (st) => {
  const v = Number.parseFloat(st?.state);
  return Number.isFinite(v) ? v : null;
};
export const wpLabel = (hass, id) => `${id} ${hass.states[id]?.attributes.friendly_name || ""}`;
export const wpDeviceOf = (hass, id) => hass.entities?.[id]?.device_id;
export const wpDeviceEntities = rcPerRegistry((hass) => {
  const out = {};
  for (const [id, r] of Object.entries(hass.entities || {})) if (r.device_id && !r.hidden) (out[r.device_id] ||= []).push(id);
  return out;
});
// The pumps of the home: switches, running binary sensors and power sensors named like a pump.
export const WP_NAME = /pump|pompe|pumpe|bomba|pompa|pomp|помп|насос|szivatty|čerpadl|črpalk|sūkn|αντλί|relevage|surpresseur|booster|hydrophore/i;
export const wpPumps = (hass) => {
  const ids = Object.keys(hass.states || {}).filter((id) => /^(switch|binary_sensor|sensor|input_boolean)\./.test(id) && WP_NAME.test(wpLabel(hass, id)) && !hass.entities?.[id]?.hidden && !hass.entities?.[id]?.entity_category);
  const rank = (id) => (id.startsWith("switch.") ? 0 : id.startsWith("binary_sensor.") ? 1 : id.startsWith("sensor.") && hass.states[id].attributes.device_class === "power" ? 2 : 3);
  return ids.filter((id) => rank(id) < 3).sort((a, b) => rank(a) - rank(b));
};

// The roles on the pump's device: switch, running (a binary sensor), power, level (%), pressure, flow, volume, alarm
// (a binary sensor: problem, moisture, safety, or named high / alarm / overflow). `overrides` win.
export const wpFind = (hass, entity, overrides = {}) => {
  const device = entity && wpDeviceOf(hass, entity);
  const ids = ((device && wpDeviceEntities(hass)[device]) || []).filter((id) => id !== entity && hass.states[id]);
  const st = (id) => hass.states[id];
  const dc = (id) => st(id)?.attributes.device_class;
  const unit = (id) => st(id)?.attributes.unit_of_measurement;
  const named = (id, re) => re.test(wpLabel(hass, id));
  const dom = (id) => id.split(".")[0];
  const pick = (test) => ids.find((id) => !hass.entities?.[id]?.entity_category && test(id)) || ids.find(test);
  const own = (role, test) => (entity && test(entity) ? entity : undefined) || overrides[role] || pick(test);
  const isPower = (id) => dom(id) === "sensor" && (dc(id) === "power" || ["W", "kW"].includes(unit(id)));
  const isRunning = (id) => dom(id) === "binary_sensor" && (dc(id) === "running" || named(id, /run|marche|läuft|funcion|funziona|loopt|pracuj|lauf|pump|pompe/i)) && !named(id, /alarm|high|haut|overflow|fault|error|défaut/i);
  return {
    switch: own("switch", (id) => /^(switch|input_boolean)\./.test(id)),
    running: own("running", isRunning),
    power: own("power", isPower),
    level: overrides.level || pick((id) => dom(id) === "sensor" && unit(id) === "%" && named(id, /level|niveau|füllstand|nivel|livello|peil|poziom|nível|nivel|niveau|niv[aå]|ниво|уров|рів|szint|hladin|nivo|līmen|στάθμ|cuve|tank|pit|fosse|puisard/i)),
    pressure: overrides.pressure || pick((id) => dom(id) === "sensor" && (dc(id) === "pressure" || ["bar", "mbar", "psi", "kPa", "hPa"].includes(unit(id)))),
    flow: overrides.flow || pick((id) => dom(id) === "sensor" && (dc(id) === "volume_flow_rate" || /\/(min|h|s)$/.test(unit(id) || "")) && !isPower(id)),
    volume: overrides.volume || pick((id) => dom(id) === "sensor" && (dc(id) === "water" || dc(id) === "volume") && ["L", "m³", "gal"].includes(unit(id))),
    alarm: overrides.alarm || pick((id) => dom(id) === "binary_sensor" && (["problem", "moisture", "safety"].includes(dc(id)) || named(id, /alarm|high|haut|overflow|débord|hoch|alto|alta|fault|défaut|störung/i))),
  };
};

// The runs in a history of on/off points { t, on } up to `now`: each a stretch on, with its start and end.
export const wpRuns = (points, now) => {
  const runs = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const end = Math.min(points[i + 1]?.t ?? now, now);
    if (!p.on || end <= p.t) continue;
    const last = runs.at(-1);
    if (last && last.end >= p.t) last.end = end;
    else runs.push({ start: p.t, end });
  }
  return runs;
};
// Recorder rows (minimal response) as on/off points: `on(state)` decides (a power above the threshold, a switch on).
export const wpPoints = (rows, on) =>
  (rows || [])
    .map((r) => ({ t: Math.round((r.lu ?? Date.parse(r.last_updated ?? r.last_changed) / 1000) * 1000), s: r.s ?? r.state }))
    .filter((p) => Number.isFinite(p.t) && p.s != null && !["unavailable", "unknown"].includes(p.s))
    .sort((a, b) => a.t - b.t)
    .map((p) => ({ t: p.t, on: on(p.s) }));
