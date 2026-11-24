// ── Card ─────────────────────────────────────────────────────────────────────
import { WP_DAY_MS, WP_HISTORY_MS, WP_KIND_ICONS, WP_ROOM, wpDur, wpPlacePill } from "./core.js";
import { WP_SVG, wpIcon, wpScene } from "./illustration.js";

export class WaterPumpCard extends RcCard {
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
