// A mock Home Assistant with pumps: a sump pump on a smart plug (switch and power) with a pit level and a high-level
// float in the basement, a well pump with pressure, flow and today's water, and a pump read from a running sensor.
// `history` answers the recorder's history call with [minutes from now, state] steps for every entity asked.
export const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes, last_changed: "2026-01-01T00:00:00Z" });

export const makeHass = ({ watts = "640", sw = "on", level = "62", alarm = "off", history = [], ...overrides } = {}) => {
  const calls = [];
  return {
    language: "en",
    locale: { language: "en" },
    config: { unit_system: { temperature: "°C" } },
    themes: { darkMode: false },
    areas: { basement: { area_id: "basement", name: "Basement" }, garden: { area_id: "garden", name: "Garden" } },
    devices: {
      sump: { area_id: "basement", name: "Sump pump", model: "Shelly Plus 1PM" },
      well: { area_id: "garden", name: "Well pump", model: "Shelly Pro 1PM" },
      boiler: { area_id: "basement", name: "Heating circulation pump" },
    },
    entities: {
      "switch.sump_pump": { device_id: "sump", platform: "shelly" },
      "sensor.sump_pump_power": { device_id: "sump", platform: "shelly" },
      "sensor.sump_pit_level": { device_id: "sump", platform: "esphome" },
      "binary_sensor.sump_high_level": { device_id: "sump", platform: "esphome" },
      "sensor.sump_pump_temperature": { device_id: "sump", platform: "shelly", entity_category: "diagnostic" },
      "switch.well_pump": { device_id: "well", platform: "shelly" },
      "sensor.well_pump_power": { device_id: "well", platform: "shelly" },
      "sensor.well_pressure": { device_id: "well", platform: "esphome" },
      "sensor.well_flow": { device_id: "well", platform: "esphome" },
      "sensor.well_water_today": { device_id: "well", platform: "esphome" },
      "binary_sensor.circulation_pump_running": { device_id: "boiler", platform: "modbus" },
    },
    states: {
      "switch.sump_pump": st("switch.sump_pump", sw, { friendly_name: "Sump pump" }),
      "sensor.sump_pump_power": st("sensor.sump_pump_power", watts, { device_class: "power", unit_of_measurement: "W", friendly_name: "Sump pump Power" }),
      "sensor.sump_pit_level": st("sensor.sump_pit_level", level, { unit_of_measurement: "%", friendly_name: "Sump pit level" }),
      "binary_sensor.sump_high_level": st("binary_sensor.sump_high_level", alarm, { device_class: "problem", friendly_name: "Sump high level" }),
      "sensor.sump_pump_temperature": st("sensor.sump_pump_temperature", "38", { device_class: "temperature", unit_of_measurement: "°C" }),
      "switch.well_pump": st("switch.well_pump", "on", { friendly_name: "Well pump" }),
      "sensor.well_pump_power": st("sensor.well_pump_power", "0.78", { device_class: "power", unit_of_measurement: "kW", friendly_name: "Well pump Power" }),
      "sensor.well_pressure": st("sensor.well_pressure", "3.2", { device_class: "pressure", unit_of_measurement: "bar", friendly_name: "Well pressure" }),
      "sensor.well_flow": st("sensor.well_flow", "18", { device_class: "volume_flow_rate", unit_of_measurement: "L/min", friendly_name: "Well flow" }),
      "sensor.well_water_today": st("sensor.well_water_today", "1240", { device_class: "water", unit_of_measurement: "L", friendly_name: "Well water today" }),
      "binary_sensor.circulation_pump_running": st("binary_sensor.circulation_pump_running", "on", { device_class: "running", friendly_name: "Circulation pump running" }),
    },
    calls,
    ws: [],
    callService(domain, service, data) {
      calls.push([domain, service, data]);
    },
    callWS(msg) {
      this.ws.push(msg);
      const now = Date.now();
      const rows = history.map(([m, s]) => ({ s: String(s), lu: (now + m * 60000) / 1000 }));
      return Promise.resolve(Object.fromEntries(msg.entity_ids.map((id) => [id, rows])));
    },
    ...overrides,
  };
};
