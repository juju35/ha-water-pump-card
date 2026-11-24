// ── Mini card ────────────────────────────────────────────────────────────────
// The pump on its banner: the state as the status pill, the level and the run as chips (the alerts first); the zoom
// button opens the full card in place.
import { WaterPumpCard } from "./card.js";
import { WP_HELPERS, wpSchema } from "./editor.js";

export class WaterPumpMiniCard extends rcMini(WaterPumpCard, "water-pump-mini-card", ".r { --t: var(--c); } .r.dim { --t: var(--rc-idle); }") {
  // Compact: the 90px banner is about two rows of 50px (one without it), for the masonry view.
  getCardSize() {
    if (this._zoomed) return super.getCardSize();
    return this._config?.illustration === false ? 1 : 2;
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

export const WaterPumpMiniCardEditor = rcEditor({
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
