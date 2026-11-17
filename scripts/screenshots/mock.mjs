// The mock home of the screenshots and animations: pumps on smart plugs or meters (a switch and a power sensor each),
// with a level sensor and a high-level float in the sump, a pressure, flow and volume sensor on the well pump, and their
// power history as Home Assistant's recorder would return it.
const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes, last_changed: new Date().toISOString() });

// Runs as [start, length] in minutes from now, turned into power steps.
const steps = (runs, watts) => runs.flatMap(([at, len]) => [[at, watts], [at + len, 0]]).sort((a, b) => a[0] - b[0]);
const sumpRuns = Array.from({ length: 14 }, (_, k) => [-850 + k * 60, 0.7]);

const SCENES = {
  sump: { name: "Sump pump", area: "Basement", kind: null, watts: 640, level: 62, alarm: "off", config: { level_start: 60, level_stop: 20 }, history: [[-1440, 0], ...steps(sumpRuns, 650), [-0.63, 640]] },
  "sump-idle": { name: "Sump pump", area: "Basement", watts: 0, level: 34, alarm: "off", config: { level_start: 60, level_stop: 20 }, history: [[-1440, 0], ...steps([...sumpRuns, [-13, 0.7]], 650)] },
  "sump-alert": { name: "Sump pump", area: "Basement", watts: 650, level: 92, alarm: "on", config: { level_start: 60, level_stop: 20 }, history: [[-1440, 0], ...steps(sumpRuns.slice(0, 10), 650), [-14, 650]] },
  well: {
    name: "Well pump",
    area: "Garden",
    watts: 780,
    pressure: 3.2,
    flow: 18,
    volume: 1240,
    config: {},
    history: [[-1440, 0], ...steps(Array.from({ length: 22 }, (_, k) => [-900 + k * 38, 3 + (k % 4)]), 780), [-4, 780]],
  },
  industrial: { name: "Process pump", area: "Workshop", watts: 4200, pressure: 4.5, flow: 120, config: { kind: "industrial" }, history: [[-1440, 0], [-600, 4100], [-380, 0], [-130, 4200]] },
  offline: { name: "Sump pump", area: "Basement", watts: null, level: null, config: {}, history: [] },
};

const slug = (s) => s.replace(/-.*/, "");

export const setup = (s) => {
  const v = SCENES[s.scene];
  const id = slug(s.scene);
  const na = v.watts == null;
  const states = {
    [`switch.${id}_pump`]: st(`switch.${id}_pump`, na ? "unavailable" : "on", { friendly_name: v.name }),
    [`sensor.${id}_pump_power`]: st(`sensor.${id}_pump_power`, na ? "unavailable" : String(v.watts), { device_class: "power", unit_of_measurement: "W", friendly_name: `${v.name} Power` }),
    "sun.sun": st("sun.sun", s.night ? "below_horizon" : "above_horizon", { friendly_name: "Sun" }),
  };
  if (v.level !== undefined) states[`sensor.${id}_level`] = st(`sensor.${id}_level`, v.level == null ? "unavailable" : String(v.level), { unit_of_measurement: "%", friendly_name: `${v.name} Pit level` });
  if (v.alarm) states[`binary_sensor.${id}_high_level`] = st(`binary_sensor.${id}_high_level`, v.alarm, { device_class: "problem", friendly_name: `${v.name} High level` });
  if (v.pressure != null) states[`sensor.${id}_pressure`] = st(`sensor.${id}_pressure`, String(v.pressure), { device_class: "pressure", unit_of_measurement: "bar", friendly_name: `${v.name} Pressure` });
  if (v.flow != null) states[`sensor.${id}_flow`] = st(`sensor.${id}_flow`, String(v.flow), { device_class: "volume_flow_rate", unit_of_measurement: "L/min", friendly_name: `${v.name} Flow` });
  if (v.volume != null) states[`sensor.${id}_water_today`] = st(`sensor.${id}_water_today`, String(v.volume), { device_class: "water", unit_of_measurement: "L", friendly_name: `${v.name} Water today` });
  const entities = Object.fromEntries(Object.keys(states).filter((k) => !k.startsWith("sun.")).map((k) => [k, { entity_id: k, device_id: id, platform: "shelly" }]));
  return {
    hass: {
      language: "en",
      locale: { language: "en" },
      config: { unit_system: { temperature: "°C" } },
      themes: { darkMode: s.theme === "dark" },
      areas: { [id]: { area_id: id, name: v.area } },
      devices: { [id]: { area_id: id, name: v.name, model: "Shelly Plus 1PM" } },
      entities,
      states,
    },
    config: { entity: `switch.${id}_pump`, ...v.config, ...s.config },
    open: s.open,
  };
};

// The recorder's answer for the shot's scene (minimal response), relative to the page's (fixed) clock.
export const wsFor = (s) => `window.__ws = async (msg) => {
  const now = Date.now();
  const rows = ${JSON.stringify(SCENES[s.scene].history)}.map(([m, w]) => ({ s: String(w), lu: (now + m * 60000) / 1000 }));
  return msg.type === "history/history_during_period" ? { [msg.entity_ids[0]]: rows } : {};
};`;
