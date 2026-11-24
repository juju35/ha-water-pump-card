// ── Discovery rules ──────────────────────────────────────────────────────────
export const RC_HOLD_MS = 500;
export const RC_MOVE_PX = 8;
// A held arrow key repeats some 30 times a second: one brightness step every RC_REPEAT_MS at most.
export const RC_REPEAT_MS = 150;

// `fn(hass)` computed once per entity registry: HA replaces hass.entities only when the registry changes,
// whereas a new hass (and hass.states) comes with every state change of the whole instance.
export const rcPerRegistry = (fn) => {
  const cache = new WeakMap();
  const none = {};
  return (hass) => {
    const reg = hass.entities || none;
    if (!cache.has(reg)) cache.set(reg, fn(hass));
    return cache.get(reg);
  };
};
