/**
 * water-pump-card / water-pump-mini-card: a pump, illustrated — a sump pump in its pit, a water pump by its well, an
 * industrial pump on its skid. Whether it pumps and for how long, the level of its pit or tank with its start, stop
 * and alarm marks, its runs of the last 24 hours, its cycles, pressure and flow, and its alerts.
 * https://github.com/juju35/ha-water-pump-card
 */

// One loop of the illustrations' animations (s): water runs in the pipe, the motor's fan turns, drops fall.
const WP_LOOP = 2.4;
const WP_HISTORY_MS = 5 * 60000;
const WP_DAY_MS = 24 * 3600000;
const WP_KIND_ICONS = { sump: "mdi:pump", well: "mdi:water-pump", industrial: "mdi:pump", pump: "mdi:water-pump" };
const WP_ROOM = { sump: "pit", well: "garden", industrial: "plant", pump: "garden" };

// The status pill's place (the same rule on every ha-* card): beside the title when the whole title and the pill's
// whole label fit there, else under the subtitle, else its dot alone on the title row.
const wpPlacePill = (head, row, ground) => {
  if (!head) return;
  head.removeAttribute("data-wrap");
  head.removeAttribute("data-dot");
  const pill = row.querySelector(":scope > .bpill, :scope > .pill");
  const text = pill?.querySelector(".bpt, .pt");
  if (!text?.getBoundingClientRect || text.getBoundingClientRect().width <= 1) return;
  const name = row.querySelector(".title");
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const title = name ? (name.scrollWidth > name.clientWidth ? name.scrollWidth : name.getBoundingClientRect().width) + gap : 0;
  if (title + pill.getBoundingClientRect().width <= row.getBoundingClientRect().width + 0.5) return;
  head.setAttribute("data-wrap", "");
  const box = row.parentElement.getBoundingClientRect();
  const frame = head.getBoundingClientRect();
  const out = ground && (box.bottom > ground.getBoundingClientRect().top + 0.5 || box.top < frame.top - 0.5);
  if (text.scrollWidth > text.clientWidth + 0.5 || out) {
    head.removeAttribute("data-wrap");
    head.setAttribute("data-dot", "");
  }
};

// A duration in ms, short: 45 s, 18 min, 1 h 05.
const wpDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${String(m % 60).padStart(2, "0")}` : `${Math.floor(h / 24)} d`;
};

// ── Illustration ─────────────────────────────────────────────────────────────
// The banner's scene, 200 × 80, drawn to its right edge. `on`: pumping, `moving`: animated, `share`: the level (0 to 1,
// null when unknown), `alarm`: the alarm level, `alert`: drawn in red, `pressure`: the gauge's needle (0 to 1).
const wpFlow = (d, moving, color = "#7cc4ff") =>
  `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-dasharray="5 5" stroke-linecap="round">${moving ? `<animate attributeName="stroke-dashoffset" from="10" to="0" dur="${WP_LOOP / 4}s" repeatCount="indefinite"/>` : ""}</path>`;

const wpScene = ({ kind, on, moving, share, alarm, alert, pressure, night, dx = 0 }) => {
  const steel = night ? "#7f8fa0" : "#8c9aa8";
  const water = "#5aa9e6";
  const g = (inner) => `<g${dx ? ` transform="translate(${-dx} 0)"` : ""}>${inner}</g>`;
  if (kind === "sump") {
    const [wall, soil, stone] = night ? ["#23292f", "#3a3026", "#4a3f33"] : ["#eef2f5", "#e2d4c2", "#c9b49a"];
    const top = 32;
    const bottom = 78;
    const lvl = share == null ? 0.4 : Math.min(1, Math.max(0, share));
    const wy = bottom - (bottom - top - 4) * lvl;
    const ay = alarm != null ? bottom - (bottom - top - 4) * alarm : null;
    const bubbles = moving
      ? [0, 1, 2]
          .map((k) => `<circle cx="${130 + k * 6}" cy="70" r="1.4" fill="#fff" opacity="0"><animate attributeName="cy" from="70" to="${wy + 2}" dur="${WP_LOOP / 2}s" begin="${(k * WP_LOOP) / 6}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.8;0" dur="${WP_LOOP / 2}s" begin="${(k * WP_LOOP) / 6}s" repeatCount="indefinite"/></circle>`)
          .join("")
      : "";
    return `<rect width="200" height="80" fill="${wall}"/><rect y="24" width="200" height="56" fill="${soil}"/><rect y="24" width="200" height="2" fill="${night ? "#55483a" : "#b9a68a"}"/>
      ${[18, 44, 70, 186, 30, 58].map((x, i) => `<circle cx="${x}" cy="${38 + (i % 3) * 14}" r="${2 + (i % 2)}" fill="${stone}"/>`).join("")}
      ${g(`<rect x="100" y="${top}" width="80" height="${bottom - top + 2}" rx="5" fill="${night ? "#2c333b" : "#d1d6db"}" stroke="${night ? "#4a535d" : "#a9b1b9"}" stroke-width="2"/>
      <rect x="104" y="${wy.toFixed(1)}" width="72" height="${(bottom - wy).toFixed(1)}" rx="3" fill="${water}" fill-opacity=".85"/>
      <path d="M104 ${(wy + 3).toFixed(1)}q9-3 18 0t18 0 18 0 18 0" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" fill="none"/>
      ${ay != null ? `<line x1="100" y1="${ay.toFixed(1)}" x2="180" y2="${ay.toFixed(1)}" stroke="#e5484d" stroke-width="1.5" stroke-dasharray="4 3"/>` : ""}
      ${bubbles}<rect x="118" y="56" width="24" height="22" rx="5" fill="${night ? "#2a3440" : "#3b4a5a"}"/><rect x="122" y="60" width="16" height="4" rx="2" fill="#7f8fa0"/>
      <path d="M130 56V12h50" stroke="${steel}" stroke-width="6" fill="none" stroke-linejoin="round"/>${on ? wpFlow("M130 52V14h48", moving) : ""}
      <path d="M160 ${(wy + 8).toFixed(1)}v-8" stroke="#3b4a5a" stroke-width="1.6"/><circle cx="160" cy="${(wy - 1).toFixed(1)}" r="4.5" fill="#ffd166" stroke="#3b4a5a" stroke-width="1.5"/>`)}
      ${alert ? `<g transform="translate(${190 - dx} 14)"><circle r="8" fill="#e5484d"/><path d="M0 -4v4.5M0 3.5v.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></g>` : ""}`;
  }
  if (kind === "industrial") {
    const wall = night ? "#1f242a" : "#e4e7eb";
    const blades = [0, 1, 2, 3].map((k) => `<path d="M168 52l0-9" stroke="${night ? "#c9d1d8" : "#5b6470"}" stroke-width="3" stroke-linecap="round" transform="rotate(${k * 90} 168 52)"/>`).join("");
    return `<rect width="200" height="80" fill="${wall}"/><path d="M0 16h200M0 24h200" stroke="${night ? "#3a424b" : "#c4ccd3"}" stroke-width="5"/>
      ${g(`<rect x="88" y="70" width="104" height="8" rx="1" fill="${night ? "#3a3f45" : "#6b7680"}"/>
      <path d="M70 46h28" stroke="${steel}" stroke-width="8"/>${on ? wpFlow("M72 46h24", moving) : ""}
      <circle cx="110" cy="50" r="16" fill="#2b6cb0"/><path d="M110 50m-9 0a9 9 0 1 1 9 9" stroke="#9cc8f2" stroke-width="2.4" fill="none"/>
      <path d="M110 34V8h-40" stroke="${steel}" stroke-width="7" fill="none" stroke-linejoin="round"/>${on ? wpFlow("M110 30V10H72", moving) : ""}
      <rect x="126" y="40" width="8" height="20" fill="#3b4a5a"/><rect x="134" y="34" width="34" height="32" rx="6" fill="${night ? "#59636e" : "#9aa7b4"}"/>
      ${[0, 1, 2, 3, 4].map((k) => `<path d="M${138 + k * 6} 36v28" stroke="${night ? "#4a535d" : "#7d8a97"}" stroke-width="1.6"/>`).join("")}
      <circle cx="168" cy="52" r="12" fill="${night ? "#3a424b" : "#c9d1d8"}" stroke="${night ? "#59636e" : "#8c9aa8"}" stroke-width="2"/>
      <g>${blades}${moving ? `<animateTransform attributeName="transform" type="rotate" from="0 168 52" to="360 168 52" dur="${WP_LOOP / 4}s" repeatCount="indefinite"/>` : ""}</g>
      <circle cx="148" cy="30" r="3" fill="${on ? "#34d399" : "#59616b"}"/>`)}
      ${alert ? `<g transform="translate(${190 - dx} 14)"><circle r="8" fill="#e5484d"/><path d="M0 -4v4.5M0 3.5v.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></g>` : ""}`;
  }
  // A water pump by its well: the stone well, the pump with its pressure gauge, the pipe to the tap.
  const [sky1, sky2, grass] = night ? ["#0d1a30", "#1c2f52", "#1f3a2a"] : ["#d6ebfa", "#eaf4fd", "#a9d18e"];
  const angle = -120 + 240 * Math.min(1, Math.max(0, pressure ?? (on ? 0.55 : 0.4)));
  const drops = on
    ? [0, 1, 2]
        .map((k) => `<circle cx="190" cy="${moving ? 40 : 46 + k * 9}" r="1.8" fill="#5aa9e6"${moving ? ' opacity="0"' : ""}>${moving ? `<animate attributeName="cy" from="40" to="76" dur="${WP_LOOP / 3}s" begin="${(k * WP_LOOP) / 9}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" dur="${WP_LOOP / 3}s" begin="${(k * WP_LOOP) / 9}s" repeatCount="indefinite"/>` : ""}</circle>`)
        .join("")
    : "";
  return `<defs><linearGradient id="wpsky" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${sky2}"/><stop offset="1" stop-color="${sky1}"/></linearGradient></defs>
    <rect width="200" height="80" fill="url(#wpsky)"/>${night ? [20, 52, 84, 120].map((x, i) => `<circle cx="${x}" cy="${8 + (i % 2) * 8}" r="1" fill="#fff" opacity=".8"/>`).join("") : '<circle cx="30" cy="16" r="7" fill="#ffd166"/>'}
    <path d="M0 80V62q40-12 90-4t110-4v26z" fill="${grass}"/>
    ${g(`<path d="M70 44h40v36H70z" fill="${night ? "#5a554e" : "#b8b2a8"}"/><path d="M70 54h40M70 66h40M84 44v10M98 54v12M84 66v14" stroke="${night ? "#48443e" : "#9c958a"}" stroke-width="1.5"/>
    <path d="M66 44h48l-4-10H70z" fill="${night ? "#5a3a26" : "#8c5a3c"}"/>
    <path d="M90 44V26h36" stroke="${steel}" stroke-width="5" fill="none"/>${on ? wpFlow("M90 42V28h34", moving) : ""}
    <rect x="124" y="38" width="44" height="32" rx="8" fill="#2b6cb0"/><circle cx="138" cy="54" r="9" fill="#1f4f86"/><circle cx="138" cy="54" r="3.5" fill="#9cc8f2"/>
    <rect x="154" y="44" width="8" height="20" rx="2" fill="#1f4f86"/>
    <circle cx="146" cy="26" r="9" fill="#fff" stroke="#3b4a5a" stroke-width="2"/><path d="M146 26l0-6" stroke="#e5484d" stroke-width="2" stroke-linecap="round" transform="rotate(${angle.toFixed(0)} 146 26)"/>
    <path d="M168 52h12v-16h10" stroke="${steel}" stroke-width="5" fill="none"/>${on ? wpFlow("M170 52h8v-14h10", moving) : ""}<path d="M190 36v4" stroke="${steel}" stroke-width="4"/>${drops}`)}
    ${alert ? `<g transform="translate(${190 - dx} 14)"><circle r="8" fill="#e5484d"/><path d="M0 -4v4.5M0 3.5v.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></g>` : ""}`;
};

const wpIcon = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const WP_SVG = {
  cycle: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  drop: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/>',
  flow: '<path d="M3 8c3-3 6 3 9 0s6 3 9 0M3 14c3-3 6 3 9 0s6 3 9 0"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  power: '<path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  ok: '<path d="M5 12l5 5 9-10"/>',
  alert: '<path d="M12 3l10 18H2zM12 10v5M12 18v.5"/>',
  runs: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/>',
};

// ── Card ─────────────────────────────────────────────────────────────────────
class WaterPumpCard extends RcCard {
  static tag = "water-pump-card";
  static i18n = WP_I18N;
  static defaults = { illustration: true, illustration_theme: "auto", kind: "auto", threshold: 20, show_runs: true, animations: true, show_controls: true };

  static getStubConfig(hass) {
    const entity = hass ? wpPumps(hass)[0] : undefined;
    return entity ? { entity } : {};
  }

  getCardSize() {
    return 6;
  }

  _cols() {
    return 3;
  }

  _entityId() {
    const c = this._config;
    if (c.entity) return c.entity;
    const h = this._hass;
    return rcMemo((this._memo ||= {}), "pumps", [h.entities], () => wpPumps(h))[0];
  }

  _fmt(v, digits) {
    try {
      return new Intl.NumberFormat(this._lang(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    } catch {
      return v.toFixed(digits);
    }
  }

  // The running history of the last 24 hours, fetched once and again every WP_HISTORY_MS.
  _history(id) {
    const h = this._hass;
    if (!id || typeof h.callWS !== "function") return null;
    const now = Date.now();
    const hist = this._hist;
    if (hist?.id === id && (hist.pending || now - hist.at < WP_HISTORY_MS)) return hist.rows;
    this._hist = { id, at: now, pending: true, rows: hist?.id === id ? hist.rows : null };
    Promise.resolve(h.callWS({ type: "history/history_during_period", start_time: new Date(now - WP_DAY_MS).toISOString(), entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false }))
      .then((res) => {
        if (this._hist?.id !== id) return;
        this._hist = { id, at: Date.now(), rows: res?.[id] || [] };
        this._sig = null;
        this._render();
      })
      .catch(() => {
        if (this._hist?.id === id) this._hist = { id, at: Date.now(), rows: [] };
      });
    return this._hist.rows;
  }

  _collect() {
    const h = this._hass;
    const c = this._config;
    const id = this._entityId();
    const e = rcMemo((this._memo ||= {}), "find", [id, c.level, c.pressure, c.flow, c.volume, c.alarm, h.entities, h.devices], () =>
      wpFind(h, id, { level: c.level, pressure: c.pressure, flow: c.flow, volume: c.volume, alarm: c.alarm }),
    );
    const st = (role) => (e[role] && h.states[e[role]] && !rcUnavailable(h.states[e[role]]) ? h.states[e[role]] : undefined);
    const ent = id ? h.states[id] : undefined;
    const dev = h.devices?.[wpDeviceOf(h, id || "")];
    const name = c.title || dev?.name_by_user || dev?.name || ent?.attributes.friendly_name || this._t("title");
    const kind = c.kind && c.kind !== "auto" && WP_KINDS.includes(c.kind) ? c.kind : wpKindOf([name, dev?.model, id].filter(Boolean).join(" "));
    const threshold = Number(c.threshold) >= 0 ? Number(c.threshold) : 20;
    // What says the pump runs: its running sensor, else its power, else its switch.
    const signal = e.running || e.power || e.switch;
    const watts = (() => {
      const p = st("power");
      const v = wpNum(p);
      return v == null ? null : p.attributes.unit_of_measurement === "kW" ? v * 1000 : v;
    })();
    const onOf = (s) => (signal === e.power ? Number.parseFloat(s) * (h.states[signal]?.attributes.unit_of_measurement === "kW" ? 1000 : 1) >= threshold : s === "on");
    const sig = signal ? h.states[signal] : undefined;
    const running = !!sig && !rcUnavailable(sig) && onOf(sig.state);
    const now = Date.now();
    const midnight = new Date(now).setHours(0, 0, 0, 0);
    const rows = this._history(signal);
    const points = rows ? [...wpPoints(rows, onOf).filter((p) => p.t >= now - WP_DAY_MS), ...(sig && !rcUnavailable(sig) ? [{ t: now, on: running }] : [])] : null;
    const runs = points ? wpRuns(points, now) : [];
    const last = runs.at(-1);
    const current = running && last && now - last.end < 1000 ? last : null;
    const today = runs.filter((r) => r.end > midnight).map((r) => ({ start: Math.max(r.start, midnight), end: r.end }));
    const levelSt = st("level");
    const level = wpNum(levelSt);
    const share = level == null ? null : Math.min(100, Math.max(0, level)) / 100;
    const alarmAt = c.level_alarm != null && c.level_alarm !== "" ? Number(c.level_alarm) : share != null && kind === "sump" ? 85 : null;
    const maxRun = c.max_run != null && c.max_run !== "" ? Number(c.max_run) : WP_MAX_RUN[kind];
    const alarmSt = st("alarm");
    const alerts = [];
    if (alarmSt?.state === "on") alerts.push(this._t("alert_alarm"));
    if (share != null && alarmAt != null && level >= alarmAt) alerts.push(`${this._t("alert_level")} ${Math.round(level)} %`);
    if (current && maxRun > 0 && now - current.start > maxRun * 60000) alerts.push(this._t("alert_long", { d: wpDur(now - current.start) }));
    const offline = !ent || (rcUnavailable(ent) && !(sig && !rcUnavailable(sig)));
    const state = offline ? "offline" : alerts.length ? "alert" : running ? "running" : "idle";
    const pr = st("pressure");
    const fl = st("flow");
    const vo = st("volume");
    return {
      id,
      none: !id,
      ids: e,
      state,
      running,
      kind,
      name,
      // The kind without its examples in brackets: "Water pump", not "Water pump (well, booster)".
      sub: [h.areas?.[dev?.area_id ?? h.entities?.[id]?.area_id]?.name, this._t(`k_${kind}`).replace(/\s*\(.*\)\s*$/, "")].filter(Boolean).join(" · "),
      raw: ent ? h.formatEntityState?.(ent) || ent.state : "",
      share,
      level,
      levelStart: c.level_start != null && c.level_start !== "" ? Number(c.level_start) : null,
      levelStop: c.level_stop != null && c.level_stop !== "" ? Number(c.level_stop) : null,
      alarmAt,
      maxRun,
      alerts,
      alarmKnown: !!alarmSt || alarmAt != null || maxRun > 0,
      watts,
      since: current ? current.start : null,
      lastRun: last && !current ? last : null,
      runs,
      history: !!points,
      cycles: today.length,
      avg: today.length ? today.reduce((s, r) => s + r.end - r.start, 0) / today.length : null,
      runtime: today.reduce((s, r) => s + r.end - r.start, 0),
      pressure: pr ? { v: wpNum(pr), u: pr.attributes.unit_of_measurement || "bar" } : null,
      flow: fl ? { v: wpNum(fl), u: fl.attributes.unit_of_measurement || "L/min" } : null,
      volume: vo ? { v: wpNum(vo), u: vo.attributes.unit_of_measurement || "L" } : null,
      switchId: e.switch && h.states[e.switch] && !rcUnavailable(h.states[e.switch]) ? e.switch : null,
      switchOn: h.states[e.switch]?.state === "on",
    };
  }

  _dark() {
    return !!this._hass.themes?.darkMode;
  }

  // Night picture: forced by illustration_theme, else Home Assistant's dark theme alone (a light theme keeps the day
  // picture after sunset).
  _night() {
    const theme = this._config.illustration_theme;
    if (theme === "night" || theme === "day") return theme === "night";
    return this._dark();
  }

  _animate() {
    if (this._config.animations === false) return false;
    try {
      return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return true;
    }
  }

  _icon(m) {
    if (m.state === "offline") return "mdi:lan-disconnect";
    if (m.state === "alert") return "mdi:alert-circle-outline";
    return WP_KIND_ICONS[m.kind] || "mdi:water-pump";
  }

  // The line under the big reading: how long it has pumped, or how long ago it last did.
  _line(m) {
    const now = Date.now();
    if (m.state === "offline") return "";
    if (m.running && m.since) return this._t("running_for", { d: wpDur(now - m.since) });
    if (m.running) return this._t("st_running");
    if (m.lastRun) return this._t("last_run", { d: wpDur(now - m.lastRun.end) });
    return m.history ? this._t("no_run") : this._t(`st_${m.state === "alert" ? "idle" : m.state}`);
  }

  _banner(m, sub, night, pill = "") {
    const c = this._config;
    const nav = c.navigation_path;
    const dx = this._addZoom && c.zoom ? 18 : 0;
    const room = WP_ROOM[m.kind] || "garden";
    const chip = pill ? `<span class="bpill" title="${rcEsc(m.raw || pill)}" aria-label="${rcEsc(pill)}"><span class="bdot"></span><span class="bpt">${rcEsc(pill)}</span></span>` : "";
    const scene = wpScene({
      kind: m.kind,
      on: m.running,
      moving: this._animate() && m.running,
      share: m.share,
      alarm: m.alarmAt != null ? m.alarmAt / 100 : null,
      alert: m.state === "alert",
      pressure: m.pressure?.v != null ? m.pressure.v / 6 : null,
      night,
      dx,
    });
    return `
      <div class="banner r-${room}${night ? " night" : ""}">
        <div class="head${nav ? " nav" : ""}"${nav ? ' role="link" tabindex="0"' : ""}${m.sub ? ` title="${rcEsc(m.sub)}"` : ""}>
          <div class="badge"><ha-icon icon="${this._icon(m)}"></ha-icon></div>
          <div class="tt"><div class="trow"><div class="title">${rcEsc(m.name)}</div>${chip}</div>${sub}</div>
        </div>
        <svg class="room" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax slice" role="img" aria-label="${rcEsc(`${m.name} · ${pill}`)}">${scene}</svg>
        <div class="ground"></div>
      </div>`;
  }

  _fitPill() {
    for (const row of this.shadowRoot?.querySelectorAll?.(".trow") || []) {
      const banner = row.closest(".banner");
      wpPlacePill(banner || row.closest(".head"), row, banner?.querySelector(".ground"));
    }
  }

  connectedCallback() {
    super.connectedCallback?.();
    // The durations shown (running for, last run, the 24-hour strip) move on with time: drawn again every minute.
    this._tick ??= setInterval(() => {
      this._sig = null;
      this._render();
    }, 60000);
    if (typeof ResizeObserver !== "function") return;
    this._resize ??= new ResizeObserver((entries) => {
      const w = Math.round(entries.at(-1).contentRect.width);
      if (w === this._fitWidth) return;
      this._fitWidth = w;
      cancelAnimationFrame(this._fitFrame);
      this._fitFrame = requestAnimationFrame(() => this._fitPill());
    });
    this._resize.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this._resize?.disconnect();
    this._fitWidth = undefined;
    if (this._fitFrame) cancelAnimationFrame(this._fitFrame);
    clearInterval(this._tick);
    this._tick = undefined;
  }

  // The level of the pit or tank: a vertical gauge with its start, stop and alarm marks, labelled beside it.
  _gauge(m) {
    if (m.share == null) return "";
    const pct = Math.round(m.share * 100);
    const mark = (v, cls) => (v != null ? `<span class="mk ${cls}" style="bottom:${Math.min(100, Math.max(0, v))}%"></span>` : "");
    const labels = [
      [m.alarmAt, "al", "lv_alarm"],
      [m.levelStart, "st", "lv_start"],
      [m.levelStop, "sp", "lv_stop"],
    ]
      .filter(([v]) => v != null)
      .sort((a, b) => b[0] - a[0])
      .map(([v, cls, key]) => `<span class="lb ${cls}">${rcEsc(this._t(key, { p: `${Math.round(v)} %` }))}</span>`)
      .join("");
    return `<div class="gauge" role="img" aria-label="${rcEsc(`${this._t("level")} ${pct} %`)}"><span class="wt" style="height:${pct}%"></span>${mark(m.alarmAt, "al")}${mark(m.levelStart, "st")}${mark(m.levelStop, "sp")}</div>${labels ? `<div class="lbs">${labels}</div>` : ""}`;
  }

  _readout(m) {
    const c = this._config;
    const big = m.share != null ? [String(Math.round(m.level)), "%"] : m.watts != null && m.running ? rcWatts(m.watts, this._lang()).split(" ") : [this._t(m.running ? "st_running" : m.state === "offline" ? "st_offline" : "st_idle"), ""];
    const power =
      m.switchId && c.show_controls !== false
        ? `<button class="pw${m.switchOn ? " on" : ""}" data-k="power" aria-pressed="${m.switchOn}" aria-label="${rcEsc(this._t(m.switchOn ? "stop" : "start"))}" title="${rcEsc(this._t(m.switchOn ? "stop" : "start"))}">${wpIcon(WP_SVG.power)}</button>`
        : "";
    const extra = m.running && m.watts != null && m.share != null ? `<span class="rx">${rcEsc(rcWatts(m.watts, this._lang()))}</span>` : "";
    return `<div class="rd">${this._gauge(m)}
        <div class="rr">
          <div class="rt"><button class="rv" title="${rcEsc(m.raw)}"><span class="big">${rcEsc(big[0])}</span><span class="u">${rcEsc(big[1])}</span></button>${power}</div>
          ${this._line(m) ? `<div class="rl">${rcEsc(this._line(m))}</div>` : ""}${extra}
        </div>
      </div>`;
  }

  // The runs of the last 24 hours, one bar each on a day-long strip.
  _runs(m) {
    if (this._config.show_runs === false || !m.history || m.state === "offline") return "";
    const now = Date.now();
    const from = now - WP_DAY_MS;
    const x = (t) => ((Math.max(t, from) - from) / WP_DAY_MS) * 100;
    const bars = m.runs
      .filter((r) => r.end > from)
      .map((r) => `<span class="run" style="left:${x(r.start).toFixed(2)}%;width:max(3px, ${(x(r.end) - x(r.start)).toFixed(2)}%)"></span>`)
      .join("");
    return `<div class="rn"><div class="sh">${wpIcon(WP_SVG.runs)}<span>${rcEsc(this._t("runs_24h"))}</span></div>
      <div class="strip" role="img" aria-label="${rcEsc(this._t("runs_24h"))}">${bars}</div>
      <div class="gx"><span>−24 h</span><span>−12 h</span><span>${rcEsc(this._t("now"))}</span></div></div>`;
  }

  // Three tiles: the pressure and the flow when the pump reports them, then today's cycles, their average, the volume
  // pumped or the runtime.
  _tileList(m) {
    const num = (o, d = 1) => (o?.v != null ? [this._fmt(o.v, d), o.u] : null);
    const all = [
      ["gauge", "t_pressure", num(m.pressure)],
      ["flow", "t_flow", num(m.flow, 0)],
      ["cycle", "t_cycles", m.history ? [String(m.cycles), ""] : null],
      ["clock", "t_avg", m.avg ? [wpDur(m.avg), ""] : null],
      ["drop", "t_volume", num(m.volume, m.volume?.u === "m³" ? 2 : 0)],
      ["clock", "t_runtime", m.history ? [wpDur(m.runtime), ""] : null],
      ["bolt", "t_power", m.watts != null ? rcWatts(m.watts, this._lang()).split(" ") : null],
    ];
    return m.state === "offline" ? [] : all.filter((t) => t[2]).slice(0, 3);
  }

  _tile([icon, label, [value, unit]]) {
    return `<div class="xt"><span class="xh">${wpIcon(WP_SVG[icon])}<span class="xl">${rcEsc(this._t(label))}</span></span><span class="xv">${rcEsc(value)}${unit ? `<small>${rcEsc(unit)}</small>` : ""}</span></div>`;
  }

  _chips(m) {
    if (m.state === "offline") return "";
    const out = [];
    for (const a of m.alerts) out.push(`<span class="chip bad">${wpIcon(WP_SVG.alert)}<span>${rcEsc(a)}</span></span>`);
    if (!m.alerts.length && m.alarmKnown) out.push(`<span class="chip good">${wpIcon(WP_SVG.ok)}<span>${rcEsc(this._t("ok"))}</span></span>`);
    if (m.maxRun > 0) out.push(`<span class="chip">${wpIcon(WP_SVG.clock)}<span>${rcEsc(this._t("max_run", { d: `${m.maxRun} min` }))}</span></span>`);
    return out.join("");
  }

  _draw(m) {
    const c = this._config;
    const banner = c.illustration !== false;
    const night = banner && this._night();
    const tiles = this._tileList(m);
    const minute = Math.floor(Date.now() / 60000);
    const parts = [m.none, m.state, m.kind, m.name, m.sub, m.level, m.watts, m.alerts, m.running, tiles, m.runs, m.switchId, m.switchOn, m.pressure, banner, night, this._dark(), minute];
    if (!this._changed(parts)) return;
    const pill = m.none ? "" : this._t(`st_${m.state}`);
    const sub = m.sub ? `<div class="subt">${rcEsc(m.sub)}</div>` : "";
    const head = banner
      ? this._banner(m, sub, night, pill)
      : `
      <div class="head${c.navigation_path ? " nav" : ""}"${c.navigation_path ? ' role="link" tabindex="0"' : ""}>
        <div class="badge"><ha-icon icon="${this._icon(m)}"></ha-icon></div>
        <div class="tt"><div class="trow"><div class="title">${rcEsc(m.name)}</div>${m.none ? "" : `<span class="pill" title="${rcEsc(m.raw || pill)}" aria-label="${rcEsc(pill)}"><span class="pt">${rcEsc(pill)}</span></span>`}</div>${sub}</div>
      </div>`;
    if (m.none) {
      this._paint("idle", `${head}<div class="none">${rcEsc(this._t("no_pump"))}</div>`, "");
      this._fitPill();
      return;
    }
    this._paint(m.state, head + this._readout(m), tiles.map((t) => this._tile(t)).join(""));
    this._fitPill();
  }

  _afterGrid() {
    const m = this._items;
    if (!m || m.none) return "";
    const chips = this._chips(m);
    return `${this._runs(m)}${chips ? `<div class="chips">${chips}</div>` : ""}`;
  }

  _bindAfter(root) {
    const m = this._items;
    if (!m || m.none) return;
    root.querySelector(".rv")?.addEventListener("click", () => rcMoreInfo(this, m.ids.level || m.id));
    root.querySelector(".pw")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      rcCall(this._hass, m.switchId.split(".")[0], m.switchOn ? "turn_off" : "turn_on", { entity_id: m.switchId });
    });
  }

  static styles = `
    ha-card.lvl-running { --c: #2b8be6; }
    ha-card.lvl-alert   { --c: var(--rc-alert); }
    ha-card.lvl-idle, ha-card.lvl-offline { --c: var(--rc-idle); }
    .tt { flex: 1 1 0; min-width: 5ch; display: flex; flex-direction: column; }
    .tt .title { flex: none; }
    .subt { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    :host([hide-title]) .head .tt { visibility: hidden; }
    .none { margin-top: 10px; padding: 12px; border-radius: 12px; font-size: 13px; color: var(--secondary-text-color);
            background: var(--secondary-background-color, rgba(127,127,127,.08)); }
    /* The level gauge, its marks' labels, then the reading. */
    .rd { display: flex; align-items: stretch; gap: 12px; margin-top: 12px; }
    .gauge { position: relative; flex: none; width: 44px; height: 140px; border-radius: 12px; overflow: hidden;
             background: var(--secondary-background-color, rgba(127,127,127,.12)); }
    .gauge .wt { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #7fbcf0, #2b8be6); transition: height .4s ease; }
    .lvl-alert .gauge .wt { background: linear-gradient(180deg, #7fbcf0, #2b8be6); }
    .gauge .mk { position: absolute; left: 0; right: 0; height: 0; border-top: 2px solid rgba(255,255,255,.9); }
    .gauge .mk.al { border-top: 2px dashed var(--rc-alert); }
    .lbs { flex: none; display: flex; flex-direction: column; justify-content: space-around; padding: 6px 0; font-size: 11px; color: var(--secondary-text-color); }
    .lbs .al { color: color-mix(in srgb, var(--rc-alert) 70%, var(--primary-text-color, #212121)); }
    .rr { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
    .rt { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .rv { all: unset; cursor: pointer; display: flex; align-items: baseline; gap: 4px; min-width: 0; border-radius: 10px; }
    .rv:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
    .big { font-size: 40px; font-weight: 300; line-height: 1; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .u { font-size: 16px; color: var(--secondary-text-color); }
    .rl { font-size: 14px; font-weight: 500; color: color-mix(in srgb, var(--c) 55%, var(--primary-text-color, #212121)); }
    .lvl-idle .rl, .lvl-offline .rl { color: var(--secondary-text-color); }
    .rx { font-size: 13px; color: var(--secondary-text-color); }
    .pw { all: unset; box-sizing: border-box; flex: none; cursor: pointer; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center;
          color: var(--secondary-text-color); background: var(--secondary-background-color, rgba(127,127,127,.12)); }
    .pw.on { color: color-mix(in srgb, var(--c) 75%, var(--primary-text-color, #212121)); background: color-mix(in srgb, var(--c) 18%, transparent); }
    .pw:hover { background: color-mix(in srgb, var(--c) 26%, transparent); }
    .pw:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
    .pw svg { width: 24px; height: 24px; }
    .grid { margin-top: 12px; gap: 8px; }
    .xt { min-width: 0; border-radius: 12px; padding: 9px 11px; display: flex; flex-direction: column; gap: 5px;
          background: var(--secondary-background-color, rgba(127,127,127,.08)); }
    .xh { display: flex; align-items: center; gap: 6px; min-width: 0; color: #2b8be6; }
    .xh svg { flex: none; width: 15px; height: 15px; }
    .xl { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .xv { font-size: 18px; font-weight: 500; line-height: 1.15; color: var(--primary-text-color); overflow-wrap: anywhere; }
    .xv small { font-size: 12px; font-weight: 400; color: var(--secondary-text-color); margin-left: 3px; }
    @container (max-width: 300px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid > :nth-child(3):last-child { grid-column: 1 / -1; }
      .lbs { display: none; }
    }
    /* The runs of the last 24 hours. */
    .rn { margin-top: 12px; }
    .sh { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; color: var(--secondary-text-color); }
    .sh svg { width: 15px; height: 15px; flex: none; }
    .strip { position: relative; height: 18px; margin-top: 6px; border-radius: 6px; overflow: hidden; background: var(--secondary-background-color, rgba(127,127,127,.12)); }
    .run { position: absolute; top: 0; bottom: 0; background: #2b8be6; }
    .lvl-alert .run:last-child { background: var(--rc-alert); }
    .gx { display: flex; justify-content: space-between; font-size: 10px; color: var(--secondary-text-color); margin-top: 2px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .chip { display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 100%; padding: 4px 10px; border-radius: 12px; font-size: 12px;
            color: var(--secondary-text-color); background: var(--secondary-background-color, rgba(127,127,127,.1)); }
    .chip.good { color: color-mix(in srgb, var(--rc-ok) 60%, var(--primary-text-color, #212121)); background: color-mix(in srgb, var(--rc-ok) 14%, transparent); }
    .chip.bad { color: color-mix(in srgb, var(--rc-alert) 60%, var(--primary-text-color, #212121)); background: color-mix(in srgb, var(--rc-alert) 14%, transparent); }
    .chip svg { flex: none; width: 13px; height: 13px; }
    .chip span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Illustrated header (banner): 90 px, the title on the wall (or sky), the pump at the right, a 10 px ground strip. */
    .banner { position: relative; display: flex; height: 90px; margin: -12px -12px 0; overflow: hidden; background: #eef2f5;
              --bt: #0d2a45; --bs: #3b5b78; --ic: color-mix(in srgb, var(--c) 85%, #10283f); --sw: min(200px, 56%); --gr: #9aa3ab; --gl: #b8c0c7; }
    .banner.r-garden { background: #eaf4fd; --gr: #7fb35c; --gl: #9ccc78; }
    .banner.r-plant { background: #e4e7eb; --gr: #8c959d; --gl: #a9b1b8; }
    .banner.night { background: #23292f; --bt: #fff; --bs: rgba(255,255,255,.78); --ic: color-mix(in srgb, var(--c) 72%, #fff); --gr: #2c3035; --gl: #3a4048; }
    .banner.night.r-garden { background: #1c2f52; --gr: #2f4a2a; --gl: #3d5c37; }
    .banner.night.r-plant { background: #1f242a; }
    .lvl-idle .banner, .lvl-offline .banner { --ic: #6b7680; }
    .lvl-idle .banner.night, .lvl-offline .banner.night { --ic: #a7b0b8; }
    .banner .head { position: relative; z-index: 1; flex: 1; min-width: 0; height: 80px; box-sizing: border-box;
                    padding: 0 calc(var(--sw) + 4px) 0 14px; flex-wrap: nowrap; }
    .banner .head::after { content: none; }
    .banner .badge { position: relative; color: var(--ic); background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px rgba(13,42,69,.12); }
    .banner.night .badge { background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
    .banner .title { color: var(--bt); }
    .banner .subt { color: var(--bs); font-size: 13px; }
    .banner .tt { min-width: 0; flex: 1 1 auto; }
    .banner .room { position: absolute; right: 0; bottom: 10px; width: var(--sw); height: calc(80px * var(--sk, 1)); }
    .banner .ground { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: var(--gr); box-shadow: inset 0 2px 0 var(--gl); }
    .banner .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; width: 24px; height: 24px; margin: 0; color: #33506b;
                    background: rgba(255,255,255,.55); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); backdrop-filter: blur(4px); }
    .banner.night .zoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
    .banner .zoom:hover { background: rgba(255,255,255,.75); color: #33506b; }
    .banner.night .zoom:hover { background: rgba(255,255,255,.22); color: #fff; }
    .trow { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .trow > .title { flex: 0 1 auto; min-width: 0; }
    .trow > .bpill, .trow > .pill { flex: none; max-width: none; }
    :host([hide-title]) .trow .title { visibility: hidden; }
    .head:has(.trow) { flex-wrap: nowrap; }
    .head:has(.trow)::after { content: none; }
    .bpill { display: inline-flex; align-items: center; gap: 4px; min-width: 0; box-sizing: border-box; overflow: hidden;
             white-space: nowrap; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; line-height: 16px;
             background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
    .banner.night .bpill { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
    .bdot { width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex: none; }
    .bpt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    [data-wrap] .trow { display: contents; }
    [data-wrap] .trow > .bpill, [data-wrap] .trow > .pill { order: 9; align-self: flex-start; max-width: 100%; margin-top: 3px; }
    .banner[data-wrap] .trow > .bpill { max-width: calc(100cqw - 80px); }
    [data-wrap] .subt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    [data-dot] .bpill { padding: 0; background: none; }
    [data-dot] .bpt, [data-dot] .trow > .pill .pt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    [data-dot] .trow > .pill { padding: 0; width: 18px; height: 18px; justify-content: center; background: none; }
    [data-dot] .trow > .pill::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
    @container (max-width: 200px) {
      .bpill { padding: 0; background: none; }
      .bpt, .trow > .pill .pt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      .trow > .pill { padding: 0; width: 18px; height: 18px; justify-content: center; background: none; }
      .trow > .pill::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
    }
    ha-card.bn { padding: 0; }
    ha-card.bn > .banner { margin: 0; --sw: min(200px, 46%); }
    @container (max-width: 420px) { .banner, ha-card.bn > .banner { --sw: 150px; --sk: .75; } }
    @container (max-width: 340px) { .banner, ha-card.bn > .banner { --sw: 112px; --sk: .62; } }
    @container (max-width: 260px) { .banner, ha-card.bn > .banner { --sw: 70px; --sk: .5; } }
    .banner .rs { display: flex; flex-wrap: wrap; gap: 4px; height: 20px; margin: 3px 0 0 -2px; min-width: 0; overflow: hidden; }
    .banner .r { flex: none; line-height: 20px; padding: 0 7px; color: var(--bt); background: rgba(255,255,255,.62); }
    .banner .r.pill { color: color-mix(in srgb, var(--c) 60%, #10283f); background: rgba(255,255,255,.78); }
    .banner.night .r { background: rgba(10,20,40,.4); }
    .banner.night .r.pill { color: color-mix(in srgb, var(--c) 45%, #fff); background: rgba(10,20,40,.55); }
  `;
}

// ── Editor ───────────────────────────────────────────────────────────────────
const wpSchema = (booleans) => (lang) => [
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

const WP_HELPERS = ["entity", "title", "level", "alarm", "threshold", "max_run", "zoom", "language"];

const WaterPumpCardEditor = rcEditor({
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

// ── Mini card ────────────────────────────────────────────────────────────────
// The pump on its banner: the state as the status pill, the level and the run as chips (the alerts first); the zoom
// button opens the full card in place.
class WaterPumpMiniCard extends rcMini(WaterPumpCard, "water-pump-mini-card", ".r { --t: var(--c); } .r.dim { --t: var(--rc-idle); }") {
  getCardSize() {
    return this._zoomed ? super.getCardSize() : 1;
  }

  _drawMini(m) {
    const banner = this._config.illustration !== false;
    const night = banner && this._night();
    const minute = Math.floor(Date.now() / 60000);
    if (!this._changed(["mini", m.state, m.level, m.watts, m.alerts, m.running, m.kind, m.name, m.sub, banner, night, this._dark(), minute])) return;
    const chip = (text, dim) => `<button class="r pill${dim ? " dim" : ""}" data-id="${rcEsc(m.ids.level || m.id || "")}" title="${rcEsc(text)}"><span>${rcEsc(text)}</span></button>`;
    const rest = [...m.alerts, m.share != null ? `${this._t("level")} ${Math.round(m.level)} %` : null, m.state !== "offline" ? this._line(m) : null].filter(Boolean);
    if (banner) {
      const c = this._config;
      this.shadowRoot.innerHTML = `<style>${RC_BASE_STYLES}${this.constructor.styles}</style>
        <ha-card class="lvl-${m.state} bn">${this._banner(m, rest.length ? `<div class="rs">${rest.map((t, i) => chip(t, i >= m.alerts.length)).join("")}</div>` : "", night, m.none ? "" : this._t(`st_${m.state}`))}</ha-card>`;
      const root = this.shadowRoot;
      if (c.navigation_path) rcBindNav(root.querySelector(".head"), c.navigation_path);
      for (const el of root.querySelectorAll(".r")) el.addEventListener("click", () => rcMoreInfo(this, el.dataset.id));
      this._fitPill();
      return;
    }
    const chips = [this._t(`st_${m.state}`), ...rest].map((t, i) => chip(t, i > 0)).join("");
    this._paintMini({ level: m.state, icon: this._icon(m), status: "", chips });
    const title = this.shadowRoot.querySelector(".mini .title");
    if (title) title.textContent = m.name;
  }
}

const WaterPumpMiniCardEditor = rcEditor({
  card: WaterPumpMiniCard,
  helpers: WP_HELPERS,
  schema: wpSchema(["show_title", "illustration", "show_runs", "animations", "show_controls", "zoom"]),
});

rcRegister(
  WaterPumpMiniCard,
  WaterPumpMiniCardEditor,
  "Water Pump Mini Card",
  "The pump on its illustrated banner: its state, level, run and alerts, with a zoom to the full card",
);
