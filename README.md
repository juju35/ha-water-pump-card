# ha-water-pump-card

[![Marketplace](https://img.shields.io/badge/Marketplace-Custom-41BDF5.svg)](https://www.home-assistant.io/integrations/marketplace/)
[![HACS Validation](https://github.com/juju35/ha-water-pump-card/actions/workflows/hacs.yml/badge.svg)](https://github.com/juju35/ha-water-pump-card/actions/workflows/hacs.yml)
[![Validate](https://github.com/juju35/ha-water-pump-card/actions/workflows/validate.yml/badge.svg)](https://github.com/juju35/ha-water-pump-card/actions/workflows/validate.yml)
[![Lint](https://github.com/juju35/ha-water-pump-card/actions/workflows/lint.yml/badge.svg)](https://github.com/juju35/ha-water-pump-card/actions/workflows/lint.yml)
[![Release](https://img.shields.io/github/v/release/juju35/ha-water-pump-card)](https://github.com/juju35/ha-water-pump-card/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/juju35/ha-water-pump-card/blob/main/LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/julienstep9)

<p align="center"><img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/icon.svg" alt="Water Pump Card" width="120"></p>

<p align="center">
  <a href="https://www.shelly.com/"><img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/shelly.png" alt="Shelly" width="48"></a>&nbsp;&nbsp;
  <a href="https://esphome.io/"><img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/esphome.png" alt="ESPHome" width="48"></a>&nbsp;&nbsp;
  <a href="https://www.home-assistant.io/integrations/zha/"><img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/zha.png" alt="Zigbee Home Automation" width="48"></a>&nbsp;&nbsp;
  <a href="https://www.tp-link.com/"><img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/tplink.png" alt="TP-Link" width="48"></a>&nbsp;&nbsp;
  <a href="https://www.tuya.com/"><img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/tuya.png" alt="Tuya" width="48"></a>&nbsp;&nbsp;
  <a href="https://tasmota.github.io/"><img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/tasmota.png" alt="Tasmota" width="48"></a>&nbsp;&nbsp;
  <a href="https://www.home-assistant.io/integrations/modbus/"><img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/modbus.png" alt="Modbus" width="48"></a>
</p>

An illustrated Lovelace card for **pumps** — a sump pump in its pit, a water pump by its well or booster, an industrial or circulation pump. Whether it pumps and for how long, the level of its pit or tank with its start, stop and alarm marks, its runs over the last 24 hours, today's cycles, their length and the runtime, the pressure, flow and volume pumped, and its alerts: a high-level float, a level too high, a pump that never stops. A smart plug on the pump is enough; a level, pressure or flow sensor makes it richer.

[![Open your Home Assistant instance and open a repository inside the Marketplace.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=juju35&repository=ha-water-pump-card&category=plugin)

| Card | Type | What it shows |
|---|---|---|
| [Water pump](#water-pump) | `custom:water-pump-card` | The pump illustrated, the level gauge, the reading, three tiles, the runs of 24 hours, the alerts and the switch. |
| [Water pump mini](#water-pump-mini) | `custom:water-pump-mini-card` | The same pump on its illustrated banner: the state, the alerts, the level and the run, a zoom to the full card. |

| Sump pump | Alert | Water pump | Mini |
|---|---|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump.gif" alt="Sump pump" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump-alert.png" alt="Alert" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-well.png" alt="Water pump" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-mini-sump.png" alt="Mini" width="400"> |

The cards share the look of the other ha-* cards (illustrated header with a status pill, tinted tiles), a visual editor covering every option, labels in 22 languages following the Home Assistant language, light and dark themes, and come in a single Marketplace install with no dependency.

## Features

### Water pump

`custom:water-pump-card` — The pump of `entity`: its switch, its running binary sensor, or its power sensor (the first pump of the home when none is set).

- **Running**, from its running sensor, else its power (at or above `threshold`), else its switch; *Pumping for 38 s*, or *Last run 12 min ago*
- **Level**: with a level sensor (in %, on the pump's device or set with `level`), a gauge of the pit or tank with its **start**, **stop** and **alarm** marks (`level_start`, `level_stop`, `level_alarm`; 85 % for a sump pump by default), the level in big. Without one, the power in big while it pumps
- **Three tiles**: the pressure and the flow when the pump reports them, then today's cycles, their average length, the volume pumped today or the runtime, the power
- **Runs of the last 24 hours**: one bar per run on a day-long strip, from Home Assistant's history (`show_runs: false` hides it)
- **Alerts** (red): the alarm sensor on (a high-level float, a fault; found on the device or set with `alarm`), the level at or above its alarm mark, the pump running non-stop longer than `max_run` minutes (10 for a sump pump, 30 for a water pump, never for an industrial one; `0` turns it off). Otherwise *No alarm*
- **The switch**: a round button starts and stops the pump (`show_controls: false` removes it)
- **Illustrated header**: a 90 px banner with the pump drawn in its place — a sump pump in its pit in the basement's soil, its water at the level and its alarm line, the discharge pipe running while it pumps; a water pump between its well and the tap, with its pressure gauge; an industrial pump on its skid, its motor's fan turning — on a ground strip; the name, the area and the state (*Pumping*, *Idle*, *Alert*) at the left, beside a round badge whose icon takes the state's colour. By night (with a dark Home Assistant theme; `illustration_theme: day | night` forces it) the scene is dark. `illustration: false` brings back the classic header
- `animations: false` stops the water and the fan (also when the system asks for reduced motion)

The kind of pump is found from its name (in any of the card's languages: *Pompe de relevage*, *Sump pump*, *Surpresseur*, *Brunnenpumpe*…), else set with `kind`:

| `kind` | Pump | Scene |
|---|---|---|
| `sump` | Sump or drainage pump, lifting station | The pit in the basement |
| `well` | Water pump: well, borehole, booster, irrigation | The well, the pump and the tap in the garden |
| `industrial` | Industrial, process or circulation pump | The pump and its motor on a skid |
| `pump` | Any other pump | The garden |

### Water pump mini

`custom:water-pump-mini-card` — The pump on the same 90 px illustrated banner (two lines with `illustration: false`): the state as the status pill after the name, then the alerts, the level and the run (*Pumping for 38 s*, *Last run 12 min ago*) as chips. The **zoom** button (top right) opens the full card in place, a click anywhere else folds it back (`zoom: false` removes the button).

## Supported integrations

Any integration giving the pump's switch, a running binary sensor or a power sensor works; level, pressure, flow, volume and alarm sensors on the same device are found by their device class, unit and name. Among them:

| Integration | Pumps and sensors |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/shelly.png" alt="" width="16"> [Shelly](https://www.home-assistant.io/integrations/shelly/) (built in) | A pump on a Shelly Plug, Plus 1PM, Pro 1PM or Pro 4PM (switch and power), Shelly Plus Uni for a float |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/esphome.png" alt="" width="16"> [ESPHome](https://www.home-assistant.io/integrations/esphome/) (built in) | Level (ultrasonic, pressure transducer), pressure, flow and float sensors |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/zha.png" alt="" width="16"> [Zigbee Home Automation](https://www.home-assistant.io/integrations/zha/) (built in) and [Zigbee2MQTT](https://www.zigbee2mqtt.io/guide/usage/integrations/home_assistant.html) (MQTT) | Zigbee plugs with metering, water leak sensors as a high-level alarm |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/tplink.png" alt="" width="16"> [TP-Link Smart Home](https://www.home-assistant.io/integrations/tplink/), <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/tuya.png" alt="" width="16"> [Tuya](https://www.home-assistant.io/integrations/tuya/), <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/tasmota.png" alt="" width="16"> [Tasmota](https://www.home-assistant.io/integrations/tasmota/) (built in) | Their plugs and relays |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/images/modbus.png" alt="" width="16"> [Modbus](https://www.home-assistant.io/integrations/modbus/) (built in) | Industrial and circulation pumps, variable-speed drives |
| [Template](https://www.home-assistant.io/integrations/template/) (built in) | A level in % worked out from a distance, a running sensor of your own |

When the card picks the wrong sensor, set it with `level`, `pressure`, `flow`, `volume` or `alarm`, and open an issue with the pump's entities so that the discovery learns it.

## Installation

### Via the Marketplace (recommended)

Click the button below to add the repository directly:

[![Add to the Marketplace](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=juju35&repository=ha-water-pump-card&category=plugin)

Or manually:

1. Open **Settings → Marketplace → Add from link** (top right; this needs a GitHub account connected)
2. Add `https://github.com/juju35/ha-water-pump-card` — Type: **Dashboard**
3. Open **Water Pump Card** and click **Install**
4. Clear your browser cache and refresh

The Marketplace registers the dashboard resource for you.

### Manual

1. Download `ha-water-pump-card.js` and the `ha-water-pump-card.i18n.*.js` translation files from the [latest release](https://github.com/juju35/ha-water-pump-card/releases/latest)
2. Copy them all to `/config/www/` (without the translation files, the cards show in English)
3. Go to **Settings → Dashboards → Resources** → Add resource:
   - URL: `/local/ha-water-pump-card.js`
   - Type: **JavaScript Module**
4. Clear your browser cache and refresh

## Configuration

Every option is in the visual editor. In YAML:

```yaml
type: custom:water-pump-card
entity: switch.sump_pump

# A sump pump with its pit level and float, its start and stop levels
type: custom:water-pump-card
entity: switch.sump_pump
level: sensor.sump_pit_level
alarm: binary_sensor.sump_high_level
level_start: 60
level_stop: 20
level_alarm: 85

# A well pump read from its power, with its pressure and flow
type: custom:water-pump-card
entity: sensor.well_pump_power
threshold: 50
pressure: sensor.well_pressure
flow: sensor.well_flow
max_run: 45

# On a phone dashboard
type: custom:water-pump-mini-card
entity: switch.sump_pump
```

| Option | Card | Type | Default | Description |
|---|---|---|---|---|
| `entity` | both | string | the first pump found | The pump's switch, its running binary sensor, or its power sensor |
| `title` | both | string | the device's name | Card title |
| `show_title` | both | boolean | `true` | Show the title |
| `navigation_path` | both | string | | A tap on the header opens this dashboard path |
| `kind` | both | string | `auto` | The kind of pump (see the table above); `auto` finds it from the name |
| `level` | both | string | the device's | The pit's or tank's level, in % |
| `pressure` | both | string | the device's | A pressure sensor |
| `flow` | both | string | the device's | A flow sensor |
| `volume` | both | string | the device's | A water volume sensor (today's) |
| `alarm` | both | string | the device's | A binary sensor: a high-level float or a fault |
| `threshold` | both | number | `20` | Watts at or above which the pump runs, when it is read from its power |
| `level_start` | both | number | | The level (%) at which the pump starts: a mark on the gauge |
| `level_stop` | both | number | | The level (%) at which it stops: a mark on the gauge |
| `level_alarm` | both | number | `85` for a sump pump | The level (%) of the alarm: a mark, and an alert at or above it |
| `max_run` | both | number | by kind | Minutes non-stop before an alert (`0`: never) |
| `illustration` | both | boolean | `true` | The illustrated header (`false`: the classic header) |
| `illustration_theme` | both | string | `auto` | `auto` (follows the Home Assistant theme: night with a dark theme, day with a light theme), `day` or `night` |
| `show_runs` | both | boolean | `true` | The runs of the last 24 hours |
| `animations` | both | boolean | `true` | Running water and turning fan |
| `show_controls` | both | boolean | `true` | The switch |
| `zoom` | mini | boolean | `true` | The zoom button at the top right: it switches to the full card and back |
| `language` | both | string | Home Assistant's | One of the [languages](#translations) |

## Screenshots

| Sump pump, pumping | Sump pump, idle | Alert |
|---|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump.png" alt="Sump pump, pumping" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump-idle.png" alt="Sump pump, idle" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump-alert.png" alt="Alert" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump-dark.png" alt="Sump pump, pumping, dark" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump-idle-dark.png" alt="Sump pump, idle, dark" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump-alert-dark.png" alt="Alert, dark" width="400"> |

| Water pump | Water pump by night | Industrial pump |
|---|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-well.png" alt="Water pump" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-well-night.png" alt="Water pump by night" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-industrial.png" alt="Industrial pump" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-well-dark.png" alt="Water pump, dark" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-well-night-dark.png" alt="Water pump by night, dark" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-industrial-dark.png" alt="Industrial pump, dark" width="400"> |

| Offline |
|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-offline.png" alt="Offline" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-offline-dark.png" alt="Offline, dark" width="400"> |

**Animations**: while it pumps, the water runs up the sump pump's pipe, the water pump fills the tap, the industrial pump's fan turns (still with `animations: false`, or when the system asks for reduced motion).

| Sump pump | Water pump | Industrial pump |
|---|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump.gif" alt="Sump pump animation" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-well.gif" alt="Water pump animation" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-industrial.gif" alt="Industrial pump animation" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-sump-dark.gif" alt="Sump pump animation, dark" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-well-dark.gif" alt="Water pump animation, dark" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-industrial-dark.gif" alt="Industrial pump animation, dark" width="400"> |

### Water pump mini

| Pumping | Alert | Zoomed in |
|---|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-mini-sump.png" alt="Mini, pumping" width="320"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-mini-alert.png" alt="Mini, alert" width="320"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-mini-zoom.png" alt="Mini, zoomed in" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-mini-sump-dark.png" alt="Mini, pumping, dark" width="320"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-mini-alert-dark.png" alt="Mini, alert, dark" width="320"> | <img src="https://raw.githubusercontent.com/juju35/ha-water-pump-card/main/screenshots/wp-mini-zoom-dark.png" alt="Mini, zoomed in, dark" width="400"> |

## How it works

- **Pump**: `entity`, else the first switch, running binary sensor or power sensor named like a pump (*pump*, *pompe*, *Pumpe*, *bomba*…)
- **On its device**: the switch, a running binary sensor, the power, a level in % (named *level*, *niveau*, *pit*, *tank*…), a pressure (`pressure` device class or bar / psi), a flow (`volume_flow_rate` or a unit per minute or hour), a water volume, an alarm (`problem`, `moisture`, `safety`, or named *alarm*, *high*…); diagnostic entities left out
- **Runs**: the history of the running signal over the last 24 hours (`history/history_during_period`), fetched again every 5 minutes, closed by the live state; today's from midnight
- **Actions**: `turn_on` / `turn_off` on the pump's switch (never on a sensor); nothing else

## Development

```bash
npm install
npm run build        # stamps the version of package.json into dist/ha-water-pump-card.js
npm run check        # builds and checks the bundle (run in CI)
npm test             # unit tests
npm run screenshots  # renders the cards with mock pumps into screenshots/ (and the GIFs, needs ffmpeg)
```

`dist/` is not committed: `npm run build` creates it locally, CI builds it on every push, and the release workflow attaches the built files to the release, which is where the Marketplace installs them from.

### Releasing

1. Bump `version` in `package.json`
2. Add a `## <version>` section at the top of [CHANGELOG.md](https://github.com/juju35/ha-water-pump-card/blob/main/CHANGELOG.md)
3. Push to `main`: the **Release** workflow builds the card, creates the tag and the GitHub release with the changelog section as notes, and attaches `ha-water-pump-card.js` and its translation files

## Translations

The card auto-detects the language from your Home Assistant settings. Currently supported:

| Language | Code |
|---|---|
| English | `en` |
| Français | `fr` |
| Deutsch | `de` |
| Español | `es` |
| Српски | `sr` |
| Srpski (latinica) | `sr-Latn` |
| Italiano | `it` |
| Nederlands | `nl` |
| Português (Portugal) | `pt` |
| Polski | `pl` |
| Română | `ro` |
| Dansk | `da` |
| Svenska | `sv` |
| Български | `bg` |
| Русский | `ru` |
| Українська | `uk` |
| Magyar | `hu` |
| Slovenčina | `sk` |
| Čeština | `cs` |
| Slovenščina | `sl` |
| Latviešu | `lv` |
| Ελληνικά | `el` |

Contributions for additional languages are welcome!

## License

[MIT](https://github.com/juju35/ha-water-pump-card/blob/main/LICENSE)

## Support

If you find this project useful, you can support its development:

<a href="https://buymeacoffee.com/julienstep9"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"></a>
