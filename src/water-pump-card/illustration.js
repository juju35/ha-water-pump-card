// ── Illustration ─────────────────────────────────────────────────────────────
// The banner's scene, 200 × 80, drawn to its right edge. `on`: pumping, `moving`: animated, `share`: the level (0 to 1,
// null when unknown), `alarm`: the alarm level, `alert`: drawn in red, `pressure`: the gauge's needle (0 to 1).
import { WP_LOOP } from "./core.js";

export const wpFlow = (d, moving, color = "#7cc4ff") =>
  `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-dasharray="5 5" stroke-linecap="round">${moving ? `<animate attributeName="stroke-dashoffset" from="10" to="0" dur="${WP_LOOP / 4}s" repeatCount="indefinite"/>` : ""}</path>`;

export const wpScene = ({ kind, on, moving, share, alarm, alert, pressure, night, dx = 0 }) => {
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

export const wpIcon = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const WP_SVG = {
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
