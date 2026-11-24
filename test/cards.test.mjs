import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { makeHass } from "./hass.mjs";
import { fakeNode, load } from "./load.mjs";
import { sources } from "./source.mjs";

const wp = load();
const { cards } = wp;
const json = (v) => JSON.parse(JSON.stringify(v));
const settle = () => new Promise((r) => setTimeout(r, 0));

const make = (tag, config, hass = makeHass()) => {
  const card = new cards[tag]();
  card.attachShadow();
  const nodes = {};
  card.shadowRoot.querySelector = (s) => (nodes[s] ||= fakeNode());
  card._nodes = nodes;
  card.setConfig({ type: `custom:${tag}`, ...config });
  card.hass = hass;
  return card;
};
const click = (card, sel) => card._nodes[sel].listeners.click({ stopPropagation() {} });
const SUMP = { entity: "switch.sump_pump", level_start: 60, level_stop: 20 };
// Three runs this morning, then pumping for half a minute.
const HISTORY = [
  [-600, 0],
  [-300, 650],
  [-299, 0],
  [-200, 650],
  [-199, 0],
  [-100, 650],
  [-99, 0],
  [-0.5, 640],
];

test("both cards are registered, with their editors and a picker entry", () => {
  for (const tag of ["water-pump-card", "water-pump-mini-card"]) {
    assert.ok(wp.customElements.get(tag), tag);
    assert.ok(wp.customElements.get(`${tag}-editor`), `${tag}-editor`);
  }
  assert.deepEqual(json(wp.window.customCards.map((c) => c.type)), ["water-pump-card", "water-pump-mini-card"]);
});

test("discovery: pumps by name, switches first; the roles on the device", () => {
  const h = makeHass();
  const found = json(wp.wpPumps(h));
  assert.equal(found[0], "switch.sump_pump");
  assert.ok(found.includes("binary_sensor.circulation_pump_running"));
  const r = wp.wpFind(h, "switch.sump_pump");
  assert.deepEqual([r.switch, r.power, r.level, r.alarm], ["switch.sump_pump", "sensor.sump_pump_power", "sensor.sump_pit_level", "binary_sensor.sump_high_level"]);
  const w = wp.wpFind(h, "switch.well_pump");
  assert.deepEqual([w.pressure, w.flow, w.volume, w.level], ["sensor.well_pressure", "sensor.well_flow", "sensor.well_water_today", undefined]);
  assert.equal(wp.wpFind(h, "binary_sensor.circulation_pump_running").running, "binary_sensor.circulation_pump_running");
  assert.equal(wp.wpFind(h, "switch.sump_pump", { level: "sensor.other" }).level, "sensor.other");
  assert.deepEqual(json(cards["water-pump-card"].getStubConfig(h)), { entity: "switch.sump_pump" });
});

test("kinds from the name, in several languages", () => {
  const cases = { "Pompe de relevage": "sump", "Sump pump": "sump", Tauchpumpe: "sump", "Pompe du puits": "well", Surpresseur: "well", "Brunnen Pumpe": "well", "Pompe d'arrosage": "well", "Circulation pump": "industrial", "Pompe industrielle": "industrial", "Pool pump": "pump" };
  for (const [name, kind] of Object.entries(cases)) assert.equal(wp.wpKindOf(name), kind, name);
  for (const k of wp.WP_KINDS) assert.ok(wp.WP_I18N.en[`k_${k}`], `k_${k}`);
});

test("runs: stretches on, joined end to start", () => {
  const pts = wp.wpPoints(
    [
      { s: "0", lu: 0 },
      { s: "700", lu: 60 },
      { s: "0", lu: 120 },
      { s: "unavailable", lu: 130 },
      { s: "650", lu: 300 },
    ],
    (s) => Number(s) >= 20,
  );
  assert.deepEqual(json(pts.map((p) => p.on)), [false, true, false, true]);
  assert.deepEqual(json(wp.wpRuns(pts, 400000)), [
    { start: 60000, end: 120000 },
    { start: 300000, end: 400000 },
  ]);
});

test("full card: pumping, the level gauge with its marks, tiles, runs and the switch", async () => {
  const hass = makeHass({ history: HISTORY });
  const card = make("water-pump-card", SUMP, hass);
  assert.equal(hass.ws[0].type, "history/history_during_period");
  assert.deepEqual(json(hass.ws[0].entity_ids), ["sensor.sump_pump_power"], "runs read from the power");
  await settle();
  const m = card._items;
  assert.equal(m.state, "running");
  assert.equal(m.kind, "sump");
  assert.equal(m.level, 62);
  assert.equal(m.alarmAt, 85, "a sump pump's alarm level by default");
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /class="banner r-pit"/);
  assert.match(html, /<span class="bpt">Pumping<\/span>/);
  assert.match(html, /<span class="wt" style="height:62%">/);
  assert.match(html, /Alarm 85 %/);
  assert.match(html, /Start 60 %/);
  // The history is stamped when the card asks for it and the run read when it renders: a slow runner adds a second or two.
  assert.match(html, /Pumping for 3[0-3] s/);
  assert.match(html, /Cycles today/);
  assert.match(html, /class="run"/);
  assert.match(html, /No alarm/);
  assert.match(html, /Alert after 10 min non-stop/);
  click(card, ".pw");
  assert.deepEqual(json(hass.calls.at(-1)), ["switch", "turn_off", { entity_id: "switch.sump_pump" }]);
});

test("alerts: the float, a high level, a run too long; idle; offline", async () => {
  const alarm = make("water-pump-card", SUMP, makeHass({ alarm: "on", level: "92", history: [[-30, 0], [-14, 650]] }));
  await settle();
  const a = alarm._items;
  assert.equal(a.state, "alert");
  const alerts = json(a.alerts);
  assert.deepEqual(alerts.slice(0, 2), ["Alarm", "High level 92 %"]);
  assert.match(alerts[2], /^Running non-stop for 1[45] min$/, "a minute boundary may pass while the test runs");
  assert.equal(alerts.length, 3);
  assert.match(alarm.shadowRoot.innerHTML, /<span class="bpt">Alert<\/span>/);
  const idle = make("water-pump-card", SUMP, makeHass({ watts: "0", level: "34", history: [[-60, 0], [-13, 650], [-12, 0]] }));
  await settle();
  assert.equal(idle._items.state, "idle");
  assert.match(idle.shadowRoot.innerHTML, /Last run 12 min ago/);
  const gone = make("water-pump-card", SUMP, makeHass({ sw: "unavailable", watts: "unavailable", level: "unavailable" }));
  assert.equal(gone._items.state, "offline");
  assert.doesNotMatch(gone.shadowRoot.innerHTML, /class="xt"/);
});

test("well pump: pressure, flow and running from its power in kW", async () => {
  const card = make("water-pump-card", { entity: "switch.well_pump", max_run: 0 }, makeHass({ history: [[-60, 0], [-4, 0.78]] }));
  await settle();
  const m = card._items;
  assert.equal(m.kind, "well");
  assert.equal(m.running, true);
  assert.equal(m.watts, 780);
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /class="banner r-garden"/);
  assert.match(html, /<div class="subt">Garden · Water pump<\/div>/);
  assert.match(html, /Pressure/);
  assert.match(html, /3\.2<small>bar<\/small>/);
  assert.match(html, /18<small>L\/min<\/small>/);
  assert.doesNotMatch(html, /Alert after/, "max_run: 0 never alerts");
});

test("no pump: says so", () => {
  const card = make("water-pump-card", {}, makeHass({ states: {}, entities: {} }));
  assert.match(card.shadowRoot.innerHTML, /No pump found/);
});

test("mini card: the banner with the state, the level and the run; alerts first", async () => {
  const card = make("water-pump-mini-card", SUMP, makeHass({ alarm: "on", history: HISTORY }));
  await settle();
  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /class="lvl-alert bn"/);
  assert.match(html, /<button class="r pill"[^>]*><span>Alarm<\/span>/);
  assert.match(html, /Level 62 %/);
});

test("translations: every language has every key of English, with the same placeholders", () => {
  const LANGS = ["en", "fr", "de", "es", "sr", "sr-Latn", "it", "nl", "pt", "pl", "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"];
  const vars = (s) => s.match(/\{\w+\}/g)?.sort() ?? [];
  for (const [name, table] of [["shared", wp.RC_I18N], ["wp", wp.WP_I18N]]) {
    assert.deepEqual(json(Object.keys(table)), LANGS, name);
    const ref = json(Object.keys(table.en)).sort();
    for (const lang of LANGS) {
      const keys = json(Object.keys(table[lang])).filter((k) => !["open_f", "closed_f"].includes(k) && !k.endsWith("_few"));
      assert.deepEqual(keys.sort(), ref, `${name}.${lang}`);
      for (const k of ref) assert.deepEqual(json(vars(table[lang][k])), json(vars(table.en[k])), `${name}.${lang}.${k}`);
    }
  }
  const fr = make("water-pump-card", { ...SUMP, language: "fr" });
  assert.match(fr.shadowRoot.innerHTML, /Alarme 85 %/);
});

test("editors: defaults stay out of the YAML, every field has a label", () => {
  const flat = (schema) => schema.flatMap((f) => (f.schema ? flat(f.schema) : [f]));
  for (const tag of ["water-pump-card", "water-pump-mini-card"]) {
    const ed = new (wp.customElements.get(`${tag}-editor`))();
    ed.appendChild = () => {};
    ed.setConfig({ type: `custom:${tag}`, entity: "switch.sump_pump" });
    ed.hass = makeHass();
    const names = flat(ed._form.schema).map((f) => f.name);
    for (const n of ["entity", "kind", "level", "pressure", "flow", "volume", "alarm", "threshold", "level_start", "level_stop", "level_alarm", "max_run", "show_runs", "language"]) assert.ok(names.includes(n), `${tag}: ${n}`);
    for (const f of flat(ed._form.schema)) {
      assert.notEqual(ed._form.computeLabel(f), `ed_${f.name}`, `${tag}: no label for ${f.name}`);
      const helper = ed._form.computeHelper(f);
      if (helper !== undefined) assert.notEqual(helper, `ed_${f.name}_helper`, `${tag}: no helper for ${f.name}`);
    }
    let out;
    ed.dispatchEvent = (e) => (out = e.detail.config);
    ed._form.listeners["value-changed"]({ detail: { value: { type: `custom:${tag}`, entity: "switch.sump_pump", threshold: 20, kind: "auto", show_runs: true } } });
    assert.deepEqual(json(out), { type: `custom:${tag}`, entity: "switch.sump_pump" });
  }
});

test("night picture: the dark theme alone, a light theme stays day after sunset; illustration_theme wins", () => {
  const sky = (sun, darkMode) => {
    const h = makeHass();
    h.states = { ...h.states, "sun.sun": { entity_id: "sun.sun", state: sun, attributes: {} } };
    h.themes = { darkMode };
    return h;
  };
  for (const tag of ["water-pump-card", "water-pump-mini-card"]) {
    assert.equal(make(tag, SUMP, sky("below_horizon", false))._night(), false, `${tag}: light theme after sunset`);
    assert.equal(make(tag, SUMP, sky("above_horizon", true))._night(), true, `${tag}: dark theme by day`);
    assert.equal(make(tag, { ...SUMP, illustration_theme: "day" }, sky("below_horizon", true))._night(), false, `${tag}: forced day`);
    assert.equal(make(tag, { ...SUMP, illustration_theme: "night" }, sky("above_horizon", false))._night(), true, `${tag}: forced night`);
  }
});

test("the minute timer runs while the card is on the page, even without ResizeObserver", () => {
  const card = make("water-pump-card", SUMP);
  const before = wp.window.intervals.size;
  card.connectedCallback();
  assert.equal(wp.window.intervals.size, before + 1);
  card.disconnectedCallback();
  assert.equal(wp.window.intervals.size, before);
});

// The shared strings keep only what this card uses: a static key, an editor label or helper (`ed_<field>`), a plural
// (`open_*`, `unavail_*`) or an alarm kind of the shared status. The room cards' keys (rooms, layout, thresholds…) are gone.
test("shared strings: no unused key of the room cards", () => {
  const src = ["shared", "water-pump-card"].map((f) => (sources[`${f}.js`] ?? readFileSync(new URL(`../src/${f}.js`, import.meta.url), "utf8"))).join("\n");
  const code = src.replace(/const RC_I18N = \{[\s\S]*?\n\};/, "").replace(/const WP_I18N = \{[\s\S]*?\n\};/, "");
  const flat = (schema) => schema.flatMap((f) => (f.schema ? [f, ...flat(f.schema)] : [f]));
  const fields = new Set();
  for (const tag of ["water-pump-card", "water-pump-mini-card"]) {
    const ed = new (wp.customElements.get(`${tag}-editor`))();
    ed.appendChild = () => {};
    ed.setConfig({ type: `custom:${tag}`, entity: "switch.sump_pump" });
    ed.hass = makeHass();
    for (const f of flat(ed._form.schema)) fields.add(`ed_${f.name}`).add(`ed_${f.name}_helper`);
  }
  const dynamic = /^(open|unavail)_(one|few|many)$|^(leak|smoke|gas|co|detected|clear)$/;
  const unused = json(Object.keys(wp.RC_I18N.en)).filter((k) => !fields.has(k) && !dynamic.test(k) && !new RegExp(`["'\`]${k}["'\`]`).test(code));
  assert.deepEqual(unused, []);
  for (const k of ["ed_rooms", "ed_layout", "ed_thresholds", "ed_columns", "rooms_all"]) assert.ok(!(k in wp.RC_I18N.en), k);
});

// Real devices name and class their entities in many ways: a Tuya plug (French names, kW, a diagnostic power first),
// an ESPHome controller (a running sensor, a tank in %, a pressure in psi, a flow in m³/h), a hidden or other-device
// entity never taken.
test("discovery on varied devices: Tuya plug, ESPHome controller, hidden and foreign entities", () => {
  const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
  const h = {
    ...makeHass(),
    devices: { tuya: { name: "Prise pompe de relevage" }, esp: { name: "Booster" } },
    entities: {
      "switch.prise_pompe_relevage": { device_id: "tuya", platform: "tuya" },
      "sensor.prise_pompe_relevage_puissance_diag": { device_id: "tuya", platform: "tuya", entity_category: "diagnostic" },
      "sensor.prise_pompe_relevage_puissance": { device_id: "tuya", platform: "tuya" },
      "sensor.prise_pompe_relevage_niveau_cuve": { device_id: "tuya", platform: "tuya", hidden: true },
      "sensor.other_level": { device_id: "other", platform: "zha" },
      "binary_sensor.booster_running": { device_id: "esp", platform: "esphome" },
      "sensor.booster_tank": { device_id: "esp", platform: "esphome" },
      "sensor.booster_pressure": { device_id: "esp", platform: "esphome" },
      "sensor.booster_flow": { device_id: "esp", platform: "esphome" },
      "binary_sensor.booster_fault": { device_id: "esp", platform: "esphome" },
    },
    states: {
      "switch.prise_pompe_relevage": st("switch.prise_pompe_relevage", "off", { friendly_name: "Prise pompe de relevage" }),
      "sensor.prise_pompe_relevage_puissance_diag": st("sensor.prise_pompe_relevage_puissance_diag", "0.6", { device_class: "power", unit_of_measurement: "kW" }),
      "sensor.prise_pompe_relevage_puissance": st("sensor.prise_pompe_relevage_puissance", "0.6", { device_class: "power", unit_of_measurement: "kW" }),
      "sensor.prise_pompe_relevage_niveau_cuve": st("sensor.prise_pompe_relevage_niveau_cuve", "40", { unit_of_measurement: "%", friendly_name: "Niveau cuve" }),
      "sensor.other_level": st("sensor.other_level", "10", { unit_of_measurement: "%", friendly_name: "Pit level" }),
      "binary_sensor.booster_running": st("binary_sensor.booster_running", "unavailable", { device_class: "running", friendly_name: "Booster running" }),
      "sensor.booster_tank": st("sensor.booster_tank", "70", { unit_of_measurement: "%", friendly_name: "Booster tank" }),
      "sensor.booster_pressure": st("sensor.booster_pressure", "45", { unit_of_measurement: "psi", friendly_name: "Booster pressure" }),
      "sensor.booster_flow": st("sensor.booster_flow", "1.2", { unit_of_measurement: "m³/h", friendly_name: "Booster flow" }),
      "binary_sensor.booster_fault": st("binary_sensor.booster_fault", "off", { device_class: "problem", friendly_name: "Booster fault" }),
    },
  };
  const t = wp.wpFind(h, "switch.prise_pompe_relevage");
  // The primary power sensor before the diagnostic one; the hidden level and the other device's level are not taken.
  assert.deepEqual([t.switch, t.power, t.level, t.alarm], ["switch.prise_pompe_relevage", "sensor.prise_pompe_relevage_puissance", undefined, undefined]);
  assert.equal(wp.wpKindOf("Prise pompe de relevage"), "sump");
  const e = wp.wpFind(h, "binary_sensor.booster_running");
  // An unavailable running sensor stays the pump's entity; the others found by unit and class.
  assert.deepEqual([e.running, e.level, e.pressure, e.flow, e.alarm, e.switch], ["binary_sensor.booster_running", "sensor.booster_tank", "sensor.booster_pressure", "sensor.booster_flow", "binary_sensor.booster_fault", undefined]);
  // Pumps of the home: the switch first, then the running sensor; nothing without a pump name.
  const found = json(wp.wpPumps(h));
  assert.equal(found[0], "switch.prise_pompe_relevage");
  assert.ok(found.indexOf("binary_sensor.booster_running") > 0);
  assert.ok(!found.includes("sensor.other_level"));
});

test("mini card size: two rows with the banner, one without", () => {
  const Mini = cards["water-pump-mini-card"];
  const m = new Mini();
  m._config = { entity: "switch.sump_pump" };
  assert.equal(m.getCardSize(), 2);
  m._config = { entity: "switch.sump_pump", illustration: false };
  assert.equal(m.getCardSize(), 1);
});
