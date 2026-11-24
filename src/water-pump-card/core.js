/**
 * water-pump-card / water-pump-mini-card: a pump, illustrated — a sump pump in its pit, a water pump by its well, an
 * industrial pump on its skid. Whether it pumps and for how long, the level of its pit or tank with its start, stop
 * and alarm marks, its runs of the last 24 hours, its cycles, pressure and flow, and its alerts.
 * https://github.com/juju35/ha-water-pump-card
 */

// One loop of the illustrations' animations (s): water runs in the pipe, the motor's fan turns, drops fall.
export const WP_LOOP = 2.4;
export const WP_HISTORY_MS = 5 * 60000;
export const WP_DAY_MS = 24 * 3600000;
export const WP_KIND_ICONS = { sump: "mdi:pump", well: "mdi:water-pump", industrial: "mdi:pump", pump: "mdi:water-pump" };
export const WP_ROOM = { sump: "pit", well: "garden", industrial: "plant", pump: "garden" };

// The status pill's place (the same rule on every ha-* card): beside the title when the whole title and the pill's
// whole label fit there, else under the subtitle, else its dot alone on the title row.
export const wpPlacePill = (head, row, ground) => {
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
export const wpDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${String(m % 60).padStart(2, "0")}` : `${Math.floor(h / 24)} d`;
};
