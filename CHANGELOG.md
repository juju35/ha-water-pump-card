# Changelog

## 1.0.3 - 2026-11-20

### Fixes
- The minute refresh (running for, last run, the 24-hour strip) now also runs in browsers without `ResizeObserver`.
- README: the options table gets a *Card* column (`both` / `mini`), and a Support section.
- Mini card: its size for the masonry view counts the 90px banner (2 rows; 1 with `illustration: false`).

### Performance
- About 420 lines of unused code copied from the room cards (rooms, lights, plugs, toggle mini card, rooms panel and their styles) are gone from the bundle.
- The 19 room-card strings left in the shared translations (rooms, layout, columns, thresholds, sort…) are gone in every language; the editor labels and helpers this card uses are unchanged (checked in every language), and a test keeps unused shared keys out.

### Maintenance
- The commitlint config loads as an ES module: the `commit-msg` hook failed on every commit.
- Tests: the discovery on varied devices (a Tuya plug with French names and a diagnostic power sensor, an ESPHome controller with an unavailable running sensor, psi and m³/h, hidden and foreign entities).

## 1.0.2 - 2026-11-18

### Maintenance

- **README**: the supported integrations' logos (Shelly, ESPHome, ZHA, TP-Link, Tuya, Tasmota, Modbus) under the card's own logo and in the *Supported integrations* table.

## 1.0.1 - 2026-11-18

### Fixes
- Illustrated header: `auto` now follows the Home Assistant theme alone — a light theme keeps the day picture after sunset, a dark theme still shows the night one.

## 1.0.0 - 2026-11-17

### Features
- **Water pump card** (`custom:water-pump-card`): a pump read from its switch, its running sensor or its power (`threshold`) — pumping, idle, alert, offline — with *Pumping for 38 s* or *Last run 12 min ago*.
- **Level gauge** of the pit or tank (a level sensor in %, `level`) with its start, stop and alarm marks (`level_start`, `level_stop`, `level_alarm`, 85 % for a sump pump by default).
- **Three tiles**: pressure and flow when reported, today's cycles, their average, the volume pumped or the runtime, the power. **Runs of the last 24 hours** as bars on a day-long strip (`show_runs`).
- **Alerts**: the alarm sensor (`alarm`, a high-level float or a fault), a level at or above its alarm mark, a run longer than `max_run` minutes (10 for a sump pump, 30 for a water pump). The pump's **switch** as a round button (`show_controls`).
- **Illustrated header**: a 90 px banner with the pump in its place — a sump pump in its pit with the water at its level and the alarm line, a water pump between its well and the tap with its pressure gauge, an industrial pump and its motor on a skid — water running and fan turning while it pumps; the badge's icon in the state's colour and the status pill placed by measurement; kinds found from the name in 22 languages or set with `kind`; night mode (`illustration_theme`); `illustration: false` for the classic header.
- **Water pump mini card** (`custom:water-pump-mini-card`): the banner with the state, the alerts, the level and the run as chips, and a zoom to the full card.
- Visual editor for every option; labels in 22 languages, English in the bundle and the others loaded on demand.
