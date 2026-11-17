/**
 * Shared by the water pump cards (its names are used by the other src/ files): the pump's entities, runs and strings,
 * i18n helpers, the base card (header, tiles, tap / hold), the mini card, the visual editor and the common styles.
 * Same base as ha-room-card.
 * https://github.com/juju35/ha-water-pump-card
 */
const RC_VERSION = "__VERSION__";

// ── Discovery rules ──────────────────────────────────────────────────────────
const RC_OPENING_CLASSES = ["moisture", "smoke", "carbon_monoxide", "gas", "door", "window", "opening", "garage_door"];
// Safety sensors: an active state is an alarm, not an opening. Most serious first: it names the room's status.
const RC_ALERT_KINDS = {
  smoke: { dc: "smoke", on: "mdi:smoke-detector-alert", off: "mdi:smoke-detector" },
  co: { dc: "carbon_monoxide", on: "mdi:molecule-co", off: "mdi:molecule-co" },
  gas: { dc: "gas", on: "mdi:gas-cylinder", off: "mdi:gas-cylinder" },
  leak: { dc: "moisture", on: "mdi:water-alert", off: "mdi:water-check" },
};
const RC_ALERT_ORDER = Object.keys(RC_ALERT_KINDS);
// Alert kind of a device class (`leak`, `smoke`, `co`, `gas`), or undefined for any other class.
const rcAlertKind = (dc) => RC_ALERT_ORDER.find((k) => RC_ALERT_KINDS[k].dc === dc);
// The most serious alert kind among `kinds`, `leak` when none is known.
const rcTopAlert = (kinds) => RC_ALERT_ORDER.find((k) => kinds.includes(k)) || "leak";
const RC_PRESENCE_CLASSES = ["occupancy", "presence", "motion"];
// A switch driving a light belongs to the lights card, a switch that is a plug to the plugs card.
const RC_LIGHT_NAME = /(^|\s)(lumi[eè]re|lampe|lamp|light|veilleuse|guirlande)(\s|$)/i;
const RC_PLUG_NAME = /(^|\s)(prise|multiprise|plug|outlet|socket)(\s|$)/i;
const RC_HOLD_MS = 500;
const RC_MOVE_PX = 8;
// A held arrow key repeats some 30 times a second: one brightness step every RC_REPEAT_MS at most.
const RC_REPEAT_MS = 150;

const rcIsLightSwitch = (st) => RC_LIGHT_NAME.test(st.attributes.friendly_name || "");
const rcIsPlug = (st) =>
  !rcIsLightSwitch(st) && (st.attributes.device_class === "outlet" || RC_PLUG_NAME.test(st.attributes.friendly_name || ""));

// What each room card shows, shared with the Overview so that both count the same entities.
// Detections that are not about people, which cameras report as motion: pets never count, vehicles only outdoors.
const RC_PET = /(^|[\s_.-])(pets?|animals?|animaux|chiens?|chats?|dogs?|cats?)($|[\s_-])/i;
const RC_VEHICLE = /(^|[\s_.-])(vehicles?|v[ée]hicules?|voitures?|cars?)($|[\s_-])/i;
// An outdoor room, from its name: garden, terrace, balcony, patio, yard, driveway, porch, gate, parking…
const RC_OUTDOOR =
  /jardin|terrasse|balcon|patio|ext[ée]rieur|cour(\s|$)|all[ée]e|porche|portail|parking|garden|terrace|balcony|outdoor|outside|yard|driveway|porch|gate/i;
const rcIsOutdoor = (area) => !!area && RC_OUTDOOR.test(`${area.name || ""} ${area.area_id || ""}`);

// Sensors card: leak, door, window and opening sensors, plus presence and motion unless `presence` is false. Camera
// detections count, except pets, and vehicles outside an `outdoor` room.
const rcMatchSensor = (hass, id, { presence = true, outdoor = false } = {}) => {
  if (!id.startsWith("binary_sensor.")) return false;
  const st = hass.states[id];
  const dc = st?.attributes.device_class;
  if (RC_OPENING_CLASSES.includes(dc)) return true;
  if (presence === false || !RC_PRESENCE_CLASSES.includes(dc)) return false;
  const name = `${id} ${st.attributes.friendly_name || ""}`;
  if (RC_PET.test(name)) return false;
  return outdoor || !RC_VEHICLE.test(name);
};
// Lights card: lights (groups excepted) and switches driving a light, configuration and diagnostic entities excepted.
const rcMatchLight = (hass, id) => {
  const st = hass.states[id];
  if (!st || hass.entities?.[id]?.entity_category) return false;
  if (id.startsWith("light.")) return !Array.isArray(st.attributes.entity_id);
  return id.startsWith("switch.") && rcIsLightSwitch(st);
};
// Plugs card: switches that are plugs, configuration and diagnostic entities excepted.
const rcMatchPlug = (hass, id) => {
  const st = hass.states[id];
  if (!st || !id.startsWith("switch.") || hass.entities?.[id]?.entity_category) return false;
  return rcIsPlug(st);
};

const RC_ROOM_ICONS = [
  [/chambre|bedroom|nursery/i, "mdi:bed-outline"],
  [/s[ée]jour|salon|living|lounge/i, "mdi:sofa-outline"],
  [/cuisine|kitchen/i, "mdi:silverware-fork-knife"],
  [/salle (de )?bains?|bath|douche|shower/i, "mdi:shower-head"],
  [/toilettes?|wc|toilet/i, "mdi:toilet"],
  [/entr[ée]e|entrance|hall d.entr|entry/i, "mdi:door"],
  [/couloir|hall|corridor/i, "mdi:arrow-left-right"],
  [/bureau|office|study/i, "mdi:desk"],
  [/garage/i, "mdi:garage"],
  [/terrasse|jardin|balcon|garden|terrace|balcony|patio|ext[ée]rieur|outdoor/i, "mdi:flower-outline"],
  [/buanderie|cellier|laundry|utility/i, "mdi:washing-machine"],
  [/salle [àa] manger|dining/i, "mdi:table-chair"],
];

// Icon of a room in the overviews: the area's own icon, or one picked from its name.
const rcRoomIcon = (area) => {
  if (area.icon) return area.icon;
  const hit = RC_ROOM_ICONS.find(([re]) => re.test(area.name || area.area_id || ""));
  return hit ? hit[1] : "mdi:home-outline";
};

// `fn(hass)` computed once per entity registry: HA replaces hass.entities only when the registry changes,
// whereas a new hass (and hass.states) comes with every state change of the whole instance.
const rcPerRegistry = (fn) => {
  const cache = new WeakMap();
  const none = {};
  return (hass) => {
    const reg = hass.entities || none;
    if (!cache.has(reg)) cache.set(reg, fn(hass));
    return cache.get(reg);
  };
};

// The sensor entities of each device, in registry order.
const rcDeviceSensors = rcPerRegistry((hass) => {
  const out = {};
  for (const [id, r] of Object.entries(hass.entities || {})) {
    if (r.device_id && id.startsWith("sensor.")) (out[r.device_id] ||= []).push(id);
  }
  return out;
});

// Power sensor (device class power, W or kW) of each device; only the device's own sensors are read.
// Settled per registry like rcDeviceSensors (a device_class next to never changes), except for the devices with a
// sensor that has no state yet (an integration still loading after a restart): those are looked at again on every
// call until all their sensors report, so their power sensor is not missed until the next registry change.
const rcPowerCache = rcPerRegistry((hass) => ({ found: {}, pending: new Set(Object.keys(rcDeviceSensors(hass))) }));
const rcPowerSensors = (hass) => {
  const cache = rcPowerCache(hass);
  if (!cache.pending.size) return cache.found;
  const sensors = rcDeviceSensors(hass);
  for (const device of cache.pending) {
    const ids = sensors[device] || [];
    const id = ids.find((s) => hass.states[s]?.attributes.device_class === "power");
    if (id) cache.found[device] = id;
    if (id || ids.every((s) => hass.states[s])) cache.pending.delete(device);
  }
  return cache.found;
};

const rcWattsOf = (hass, sensorId) => {
  const st = sensorId && hass.states[sensorId];
  const v = st ? Number.parseFloat(st.state) : Number.NaN;
  if (!Number.isFinite(v)) return null;
  return st.attributes.unit_of_measurement === "kW" ? v * 1000 : v;
};

// ── Overviews ────────────────────────────────────────────────────────────────
// Shared by room-overview-card and room-environment-overview-card.

// Visible entities accepted by `match(id)`, with their area, minus the config's `exclude`: the registries are
// scanned again only when they or the config change.
const rcByArea = (card, match) => {
  const h = card._hass;
  const c = card._config;
  return rcMemo((card._memo ||= {}), "byArea", [c, h.entities, h.devices], () => {
    const excluded = new Set(c.exclude || []);
    const out = [];
    for (const [id, r] of Object.entries(h.entities || {})) {
      if (r.hidden || excluded.has(id) || !match(id)) continue;
      const aid = card._areaOf(id);
      if (aid) out.push([id, aid]);
    }
    return out;
  });
};

// Rooms in the order of the config's `rooms` list, then, with `sort: state`, the highest `rank(room)` first,
// then by name.
const rcSortRooms = (list, config, rank) => {
  const order = (config.rooms || []).map((x) => x.area);
  return list.sort((a, b) => {
    if (order.length) {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia !== ib) return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    }
    return (config.sort === "state" ? rank(b) - rank(a) : 0) || a.name.localeCompare(b.name);
  });
};

// The overviews only show the rooms needing a look until their detail button (`zoom`, on by default) is pressed;
// `zoom: false` shows every room, with no button.
const rcCompact = (card) => card._config.zoom !== false && !card._zoomed;

// The zoom / detail button: the same icons on the overviews and the mini cards.
const rcZoomIcon = (card) => (card._zoomed ? "mdi:arrow-collapse" : "mdi:arrow-expand");

// The detail button of an overview header, at its end.
const rcZoomButton = (card) =>
  card._config.zoom === false
    ? ""
    : `<button class="zoom" title="${rcEsc(card._t(card._zoomed ? "rooms_check" : "rooms_all"))}"><ha-icon icon="${rcZoomIcon(card)}"></ha-icon></button>`;

// Back to the compact view (mini card, or overview showing the rooms needing a look), when zoomed in.
const rcUnzoom = (card) => {
  if (!card._zoomed) return;
  card._zoomed = false;
  card._sig = null;
  card._render();
};

// True for a click outside `card` that is not in a dialog opened from it (more-info, say): it folds the card back.
const rcOutside = (card, ev) => !ev.composedPath().includes(card) && !rcInDialog(ev);

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. The handler runs when the press and the release are both outside the card (a slider dragged out of the
// card does not count), and a scroll does not count (the browser cancels the pointer); keyboard clicks still go
// through the click event. The handler keeps its own checks (outside of the card, not in a dialog).
const watchOutside = (card, handler) => {
  let downOutside = false;
  const onDown = (ev) => {
    downOutside = !ev.composedPath().includes(card);
  };
  const onUp = (ev) => {
    if (downOutside) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
    // A tap (press and release at the same spot), for the tests.
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
  };
};

// A click on the detail button: every room, or back to the rooms needing a look. True when handled.
const rcZoomClick = (card, ev) => {
  if (!ev.target.closest?.(".zoom")) return false;
  ev.stopPropagation();
  card._zoomed = !card._zoomed;
  card._sig = null;
  card._render();
  if (ev.detail === 0) card.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
  return true;
};

// Editor fields shared by the overviews: title, columns and sort.
const rcOverviewFields = (i18n, lang) => [
  { name: "title", selector: { text: {} } },
  { name: "columns", selector: { number: { min: 1, max: 6, mode: "box" } } },
  {
    name: "sort",
    selector: {
      select: {
        mode: "dropdown",
        options: ["name", "state"].map((value) => ({ value, label: rcT(i18n, lang, `ed_sort_${value}`) })),
      },
    },
  },
];

// ── i18n ─────────────────────────────────────────────────────────────────────
// Strings shared by the cards; a card's own dictionary wins over these.
const RC_I18N = {
  en: {
    all_closed: "All closed",
    all_quiet: "All quiet",
    open_one: "{n} open",
    open_many: "{n} open",
    unavail_one: "{n} unavailable",
    unavail_many: "{n} unavailable",
    leak: "Water leak",
    smoke: "Smoke detected",
    gas: "Gas detected",
    co: "Carbon monoxide",
    detected: "Detected",
    clear: "Clear",
    unavailable: "Unavailable",
    on: "On",
    off: "Off",
    turn_all_off: "Turn everything off",
    ed_area: "Area",
    ed_title: "Title",
    ed_show_title: "Show title",
    ed_title_helper: "Leave empty for the area name",
    ed_columns: "Columns",
    ed_layout: "Layout",
    ed_layout_helper: "Tiles: one large tile per entity, like the Tile card, easier to tap on a phone",
    ed_layout_compact: "Compact",
    ed_layout_tiles: "Tiles",
    ed_advanced: "Advanced",
    ed_language: "Language",
    ed_language_helper: "Empty: the Home Assistant language",
    ed_language_auto: "Automatic",
    ed_entities: "Explicit entities (YAML)",
    ed_entities_helper: "Replaces the automatic discovery: entity IDs, or {entity, name, icon}",
    ed_thresholds: "Comfort thresholds (YAML)",
    ed_thresholds_helper: "Per kind, in the sensor's unit, e.g. co2: [800, 1200] or humidity: [25, 35, 70, 80]",
    ed_rooms: "Rooms (YAML)",
    ed_rooms_helper: "Order and overrides: a list of {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigation path",
    ed_all_off_button: "“Turn everything off” button",
    err_config: "Set `area` or `entities`",
    zoom_in: "Show the full card",
    zoom_out: "Back to the compact view",
    ed_zoom: "Zoom button",
    ed_zoom_helper: "Switches the mini card to the full card and back",
    rooms_all: "Show every room",
    rooms_check: "Only the rooms needing a look",
    ed_sort: "Sort",
    ed_sort_name: "By name",
    ed_exclude_areas: "Rooms to exclude",
  },
  fr: {
    all_closed: "Tout est fermé",
    all_quiet: "Tout est calme",
    open_one: "{n} ouverture",
    open_many: "{n} ouvertures",
    unavail_one: "{n} indisponible",
    unavail_many: "{n} indisponibles",
    leak: "Fuite d'eau",
    smoke: "Fumée détectée",
    gas: "Gaz détecté",
    co: "Monoxyde de carbone",
    detected: "Détecté",
    clear: "Non détecté",
    unavailable: "Indisponible",
    on: "Allumée",
    off: "Éteinte",
    turn_all_off: "Tout éteindre",
    ed_area: "Pièce",
    ed_title: "Titre",
    ed_show_title: "Afficher le titre",
    ed_title_helper: "Laisser vide pour le nom de la pièce",
    ed_columns: "Colonnes",
    ed_layout: "Disposition",
    ed_layout_helper: "Tuiles : une grande tuile par entité, comme la carte Tuile, plus facile à toucher sur téléphone",
    ed_layout_compact: "Compacte",
    ed_layout_tiles: "Tuiles",
    ed_advanced: "Avancé",
    ed_language: "Langue",
    ed_language_helper: "Vide : la langue de Home Assistant",
    ed_language_auto: "Automatique",
    ed_entities: "Entités explicites (YAML)",
    ed_entities_helper: "Remplace la découverte automatique : des identifiants d'entités, ou {entity, name, icon}",
    ed_thresholds: "Seuils de confort (YAML)",
    ed_thresholds_helper: "Par type, dans l'unité du capteur, par exemple co2: [800, 1200] ou humidity: [25, 35, 70, 80]",
    ed_rooms: "Pièces (YAML)",
    ed_rooms_helper: "Ordre et personnalisation : une liste de {area, name, icon, navigation_path}",
    ed_navigation_path: "Chemin de navigation",
    ed_all_off_button: "Bouton « Tout éteindre »",
    err_config: "Définis `area` ou `entities`",
    zoom_in: "Afficher la carte complète",
    zoom_out: "Revenir à la vue compacte",
    ed_zoom: "Bouton zoom",
    ed_zoom_helper: "Bascule la mini-carte en carte complète, et inversement",
    rooms_all: "Afficher toutes les pièces",
    rooms_check: "Seulement les pièces à surveiller",
    ed_sort: "Tri",
    ed_sort_name: "Par nom",
    ed_exclude_areas: "Pièces à exclure",
  },
  de: {
    all_closed: "Alles geschlossen",
    all_quiet: "Alles ruhig",
    open_one: "{n} offen",
    open_many: "{n} offen",
    unavail_one: "{n} nicht verfügbar",
    unavail_many: "{n} nicht verfügbar",
    leak: "Wasserleck",
    smoke: "Rauch erkannt",
    gas: "Gas erkannt",
    co: "Kohlenmonoxid",
    detected: "Erkannt",
    clear: "Nicht erkannt",
    unavailable: "Nicht verfügbar",
    on: "An",
    off: "Aus",
    turn_all_off: "Alles ausschalten",
    ed_area: "Bereich",
    ed_title: "Titel",
    ed_show_title: "Titel anzeigen",
    ed_title_helper: "Leer lassen für den Namen des Bereichs",
    ed_columns: "Spalten",
    ed_layout: "Layout",
    ed_layout_helper: "Kacheln: eine große Kachel pro Entität wie die Kachel-Karte, auf dem Handy leichter anzutippen",
    ed_layout_compact: "Kompakt",
    ed_layout_tiles: "Kacheln",
    ed_advanced: "Erweitert",
    ed_language: "Sprache",
    ed_language_helper: "Leer: die Sprache von Home Assistant",
    ed_language_auto: "Automatisch",
    ed_entities: "Explizite Entitäten (YAML)",
    ed_entities_helper: "Ersetzt die automatische Erkennung: Entitäts-IDs oder {entity, name, icon}",
    ed_thresholds: "Komfortschwellen (YAML)",
    ed_thresholds_helper: "Pro Art, in der Einheit des Sensors, z. B. co2: [800, 1200] oder humidity: [25, 35, 70, 80]",
    ed_rooms: "Räume (YAML)",
    ed_rooms_helper: "Reihenfolge und Anpassungen: eine Liste von {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigationspfad",
    ed_all_off_button: "Schaltfläche „Alles ausschalten“",
    err_config: "Lege `area` oder `entities` fest",
    zoom_in: "Vollständige Karte anzeigen",
    zoom_out: "Zurück zur kompakten Ansicht",
    ed_zoom: "Zoom-Schaltfläche",
    ed_zoom_helper: "Wechselt von der Mini-Karte zur vollständigen Karte und zurück",
    rooms_all: "Alle Räume anzeigen",
    rooms_check: "Nur die Räume, die Aufmerksamkeit brauchen",
    ed_sort: "Sortierung",
    ed_sort_name: "Nach Name",
    ed_exclude_areas: "Auszuschließende Räume",
  },
  es: {
    all_closed: "Todo cerrado",
    all_quiet: "Todo tranquilo",
    open_one: "{n} abierto",
    open_many: "{n} abiertos",
    unavail_one: "{n} no disponible",
    unavail_many: "{n} no disponibles",
    leak: "Fuga de agua",
    smoke: "Humo detectado",
    gas: "Gas detectado",
    co: "Monóxido de carbono",
    detected: "Detectado",
    clear: "No detectado",
    unavailable: "No disponible",
    on: "Encendido",
    off: "Apagado",
    turn_all_off: "Apagar todo",
    ed_area: "Área",
    ed_title: "Título",
    ed_show_title: "Mostrar el título",
    ed_title_helper: "Déjalo vacío para usar el nombre del área",
    ed_columns: "Columnas",
    ed_layout: "Diseño",
    ed_layout_helper: "Mosaicos: un mosaico grande por entidad, como la tarjeta Mosaico, más fácil de tocar en el móvil",
    ed_layout_compact: "Compacto",
    ed_layout_tiles: "Mosaicos",
    ed_advanced: "Avanzado",
    ed_language: "Idioma",
    ed_language_helper: "Vacío: el idioma de Home Assistant",
    ed_language_auto: "Automático",
    ed_entities: "Entidades explícitas (YAML)",
    ed_entities_helper: "Sustituye la detección automática: IDs de entidad, o {entity, name, icon}",
    ed_thresholds: "Umbrales de confort (YAML)",
    ed_thresholds_helper: "Por tipo, en la unidad del sensor, p. ej. co2: [800, 1200] o humidity: [25, 35, 70, 80]",
    ed_rooms: "Habitaciones (YAML)",
    ed_rooms_helper: "Orden y personalización: una lista de {area, name, icon, navigation_path}",
    ed_navigation_path: "Ruta de navegación",
    ed_all_off_button: "Botón «Apagar todo»",
    err_config: "Define `area` o `entities`",
    zoom_in: "Mostrar la tarjeta completa",
    zoom_out: "Volver a la vista compacta",
    ed_zoom: "Botón de zoom",
    ed_zoom_helper: "Cambia de la minitarjeta a la tarjeta completa y viceversa",
    rooms_all: "Mostrar todas las habitaciones",
    rooms_check: "Solo las habitaciones que requieren atención",
    ed_sort: "Orden",
    ed_sort_name: "Por nombre",
    ed_exclude_areas: "Habitaciones a excluir",
  },
  sr: {
    all_closed: "Све је затворено",
    all_quiet: "Све је мирно",
    open_one: "{n} отворено",
    open_few: "{n} отворена",
    open_many: "{n} отворених",
    unavail_one: "Недоступно: {n}",
    unavail_many: "Недоступно: {n}",
    leak: "Цурење воде",
    smoke: "Откривен дим",
    gas: "Откривен гас",
    co: "Угљен-моноксид",
    detected: "Откривено",
    clear: "Није откривено",
    unavailable: "Недоступно",
    on: "Укључено",
    off: "Искључено",
    turn_all_off: "Искључи све",
    ed_area: "Просторија",
    ed_title: "Наслов",
    ed_show_title: "Прикажи наслов",
    ed_title_helper: "Остави празно за назив просторије",
    ed_columns: "Колоне",
    ed_layout: "Распоред",
    ed_layout_helper: "Плочице: једна велика плочица по ентитету, као картица Плочица, лакше за додир на телефону",
    ed_layout_compact: "Збијено",
    ed_layout_tiles: "Плочице",
    ed_advanced: "Напредно",
    ed_language: "Језик",
    ed_language_helper: "Празно: језик Home Assistant-а",
    ed_language_auto: "Аутоматски",
    ed_entities: "Експлицитни ентитети (YAML)",
    ed_entities_helper: "Замењује аутоматско проналажење: ID-ови ентитета или {entity, name, icon}",
    ed_thresholds: "Прагови комфора (YAML)",
    ed_thresholds_helper: "По врсти, у јединици сензора, нпр. co2: [800, 1200] или humidity: [25, 35, 70, 80]",
    ed_rooms: "Собе/Просторије (YAML)",
    ed_rooms_helper: "Редослед и измене: листа са {area, name, icon, navigation_path}",
    ed_navigation_path: "Путања за навигацију",
    ed_all_off_button: "Дугме „Искључи све“",
    err_config: "Подесите `area` или `entities`",
    zoom_in: "Прикажи целу картицу",
    zoom_out: "Назад на компактни приказ",
    ed_zoom: "Дугме за увећање",
    ed_zoom_helper: "Пребацује мини картицу на пун приказ и назад",
    rooms_all: "Прикажи сваку собу",
    rooms_check: "Само собе које захтевају пажњу",
    ed_sort: "Сортирање",
    ed_sort_name: "По имену",
    ed_exclude_areas: "Изостави собе",
  },
  "sr-Latn": {
    all_closed: "Sve je zatvoreno",
    all_quiet: "Sve je mirno",
    open_one: "{n} otvoreno",
    open_few: "{n} otvorena",
    open_many: "{n} otvorenih",
    unavail_one: "Nedostupno: {n}",
    unavail_many: "Nedostupno: {n}",
    leak: "Curenje vode",
    smoke: "Otkriven dim",
    gas: "Otkriven gas",
    co: "Ugljen-monoksid",
    detected: "Otkriveno",
    clear: "Nije otkriveno",
    unavailable: "Nedostupno",
    on: "Uključeno",
    off: "Isključeno",
    turn_all_off: "Isključi sve",
    ed_area: "Prostorija",
    ed_title: "Naslov",
    ed_show_title: "Prikaži naslov",
    ed_title_helper: "Ostavi prazno za naziv prostorije",
    ed_columns: "Kolone",
    ed_layout: "Raspored",
    ed_layout_helper: "Pločice: jedna velika pločica po entitetu, kao kartica Pločica, lakše za dodir na telefonu",
    ed_layout_compact: "Zbijeno",
    ed_layout_tiles: "Pločice",
    ed_advanced: "Napredno",
    ed_language: "Jezik",
    ed_language_helper: "Prazno: jezik Home Assistant-a",
    ed_language_auto: "Automatski",
    ed_entities: "Eksplicitni entiteti (YAML)",
    ed_entities_helper: "Zamenjuje automatsko pronalaženje: ID-ovi entiteta ili {entity, name, icon}",
    ed_thresholds: "Pragovi komfora (YAML)",
    ed_thresholds_helper: "Po vrsti, u jedinici senzora, npr. co2: [800, 1200] ili humidity: [25, 35, 70, 80]",
    ed_rooms: "Sobe/Prostorije (YAML)",
    ed_rooms_helper: "Redosled i izmene: lista sa {area, name, icon, navigation_path}",
    ed_navigation_path: "Putanja za navigaciju",
    ed_all_off_button: "Dugme „Isključi sve“",
    err_config: "Podesite `area` ili `entities`",
    zoom_in: "Prikaži celu karticu",
    zoom_out: "Nazad na kompaktni prikaz",
    ed_zoom: "Dugme za uvećanje",
    ed_zoom_helper: "Prebacuje mini karticu na pun prikaz i nazad",
    rooms_all: "Prikaži svaku sobu",
    rooms_check: "Samo sobe koje zahtevaju pažnju",
    ed_sort: "Sortiranje",
    ed_sort_name: "Po imenu",
    ed_exclude_areas: "Izostavi sobe",
  },
  it: {
    all_closed: "Tutto chiuso",
    all_quiet: "Tutto calmo",
    open_one: "{n} apertura",
    open_many: "{n} aperture",
    unavail_one: "{n} non disponibile",
    unavail_many: "{n} non disponibili",
    leak: "Perdita d'acqua",
    smoke: "Fumo rilevato",
    gas: "Gas rilevato",
    co: "Monossido di carbonio",
    detected: "Rilevato",
    clear: "Non rilevato",
    unavailable: "Non disponibile",
    on: "Accesa",
    off: "Spenta",
    turn_all_off: "Spegni tutto",
    ed_area: "Area",
    ed_title: "Titolo",
    ed_show_title: "Mostra il titolo",
    ed_title_helper: "Lascia vuoto per usare il nome dell'area",
    ed_columns: "Colonne",
    ed_layout: "Layout",
    ed_layout_helper: "Riquadri: un riquadro grande per entità, come la scheda Riquadro, più facile da toccare sul telefono",
    ed_layout_compact: "Compatto",
    ed_layout_tiles: "Riquadri",
    ed_advanced: "Avanzate",
    ed_language: "Lingua",
    ed_language_helper: "Vuoto: la lingua di Home Assistant",
    ed_language_auto: "Automatica",
    ed_entities: "Entità esplicite (YAML)",
    ed_entities_helper: "Sostituisce il rilevamento automatico: ID entità o {entity, name, icon}",
    ed_thresholds: "Soglie di comfort (YAML)",
    ed_thresholds_helper: "Per tipo, nell'unità del sensore, ad es. co2: [800, 1200] o humidity: [25, 35, 70, 80]",
    ed_rooms: "Stanze (YAML)",
    ed_rooms_helper: "Ordine e personalizzazioni: un elenco di {area, name, icon, navigation_path}",
    ed_navigation_path: "Percorso di navigazione",
    ed_all_off_button: "Pulsante «Spegni tutto»",
    err_config: "Imposta `area` o `entities`",
    zoom_in: "Mostra la scheda completa",
    zoom_out: "Torna alla vista compatta",
    ed_zoom: "Pulsante zoom",
    ed_zoom_helper: "Passa dalla mini scheda alla scheda completa e viceversa",
    rooms_all: "Mostra tutte le stanze",
    rooms_check: "Solo le stanze da controllare",
    ed_sort: "Ordinamento",
    ed_sort_name: "Per nome",
    ed_exclude_areas: "Stanze da escludere",
  },
  nl: {
    all_closed: "Alles dicht",
    all_quiet: "Alles rustig",
    open_one: "{n} open",
    open_many: "{n} open",
    unavail_one: "{n} niet beschikbaar",
    unavail_many: "{n} niet beschikbaar",
    leak: "Waterlek",
    smoke: "Rook gedetecteerd",
    gas: "Gas gedetecteerd",
    co: "Koolmonoxide",
    detected: "Gedetecteerd",
    clear: "Niet gedetecteerd",
    unavailable: "Niet beschikbaar",
    on: "Aan",
    off: "Uit",
    turn_all_off: "Alles uitschakelen",
    ed_area: "Ruimte",
    ed_title: "Titel",
    ed_show_title: "Titel tonen",
    ed_title_helper: "Leeg laten voor de naam van de ruimte",
    ed_columns: "Kolommen",
    ed_layout: "Indeling",
    ed_layout_helper: "Tegels: één grote tegel per entiteit, zoals de Tegel-kaart, makkelijker aan te tikken op een telefoon",
    ed_layout_compact: "Compact",
    ed_layout_tiles: "Tegels",
    ed_advanced: "Geavanceerd",
    ed_language: "Taal",
    ed_language_helper: "Leeg: de taal van Home Assistant",
    ed_language_auto: "Automatisch",
    ed_entities: "Expliciete entiteiten (YAML)",
    ed_entities_helper: "Vervangt de automatische detectie: entiteit-ID's of {entity, name, icon}",
    ed_thresholds: "Comfortdrempels (YAML)",
    ed_thresholds_helper: "Per soort, in de eenheid van de sensor, bijv. co2: [800, 1200] of humidity: [25, 35, 70, 80]",
    ed_rooms: "Ruimtes (YAML)",
    ed_rooms_helper: "Volgorde en aanpassingen: een lijst van {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigatiepad",
    ed_all_off_button: "Knop “Alles uitschakelen”",
    err_config: "Stel `area` of `entities` in",
    zoom_in: "Volledige kaart tonen",
    zoom_out: "Terug naar de compacte weergave",
    ed_zoom: "Zoomknop",
    ed_zoom_helper: "Schakelt de minikaart naar de volledige kaart en terug",
    rooms_all: "Alle ruimtes tonen",
    rooms_check: "Alleen de ruimtes die aandacht nodig hebben",
    ed_sort: "Sortering",
    ed_sort_name: "Op naam",
    ed_exclude_areas: "Uit te sluiten ruimtes",
  },
  pt: {
    all_closed: "Tudo fechado",
    all_quiet: "Tudo calmo",
    open_one: "{n} abertura",
    open_many: "{n} aberturas",
    unavail_one: "{n} indisponível",
    unavail_many: "{n} indisponíveis",
    leak: "Fuga de água",
    smoke: "Fumo detetado",
    gas: "Gás detetado",
    co: "Monóxido de carbono",
    detected: "Detetado",
    clear: "Não detetado",
    unavailable: "Indisponível",
    on: "Ligada",
    off: "Desligada",
    turn_all_off: "Desligar tudo",
    ed_area: "Área",
    ed_title: "Título",
    ed_show_title: "Mostrar o título",
    ed_title_helper: "Deixe vazio para usar o nome da área",
    ed_columns: "Colunas",
    ed_layout: "Disposição",
    ed_layout_helper: "Mosaicos: um mosaico grande por entidade, como o cartão Mosaico, mais fácil de tocar no telemóvel",
    ed_layout_compact: "Compacta",
    ed_layout_tiles: "Mosaicos",
    ed_advanced: "Avançado",
    ed_language: "Idioma",
    ed_language_helper: "Vazio: o idioma do Home Assistant",
    ed_language_auto: "Automático",
    ed_entities: "Entidades explícitas (YAML)",
    ed_entities_helper: "Substitui a deteção automática: IDs de entidade, ou {entity, name, icon}",
    ed_thresholds: "Limiares de conforto (YAML)",
    ed_thresholds_helper: "Por tipo, na unidade do sensor, p. ex. co2: [800, 1200] ou humidity: [25, 35, 70, 80]",
    ed_rooms: "Divisões (YAML)",
    ed_rooms_helper: "Ordem e personalização: uma lista de {area, name, icon, navigation_path}",
    ed_navigation_path: "Caminho de navegação",
    ed_all_off_button: "Botão «Desligar tudo»",
    err_config: "Defina `area` ou `entities`",
    zoom_in: "Mostrar o cartão completo",
    zoom_out: "Voltar à vista compacta",
    ed_zoom: "Botão de zoom",
    ed_zoom_helper: "Alterna entre o minicartão e o cartão completo",
    rooms_all: "Mostrar todas as divisões",
    rooms_check: "Só as divisões que precisam de atenção",
    ed_sort: "Ordenação",
    ed_sort_name: "Por nome",
    ed_exclude_areas: "Divisões a excluir",
  },
  pl: {
    all_closed: "Zamknięte",
    all_quiet: "Spokojnie",
    open_one: "Otwarte: {n}",
    open_many: "Otwarte: {n}",
    unavail_one: "Niedostępne: {n}",
    unavail_many: "Niedostępne: {n}",
    leak: "Wyciek wody",
    smoke: "Wykryto dym",
    gas: "Wykryto gaz",
    co: "Tlenek węgla",
    detected: "Wykryto",
    clear: "Nie wykryto",
    unavailable: "Niedostępne",
    on: "Włączone",
    off: "Wyłączone",
    turn_all_off: "Wyłącz wszystko",
    ed_area: "Obszar",
    ed_title: "Tytuł",
    ed_show_title: "Pokaż tytuł",
    ed_title_helper: "Pozostaw puste, aby użyć nazwy obszaru",
    ed_columns: "Kolumny",
    ed_layout: "Układ",
    ed_layout_helper: "Kafelki: jeden duży kafelek na encję, jak karta Kafelek, łatwiejszy do dotknięcia na telefonie",
    ed_layout_compact: "Kompaktowy",
    ed_layout_tiles: "Kafelki",
    ed_advanced: "Zaawansowane",
    ed_language: "Język",
    ed_language_helper: "Puste: język Home Assistanta",
    ed_language_auto: "Automatyczny",
    ed_entities: "Jawnie podane encje (YAML)",
    ed_entities_helper: "Zastępuje automatyczne wykrywanie: identyfikatory encji lub {entity, name, icon}",
    ed_thresholds: "Progi komfortu (YAML)",
    ed_thresholds_helper: "Dla każdego rodzaju, w jednostce czujnika, np. co2: [800, 1200] lub humidity: [25, 35, 70, 80]",
    ed_rooms: "Pomieszczenia (YAML)",
    ed_rooms_helper: "Kolejność i nadpisania: lista {area, name, icon, navigation_path}",
    ed_navigation_path: "Ścieżka nawigacji",
    ed_all_off_button: "Przycisk „Wyłącz wszystko”",
    err_config: "Ustaw `area` lub `entities`",
    zoom_in: "Pokaż pełną kartę",
    zoom_out: "Wróć do widoku kompaktowego",
    ed_zoom: "Przycisk powiększenia",
    ed_zoom_helper: "Przełącza minikartę na pełną kartę i z powrotem",
    rooms_all: "Pokaż wszystkie pomieszczenia",
    rooms_check: "Tylko pomieszczenia wymagające uwagi",
    ed_sort: "Sortowanie",
    ed_sort_name: "Według nazwy",
    ed_exclude_areas: "Pomieszczenia do wykluczenia",
  },
  ro: {
    all_closed: "Totul închis",
    all_quiet: "Totul liniștit",
    open_one: "Deschise: {n}",
    open_many: "Deschise: {n}",
    unavail_one: "Indisponibile: {n}",
    unavail_many: "Indisponibile: {n}",
    leak: "Scurgere",
    smoke: "Fum detectat",
    gas: "Gaz detectat",
    co: "Monoxid de carbon",
    detected: "Detectat",
    clear: "Nedetectat",
    unavailable: "Indisponibil",
    on: "Pornită",
    off: "Oprită",
    turn_all_off: "Oprește tot",
    ed_area: "Zonă",
    ed_title: "Titlu",
    ed_show_title: "Afișează titlul",
    ed_title_helper: "Lasă gol pentru numele zonei",
    ed_columns: "Coloane",
    ed_layout: "Aspect",
    ed_layout_helper: "Plăci: o placă mare pentru fiecare entitate, ca fișa Placă, mai ușor de atins pe telefon",
    ed_layout_compact: "Compact",
    ed_layout_tiles: "Plăci",
    ed_advanced: "Avansat",
    ed_language: "Limbă",
    ed_language_helper: "Gol: limba Home Assistant",
    ed_language_auto: "Automată",
    ed_entities: "Entități explicite (YAML)",
    ed_entities_helper: "Înlocuiește detectarea automată: ID-uri de entitate sau {entity, name, icon}",
    ed_thresholds: "Praguri de confort (YAML)",
    ed_thresholds_helper: "Pe tip, în unitatea senzorului, de ex. co2: [800, 1200] sau humidity: [25, 35, 70, 80]",
    ed_rooms: "Camere (YAML)",
    ed_rooms_helper: "Ordine și personalizări: o listă de {area, name, icon, navigation_path}",
    ed_navigation_path: "Cale de navigare",
    ed_all_off_button: "Butonul „Oprește tot”",
    err_config: "Setează `area` sau `entities`",
    zoom_in: "Afișează cardul complet",
    zoom_out: "Înapoi la vizualizarea compactă",
    ed_zoom: "Buton de zoom",
    ed_zoom_helper: "Comută între mini-card și cardul complet",
    rooms_all: "Afișează toate camerele",
    rooms_check: "Doar camerele care necesită atenție",
    ed_sort: "Sortare",
    ed_sort_name: "După nume",
    ed_exclude_areas: "Camere excluse",
  },
  da: {
    all_closed: "Alt lukket",
    all_quiet: "Alt roligt",
    open_one: "{n} åben",
    open_many: "{n} åbne",
    unavail_one: "{n} utilgængelig",
    unavail_many: "{n} utilgængelige",
    leak: "Vandlækage",
    smoke: "Røg registreret",
    gas: "Gas registreret",
    co: "Kulilte",
    detected: "Registreret",
    clear: "Ikke registreret",
    unavailable: "Utilgængelig",
    on: "Tændt",
    off: "Slukket",
    turn_all_off: "Sluk alt",
    ed_area: "Område",
    ed_title: "Titel",
    ed_show_title: "Vis titel",
    ed_title_helper: "Lad stå tomt for at bruge områdets navn",
    ed_columns: "Kolonner",
    ed_layout: "Layout",
    ed_layout_helper: "Fliser: én stor flise pr. entitet som Flise-kortet, nemmere at trykke på en telefon",
    ed_layout_compact: "Kompakt",
    ed_layout_tiles: "Fliser",
    ed_advanced: "Avanceret",
    ed_language: "Sprog",
    ed_language_helper: "Tomt: Home Assistants sprog",
    ed_language_auto: "Automatisk",
    ed_entities: "Eksplicitte enheder (YAML)",
    ed_entities_helper: "Erstatter den automatiske registrering: enheds-id'er eller {entity, name, icon}",
    ed_thresholds: "Komforttærskler (YAML)",
    ed_thresholds_helper: "Pr. type, i sensorens enhed, f.eks. co2: [800, 1200] eller humidity: [25, 35, 70, 80]",
    ed_rooms: "Rum (YAML)",
    ed_rooms_helper: "Rækkefølge og tilpasninger: en liste med {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigationssti",
    ed_all_off_button: "Knappen »Sluk alt«",
    err_config: "Angiv `area` eller `entities`",
    zoom_in: "Vis hele kortet",
    zoom_out: "Tilbage til den kompakte visning",
    ed_zoom: "Zoomknap",
    ed_zoom_helper: "Skifter fra minikortet til hele kortet og tilbage",
    rooms_all: "Vis alle rum",
    rooms_check: "Kun rum, der kræver opmærksomhed",
    ed_sort: "Sortering",
    ed_sort_name: "Efter navn",
    ed_exclude_areas: "Rum, der udelades",
  },
  sv: {
    all_closed: "Allt stängt",
    all_quiet: "Allt lugnt",
    open_one: "{n} öppen",
    open_many: "{n} öppna",
    unavail_one: "{n} ej tillgänglig",
    unavail_many: "{n} ej tillgängliga",
    leak: "Vattenläcka",
    smoke: "Rök upptäckt",
    gas: "Gas upptäckt",
    co: "Kolmonoxid",
    detected: "Upptäckt",
    clear: "Inte upptäckt",
    unavailable: "Ej tillgänglig",
    on: "På",
    off: "Av",
    turn_all_off: "Stäng av allt",
    ed_area: "Område",
    ed_title: "Titel",
    ed_show_title: "Visa rubrik",
    ed_title_helper: "Lämna tomt för områdets namn",
    ed_columns: "Kolumner",
    ed_layout: "Layout",
    ed_layout_helper: "Rutor: en stor ruta per entitet, som Ruta-kortet, lättare att trycka på i mobilen",
    ed_layout_compact: "Kompakt",
    ed_layout_tiles: "Rutor",
    ed_advanced: "Avancerat",
    ed_language: "Språk",
    ed_language_helper: "Tomt: Home Assistants språk",
    ed_language_auto: "Automatiskt",
    ed_entities: "Explicita entiteter (YAML)",
    ed_entities_helper: "Ersätter den automatiska identifieringen: entitets-ID:n eller {entity, name, icon}",
    ed_thresholds: "Komfortgränser (YAML)",
    ed_thresholds_helper: "Per typ, i sensorns enhet, t.ex. co2: [800, 1200] eller humidity: [25, 35, 70, 80]",
    ed_rooms: "Rum (YAML)",
    ed_rooms_helper: "Ordning och anpassningar: en lista med {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigeringssökväg",
    ed_all_off_button: "Knappen ”Stäng av allt”",
    err_config: "Ange `area` eller `entities`",
    zoom_in: "Visa hela kortet",
    zoom_out: "Tillbaka till kompakt vy",
    ed_zoom: "Zoomknapp",
    ed_zoom_helper: "Växlar mellan minikortet och hela kortet",
    rooms_all: "Visa alla rum",
    rooms_check: "Bara rum som behöver ses över",
    ed_sort: "Sortering",
    ed_sort_name: "Efter namn",
    ed_exclude_areas: "Rum att utesluta",
  },
  bg: {
    all_closed: "Всичко е затворено",
    all_quiet: "Всичко е спокойно",
    open_one: "Отворени: {n}",
    open_many: "Отворени: {n}",
    unavail_one: "Недостъпни: {n}",
    unavail_many: "Недостъпни: {n}",
    leak: "Теч на вода",
    smoke: "Открит дим",
    gas: "Открит газ",
    co: "Въглероден оксид",
    detected: "Открито",
    clear: "Не е открито",
    unavailable: "Недостъпно",
    on: "Включен",
    off: "Изключен",
    turn_all_off: "Изключи всичко",
    ed_area: "Зона",
    ed_title: "Заглавие",
    ed_show_title: "Показване на заглавието",
    ed_title_helper: "Оставете празно за името на зоната",
    ed_columns: "Колони",
    ed_layout: "Оформление",
    ed_layout_helper: "Плочки: по една голяма плочка за обект, като картата Плочка, по-лесна за докосване на телефон",
    ed_layout_compact: "Компактно",
    ed_layout_tiles: "Плочки",
    ed_advanced: "Разширени",
    ed_language: "Език",
    ed_language_helper: "Празно: езикът на Home Assistant",
    ed_language_auto: "Автоматично",
    ed_entities: "Изрично зададени обекти (YAML)",
    ed_entities_helper: "Заменя автоматичното откриване: ID на обекти или {entity, name, icon}",
    ed_thresholds: "Прагове на комфорт (YAML)",
    ed_thresholds_helper: "По вид, в мерната единица на сензора, напр. co2: [800, 1200] или humidity: [25, 35, 70, 80]",
    ed_rooms: "Стаи (YAML)",
    ed_rooms_helper: "Ред и персонализиране: списък от {area, name, icon, navigation_path}",
    ed_navigation_path: "Път за навигация",
    ed_all_off_button: "Бутон „Изключи всичко“",
    err_config: "Задайте `area` или `entities`",
    zoom_in: "Покажи пълната карта",
    zoom_out: "Обратно към компактния изглед",
    ed_zoom: "Бутон за увеличение",
    ed_zoom_helper: "Превключва от мини картата към пълната карта и обратно",
    rooms_all: "Покажи всички стаи",
    rooms_check: "Само стаите, които изискват внимание",
    ed_sort: "Сортиране",
    ed_sort_name: "По име",
    ed_exclude_areas: "Стаи за пропускане",
  },
  ru: {
    all_closed: "Всё закрыто",
    all_quiet: "Всё спокойно",
    open_one: "Открыто: {n}",
    open_many: "Открыто: {n}",
    unavail_one: "Недоступно: {n}",
    unavail_many: "Недоступно: {n}",
    leak: "Протечка",
    smoke: "Обнаружен дым",
    gas: "Обнаружен газ",
    co: "Угарный газ",
    detected: "Обнаружено",
    clear: "Не обнаружено",
    unavailable: "Недоступно",
    on: "Включено",
    off: "Выключено",
    turn_all_off: "Выключить всё",
    ed_area: "Пространство",
    ed_title: "Заголовок",
    ed_show_title: "Показывать заголовок",
    ed_title_helper: "Оставьте пустым, чтобы использовать название пространства",
    ed_columns: "Столбцы",
    ed_layout: "Макет",
    ed_layout_helper: "Плитки: одна большая плитка на объект, как карточка «Плитка», удобнее нажимать на телефоне",
    ed_layout_compact: "Компактный",
    ed_layout_tiles: "Плитки",
    ed_advanced: "Дополнительно",
    ed_language: "Язык",
    ed_language_helper: "Пусто: язык Home Assistant",
    ed_language_auto: "Автоматически",
    ed_entities: "Явно заданные объекты (YAML)",
    ed_entities_helper: "Заменяет автоматическое обнаружение: ID объектов или {entity, name, icon}",
    ed_thresholds: "Пороги комфорта (YAML)",
    ed_thresholds_helper: "Для каждого типа, в единицах датчика, например co2: [800, 1200] или humidity: [25, 35, 70, 80]",
    ed_rooms: "Комнаты (YAML)",
    ed_rooms_helper: "Порядок и настройки: список {area, name, icon, navigation_path}",
    ed_navigation_path: "Путь навигации",
    ed_all_off_button: "Кнопка «Выключить всё»",
    err_config: "Укажите `area` или `entities`",
    zoom_in: "Показать полную карточку",
    zoom_out: "Вернуться к компактному виду",
    ed_zoom: "Кнопка масштаба",
    ed_zoom_helper: "Переключает мини-карточку на полную карточку и обратно",
    rooms_all: "Показать все комнаты",
    rooms_check: "Только комнаты, требующие внимания",
    ed_sort: "Сортировка",
    ed_sort_name: "По названию",
    ed_exclude_areas: "Исключить комнаты",
  },
  uk: {
    all_closed: "Усе зачинено",
    all_quiet: "Усе спокійно",
    open_one: "Відчинено: {n}",
    open_many: "Відчинено: {n}",
    unavail_one: "Недоступно: {n}",
    unavail_many: "Недоступно: {n}",
    leak: "Витік води",
    smoke: "Виявлено дим",
    gas: "Виявлено газ",
    co: "Чадний газ",
    detected: "Виявлено",
    clear: "Не виявлено",
    unavailable: "Недоступно",
    on: "Увімкнено",
    off: "Вимкнено",
    turn_all_off: "Вимкнути все",
    ed_area: "Простір",
    ed_title: "Заголовок",
    ed_show_title: "Показувати заголовок",
    ed_title_helper: "Залиште порожнім, щоб використати назву простору",
    ed_columns: "Стовпці",
    ed_layout: "Макет",
    ed_layout_helper: "Плитки: одна велика плитка на сутність, як картка «Плитка», зручніше торкатися на телефоні",
    ed_layout_compact: "Компактний",
    ed_layout_tiles: "Плитки",
    ed_advanced: "Додатково",
    ed_language: "Мова",
    ed_language_helper: "Порожньо: мова Home Assistant",
    ed_language_auto: "Автоматично",
    ed_entities: "Явно задані сутності (YAML)",
    ed_entities_helper: "Замінює автоматичне виявлення: ID сутностей або {entity, name, icon}",
    ed_thresholds: "Пороги комфорту (YAML)",
    ed_thresholds_helper: "Для кожного типу, в одиницях датчика, наприклад co2: [800, 1200] або humidity: [25, 35, 70, 80]",
    ed_rooms: "Кімнати (YAML)",
    ed_rooms_helper: "Порядок і налаштування: список {area, name, icon, navigation_path}",
    ed_navigation_path: "Шлях навігації",
    ed_all_off_button: "Кнопка «Вимкнути все»",
    err_config: "Вкажіть `area` або `entities`",
    zoom_in: "Показати повну картку",
    zoom_out: "Повернутися до компактного вигляду",
    ed_zoom: "Кнопка масштабу",
    ed_zoom_helper: "Перемикає міні-картку на повну картку й назад",
    rooms_all: "Показати всі кімнати",
    rooms_check: "Лише кімнати, що потребують уваги",
    ed_sort: "Сортування",
    ed_sort_name: "За назвою",
    ed_exclude_areas: "Виключити кімнати",
  },
  hu: {
    all_closed: "Minden zárva",
    all_quiet: "Minden nyugodt",
    open_one: "{n} nyitva",
    open_many: "{n} nyitva",
    unavail_one: "{n} nem elérhető",
    unavail_many: "{n} nem elérhető",
    leak: "Vízszivárgás",
    smoke: "Füst észlelve",
    gas: "Gáz észlelve",
    co: "Szén-monoxid",
    detected: "Észlelve",
    clear: "Nincs észlelés",
    unavailable: "Nem elérhető",
    on: "Be",
    off: "Ki",
    turn_all_off: "Minden kikapcsolása",
    ed_area: "Terület",
    ed_title: "Cím",
    ed_show_title: "Cím megjelenítése",
    ed_title_helper: "Hagyd üresen a terület nevéhez",
    ed_columns: "Oszlopok",
    ed_layout: "Elrendezés",
    ed_layout_helper: "Csempék: entitásonként egy nagy csempe, mint a Csempe kártya, telefonon könnyebb megérinteni",
    ed_layout_compact: "Tömör",
    ed_layout_tiles: "Csempék",
    ed_advanced: "Speciális",
    ed_language: "Nyelv",
    ed_language_helper: "Üres: a Home Assistant nyelve",
    ed_language_auto: "Automatikus",
    ed_entities: "Kifejezetten megadott entitások (YAML)",
    ed_entities_helper: "Felülírja az automatikus felismerést: entitásazonosítók vagy {entity, name, icon}",
    ed_thresholds: "Komfortküszöbök (YAML)",
    ed_thresholds_helper: "Típusonként, az érzékelő mértékegységében, pl. co2: [800, 1200] vagy humidity: [25, 35, 70, 80]",
    ed_rooms: "Helyiségek (YAML)",
    ed_rooms_helper: "Sorrend és testreszabás: {area, name, icon, navigation_path} elemek listája",
    ed_navigation_path: "Navigációs útvonal",
    ed_all_off_button: "„Minden kikapcsolása” gomb",
    err_config: "Állítsd be az `area` vagy az `entities` értékét",
    zoom_in: "A teljes kártya megjelenítése",
    zoom_out: "Vissza a kompakt nézethez",
    ed_zoom: "Nagyítás gomb",
    ed_zoom_helper: "Vált a mini kártya és a teljes kártya között",
    rooms_all: "Minden helyiség megjelenítése",
    rooms_check: "Csak a figyelmet igénylő helyiségek",
    ed_sort: "Rendezés",
    ed_sort_name: "Név szerint",
    ed_exclude_areas: "Kihagyott helyiségek",
  },
  sk: {
    all_closed: "Všetko zatvorené",
    all_quiet: "Všetko pokojné",
    open_one: "Otvorené: {n}",
    open_many: "Otvorené: {n}",
    unavail_one: "Nedostupné: {n}",
    unavail_many: "Nedostupné: {n}",
    leak: "Únik vody",
    smoke: "Zistený dym",
    gas: "Zistený plyn",
    co: "Oxid uhoľnatý",
    detected: "Zistené",
    clear: "Nezistené",
    unavailable: "Nedostupné",
    on: "Zapnuté",
    off: "Vypnuté",
    turn_all_off: "Vypnúť všetko",
    ed_area: "Oblasť",
    ed_title: "Názov",
    ed_show_title: "Zobraziť názov",
    ed_title_helper: "Nechajte prázdne pre názov oblasti",
    ed_columns: "Stĺpce",
    ed_layout: "Rozloženie",
    ed_layout_helper: "Dlaždice: jedna veľká dlaždica na entitu ako karta Dlaždica, na telefóne sa ľahšie ťuká",
    ed_layout_compact: "Kompaktné",
    ed_layout_tiles: "Dlaždice",
    ed_advanced: "Rozšírené",
    ed_language: "Jazyk",
    ed_language_helper: "Prázdne: jazyk Home Assistanta",
    ed_language_auto: "Automaticky",
    ed_entities: "Explicitné entity (YAML)",
    ed_entities_helper: "Nahrádza automatické vyhľadávanie: ID entít alebo {entity, name, icon}",
    ed_thresholds: "Prahy komfortu (YAML)",
    ed_thresholds_helper: "Podľa druhu, v jednotke senzora, napr. co2: [800, 1200] alebo humidity: [25, 35, 70, 80]",
    ed_rooms: "Miestnosti (YAML)",
    ed_rooms_helper: "Poradie a úpravy: zoznam {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigačná cesta",
    ed_all_off_button: "Tlačidlo „Vypnúť všetko“",
    err_config: "Nastavte `area` alebo `entities`",
    zoom_in: "Zobraziť celú kartu",
    zoom_out: "Späť na kompaktné zobrazenie",
    ed_zoom: "Tlačidlo priblíženia",
    ed_zoom_helper: "Prepína minikartu na celú kartu a späť",
    rooms_all: "Zobraziť všetky miestnosti",
    rooms_check: "Len miestnosti vyžadujúce pozornosť",
    ed_sort: "Zoradenie",
    ed_sort_name: "Podľa názvu",
    ed_exclude_areas: "Vynechané miestnosti",
  },
  cs: {
    all_closed: "Vše zavřeno",
    all_quiet: "Vše v klidu",
    open_one: "Otevřeno: {n}",
    open_many: "Otevřeno: {n}",
    unavail_one: "Nedostupné: {n}",
    unavail_many: "Nedostupné: {n}",
    leak: "Únik vody",
    smoke: "Zjištěn kouř",
    gas: "Zjištěn plyn",
    co: "Oxid uhelnatý",
    detected: "Zjištěno",
    clear: "Nezjištěno",
    unavailable: "Nedostupné",
    on: "Zapnuto",
    off: "Vypnuto",
    turn_all_off: "Vypnout vše",
    ed_area: "Oblast",
    ed_title: "Název",
    ed_show_title: "Zobrazit název",
    ed_title_helper: "Ponechte prázdné pro název oblasti",
    ed_columns: "Sloupce",
    ed_layout: "Rozložení",
    ed_layout_helper: "Dlaždice: jedna velká dlaždice na entitu jako karta Dlaždice, na telefonu se snáz ťuká",
    ed_layout_compact: "Kompaktní",
    ed_layout_tiles: "Dlaždice",
    ed_advanced: "Pokročilé",
    ed_language: "Jazyk",
    ed_language_helper: "Prázdné: jazyk Home Assistanta",
    ed_language_auto: "Automaticky",
    ed_entities: "Explicitní entity (YAML)",
    ed_entities_helper: "Nahrazuje automatické vyhledávání: ID entit nebo {entity, name, icon}",
    ed_thresholds: "Prahy komfortu (YAML)",
    ed_thresholds_helper: "Podle druhu, v jednotce senzoru, např. co2: [800, 1200] nebo humidity: [25, 35, 70, 80]",
    ed_rooms: "Místnosti (YAML)",
    ed_rooms_helper: "Pořadí a úpravy: seznam {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigační cesta",
    ed_all_off_button: "Tlačítko „Vypnout vše“",
    err_config: "Nastavte `area` nebo `entities`",
    zoom_in: "Zobrazit celou kartu",
    zoom_out: "Zpět na kompaktní zobrazení",
    ed_zoom: "Tlačítko přiblížení",
    ed_zoom_helper: "Přepíná minikartu na celou kartu a zpět",
    rooms_all: "Zobrazit všechny místnosti",
    rooms_check: "Jen místnosti vyžadující pozornost",
    ed_sort: "Řazení",
    ed_sort_name: "Podle názvu",
    ed_exclude_areas: "Vynechané místnosti",
  },
  sl: {
    all_closed: "Vse zaprto",
    all_quiet: "Vse mirno",
    open_one: "Odprto: {n}",
    open_many: "Odprto: {n}",
    unavail_one: "Ni na voljo: {n}",
    unavail_many: "Ni na voljo: {n}",
    leak: "Puščanje vode",
    smoke: "Zaznan dim",
    gas: "Zaznan plin",
    co: "Ogljikov monoksid",
    detected: "Zaznano",
    clear: "Ni zaznano",
    unavailable: "Ni na voljo",
    on: "Vklopljeno",
    off: "Izklopljeno",
    turn_all_off: "Izklopi vse",
    ed_area: "Območje",
    ed_title: "Naslov",
    ed_show_title: "Prikaži naslov",
    ed_title_helper: "Pustite prazno za ime območja",
    ed_columns: "Stolpci",
    ed_layout: "Postavitev",
    ed_layout_helper: "Ploščice: ena velika ploščica na entiteto, kot kartica Ploščica, lažje za dotik na telefonu",
    ed_layout_compact: "Strnjena",
    ed_layout_tiles: "Ploščice",
    ed_advanced: "Napredno",
    ed_language: "Jezik",
    ed_language_helper: "Prazno: jezik Home Assistanta",
    ed_language_auto: "Samodejno",
    ed_entities: "Izrecno navedene entitete (YAML)",
    ed_entities_helper: "Nadomesti samodejno zaznavanje: ID-ji entitet ali {entity, name, icon}",
    ed_thresholds: "Pragovi udobja (YAML)",
    ed_thresholds_helper: "Po vrsti, v enoti senzorja, npr. co2: [800, 1200] ali humidity: [25, 35, 70, 80]",
    ed_rooms: "Prostori (YAML)",
    ed_rooms_helper: "Vrstni red in prilagoditve: seznam {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigacijska pot",
    ed_all_off_button: "Gumb »Izklopi vse«",
    err_config: "Nastavite `area` ali `entities`",
    zoom_in: "Prikaži celotno kartico",
    zoom_out: "Nazaj na strnjen pogled",
    ed_zoom: "Gumb za povečavo",
    ed_zoom_helper: "Preklopi mini kartico v celotno kartico in nazaj",
    rooms_all: "Prikaži vse prostore",
    rooms_check: "Samo prostori, ki potrebujejo pozornost",
    ed_sort: "Razvrščanje",
    ed_sort_name: "Po imenu",
    ed_exclude_areas: "Izpuščeni prostori",
  },
  lv: {
    all_closed: "Viss aizvērts",
    all_quiet: "Viss mierīgi",
    open_one: "Atvērti: {n}",
    open_many: "Atvērti: {n}",
    unavail_one: "Nav pieejami: {n}",
    unavail_many: "Nav pieejami: {n}",
    leak: "Ūdens noplūde",
    smoke: "Konstatēti dūmi",
    gas: "Konstatēta gāze",
    co: "Tvana gāze",
    detected: "Konstatēts",
    clear: "Nav konstatēts",
    unavailable: "Nav pieejams",
    on: "Ieslēgts",
    off: "Izslēgts",
    turn_all_off: "Izslēgt visu",
    ed_area: "Zona",
    ed_title: "Virsraksts",
    ed_show_title: "Rādīt virsrakstu",
    ed_title_helper: "Atstājiet tukšu, lai izmantotu zonas nosaukumu",
    ed_columns: "Kolonnas",
    ed_layout: "Izkārtojums",
    ed_layout_helper: "Flīzes: viena liela flīze katrai entītijai kā kartītē Flīze, tālrunī vieglāk pieskarties",
    ed_layout_compact: "Kompakts",
    ed_layout_tiles: "Flīzes",
    ed_advanced: "Papildu",
    ed_language: "Valoda",
    ed_language_helper: "Tukšs: Home Assistant valoda",
    ed_language_auto: "Automātiski",
    ed_entities: "Tieši norādītas vienības (YAML)",
    ed_entities_helper: "Aizstāj automātisko noteikšanu: vienību ID vai {entity, name, icon}",
    ed_thresholds: "Komforta sliekšņi (YAML)",
    ed_thresholds_helper: "Pēc veida, sensora mērvienībā, piem., co2: [800, 1200] vai humidity: [25, 35, 70, 80]",
    ed_rooms: "Telpas (YAML)",
    ed_rooms_helper: "Secība un pielāgojumi: saraksts ar {area, name, icon, navigation_path}",
    ed_navigation_path: "Navigācijas ceļš",
    ed_all_off_button: "Poga “Izslēgt visu”",
    err_config: "Iestatiet `area` vai `entities`",
    zoom_in: "Rādīt pilno karti",
    zoom_out: "Atpakaļ uz kompakto skatu",
    ed_zoom: "Tālummaiņas poga",
    ed_zoom_helper: "Pārslēdz mini karti uz pilno karti un atpakaļ",
    rooms_all: "Rādīt visas telpas",
    rooms_check: "Tikai telpas, kurām jāpievērš uzmanība",
    ed_sort: "Kārtošana",
    ed_sort_name: "Pēc nosaukuma",
    ed_exclude_areas: "Izslēdzamās telpas",
  },
  el: {
    all_closed: "Όλα κλειστά",
    all_quiet: "Όλα ήσυχα",
    open_one: "{n} ανοιχτό",
    open_many: "{n} ανοιχτά",
    unavail_one: "Μη διαθέσιμα: {n}",
    unavail_many: "Μη διαθέσιμα: {n}",
    leak: "Διαρροή νερού",
    smoke: "Ανιχνεύθηκε καπνός",
    gas: "Ανιχνεύθηκε αέριο",
    co: "Μονοξείδιο του άνθρακα",
    detected: "Ανιχνεύθηκε",
    clear: "Δεν ανιχνεύθηκε",
    unavailable: "Μη διαθέσιμο",
    on: "Ενεργή",
    off: "Ανενεργή",
    turn_all_off: "Απενεργοποίηση όλων",
    ed_area: "Περιοχή",
    ed_title: "Τίτλος",
    ed_show_title: "Εμφάνιση τίτλου",
    ed_title_helper: "Αφήστε το κενό για το όνομα της περιοχής",
    ed_columns: "Στήλες",
    ed_layout: "Διάταξη",
    ed_layout_helper: "Πλακίδια: ένα μεγάλο πλακίδιο ανά οντότητα, όπως η κάρτα Πλακίδιο, πιο εύκολο στο πάτημα στο κινητό",
    ed_layout_compact: "Συμπαγής",
    ed_layout_tiles: "Πλακίδια",
    ed_advanced: "Για προχωρημένους",
    ed_language: "Γλώσσα",
    ed_language_helper: "Κενό: η γλώσσα του Home Assistant",
    ed_language_auto: "Αυτόματα",
    ed_entities: "Ρητές οντότητες (YAML)",
    ed_entities_helper: "Αντικαθιστά τον αυτόματο εντοπισμό: αναγνωριστικά οντοτήτων ή {entity, name, icon}",
    ed_thresholds: "Όρια άνεσης (YAML)",
    ed_thresholds_helper: "Ανά είδος, στη μονάδα του αισθητήρα, π.χ. co2: [800, 1200] ή humidity: [25, 35, 70, 80]",
    ed_rooms: "Δωμάτια (YAML)",
    ed_rooms_helper: "Σειρά και προσαρμογές: μια λίστα με {area, name, icon, navigation_path}",
    ed_navigation_path: "Διαδρομή πλοήγησης",
    ed_all_off_button: "Κουμπί «Απενεργοποίηση όλων»",
    err_config: "Ορίστε `area` ή `entities`",
    zoom_in: "Εμφάνιση της πλήρους κάρτας",
    zoom_out: "Επιστροφή στη συμπαγή προβολή",
    ed_zoom: "Κουμπί ζουμ",
    ed_zoom_helper: "Εναλλάσσει τη μίνι κάρτα με την πλήρη κάρτα",
    rooms_all: "Εμφάνιση όλων των δωματίων",
    rooms_check: "Μόνο τα δωμάτια που χρειάζονται έλεγχο",
    ed_sort: "Ταξινόμηση",
    ed_sort_name: "Κατά όνομα",
    ed_exclude_areas: "Δωμάτια προς εξαίρεση",
  },
};

// ── Water pump ───────────────────────────────────────────────────────────────
// A pump is read from what tells it runs — its switch, a running binary sensor, or its power sensor (running above
// `threshold`) — and from the other sensors of its device: the level of its pit or tank (%), the pressure, the flow,
// today's pumped volume, an alarm. `entity` is any of the first three; `level`, `pressure`, `flow`, `volume` and
// `alarm` override the discovery. Its kind — a sump pump, a water pump (well, booster), an industrial pump — is found
// from its name, else set with `kind`: it decides the illustration.
const WP_KIND_NAMES = [
  ["sump", /sump|relevage|lift|drain|vide.?cave|eaux us[ée]es|tauchpumpe|hebeanlage|abwasser|sumidero|achique|sommergibile|sollevamento|dompel|pompa zatapial|przepompown|esgoto|drenaj|dr[aă]naj|pumpebrønd|dränkbar|länspump|дренаж|канализац|szennyvíz|drenážn|kalov|ponorn|drenas|αποστράγγισ/],
  ["industrial", /industri|process|procédé|prozess|proceso|processo|procesow|proces|centrifug|zentrifug|centrífug|pompe de circulation|circulation|umwälz|circolazione|circulación|circulatie|cyrkulac|circula[tț]i|cirkulation|циркулац|keringet|obehov|cirkulačn|obtočn|cirkulācij|κυκλοφορ/],
  ["well", /well|puits|forage|surpresseur|booster|hydrophore|brunnen|druckerh|hauswasser|pozo|grupo de presión|pozzo|autoclave|waterpomp|hydrofoor|studni|hydrofor|po[cç]o|pressuriz|fântân|hidrofor|brønd|trykforøg|brunn|tryckstegr|кладен|хидрофор|колод|скважин|насосная станция|kút|házi vízmű|studň|domáca vodáreň|domácí vodárna|vodnjak|hidropostaj|aka|hidrofors|γεώτρησ|πιεστικό|arrosage|irrigation|bewässerung|riego|irrigazione|beregening|nawadnian|rega|iriga[tț]i|vanding|bevattning|напояв|полив|öntöz|zavlažov|zalivan|laistīšan|άρδευσ|potable/],
];
const WP_KINDS = [...WP_KIND_NAMES.map(([k]) => k), "pump"];
const wpKindOf = (text) => WP_KIND_NAMES.find(([, re]) => re.test(String(text || "").toLowerCase()))?.[0] || "pump";
// A pump running longer than this without a stop is an alert (minutes), by kind.
const WP_MAX_RUN = { sump: 10, well: 30, industrial: 0, pump: 30 };

const wpNum = (st) => {
  const v = Number.parseFloat(st?.state);
  return Number.isFinite(v) ? v : null;
};
const wpLabel = (hass, id) => `${id} ${hass.states[id]?.attributes.friendly_name || ""}`;
const wpDeviceOf = (hass, id) => hass.entities?.[id]?.device_id;
const wpDeviceEntities = rcPerRegistry((hass) => {
  const out = {};
  for (const [id, r] of Object.entries(hass.entities || {})) if (r.device_id && !r.hidden) (out[r.device_id] ||= []).push(id);
  return out;
});
// The pumps of the home: switches, running binary sensors and power sensors named like a pump.
const WP_NAME = /pump|pompe|pumpe|bomba|pompa|pomp|помп|насос|szivatty|čerpadl|črpalk|sūkn|αντλί|relevage|surpresseur|booster|hydrophore/i;
const wpPumps = (hass) => {
  const ids = Object.keys(hass.states || {}).filter((id) => /^(switch|binary_sensor|sensor|input_boolean)\./.test(id) && WP_NAME.test(wpLabel(hass, id)) && !hass.entities?.[id]?.hidden && !hass.entities?.[id]?.entity_category);
  const rank = (id) => (id.startsWith("switch.") ? 0 : id.startsWith("binary_sensor.") ? 1 : id.startsWith("sensor.") && hass.states[id].attributes.device_class === "power" ? 2 : 3);
  return ids.filter((id) => rank(id) < 3).sort((a, b) => rank(a) - rank(b));
};

// The roles on the pump's device: switch, running (a binary sensor), power, level (%), pressure, flow, volume, alarm
// (a binary sensor: problem, moisture, safety, or named high / alarm / overflow). `overrides` win.
const wpFind = (hass, entity, overrides = {}) => {
  const device = entity && wpDeviceOf(hass, entity);
  const ids = ((device && wpDeviceEntities(hass)[device]) || []).filter((id) => id !== entity && hass.states[id]);
  const st = (id) => hass.states[id];
  const dc = (id) => st(id)?.attributes.device_class;
  const unit = (id) => st(id)?.attributes.unit_of_measurement;
  const named = (id, re) => re.test(wpLabel(hass, id));
  const dom = (id) => id.split(".")[0];
  const pick = (test) => ids.find((id) => !hass.entities?.[id]?.entity_category && test(id)) || ids.find(test);
  const own = (role, test) => (entity && test(entity) ? entity : undefined) || overrides[role] || pick(test);
  const isPower = (id) => dom(id) === "sensor" && (dc(id) === "power" || ["W", "kW"].includes(unit(id)));
  const isRunning = (id) => dom(id) === "binary_sensor" && (dc(id) === "running" || named(id, /run|marche|läuft|funcion|funziona|loopt|pracuj|lauf|pump|pompe/i)) && !named(id, /alarm|high|haut|overflow|fault|error|défaut/i);
  return {
    switch: own("switch", (id) => /^(switch|input_boolean)\./.test(id)),
    running: own("running", isRunning),
    power: own("power", isPower),
    level: overrides.level || pick((id) => dom(id) === "sensor" && unit(id) === "%" && named(id, /level|niveau|füllstand|nivel|livello|peil|poziom|nível|nivel|niveau|niv[aå]|ниво|уров|рів|szint|hladin|nivo|līmen|στάθμ|cuve|tank|pit|fosse|puisard/i)),
    pressure: overrides.pressure || pick((id) => dom(id) === "sensor" && (dc(id) === "pressure" || ["bar", "mbar", "psi", "kPa", "hPa"].includes(unit(id)))),
    flow: overrides.flow || pick((id) => dom(id) === "sensor" && (dc(id) === "volume_flow_rate" || /\/(min|h|s)$/.test(unit(id) || "")) && !isPower(id)),
    volume: overrides.volume || pick((id) => dom(id) === "sensor" && (dc(id) === "water" || dc(id) === "volume") && ["L", "m³", "gal"].includes(unit(id))),
    alarm: overrides.alarm || pick((id) => dom(id) === "binary_sensor" && (["problem", "moisture", "safety"].includes(dc(id)) || named(id, /alarm|high|haut|overflow|débord|hoch|alto|alta|fault|défaut|störung/i))),
  };
};

// The runs in a history of on/off points { t, on } up to `now`: each a stretch on, with its start and end.
const wpRuns = (points, now) => {
  const runs = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const end = Math.min(points[i + 1]?.t ?? now, now);
    if (!p.on || end <= p.t) continue;
    const last = runs.at(-1);
    if (last && last.end >= p.t) last.end = end;
    else runs.push({ start: p.t, end });
  }
  return runs;
};
// Recorder rows (minimal response) as on/off points: `on(state)` decides (a power above the threshold, a switch on).
const wpPoints = (rows, on) =>
  (rows || [])
    .map((r) => ({ t: Math.round((r.lu ?? Date.parse(r.last_updated ?? r.last_changed) / 1000) * 1000), s: r.s ?? r.state }))
    .filter((p) => Number.isFinite(p.t) && p.s != null && !["unavailable", "unknown"].includes(p.s))
    .sort((a, b) => a.t - b.t)
    .map((p) => ({ t: p.t, on: on(p.s) }));

// Strings of the water pump cards; the shared ones above (unavailable, editor basics) complete them.
const WP_I18N = {
  en: {
    title: "Pump",
    st_running: "Pumping",
    st_idle: "Idle",
    st_alert: "Alert",
    st_offline: "Offline",
    running_for: "Pumping for {d}",
    last_run: "Last run {d} ago",
    no_run: "No run in 24 hours",
    level: "Level",
    lv_start: "Start {p}",
    lv_stop: "Stop {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Runs · last 24 hours",
    now: "now",
    t_cycles: "Cycles today",
    t_avg: "Average run",
    t_runtime: "Runtime today",
    t_pressure: "Pressure",
    t_flow: "Flow",
    t_power: "Power",
    t_volume: "Pumped today",
    ok: "No alarm",
    alert_level: "High level",
    alert_alarm: "Alarm",
    alert_long: "Running non-stop for {d}",
    max_run: "Alert after {d} non-stop",
    start: "Start",
    stop: "Stop",
    no_pump: "No pump found",
    k_auto: "Automatic (from the name)",
    k_sump: "Sump pump",
    k_well: "Water pump (well, booster)",
    k_industrial: "Industrial pump",
    k_pump: "Pump",
    ed_entity: "Pump",
    ed_entity_helper: "The pump's switch, its running binary sensor, or its power sensor",
    ed_kind: "Kind of pump",
    ed_level: "Level sensor",
    ed_level_helper: "The pit's or tank's level, in %",
    ed_pressure: "Pressure sensor",
    ed_flow: "Flow sensor",
    ed_volume: "Volume sensor",
    ed_alarm: "Alarm sensor",
    ed_alarm_helper: "A high-level float or a fault, as a binary sensor",
    ed_threshold: "Running above",
    ed_threshold_helper: "Watts, when the pump is read from its power",
    ed_level_start: "Start level",
    ed_level_stop: "Stop level",
    ed_level_alarm: "Alarm level",
    ed_max_run: "Alert after running",
    ed_max_run_helper: "Minutes non-stop before an alert; 0: never",
    ed_show_runs: "24-hour runs",
    ed_animations: "Animations",
    ed_show_controls: "Controls",
    ed_title_helper: "Empty: the pump's name",
    ed_illustration: "Illustrated header",
    ed_illustration_theme: "Header theme",
    ed_theme_auto: "Automatic (sun or dark theme)",
    ed_theme_day: "Day",
    ed_theme_night: "Night",
  },
  fr: {
    title: "Pompe",
    st_running: "Pompe",
    st_idle: "Au repos",
    st_alert: "Alerte",
    st_offline: "Hors ligne",
    running_for: "Pompe depuis {d}",
    last_run: "Dernier pompage il y a {d}",
    no_run: "Aucun pompage en 24 heures",
    level: "Niveau",
    lv_start: "Démarrage {p}",
    lv_stop: "Arrêt {p}",
    lv_alarm: "Alarme {p}",
    runs_24h: "Pompages · dernières 24 heures",
    now: "maint.",
    t_cycles: "Cycles du jour",
    t_avg: "Durée moyenne",
    t_runtime: "Durée du jour",
    t_pressure: "Pression",
    t_flow: "Débit",
    t_power: "Puissance",
    t_volume: "Pompé aujourd'hui",
    ok: "Aucune alarme",
    alert_level: "Niveau haut",
    alert_alarm: "Alarme",
    alert_long: "Tourne sans arrêt depuis {d}",
    max_run: "Alerte après {d} sans arrêt",
    start: "Démarrer",
    stop: "Arrêter",
    no_pump: "Aucune pompe trouvée",
    k_auto: "Automatique (d'après le nom)",
    k_sump: "Pompe de relevage",
    k_well: "Pompe à eau (puits, surpresseur)",
    k_industrial: "Pompe industrielle",
    k_pump: "Pompe",
    ed_entity: "Pompe",
    ed_entity_helper: "L'interrupteur de la pompe, son capteur de marche, ou son capteur de puissance",
    ed_kind: "Type de pompe",
    ed_level: "Capteur de niveau",
    ed_level_helper: "Le niveau de la fosse ou de la cuve, en %",
    ed_pressure: "Capteur de pression",
    ed_flow: "Capteur de débit",
    ed_volume: "Capteur de volume",
    ed_alarm: "Capteur d'alarme",
    ed_alarm_helper: "Un flotteur de niveau haut ou un défaut, en capteur binaire",
    ed_threshold: "En marche au-dessus de",
    ed_threshold_helper: "Watts, quand la pompe est lue par sa puissance",
    ed_level_start: "Niveau de démarrage",
    ed_level_stop: "Niveau d'arrêt",
    ed_level_alarm: "Niveau d'alarme",
    ed_max_run: "Alerte après une marche de",
    ed_max_run_helper: "Minutes sans arrêt avant une alerte ; 0 : jamais",
    ed_show_runs: "Pompages sur 24 heures",
    ed_animations: "Animations",
    ed_show_controls: "Commandes",
    ed_title_helper: "Vide : le nom de la pompe",
    ed_illustration: "En-tête illustré",
    ed_illustration_theme: "Thème de l'en-tête",
    ed_theme_auto: "Automatique (soleil ou thème sombre)",
    ed_theme_day: "Jour",
    ed_theme_night: "Nuit",
  },
  de: {
    title: "Pumpe",
    st_running: "Pumpt",
    st_idle: "Bereit",
    st_alert: "Alarm",
    st_offline: "Offline",
    running_for: "Pumpt seit {d}",
    last_run: "Letzter Lauf vor {d}",
    no_run: "Kein Lauf in 24 Stunden",
    level: "Füllstand",
    lv_start: "Start {p}",
    lv_stop: "Stopp {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Läufe · letzte 24 Stunden",
    now: "jetzt",
    t_cycles: "Zyklen heute",
    t_avg: "Ø Laufzeit",
    t_runtime: "Laufzeit heute",
    t_pressure: "Druck",
    t_flow: "Durchfluss",
    t_power: "Leistung",
    t_volume: "Heute gepumpt",
    ok: "Kein Alarm",
    alert_level: "Hoher Füllstand",
    alert_alarm: "Alarm",
    alert_long: "Läuft ununterbrochen seit {d}",
    max_run: "Alarm nach {d} Dauerlauf",
    start: "Starten",
    stop: "Stoppen",
    no_pump: "Keine Pumpe gefunden",
    k_auto: "Automatisch (nach dem Namen)",
    k_sump: "Hebe- / Tauchpumpe",
    k_well: "Wasserpumpe (Brunnen, Druckerhöhung)",
    k_industrial: "Industriepumpe",
    k_pump: "Pumpe",
    ed_entity: "Pumpe",
    ed_entity_helper: "Der Schalter der Pumpe, ihr Laufsensor oder ihr Leistungssensor",
    ed_kind: "Pumpenart",
    ed_level: "Füllstandssensor",
    ed_level_helper: "Der Füllstand des Schachts oder Tanks, in %",
    ed_pressure: "Drucksensor",
    ed_flow: "Durchflusssensor",
    ed_volume: "Volumensensor",
    ed_alarm: "Alarmsensor",
    ed_alarm_helper: "Ein Hochwasser-Schwimmer oder eine Störung, als Binärsensor",
    ed_threshold: "Läuft ab",
    ed_threshold_helper: "Watt, wenn die Pumpe über ihre Leistung gelesen wird",
    ed_level_start: "Einschaltpegel",
    ed_level_stop: "Ausschaltpegel",
    ed_level_alarm: "Alarmpegel",
    ed_max_run: "Alarm nach einer Laufzeit von",
    ed_max_run_helper: "Minuten ohne Pause vor einem Alarm; 0: nie",
    ed_show_runs: "Läufe über 24 Stunden",
    ed_animations: "Animationen",
    ed_show_controls: "Bedienelemente",
    ed_title_helper: "Leer: der Name der Pumpe",
    ed_illustration: "Illustrierte Kopfzeile",
    ed_illustration_theme: "Thema der Kopfzeile",
    ed_theme_auto: "Automatisch (Sonne oder dunkles Thema)",
    ed_theme_day: "Tag",
    ed_theme_night: "Nacht",
  },
  es: {
    title: "Bomba",
    st_running: "Bombeando",
    st_idle: "En reposo",
    st_alert: "Alerta",
    st_offline: "Sin conexión",
    running_for: "Bombeando desde hace {d}",
    last_run: "Último bombeo hace {d}",
    no_run: "Sin bombeo en 24 horas",
    level: "Nivel",
    lv_start: "Arranque {p}",
    lv_stop: "Parada {p}",
    lv_alarm: "Alarma {p}",
    runs_24h: "Bombeos · últimas 24 horas",
    now: "ahora",
    t_cycles: "Ciclos de hoy",
    t_avg: "Duración media",
    t_runtime: "Tiempo de hoy",
    t_pressure: "Presión",
    t_flow: "Caudal",
    t_power: "Potencia",
    t_volume: "Bombeado hoy",
    ok: "Sin alarma",
    alert_level: "Nivel alto",
    alert_alarm: "Alarma",
    alert_long: "Funcionando sin parar desde hace {d}",
    max_run: "Alerta tras {d} sin parar",
    start: "Arrancar",
    stop: "Parar",
    no_pump: "No se encontró ninguna bomba",
    k_auto: "Automático (según el nombre)",
    k_sump: "Bomba de achique",
    k_well: "Bomba de agua (pozo, grupo de presión)",
    k_industrial: "Bomba industrial",
    k_pump: "Bomba",
    ed_entity: "Bomba",
    ed_entity_helper: "El interruptor de la bomba, su sensor de funcionamiento o su sensor de potencia",
    ed_kind: "Tipo de bomba",
    ed_level: "Sensor de nivel",
    ed_level_helper: "El nivel del pozo o del depósito, en %",
    ed_pressure: "Sensor de presión",
    ed_flow: "Sensor de caudal",
    ed_volume: "Sensor de volumen",
    ed_alarm: "Sensor de alarma",
    ed_alarm_helper: "Un flotador de nivel alto o un fallo, como sensor binario",
    ed_threshold: "En marcha por encima de",
    ed_threshold_helper: "Vatios, cuando la bomba se lee por su potencia",
    ed_level_start: "Nivel de arranque",
    ed_level_stop: "Nivel de parada",
    ed_level_alarm: "Nivel de alarma",
    ed_max_run: "Alerta tras funcionar",
    ed_max_run_helper: "Minutos sin parar antes de una alerta; 0: nunca",
    ed_show_runs: "Bombeos en 24 horas",
    ed_animations: "Animaciones",
    ed_show_controls: "Controles",
    ed_title_helper: "Vacío: el nombre de la bomba",
    ed_illustration: "Cabecera ilustrada",
    ed_illustration_theme: "Tema de la cabecera",
    ed_theme_auto: "Automático (sol o tema oscuro)",
    ed_theme_day: "Día",
    ed_theme_night: "Noche",
  },
  sr: {
    title: "Пумпа",
    st_running: "Пумпа",
    st_idle: "Мирује",
    st_alert: "Упозорење",
    st_offline: "Ван мреже",
    running_for: "Пумпа већ {d}",
    last_run: "Последњи рад пре {d}",
    no_run: "Без рада у последња 24 сата",
    level: "Ниво",
    lv_start: "Покретање {p}",
    lv_stop: "Заустављање {p}",
    lv_alarm: "Аларм {p}",
    runs_24h: "Рад · последња 24 сата",
    now: "сада",
    t_cycles: "Циклуси данас",
    t_avg: "Просечно трајање",
    t_runtime: "Време рада данас",
    t_pressure: "Притисак",
    t_flow: "Проток",
    t_power: "Снага",
    t_volume: "Испумпано данас",
    ok: "Нема аларма",
    alert_level: "Висок ниво",
    alert_alarm: "Аларм",
    alert_long: "Ради без прекида већ {d}",
    max_run: "Упозорење после {d} без прекида",
    start: "Покрени",
    stop: "Заустави",
    no_pump: "Није пронађена пумпа",
    k_auto: "Аутоматски (према имену)",
    k_sump: "Дренажна пумпа",
    k_well: "Пумпа за воду (бунар, хидрофор)",
    k_industrial: "Индустријска пумпа",
    k_pump: "Пумпа",
    ed_entity: "Пумпа",
    ed_entity_helper: "Прекидач пумпе, њен сензор рада или њен сензор снаге",
    ed_kind: "Врста пумпе",
    ed_level: "Сензор нивоа",
    ed_level_helper: "Ниво шахта или резервоара, у %",
    ed_pressure: "Сензор притиска",
    ed_flow: "Сензор протока",
    ed_volume: "Сензор запремине",
    ed_alarm: "Сензор аларма",
    ed_alarm_helper: "Пловак високог нивоа или квар, као бинарни сензор",
    ed_threshold: "Ради изнад",
    ed_threshold_helper: "Вати, када се пумпа очитава по снази",
    ed_level_start: "Ниво покретања",
    ed_level_stop: "Ниво заустављања",
    ed_level_alarm: "Ниво аларма",
    ed_max_run: "Упозорење после рада од",
    ed_max_run_helper: "Минути без прекида пре упозорења; 0: никад",
    ed_show_runs: "Рад у 24 сата",
    ed_animations: "Анимације",
    ed_show_controls: "Команде",
    ed_title_helper: "Празно: име пумпе",
    ed_illustration: "Илустровано заглавље",
    ed_illustration_theme: "Тема заглавља",
    ed_theme_auto: "Аутоматски (сунце или тамна тема)",
    ed_theme_day: "Дан",
    ed_theme_night: "Ноћ",
  },
  "sr-Latn": {
    title: "Pumpa",
    st_running: "Pumpa",
    st_idle: "Miruje",
    st_alert: "Upozorenje",
    st_offline: "Van mreže",
    running_for: "Pumpa već {d}",
    last_run: "Poslednji rad pre {d}",
    no_run: "Bez rada u poslednja 24 sata",
    level: "Nivo",
    lv_start: "Pokretanje {p}",
    lv_stop: "Zaustavljanje {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Rad · poslednja 24 sata",
    now: "sada",
    t_cycles: "Ciklusi danas",
    t_avg: "Prosečno trajanje",
    t_runtime: "Vreme rada danas",
    t_pressure: "Pritisak",
    t_flow: "Protok",
    t_power: "Snaga",
    t_volume: "Ispumpano danas",
    ok: "Nema alarma",
    alert_level: "Visok nivo",
    alert_alarm: "Alarm",
    alert_long: "Radi bez prekida već {d}",
    max_run: "Upozorenje posle {d} bez prekida",
    start: "Pokreni",
    stop: "Zaustavi",
    no_pump: "Nije pronađena pumpa",
    k_auto: "Automatski (prema imenu)",
    k_sump: "Drenažna pumpa",
    k_well: "Pumpa za vodu (bunar, hidrofor)",
    k_industrial: "Industrijska pumpa",
    k_pump: "Pumpa",
    ed_entity: "Pumpa",
    ed_entity_helper: "Prekidač pumpe, njen senzor rada ili njen senzor snage",
    ed_kind: "Vrsta pumpe",
    ed_level: "Senzor nivoa",
    ed_level_helper: "Nivo šahta ili rezervoara, u %",
    ed_pressure: "Senzor pritiska",
    ed_flow: "Senzor protoka",
    ed_volume: "Senzor zapremine",
    ed_alarm: "Senzor alarma",
    ed_alarm_helper: "Plovak visokog nivoa ili kvar, kao binarni senzor",
    ed_threshold: "Radi iznad",
    ed_threshold_helper: "Vati, kada se pumpa očitava po snazi",
    ed_level_start: "Nivo pokretanja",
    ed_level_stop: "Nivo zaustavljanja",
    ed_level_alarm: "Nivo alarma",
    ed_max_run: "Upozorenje posle rada od",
    ed_max_run_helper: "Minuti bez prekida pre upozorenja; 0: nikad",
    ed_show_runs: "Rad u 24 sata",
    ed_animations: "Animacije",
    ed_show_controls: "Komande",
    ed_title_helper: "Prazno: ime pumpe",
    ed_illustration: "Ilustrovano zaglavlje",
    ed_illustration_theme: "Tema zaglavlja",
    ed_theme_auto: "Automatski (sunce ili tamna tema)",
    ed_theme_day: "Dan",
    ed_theme_night: "Noć",
  },
  it: {
    title: "Pompa",
    st_running: "In pompaggio",
    st_idle: "A riposo",
    st_alert: "Allerta",
    st_offline: "Non in linea",
    running_for: "In pompaggio da {d}",
    last_run: "Ultimo pompaggio {d} fa",
    no_run: "Nessun pompaggio in 24 ore",
    level: "Livello",
    lv_start: "Avvio {p}",
    lv_stop: "Arresto {p}",
    lv_alarm: "Allarme {p}",
    runs_24h: "Pompaggi · ultime 24 ore",
    now: "ora",
    t_cycles: "Cicli di oggi",
    t_avg: "Durata media",
    t_runtime: "Durata di oggi",
    t_pressure: "Pressione",
    t_flow: "Portata",
    t_power: "Potenza",
    t_volume: "Pompato oggi",
    ok: "Nessun allarme",
    alert_level: "Livello alto",
    alert_alarm: "Allarme",
    alert_long: "In funzione senza sosta da {d}",
    max_run: "Allerta dopo {d} senza sosta",
    start: "Avvia",
    stop: "Arresta",
    no_pump: "Nessuna pompa trovata",
    k_auto: "Automatico (dal nome)",
    k_sump: "Pompa di sollevamento",
    k_well: "Pompa dell'acqua (pozzo, autoclave)",
    k_industrial: "Pompa industriale",
    k_pump: "Pompa",
    ed_entity: "Pompa",
    ed_entity_helper: "L'interruttore della pompa, il suo sensore di funzionamento o il suo sensore di potenza",
    ed_kind: "Tipo di pompa",
    ed_level: "Sensore di livello",
    ed_level_helper: "Il livello del pozzetto o del serbatoio, in %",
    ed_pressure: "Sensore di pressione",
    ed_flow: "Sensore di portata",
    ed_volume: "Sensore di volume",
    ed_alarm: "Sensore di allarme",
    ed_alarm_helper: "Un galleggiante di livello alto o un guasto, come sensore binario",
    ed_threshold: "In funzione sopra",
    ed_threshold_helper: "Watt, quando la pompa è letta dalla sua potenza",
    ed_level_start: "Livello di avvio",
    ed_level_stop: "Livello di arresto",
    ed_level_alarm: "Livello di allarme",
    ed_max_run: "Allerta dopo un funzionamento di",
    ed_max_run_helper: "Minuti senza sosta prima di un'allerta; 0: mai",
    ed_show_runs: "Pompaggi in 24 ore",
    ed_animations: "Animazioni",
    ed_show_controls: "Comandi",
    ed_title_helper: "Vuoto: il nome della pompa",
    ed_illustration: "Intestazione illustrata",
    ed_illustration_theme: "Tema dell'intestazione",
    ed_theme_auto: "Automatico (sole o tema scuro)",
    ed_theme_day: "Giorno",
    ed_theme_night: "Notte",
  },
  nl: {
    title: "Pomp",
    st_running: "Pompt",
    st_idle: "In rust",
    st_alert: "Waarschuwing",
    st_offline: "Offline",
    running_for: "Pompt sinds {d}",
    last_run: "Laatste keer {d} geleden",
    no_run: "Niet gepompt in 24 uur",
    level: "Niveau",
    lv_start: "Start {p}",
    lv_stop: "Stop {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Pompbeurten · laatste 24 uur",
    now: "nu",
    t_cycles: "Cycli vandaag",
    t_avg: "Gem. duur",
    t_runtime: "Looptijd vandaag",
    t_pressure: "Druk",
    t_flow: "Debiet",
    t_power: "Vermogen",
    t_volume: "Vandaag gepompt",
    ok: "Geen alarm",
    alert_level: "Hoog niveau",
    alert_alarm: "Alarm",
    alert_long: "Draait al {d} zonder stoppen",
    max_run: "Waarschuwing na {d} zonder stoppen",
    start: "Starten",
    stop: "Stoppen",
    no_pump: "Geen pomp gevonden",
    k_auto: "Automatisch (op naam)",
    k_sump: "Dompelpomp",
    k_well: "Waterpomp (put, hydrofoor)",
    k_industrial: "Industriële pomp",
    k_pump: "Pomp",
    ed_entity: "Pomp",
    ed_entity_helper: "De schakelaar van de pomp, haar bedrijfssensor of haar vermogenssensor",
    ed_kind: "Soort pomp",
    ed_level: "Niveausensor",
    ed_level_helper: "Het niveau van de put of de tank, in %",
    ed_pressure: "Druksensor",
    ed_flow: "Debietsensor",
    ed_volume: "Volumesensor",
    ed_alarm: "Alarmsensor",
    ed_alarm_helper: "Een hoogwatervlotter of een storing, als binaire sensor",
    ed_threshold: "Draait boven",
    ed_threshold_helper: "Watt, als de pomp via haar vermogen wordt gelezen",
    ed_level_start: "Startniveau",
    ed_level_stop: "Stopniveau",
    ed_level_alarm: "Alarmniveau",
    ed_max_run: "Waarschuwing na een looptijd van",
    ed_max_run_helper: "Minuten zonder stoppen voor een waarschuwing; 0: nooit",
    ed_show_runs: "Pompbeurten over 24 uur",
    ed_animations: "Animaties",
    ed_show_controls: "Bediening",
    ed_title_helper: "Leeg: de naam van de pomp",
    ed_illustration: "Geïllustreerde kop",
    ed_illustration_theme: "Thema van de kop",
    ed_theme_auto: "Automatisch (zon of donker thema)",
    ed_theme_day: "Dag",
    ed_theme_night: "Nacht",
  },
  pt: {
    title: "Bomba",
    st_running: "A bombear",
    st_idle: "Em repouso",
    st_alert: "Alerta",
    st_offline: "Offline",
    running_for: "A bombear há {d}",
    last_run: "Última bombagem há {d}",
    no_run: "Sem bombagem em 24 horas",
    level: "Nível",
    lv_start: "Arranque {p}",
    lv_stop: "Paragem {p}",
    lv_alarm: "Alarme {p}",
    runs_24h: "Bombagens · últimas 24 horas",
    now: "agora",
    t_cycles: "Ciclos de hoje",
    t_avg: "Duração média",
    t_runtime: "Tempo de hoje",
    t_pressure: "Pressão",
    t_flow: "Caudal",
    t_power: "Potência",
    t_volume: "Bombeado hoje",
    ok: "Sem alarme",
    alert_level: "Nível alto",
    alert_alarm: "Alarme",
    alert_long: "A funcionar sem parar há {d}",
    max_run: "Alerta após {d} sem parar",
    start: "Arrancar",
    stop: "Parar",
    no_pump: "Nenhuma bomba encontrada",
    k_auto: "Automático (pelo nome)",
    k_sump: "Bomba de drenagem",
    k_well: "Bomba de água (poço, sobrepressor)",
    k_industrial: "Bomba industrial",
    k_pump: "Bomba",
    ed_entity: "Bomba",
    ed_entity_helper: "O interruptor da bomba, o seu sensor de funcionamento ou o seu sensor de potência",
    ed_kind: "Tipo de bomba",
    ed_level: "Sensor de nível",
    ed_level_helper: "O nível do poço ou do depósito, em %",
    ed_pressure: "Sensor de pressão",
    ed_flow: "Sensor de caudal",
    ed_volume: "Sensor de volume",
    ed_alarm: "Sensor de alarme",
    ed_alarm_helper: "Uma boia de nível alto ou uma avaria, como sensor binário",
    ed_threshold: "A funcionar acima de",
    ed_threshold_helper: "Watts, quando a bomba é lida pela sua potência",
    ed_level_start: "Nível de arranque",
    ed_level_stop: "Nível de paragem",
    ed_level_alarm: "Nível de alarme",
    ed_max_run: "Alerta após funcionar",
    ed_max_run_helper: "Minutos sem parar antes de um alerta; 0: nunca",
    ed_show_runs: "Bombagens em 24 horas",
    ed_animations: "Animações",
    ed_show_controls: "Comandos",
    ed_title_helper: "Vazio: o nome da bomba",
    ed_illustration: "Cabeçalho ilustrado",
    ed_illustration_theme: "Tema do cabeçalho",
    ed_theme_auto: "Automático (sol ou tema escuro)",
    ed_theme_day: "Dia",
    ed_theme_night: "Noite",
  },
  pl: {
    title: "Pompa",
    st_running: "Pompuje",
    st_idle: "Spoczynek",
    st_alert: "Alarm",
    st_offline: "Offline",
    running_for: "Pompuje od {d}",
    last_run: "Ostatnie pompowanie {d} temu",
    no_run: "Brak pompowania od 24 godzin",
    level: "Poziom",
    lv_start: "Start {p}",
    lv_stop: "Stop {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Pompowania · ostatnie 24 godziny",
    now: "teraz",
    t_cycles: "Cykle dziś",
    t_avg: "Średni czas",
    t_runtime: "Czas pracy dziś",
    t_pressure: "Ciśnienie",
    t_flow: "Przepływ",
    t_power: "Moc",
    t_volume: "Wypompowano dziś",
    ok: "Brak alarmu",
    alert_level: "Wysoki poziom",
    alert_alarm: "Alarm",
    alert_long: "Pracuje bez przerwy od {d}",
    max_run: "Alarm po {d} bez przerwy",
    start: "Uruchom",
    stop: "Zatrzymaj",
    no_pump: "Nie znaleziono pompy",
    k_auto: "Automatycznie (z nazwy)",
    k_sump: "Pompa zatapialna",
    k_well: "Pompa wody (studnia, hydrofor)",
    k_industrial: "Pompa przemysłowa",
    k_pump: "Pompa",
    ed_entity: "Pompa",
    ed_entity_helper: "Przełącznik pompy, jej czujnik pracy lub jej czujnik mocy",
    ed_kind: "Rodzaj pompy",
    ed_level: "Czujnik poziomu",
    ed_level_helper: "Poziom studzienki lub zbiornika, w %",
    ed_pressure: "Czujnik ciśnienia",
    ed_flow: "Czujnik przepływu",
    ed_volume: "Czujnik objętości",
    ed_alarm: "Czujnik alarmu",
    ed_alarm_helper: "Pływak wysokiego poziomu lub awaria, jako czujnik binarny",
    ed_threshold: "Pracuje powyżej",
    ed_threshold_helper: "Waty, gdy pompa jest odczytywana z mocy",
    ed_level_start: "Poziom startu",
    ed_level_stop: "Poziom zatrzymania",
    ed_level_alarm: "Poziom alarmu",
    ed_max_run: "Alarm po czasie pracy",
    ed_max_run_helper: "Minuty bez przerwy przed alarmem; 0: nigdy",
    ed_show_runs: "Pompowania z 24 godzin",
    ed_animations: "Animacje",
    ed_show_controls: "Sterowanie",
    ed_title_helper: "Puste: nazwa pompy",
    ed_illustration: "Ilustrowany nagłówek",
    ed_illustration_theme: "Motyw nagłówka",
    ed_theme_auto: "Automatycznie (słońce lub ciemny motyw)",
    ed_theme_day: "Dzień",
    ed_theme_night: "Noc",
  },
  ro: {
    title: "Pompă",
    st_running: "Pompează",
    st_idle: "În repaus",
    st_alert: "Alertă",
    st_offline: "Offline",
    running_for: "Pompează de {d}",
    last_run: "Ultima pompare acum {d}",
    no_run: "Nicio pompare în 24 de ore",
    level: "Nivel",
    lv_start: "Pornire {p}",
    lv_stop: "Oprire {p}",
    lv_alarm: "Alarmă {p}",
    runs_24h: "Pompări · ultimele 24 de ore",
    now: "acum",
    t_cycles: "Cicluri azi",
    t_avg: "Durată medie",
    t_runtime: "Funcționare azi",
    t_pressure: "Presiune",
    t_flow: "Debit",
    t_power: "Putere",
    t_volume: "Pompat azi",
    ok: "Nicio alarmă",
    alert_level: "Nivel ridicat",
    alert_alarm: "Alarmă",
    alert_long: "Funcționează fără oprire de {d}",
    max_run: "Alertă după {d} fără oprire",
    start: "Pornește",
    stop: "Oprește",
    no_pump: "Nicio pompă găsită",
    k_auto: "Automat (după nume)",
    k_sump: "Pompă de drenaj",
    k_well: "Pompă de apă (fântână, hidrofor)",
    k_industrial: "Pompă industrială",
    k_pump: "Pompă",
    ed_entity: "Pompă",
    ed_entity_helper: "Comutatorul pompei, senzorul ei de funcționare sau senzorul ei de putere",
    ed_kind: "Tipul pompei",
    ed_level: "Senzor de nivel",
    ed_level_helper: "Nivelul bazinului sau al rezervorului, în %",
    ed_pressure: "Senzor de presiune",
    ed_flow: "Senzor de debit",
    ed_volume: "Senzor de volum",
    ed_alarm: "Senzor de alarmă",
    ed_alarm_helper: "Un plutitor de nivel ridicat sau o defecțiune, ca senzor binar",
    ed_threshold: "Funcționează peste",
    ed_threshold_helper: "Wați, când pompa este citită după putere",
    ed_level_start: "Nivel de pornire",
    ed_level_stop: "Nivel de oprire",
    ed_level_alarm: "Nivel de alarmă",
    ed_max_run: "Alertă după o funcționare de",
    ed_max_run_helper: "Minute fără oprire înaintea unei alerte; 0: niciodată",
    ed_show_runs: "Pompări în 24 de ore",
    ed_animations: "Animații",
    ed_show_controls: "Comenzi",
    ed_title_helper: "Gol: numele pompei",
    ed_illustration: "Antet ilustrat",
    ed_illustration_theme: "Tema antetului",
    ed_theme_auto: "Automat (soare sau temă întunecată)",
    ed_theme_day: "Zi",
    ed_theme_night: "Noapte",
  },
  da: {
    title: "Pumpe",
    st_running: "Pumper",
    st_idle: "I hvile",
    st_alert: "Advarsel",
    st_offline: "Offline",
    running_for: "Pumper i {d}",
    last_run: "Sidste kørsel for {d} siden",
    no_run: "Ingen kørsel i 24 timer",
    level: "Niveau",
    lv_start: "Start {p}",
    lv_stop: "Stop {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Kørsler · sidste 24 timer",
    now: "nu",
    t_cycles: "Cyklusser i dag",
    t_avg: "Gns. kørsel",
    t_runtime: "Driftstid i dag",
    t_pressure: "Tryk",
    t_flow: "Flow",
    t_power: "Effekt",
    t_volume: "Pumpet i dag",
    ok: "Ingen alarm",
    alert_level: "Højt niveau",
    alert_alarm: "Alarm",
    alert_long: "Har kørt uafbrudt i {d}",
    max_run: "Advarsel efter {d} uafbrudt",
    start: "Start",
    stop: "Stop",
    no_pump: "Ingen pumpe fundet",
    k_auto: "Automatisk (ud fra navnet)",
    k_sump: "Dykpumpe",
    k_well: "Vandpumpe (brønd, trykforøger)",
    k_industrial: "Industripumpe",
    k_pump: "Pumpe",
    ed_entity: "Pumpe",
    ed_entity_helper: "Pumpens kontakt, dens driftssensor eller dens effektsensor",
    ed_kind: "Pumpetype",
    ed_level: "Niveausensor",
    ed_level_helper: "Brøndens eller tankens niveau, i %",
    ed_pressure: "Tryksensor",
    ed_flow: "Flowsensor",
    ed_volume: "Volumensensor",
    ed_alarm: "Alarmsensor",
    ed_alarm_helper: "En højvandsflyder eller en fejl, som binær sensor",
    ed_threshold: "Kører over",
    ed_threshold_helper: "Watt, når pumpen læses ud fra sin effekt",
    ed_level_start: "Startniveau",
    ed_level_stop: "Stopniveau",
    ed_level_alarm: "Alarmniveau",
    ed_max_run: "Advarsel efter en driftstid på",
    ed_max_run_helper: "Minutter uafbrudt før en advarsel; 0: aldrig",
    ed_show_runs: "Kørsler over 24 timer",
    ed_animations: "Animationer",
    ed_show_controls: "Betjening",
    ed_title_helper: "Tom: pumpens navn",
    ed_illustration: "Illustreret overskrift",
    ed_illustration_theme: "Overskriftens tema",
    ed_theme_auto: "Automatisk (sol eller mørkt tema)",
    ed_theme_day: "Dag",
    ed_theme_night: "Nat",
  },
  sv: {
    title: "Pump",
    st_running: "Pumpar",
    st_idle: "Vilar",
    st_alert: "Varning",
    st_offline: "Offline",
    running_for: "Pumpar i {d}",
    last_run: "Senaste körning för {d} sedan",
    no_run: "Ingen körning på 24 timmar",
    level: "Nivå",
    lv_start: "Start {p}",
    lv_stop: "Stopp {p}",
    lv_alarm: "Larm {p}",
    runs_24h: "Körningar · senaste 24 timmarna",
    now: "nu",
    t_cycles: "Cykler i dag",
    t_avg: "Snittkörning",
    t_runtime: "Drifttid i dag",
    t_pressure: "Tryck",
    t_flow: "Flöde",
    t_power: "Effekt",
    t_volume: "Pumpat i dag",
    ok: "Inget larm",
    alert_level: "Hög nivå",
    alert_alarm: "Larm",
    alert_long: "Har gått oavbrutet i {d}",
    max_run: "Varning efter {d} oavbrutet",
    start: "Starta",
    stop: "Stoppa",
    no_pump: "Ingen pump hittades",
    k_auto: "Automatiskt (från namnet)",
    k_sump: "Dränkbar pump",
    k_well: "Vattenpump (brunn, tryckstegring)",
    k_industrial: "Industripump",
    k_pump: "Pump",
    ed_entity: "Pump",
    ed_entity_helper: "Pumpens brytare, dess driftsensor eller dess effektsensor",
    ed_kind: "Typ av pump",
    ed_level: "Nivåsensor",
    ed_level_helper: "Brunnens eller tankens nivå, i %",
    ed_pressure: "Trycksensor",
    ed_flow: "Flödessensor",
    ed_volume: "Volymsensor",
    ed_alarm: "Larmsensor",
    ed_alarm_helper: "En högnivåflottör eller ett fel, som binär sensor",
    ed_threshold: "Igång över",
    ed_threshold_helper: "Watt, när pumpen läses från sin effekt",
    ed_level_start: "Startnivå",
    ed_level_stop: "Stoppnivå",
    ed_level_alarm: "Larmnivå",
    ed_max_run: "Varning efter en drifttid på",
    ed_max_run_helper: "Minuter oavbrutet före en varning; 0: aldrig",
    ed_show_runs: "Körningar över 24 timmar",
    ed_animations: "Animationer",
    ed_show_controls: "Reglage",
    ed_title_helper: "Tomt: pumpens namn",
    ed_illustration: "Illustrerad rubrik",
    ed_illustration_theme: "Rubrikens tema",
    ed_theme_auto: "Automatiskt (sol eller mörkt tema)",
    ed_theme_day: "Dag",
    ed_theme_night: "Natt",
  },
  bg: {
    title: "Помпа",
    st_running: "Помпа",
    st_idle: "В покой",
    st_alert: "Тревога",
    st_offline: "Офлайн",
    running_for: "Помпа от {d}",
    last_run: "Последно изпомпване преди {d}",
    no_run: "Няма изпомпване от 24 часа",
    level: "Ниво",
    lv_start: "Старт {p}",
    lv_stop: "Стоп {p}",
    lv_alarm: "Аларма {p}",
    runs_24h: "Изпомпвания · последните 24 часа",
    now: "сега",
    t_cycles: "Цикли днес",
    t_avg: "Средна продължителност",
    t_runtime: "Работа днес",
    t_pressure: "Налягане",
    t_flow: "Дебит",
    t_power: "Мощност",
    t_volume: "Изпомпано днес",
    ok: "Няма аларма",
    alert_level: "Високо ниво",
    alert_alarm: "Аларма",
    alert_long: "Работи без прекъсване от {d}",
    max_run: "Тревога след {d} без прекъсване",
    start: "Пусни",
    stop: "Спри",
    no_pump: "Не е намерена помпа",
    k_auto: "Автоматично (по името)",
    k_sump: "Дренажна помпа",
    k_well: "Водна помпа (кладенец, хидрофор)",
    k_industrial: "Индустриална помпа",
    k_pump: "Помпа",
    ed_entity: "Помпа",
    ed_entity_helper: "Ключът на помпата, сензорът ѝ за работа или сензорът ѝ за мощност",
    ed_kind: "Вид помпа",
    ed_level: "Сензор за ниво",
    ed_level_helper: "Нивото на шахтата или резервоара, в %",
    ed_pressure: "Сензор за налягане",
    ed_flow: "Сензор за дебит",
    ed_volume: "Сензор за обем",
    ed_alarm: "Сензор за аларма",
    ed_alarm_helper: "Поплавък за високо ниво или повреда, като двоичен сензор",
    ed_threshold: "Работи над",
    ed_threshold_helper: "Ватове, когато помпата се отчита по мощността",
    ed_level_start: "Ниво на пускане",
    ed_level_stop: "Ниво на спиране",
    ed_level_alarm: "Ниво на аларма",
    ed_max_run: "Тревога след работа от",
    ed_max_run_helper: "Минути без прекъсване преди тревога; 0: никога",
    ed_show_runs: "Изпомпвания за 24 часа",
    ed_animations: "Анимации",
    ed_show_controls: "Управление",
    ed_title_helper: "Празно: името на помпата",
    ed_illustration: "Илюстрирано заглавие",
    ed_illustration_theme: "Тема на заглавието",
    ed_theme_auto: "Автоматично (слънце или тъмна тема)",
    ed_theme_day: "Ден",
    ed_theme_night: "Нощ",
  },
  ru: {
    title: "Насос",
    st_running: "Качает",
    st_idle: "В покое",
    st_alert: "Тревога",
    st_offline: "Не в сети",
    running_for: "Качает уже {d}",
    last_run: "Последний запуск {d} назад",
    no_run: "Нет запусков за 24 часа",
    level: "Уровень",
    lv_start: "Пуск {p}",
    lv_stop: "Стоп {p}",
    lv_alarm: "Авария {p}",
    runs_24h: "Запуски · последние 24 часа",
    now: "сейчас",
    t_cycles: "Циклы сегодня",
    t_avg: "Средний запуск",
    t_runtime: "Работа сегодня",
    t_pressure: "Давление",
    t_flow: "Расход",
    t_power: "Мощность",
    t_volume: "Откачано сегодня",
    ok: "Нет тревог",
    alert_level: "Высокий уровень",
    alert_alarm: "Авария",
    alert_long: "Работает без остановки уже {d}",
    max_run: "Тревога после {d} без остановки",
    start: "Запустить",
    stop: "Остановить",
    no_pump: "Насос не найден",
    k_auto: "Автоматически (по названию)",
    k_sump: "Дренажный насос",
    k_well: "Водяной насос (скважина, насосная станция)",
    k_industrial: "Промышленный насос",
    k_pump: "Насос",
    ed_entity: "Насос",
    ed_entity_helper: "Выключатель насоса, его датчик работы или его датчик мощности",
    ed_kind: "Тип насоса",
    ed_level: "Датчик уровня",
    ed_level_helper: "Уровень приямка или бака, в %",
    ed_pressure: "Датчик давления",
    ed_flow: "Датчик расхода",
    ed_volume: "Датчик объёма",
    ed_alarm: "Датчик аварии",
    ed_alarm_helper: "Поплавок высокого уровня или неисправность, как двоичный датчик",
    ed_threshold: "Работает выше",
    ed_threshold_helper: "Ватты, когда насос определяется по мощности",
    ed_level_start: "Уровень пуска",
    ed_level_stop: "Уровень остановки",
    ed_level_alarm: "Аварийный уровень",
    ed_max_run: "Тревога после работы",
    ed_max_run_helper: "Минуты без остановки до тревоги; 0: никогда",
    ed_show_runs: "Запуски за 24 часа",
    ed_animations: "Анимации",
    ed_show_controls: "Управление",
    ed_title_helper: "Пусто: название насоса",
    ed_illustration: "Иллюстрированный заголовок",
    ed_illustration_theme: "Тема заголовка",
    ed_theme_auto: "Автоматически (солнце или тёмная тема)",
    ed_theme_day: "День",
    ed_theme_night: "Ночь",
  },
  uk: {
    title: "Насос",
    st_running: "Качає",
    st_idle: "У спокої",
    st_alert: "Тривога",
    st_offline: "Не в мережі",
    running_for: "Качає вже {d}",
    last_run: "Останній запуск {d} тому",
    no_run: "Немає запусків за 24 години",
    level: "Рівень",
    lv_start: "Пуск {p}",
    lv_stop: "Стоп {p}",
    lv_alarm: "Аварія {p}",
    runs_24h: "Запуски · останні 24 години",
    now: "зараз",
    t_cycles: "Цикли сьогодні",
    t_avg: "Середній запуск",
    t_runtime: "Робота сьогодні",
    t_pressure: "Тиск",
    t_flow: "Витрата",
    t_power: "Потужність",
    t_volume: "Відкачано сьогодні",
    ok: "Немає тривог",
    alert_level: "Високий рівень",
    alert_alarm: "Аварія",
    alert_long: "Працює без зупинки вже {d}",
    max_run: "Тривога після {d} без зупинки",
    start: "Запустити",
    stop: "Зупинити",
    no_pump: "Насос не знайдено",
    k_auto: "Автоматично (за назвою)",
    k_sump: "Дренажний насос",
    k_well: "Водяний насос (свердловина, насосна станція)",
    k_industrial: "Промисловий насос",
    k_pump: "Насос",
    ed_entity: "Насос",
    ed_entity_helper: "Вимикач насоса, його датчик роботи або його датчик потужності",
    ed_kind: "Тип насоса",
    ed_level: "Датчик рівня",
    ed_level_helper: "Рівень приямка або бака, у %",
    ed_pressure: "Датчик тиску",
    ed_flow: "Датчик витрати",
    ed_volume: "Датчик об'єму",
    ed_alarm: "Датчик аварії",
    ed_alarm_helper: "Поплавець високого рівня або несправність, як двійковий датчик",
    ed_threshold: "Працює понад",
    ed_threshold_helper: "Вати, коли насос визначається за потужністю",
    ed_level_start: "Рівень пуску",
    ed_level_stop: "Рівень зупинки",
    ed_level_alarm: "Аварійний рівень",
    ed_max_run: "Тривога після роботи",
    ed_max_run_helper: "Хвилини без зупинки до тривоги; 0: ніколи",
    ed_show_runs: "Запуски за 24 години",
    ed_animations: "Анімації",
    ed_show_controls: "Керування",
    ed_title_helper: "Порожньо: назва насоса",
    ed_illustration: "Ілюстрований заголовок",
    ed_illustration_theme: "Тема заголовка",
    ed_theme_auto: "Автоматично (сонце або темна тема)",
    ed_theme_day: "День",
    ed_theme_night: "Ніч",
  },
  hu: {
    title: "Szivattyú",
    st_running: "Szivattyúz",
    st_idle: "Nyugalomban",
    st_alert: "Riasztás",
    st_offline: "Offline",
    running_for: "{d} óta szivattyúz",
    last_run: "Utolsó működés {d} ezelőtt",
    no_run: "Nem működött 24 órán át",
    level: "Szint",
    lv_start: "Indítás {p}",
    lv_stop: "Leállítás {p}",
    lv_alarm: "Riasztás {p}",
    runs_24h: "Működések · utolsó 24 óra",
    now: "most",
    t_cycles: "Mai ciklusok",
    t_avg: "Átlagos működés",
    t_runtime: "Mai üzemidő",
    t_pressure: "Nyomás",
    t_flow: "Átfolyás",
    t_power: "Teljesítmény",
    t_volume: "Ma szivattyúzva",
    ok: "Nincs riasztás",
    alert_level: "Magas szint",
    alert_alarm: "Riasztás",
    alert_long: "{d} óta megállás nélkül megy",
    max_run: "Riasztás {d} megállás nélkül után",
    start: "Indítás",
    stop: "Leállítás",
    no_pump: "Nem található szivattyú",
    k_auto: "Automatikus (a név alapján)",
    k_sump: "Merülő szivattyú",
    k_well: "Vízszivattyú (kút, házi vízmű)",
    k_industrial: "Ipari szivattyú",
    k_pump: "Szivattyú",
    ed_entity: "Szivattyú",
    ed_entity_helper: "A szivattyú kapcsolója, működésérzékelője vagy teljesítményérzékelője",
    ed_kind: "Szivattyú típusa",
    ed_level: "Szintérzékelő",
    ed_level_helper: "Az akna vagy a tartály szintje, %-ban",
    ed_pressure: "Nyomásérzékelő",
    ed_flow: "Átfolyásérzékelő",
    ed_volume: "Térfogatérzékelő",
    ed_alarm: "Riasztásérzékelő",
    ed_alarm_helper: "Egy magasszint-úszó vagy hiba, bináris érzékelőként",
    ed_threshold: "Működik e felett",
    ed_threshold_helper: "Watt, ha a szivattyút a teljesítményéből olvassuk",
    ed_level_start: "Indítási szint",
    ed_level_stop: "Leállítási szint",
    ed_level_alarm: "Riasztási szint",
    ed_max_run: "Riasztás ennyi működés után",
    ed_max_run_helper: "Megállás nélküli percek a riasztás előtt; 0: soha",
    ed_show_runs: "Működések 24 órán át",
    ed_animations: "Animációk",
    ed_show_controls: "Vezérlők",
    ed_title_helper: "Üres: a szivattyú neve",
    ed_illustration: "Illusztrált fejléc",
    ed_illustration_theme: "Fejléc témája",
    ed_theme_auto: "Automatikus (nap vagy sötét téma)",
    ed_theme_day: "Nappal",
    ed_theme_night: "Éjszaka",
  },
  sk: {
    title: "Čerpadlo",
    st_running: "Čerpá",
    st_idle: "V pokoji",
    st_alert: "Výstraha",
    st_offline: "Offline",
    running_for: "Čerpá {d}",
    last_run: "Posledné čerpanie pred {d}",
    no_run: "Žiadne čerpanie za 24 hodín",
    level: "Hladina",
    lv_start: "Štart {p}",
    lv_stop: "Stop {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Čerpania · posledných 24 hodín",
    now: "teraz",
    t_cycles: "Cykly dnes",
    t_avg: "Priemerné čerpanie",
    t_runtime: "Doba chodu dnes",
    t_pressure: "Tlak",
    t_flow: "Prietok",
    t_power: "Výkon",
    t_volume: "Dnes načerpané",
    ok: "Žiadny alarm",
    alert_level: "Vysoká hladina",
    alert_alarm: "Alarm",
    alert_long: "Beží bez prestávky {d}",
    max_run: "Výstraha po {d} bez prestávky",
    start: "Spustiť",
    stop: "Zastaviť",
    no_pump: "Nenašlo sa žiadne čerpadlo",
    k_auto: "Automaticky (podľa názvu)",
    k_sump: "Kalové čerpadlo",
    k_well: "Vodné čerpadlo (studňa, domáca vodáreň)",
    k_industrial: "Priemyselné čerpadlo",
    k_pump: "Čerpadlo",
    ed_entity: "Čerpadlo",
    ed_entity_helper: "Vypínač čerpadla, jeho snímač chodu alebo jeho snímač výkonu",
    ed_kind: "Druh čerpadla",
    ed_level: "Snímač hladiny",
    ed_level_helper: "Hladina šachty alebo nádrže, v %",
    ed_pressure: "Snímač tlaku",
    ed_flow: "Snímač prietoku",
    ed_volume: "Snímač objemu",
    ed_alarm: "Snímač alarmu",
    ed_alarm_helper: "Plavák vysokej hladiny alebo porucha, ako binárny snímač",
    ed_threshold: "Beží nad",
    ed_threshold_helper: "Watty, keď sa čerpadlo číta z výkonu",
    ed_level_start: "Hladina zapnutia",
    ed_level_stop: "Hladina vypnutia",
    ed_level_alarm: "Hladina alarmu",
    ed_max_run: "Výstraha po chode",
    ed_max_run_helper: "Minúty bez prestávky pred výstrahou; 0: nikdy",
    ed_show_runs: "Čerpania za 24 hodín",
    ed_animations: "Animácie",
    ed_show_controls: "Ovládanie",
    ed_title_helper: "Prázdne: názov čerpadla",
    ed_illustration: "Ilustrovaná hlavička",
    ed_illustration_theme: "Téma hlavičky",
    ed_theme_auto: "Automaticky (slnko alebo tmavá téma)",
    ed_theme_day: "Deň",
    ed_theme_night: "Noc",
  },
  cs: {
    title: "Čerpadlo",
    st_running: "Čerpá",
    st_idle: "V klidu",
    st_alert: "Výstraha",
    st_offline: "Offline",
    running_for: "Čerpá {d}",
    last_run: "Poslední čerpání před {d}",
    no_run: "Žádné čerpání za 24 hodin",
    level: "Hladina",
    lv_start: "Start {p}",
    lv_stop: "Stop {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Čerpání · posledních 24 hodin",
    now: "nyní",
    t_cycles: "Cykly dnes",
    t_avg: "Průměrné čerpání",
    t_runtime: "Doba chodu dnes",
    t_pressure: "Tlak",
    t_flow: "Průtok",
    t_power: "Výkon",
    t_volume: "Dnes načerpáno",
    ok: "Žádný alarm",
    alert_level: "Vysoká hladina",
    alert_alarm: "Alarm",
    alert_long: "Běží bez přestávky {d}",
    max_run: "Výstraha po {d} bez přestávky",
    start: "Spustit",
    stop: "Zastavit",
    no_pump: "Nenalezeno žádné čerpadlo",
    k_auto: "Automaticky (podle názvu)",
    k_sump: "Kalové čerpadlo",
    k_well: "Vodní čerpadlo (studna, domácí vodárna)",
    k_industrial: "Průmyslové čerpadlo",
    k_pump: "Čerpadlo",
    ed_entity: "Čerpadlo",
    ed_entity_helper: "Vypínač čerpadla, jeho snímač chodu, nebo jeho snímač výkonu",
    ed_kind: "Druh čerpadla",
    ed_level: "Snímač hladiny",
    ed_level_helper: "Hladina šachty nebo nádrže, v %",
    ed_pressure: "Snímač tlaku",
    ed_flow: "Snímač průtoku",
    ed_volume: "Snímač objemu",
    ed_alarm: "Snímač alarmu",
    ed_alarm_helper: "Plovák vysoké hladiny nebo porucha, jako binární snímač",
    ed_threshold: "Běží nad",
    ed_threshold_helper: "Watty, když se čerpadlo čte z výkonu",
    ed_level_start: "Hladina zapnutí",
    ed_level_stop: "Hladina vypnutí",
    ed_level_alarm: "Hladina alarmu",
    ed_max_run: "Výstraha po chodu",
    ed_max_run_helper: "Minuty bez přestávky před výstrahou; 0: nikdy",
    ed_show_runs: "Čerpání za 24 hodin",
    ed_animations: "Animace",
    ed_show_controls: "Ovládání",
    ed_title_helper: "Prázdné: název čerpadla",
    ed_illustration: "Ilustrovaná hlavička",
    ed_illustration_theme: "Motiv hlavičky",
    ed_theme_auto: "Automaticky (slunce nebo tmavý motiv)",
    ed_theme_day: "Den",
    ed_theme_night: "Noc",
  },
  sl: {
    title: "Črpalka",
    st_running: "Črpa",
    st_idle: "Miruje",
    st_alert: "Opozorilo",
    st_offline: "Brez povezave",
    running_for: "Črpa že {d}",
    last_run: "Zadnje črpanje pred {d}",
    no_run: "Brez črpanja v 24 urah",
    level: "Nivo",
    lv_start: "Zagon {p}",
    lv_stop: "Ustavitev {p}",
    lv_alarm: "Alarm {p}",
    runs_24h: "Črpanja · zadnjih 24 ur",
    now: "zdaj",
    t_cycles: "Cikli danes",
    t_avg: "Povprečno črpanje",
    t_runtime: "Čas delovanja danes",
    t_pressure: "Tlak",
    t_flow: "Pretok",
    t_power: "Moč",
    t_volume: "Danes načrpano",
    ok: "Brez alarma",
    alert_level: "Visok nivo",
    alert_alarm: "Alarm",
    alert_long: "Deluje brez ustavitve že {d}",
    max_run: "Opozorilo po {d} brez ustavitve",
    start: "Zaženi",
    stop: "Ustavi",
    no_pump: "Črpalka ni bila najdena",
    k_auto: "Samodejno (po imenu)",
    k_sump: "Potopna črpalka",
    k_well: "Vodna črpalka (vodnjak, hidropostaja)",
    k_industrial: "Industrijska črpalka",
    k_pump: "Črpalka",
    ed_entity: "Črpalka",
    ed_entity_helper: "Stikalo črpalke, njen senzor delovanja ali njen senzor moči",
    ed_kind: "Vrsta črpalke",
    ed_level: "Senzor nivoja",
    ed_level_helper: "Nivo jaška ali rezervoarja, v %",
    ed_pressure: "Senzor tlaka",
    ed_flow: "Senzor pretoka",
    ed_volume: "Senzor prostornine",
    ed_alarm: "Senzor alarma",
    ed_alarm_helper: "Plovec visokega nivoja ali okvara, kot binarni senzor",
    ed_threshold: "Deluje nad",
    ed_threshold_helper: "Vati, ko se črpalka bere po moči",
    ed_level_start: "Nivo zagona",
    ed_level_stop: "Nivo ustavitve",
    ed_level_alarm: "Nivo alarma",
    ed_max_run: "Opozorilo po delovanju",
    ed_max_run_helper: "Minute brez ustavitve pred opozorilom; 0: nikoli",
    ed_show_runs: "Črpanja v 24 urah",
    ed_animations: "Animacije",
    ed_show_controls: "Upravljanje",
    ed_title_helper: "Prazno: ime črpalke",
    ed_illustration: "Ilustrirana glava",
    ed_illustration_theme: "Tema glave",
    ed_theme_auto: "Samodejno (sonce ali temna tema)",
    ed_theme_day: "Dan",
    ed_theme_night: "Noč",
  },
  lv: {
    title: "Sūknis",
    st_running: "Sūknē",
    st_idle: "Miera stāvoklī",
    st_alert: "Brīdinājums",
    st_offline: "Bezsaistē",
    running_for: "Sūknē jau {d}",
    last_run: "Pēdējā sūknēšana pirms {d}",
    no_run: "Nav sūknēts 24 stundās",
    level: "Līmenis",
    lv_start: "Starts {p}",
    lv_stop: "Apturēšana {p}",
    lv_alarm: "Trauksme {p}",
    runs_24h: "Sūknēšanas · pēdējās 24 stundas",
    now: "tagad",
    t_cycles: "Cikli šodien",
    t_avg: "Vidējā sūknēšana",
    t_runtime: "Darbības laiks šodien",
    t_pressure: "Spiediens",
    t_flow: "Plūsma",
    t_power: "Jauda",
    t_volume: "Šodien sūknēts",
    ok: "Nav trauksmes",
    alert_level: "Augsts līmenis",
    alert_alarm: "Trauksme",
    alert_long: "Darbojas bez pārtraukuma jau {d}",
    max_run: "Brīdinājums pēc {d} bez pārtraukuma",
    start: "Palaist",
    stop: "Apturēt",
    no_pump: "Sūknis nav atrasts",
    k_auto: "Automātiski (pēc nosaukuma)",
    k_sump: "Drenāžas sūknis",
    k_well: "Ūdens sūknis (aka, hidrofors)",
    k_industrial: "Rūpnieciskais sūknis",
    k_pump: "Sūknis",
    ed_entity: "Sūknis",
    ed_entity_helper: "Sūkņa slēdzis, tā darbības sensors vai tā jaudas sensors",
    ed_kind: "Sūkņa veids",
    ed_level: "Līmeņa sensors",
    ed_level_helper: "Akas vai tvertnes līmenis, %",
    ed_pressure: "Spiediena sensors",
    ed_flow: "Plūsmas sensors",
    ed_volume: "Tilpuma sensors",
    ed_alarm: "Trauksmes sensors",
    ed_alarm_helper: "Augsta līmeņa pludiņš vai kļūme, kā binārais sensors",
    ed_threshold: "Darbojas virs",
    ed_threshold_helper: "Vati, kad sūknis tiek nolasīts pēc jaudas",
    ed_level_start: "Starta līmenis",
    ed_level_stop: "Apturēšanas līmenis",
    ed_level_alarm: "Trauksmes līmenis",
    ed_max_run: "Brīdinājums pēc darbības",
    ed_max_run_helper: "Minūtes bez pārtraukuma pirms brīdinājuma; 0: nekad",
    ed_show_runs: "Sūknēšanas 24 stundās",
    ed_animations: "Animācijas",
    ed_show_controls: "Vadība",
    ed_title_helper: "Tukšs: sūkņa nosaukums",
    ed_illustration: "Ilustrēta galvene",
    ed_illustration_theme: "Galvenes tēma",
    ed_theme_auto: "Automātiski (saule vai tumšā tēma)",
    ed_theme_day: "Diena",
    ed_theme_night: "Nakts",
  },
  el: {
    title: "Αντλία",
    st_running: "Αντλεί",
    st_idle: "Σε ηρεμία",
    st_alert: "Ειδοποίηση",
    st_offline: "Εκτός σύνδεσης",
    running_for: "Αντλεί εδώ και {d}",
    last_run: "Τελευταία άντληση πριν από {d}",
    no_run: "Καμία άντληση σε 24 ώρες",
    level: "Στάθμη",
    lv_start: "Εκκίνηση {p}",
    lv_stop: "Διακοπή {p}",
    lv_alarm: "Συναγερμός {p}",
    runs_24h: "Αντλήσεις · τελευταίες 24 ώρες",
    now: "τώρα",
    t_cycles: "Κύκλοι σήμερα",
    t_avg: "Μέση άντληση",
    t_runtime: "Λειτουργία σήμερα",
    t_pressure: "Πίεση",
    t_flow: "Παροχή",
    t_power: "Ισχύς",
    t_volume: "Αντλήθηκαν σήμερα",
    ok: "Κανένας συναγερμός",
    alert_level: "Υψηλή στάθμη",
    alert_alarm: "Συναγερμός",
    alert_long: "Λειτουργεί χωρίς διακοπή εδώ και {d}",
    max_run: "Ειδοποίηση μετά από {d} χωρίς διακοπή",
    start: "Εκκίνηση",
    stop: "Διακοπή",
    no_pump: "Δεν βρέθηκε αντλία",
    k_auto: "Αυτόματα (από το όνομα)",
    k_sump: "Αντλία αποστράγγισης",
    k_well: "Αντλία νερού (γεώτρηση, πιεστικό)",
    k_industrial: "Βιομηχανική αντλία",
    k_pump: "Αντλία",
    ed_entity: "Αντλία",
    ed_entity_helper: "Ο διακόπτης της αντλίας, ο αισθητήρας λειτουργίας της ή ο αισθητήρας ισχύος της",
    ed_kind: "Είδος αντλίας",
    ed_level: "Αισθητήρας στάθμης",
    ed_level_helper: "Η στάθμη του φρεατίου ή της δεξαμενής, σε %",
    ed_pressure: "Αισθητήρας πίεσης",
    ed_flow: "Αισθητήρας παροχής",
    ed_volume: "Αισθητήρας όγκου",
    ed_alarm: "Αισθητήρας συναγερμού",
    ed_alarm_helper: "Ένας πλωτήρας υψηλής στάθμης ή μια βλάβη, ως δυαδικός αισθητήρας",
    ed_threshold: "Λειτουργεί πάνω από",
    ed_threshold_helper: "Watt, όταν η αντλία διαβάζεται από την ισχύ της",
    ed_level_start: "Στάθμη εκκίνησης",
    ed_level_stop: "Στάθμη διακοπής",
    ed_level_alarm: "Στάθμη συναγερμού",
    ed_max_run: "Ειδοποίηση μετά από λειτουργία",
    ed_max_run_helper: "Λεπτά χωρίς διακοπή πριν από ειδοποίηση· 0: ποτέ",
    ed_show_runs: "Αντλήσεις σε 24 ώρες",
    ed_animations: "Κινούμενα σχέδια",
    ed_show_controls: "Χειρισμός",
    ed_title_helper: "Κενό: το όνομα της αντλίας",
    ed_illustration: "Εικονογραφημένη κεφαλίδα",
    ed_illustration_theme: "Θέμα κεφαλίδας",
    ed_theme_auto: "Αυτόματα (ήλιος ή σκούρο θέμα)",
    ed_theme_day: "Ημέρα",
    ed_theme_night: "Νύχτα",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const rcLang = (i18n, hass, config) => {
  // The full tag when the card has it (sr-Latn), else its base language (fr-FR → fr, pt-BR → pt), else English.
  const l = config?.language || hass?.locale?.language || hass?.language || "en";
  const base = l.split("-")[0];
  return i18n[l] ? l : i18n[base] ? base : "en";
};

const rcT = (i18n, lang, key, vars = {}) => {
  const s = i18n[lang]?.[key] ?? RC_I18N[lang]?.[key] ?? i18n.en[key] ?? RC_I18N.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
};

// Plural key for `n` items: `<base>_one`, `<base>_few` or `<base>_many` (the "other" form), from the CLDR category of
// `n` in `lang` (Serbian 1 / 2-4 / 5+, 21 / 22…). `_few` is optional: without it, `_many` is used. A `_one` text without
// {n} ("Turn this plug off?") only means exactly one.
const rcPluralKey = (i18n, lang, base, n) => {
  let cat;
  try {
    cat = new Intl.PluralRules(lang).select(n);
  } catch {
    cat = n === 1 ? "one" : "other";
  }
  const text = (k) => i18n[lang]?.[k] ?? RC_I18N[lang]?.[k];
  if (cat === "one" && (n === 1 || text(`${base}_one`)?.includes("{n}"))) return `${base}_one`;
  if (cat === "few" && text(`${base}_few`) != null) return `${base}_few`;
  return `${base}_many`;
};

const rcEsc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const rcEscRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A power in the card's language (*1,2 kW* in French), from `lang` (defaults to the browser's).
const rcWatts = (w, lang) => {
  const kw = w >= 1000;
  const digits = kw && w < 10000 ? 1 : 0;
  let text;
  try {
    text = new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(kw ? w / 1000 : w);
  } catch {
    text = (kw ? w / 1000 : w).toFixed(digits);
  }
  return `${text} ${kw ? "kW" : "W"}`;
};

// Strips a prefix, a suffix and the area name from an entity name, then capitalises it.
const rcCleanName = (name, areaName, prefix, suffix) => {
  let n = (name || "").replace(prefix, "").replace(suffix, "").trim();
  if (areaName && n.toLowerCase() !== areaName.toLowerCase()) {
    n = n.replace(new RegExp(`(^${rcEscRe(areaName)}\\s+|\\s+${rcEscRe(areaName)}$)`, "i"), "");
  }
  return n.charAt(0).toUpperCase() + n.slice(1);
};

const rcMoreInfo = (node, entityId) => {
  const ev = new Event("hass-more-info", { bubbles: true, composed: true });
  ev.detail = { entityId };
  node.dispatchEvent(ev);
};

const rcNavigate = (path) => {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
};

// Wires a card header to its `navigation_path`: click, and Enter on the header itself.
const rcBindNav = (head, path) => {
  head.addEventListener("click", () => rcNavigate(path));
  head.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target === head) rcNavigate(path);
  });
};

const rcUnavailable = (st) => ["unavailable", "unknown"].includes(st.state);

// HA's callService already shows a toast when the call fails, then rejects: the rejection is only swallowed here
// so that it does not end up as "Uncaught (in promise)".
const rcCall = (hass, domain, service, data) => Promise.resolve(hass.callService(domain, service, data)).catch(() => {});

// A click inside a dialog (more-info opened from the card, say) is not a click outside the card.
const rcInDialog = (ev) => ev.composedPath().some((n) => ["ha-more-info-dialog", "ha-dialog", "dialog"].includes(n.localName));

// `fn()`, computed again only when one of `deps` is no longer the same object (or value) as last time.
const rcMemo = (store, key, deps, fn) => {
  const hit = store[key];
  if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => d === deps[i])) return hit.value;
  const value = fn();
  store[key] = { deps, value };
  return value;
};

// ── Base card ────────────────────────────────────────────────────────────────
class RcCard extends HTMLElement {
  static getStubConfig(hass) {
    const areas = Object.keys(hass?.areas ?? {});
    return { area: areas[0] ?? "" };
  }

  // Subclasses set: static i18n, static defaults, static tag, static styles.
  static getConfigElement() {
    // biome-ignore lint/complexity/noThisInStatic: each subclass opens its own editor.
    return document.createElement(`${this.tag}-editor`);
  }

  setConfig(config) {
    if (this.constructor.needsArea && !config.area && !config.entities?.length && !config.include?.length) {
      throw new Error(rcT(this.constructor.i18n, rcLang(this.constructor.i18n, this._hass, config), "err_config"));
    }
    this._config = { ...this.constructor.defaults, ...config };
    // show_title: the header's title, hidden by the stylesheet
    this.toggleAttribute?.("hide-title", config.show_title === false);
    if (!this.shadowRoot) this._attach();
    this._sig = null;
    this._render();
  }

  // The shadow root, and no rewrite of the card between a press anywhere in it and the end of the click: Home
  // Assistant updates the card several times a second, and a rewrite under the pointer replaces the element pressed,
  // so that the click lands on the card itself and does nothing (the tiles already hold it, see _bindPress; this
  // covers the rest: header button, detail button, rows, popup). The pending update is rendered once released.
  _attach() {
    const root = this.attachShadow({ mode: "open" });
    this._onPressEnd = () => {
      window.removeEventListener("pointerup", this._onPressEnd, true);
      window.removeEventListener("pointercancel", this._onPressEnd, true);
      // After the click, which comes in the same task as the release.
      setTimeout(() => {
        if (this._pressing) this._released();
      }, 0);
    };
    root.addEventListener("pointerdown", (ev) => {
      this._byPointer = true;
      if (ev.button !== 0) return;
      this._pressing = true;
      window.addEventListener("pointerup", this._onPressEnd, true);
      window.addEventListener("pointercancel", this._onPressEnd, true);
    });
    // The focus is kept across rewrites for the keyboard only (no focus ring after a mouse click or a tap).
    root.addEventListener("keydown", () => {
      this._byPointer = false;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    window.removeEventListener("pointerup", this._onPressEnd, true);
    window.removeEventListener("pointercancel", this._onPressEnd, true);
    // A press cut short by the detach never gets its release: rendered now, and the next updates too.
    if (this._pressing) this._released();
  }

  set hass(hass) {
    this._hass = hass;
    // No re-render during a drag or a press: it would replace the tile under the finger.
    if (this._dragging || this._pressing) this._deferred = true;
    else this._render();
  }

  // The tiles actually shown (`only_on` / `only_alerts` applied), nothing when the card is hidden.
  getCardSize() {
    if (this.style.display === "none") return 0;
    const n = this._shown ?? this._items?.length ?? 0;
    if (!n || !this._config) return 1;
    // A row of large tiles (`layout: tiles`) is about one and a half rows of compact ones.
    const rows = Math.ceil(n / this._cols());
    return 1 + (this._tiles() ? Math.ceil(rows * 1.5) : rows);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  _lang() {
    return rcLang(this.constructor.i18n, this._hass, this._config);
  }

  _t(key, vars) {
    return rcT(this.constructor.i18n, this._lang(), key, vars);
  }

  // `<base>_one` / `_few` / `_many` for `n`, with {n} filled in.
  _tn(base, n, vars) {
    return this._t(rcPluralKey(this.constructor.i18n, this._lang(), base, n), { ...vars, n });
  }

  _areaOf(id) {
    const e = this._hass.entities?.[id];
    if (!e) return undefined;
    return e.area_id ?? this._hass.devices?.[e.device_id]?.area_id;
  }

  _areaName() {
    const c = this._config;
    return c.area ? (this._hass.areas?.[c.area]?.name ?? c.area) : "";
  }

  // The configured `entities`; otherwise the entities of the area accepted by `_candidate`, minus `exclude`,
  // plus `include` (entities from another room or without one).
  _entries() {
    const h = this._hass;
    const c = this._config;
    const list = (l) => (l || []).map((e) => (typeof e === "string" ? { entity: e } : e)).filter((e) => h.states[e.entity]);
    if (c.entities?.length) return list(c.entities);
    this._prepare();
    const found = c.area ? this._areaIds().filter((id) => h.states[id] && this._candidate(id)).map((entity) => ({ entity })) : [];
    const ids = new Set(found.map((e) => e.entity));
    return [...found, ...list(c.include).filter((e) => !ids.has(e.entity))];
  }

  // Visible entities of the area, minus `exclude`: the registries are scanned again only when they or the config
  // change (an entity outside the entity registry has no area anyway).
  _areaIds() {
    const h = this._hass;
    const c = this._config;
    return rcMemo((this._memo ||= {}), "area", [c, h.entities, h.devices], () => {
      const exclude = new Set(c.exclude || []);
      return Object.keys(h.entities || {}).filter((id) => !exclude.has(id) && !h.entities[id].hidden && this._areaOf(id) === c.area);
    });
  }

  // Hook run before the discovery, for what `_candidate` needs.
  _prepare() {}

  // Re-render only when something visible changed.
  _changed(parts) {
    const sig = JSON.stringify([this._config, this._lang(), parts]);
    if (sig === this._sig) return false;
    this._sig = sig;
    return true;
  }

  _hide(hidden) {
    this.style.display = hidden ? "none" : "";
    return hidden;
  }

  // Status of a set of opening and safety sensors: an alarm (`leaks` active ones, the most serious being `alert`: leak,
  // smoke, co or gas), then the open ones, then the unavailable ones (`unavail`: a sensor that cannot report is no
  // all-clear), then "All closed" when there are door or window sensors (`closable`), `idle` otherwise.
  _openingStatus(leaks, open, closable, idle = "all_quiet", unavail = 0, alert = "leak") {
    if (leaks) return this._t(alert);
    if (open) return this._tn("open", open);
    if (unavail) return this._tn("unavail", unavail);
    return this._t(closable ? "all_closed" : idle);
  }

  // Subclasses implement `_collect()` (the tiles) and `_draw(items)`.
  _render() {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    this._items = this._collect();
    this._draw(this._items);
  }

  _cols() {
    return Math.min(4, Math.max(1, Number(this._config.columns) || 2));
  }

  // `layout: tiles`: one large tile per entity, the size of Home Assistant's Tile card (easier to tap on a phone).
  _tiles() {
    return this._config?.layout === "tiles";
  }

  // Overviews: the grid of room tiles (`tile(room)`), its columns, the empty and idle states, then the open room's
  // details kept in step with the rooms shown.
  _roomGrid(grid, rooms, tile) {
    const cols = Number(this._config.columns);
    // A `columns` of 1 or 2 holds on a narrow card; 3 and more go down to two under 340 px, one under 260 px.
    grid.classList.toggle("fixed", cols >= 1 && cols <= 2);
    grid.style.setProperty("--cols", String(Math.min(6, Math.max(1, cols || 3))));
    // Every room idle with the "hide idle rooms" option: the header alone says it all.
    const idle = !rooms.length && this._total > 0;
    grid.hidden = idle;
    if (idle) grid.innerHTML = "";
    else grid.innerHTML = rooms.length ? rooms.map(tile).join("") : `<div class="empty">${rcEsc(this._t("no_rooms"))}</div>`;
    if (this._openArea && !rooms.some((x) => x.id === this._openArea)) this._toggle(null);
    else if (this._openArea) this._fillPanel();
  }

  _head({ icon, title, status, chips = "", allOff = false }) {
    const c = this._config;
    return `
      <div class="head${c.navigation_path ? " nav" : ""}"${c.navigation_path ? ' role="link" tabindex="0"' : ""}>
        <div class="badge"><ha-icon icon="${rcEsc(icon)}"></ha-icon></div>
        <div class="title">${rcEsc(title)}</div>
        ${chips}
        <button class="pill${allOff ? " action" : ""}" title="${rcEsc(allOff ? this._t("turn_all_off") : status)}"${allOff ? "" : " disabled"}>
          ${allOff ? '<ha-icon icon="mdi:power"></ha-icon>' : ""}<span class="pt">${rcEsc(status)}</span>
        </button>
      </div>`;
  }

  _tile(i, { cls = "", style = "", extra = "", state = i.state, title = `${i.name} — ${i.state}` }) {
    return `
      <button class="tile ${i.unavailable ? "na" : i.on ? "on" : "off"}${cls}" data-id="${rcEsc(i.id)}"
              ${style ? `style="${rcEsc(style)}"` : ""} title="${rcEsc(title)}">
        ${extra}
        <span class="ic"><ha-icon icon="${rcEsc(i.icon)}"></ha-icon></span>
        <span class="txt">
          <span class="name">${rcEsc(i.name)}</span>
          <span class="state">${state}</span>
        </span>
      </button>`;
  }

  _paint(level, head, tiles, extraClass = "") {
    // The tile or control with the keyboard focus keeps it through the redraw (a toggle, a step or a two-tap
    // confirmation from the keyboard): tiles by their data-id, controls by their data-k.
    const active = this._byPointer ? null : this.shadowRoot.activeElement;
    const focused = active?.dataset?.id;
    const focusKey = active?.dataset?.k;
    this.shadowRoot.innerHTML = `
      <style>${RC_BASE_STYLES}${this.constructor.styles}</style>
      <ha-card class="lvl-${level}${extraClass}${this._tiles() ? " layout-tiles" : ""}">
        ${head}
        ${tiles ? `<div class="grid" style="--cols:${this._cols()}">${tiles}</div>` : ""}
        ${this._afterGrid()}
      </ha-card>`;
    const root = this.shadowRoot;
    root.querySelector(".pill.action")?.addEventListener("click", (ev) => this._allOff(ev));
    if (this._config.navigation_path) rcBindNav(root.querySelector(".head"), this._config.navigation_path);
    for (const el of root.querySelectorAll(".tile")) {
      this._bindTile(el, (this._items || []).find((i) => i.id === el.dataset.id));
      if (focused && el.dataset.id === focused) el.focus({ preventScroll: true });
    }
    this._bindAfter(root);
    if (focusKey) root.querySelector(`[data-k="${focusKey}"]`)?.focus({ preventScroll: true });
  }

  // What a card adds under its tiles (the Lights card's scenes), and its event wiring.
  _afterGrid() {
    return "";
  }

  _bindAfter() {}

  // The "turn everything off" button of the header (full card) or of the status (mini card).
  _allOff(ev) {
    ev.stopPropagation();
    const ids = (this._items || []).filter((i) => i.on).map((i) => i.id);
    if (!ids.length) return;
    // A host card may ask first (the Overview confirms before turning plugs off); otherwise off at once.
    if (this._confirmOff) this._confirmOff(ids);
    else rcCall(this._hass, "homeassistant", "turn_off", { entity_id: ids });
  }

  // Tap, hold for more-info, and an optional horizontal drag ({ move(x), end(x), step(delta), flush() }). From the
  // keyboard: Enter / Space tap, Shift+Enter or the context-menu key open the details, ←/→ step the drag by ∓/±10
  // (a held key at most every RC_REPEAT_MS), and releasing the arrow calls `flush`.
  _bindPress(el, { onTap, onHold, drag }) {
    let start = null;
    let mode = null; // null | "hold" | "drag"
    let timer = null;
    let lastStep = 0;
    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      start = { x: ev.clientX, y: ev.clientY };
      mode = null;
      this._pressing = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // The card may have been detached mid-press (nothing else clears this timer): no hold on a dead node.
        if (mode || !this.isConnected) return;
        mode = "hold";
        // The press is settled (no tap): the details may open over the tile, so its pointerup may never come.
        this._released();
        onHold();
      }, RC_HOLD_MS);
    });
    el.addEventListener("pointermove", (ev) => {
      if (!start || mode === "hold") return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!mode && drag && Math.abs(dx) > RC_MOVE_PX && Math.abs(dx) > Math.abs(dy)) {
        mode = "drag";
        clearTimeout(timer);
        this._dragging = true;
        el.setPointerCapture(ev.pointerId);
        el.classList.add("dragging");
      } else if (!mode && (Math.abs(dx) > RC_MOVE_PX || Math.abs(dy) > RC_MOVE_PX)) {
        clearTimeout(timer); // scrolling, or dragging what cannot be dragged: not a tap
        start = null;
        this._released();
      }
      if (mode === "drag") drag.move(ev.clientX);
    });
    const end = (ev, cancelled) => {
      clearTimeout(timer);
      if (!start) return;
      const wasDrag = mode === "drag";
      if (wasDrag) {
        this._dragging = false;
        el.classList.remove("dragging");
        if (!cancelled) drag.end(ev.clientX);
        this._sig = null;
      } else if (!mode && !cancelled) {
        onTap();
      }
      start = null;
      mode = null;
      // After a drag, the next update redraws (the bar keeps the new level until the light reports it).
      this._released(!wasDrag);
    };
    // The mouse leaving the tile mid-press (no capture outside a drag) cancels it: neither a tap nor a hold.
    el.addEventListener("pointerleave", () => {
      if (!start || mode) return;
      clearTimeout(timer);
      start = null;
      this._released();
    });
    el.addEventListener("pointerup", (ev) => end(ev, false));
    el.addEventListener("pointercancel", (ev) => end(ev, true));
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    el.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" && ev.shiftKey) || ev.key === "ContextMenu") {
        ev.preventDefault();
        if (!ev.repeat) onHold();
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (!ev.repeat) onTap();
      } else if (drag?.step && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
        ev.preventDefault();
        if (ev.repeat && ev.timeStamp - lastStep < RC_REPEAT_MS) return;
        lastStep = ev.timeStamp;
        drag.step(ev.key === "ArrowRight" ? 10 : -10);
      }
    });
    // The arrow released: the stepped level goes out now rather than after the pause.
    el.addEventListener("keyup", (ev) => {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") drag?.flush?.();
    });
  }

  // End of a press: renders now what an update brought during it.
  _released(flush = true) {
    this._pressing = false;
    if (!this._deferred || this._dragging) return;
    this._deferred = false;
    if (flush) this._render();
  }

  // Default tile: tap toggles, hold opens the details.
  _bindTile(el, item) {
    this._bindPress(el, {
      onTap: () => !item?.unavailable && rcCall(this._hass, "homeassistant", "toggle", { entity_id: el.dataset.id }),
      onHold: () => rcMoreInfo(this, el.dataset.id),
    });
  }
}

// Lights and plugs: entities that are on or off, a status counting the ones on, an optional "turn everything off".
// Subclasses set `static headIcons` ([on, off]) and `static emptyKey`, and implement `_sigOf(item)` (what a tile
// shows) and `_tileOf(item)`; `_statusExtra(lit)` adds to the status.
class RcToggleCard extends RcCard {
  _statusExtra() {
    return "";
  }

  // What the header shows, on the full card and the mini card: level, icon, status (`ofTotal`: *2/5 on*) and whether
  // the "turn everything off" button is there. Null when nothing changed, or when the card hides itself.
  _summary(items, ofTotal = false) {
    const c = this._config;
    const lit = items.filter((i) => i.on);
    const level = lit.length ? "on" : "off";
    if (!this._changed([ofTotal, items.map((i) => this._sigOf(i))])) return null;
    if (this._hide(c.hide_when_off && level === "off")) return null;

    const shown = c.only_on ? items.filter((i) => i.on || i.unavailable) : items;
    this._shown = shown.length;
    const [onIcon, offIcon] = this.constructor.headIcons;
    const n = ofTotal ? `${lit.length}/${items.length}` : lit.length;
    const status = lit.length
      ? this._t(rcPluralKey(this.constructor.i18n, this._lang(), "on", lit.length), { n })
      : this._t(items.length ? "all_off" : this.constructor.emptyKey);
    return {
      level,
      shown,
      icon: lit.length ? onIcon : offIcon,
      status: status + this._statusExtra(lit),
      allOff: c.all_off_button && lit.length > 0,
    };
  }

  _draw(items) {
    const s = this._summary(items);
    if (!s) return;
    const head = this._head({ ...s, title: this._config.title || this._areaName() || this._t("title") });
    this._paint(s.level, head, s.shown.map((i) => this._tileOf(i)).join(""));
  }
}

// ── Mini cards ───────────────────────────────────────────────────────────────
// A mini card shows what its full card (`Base`) shows on two lines: the room badge, title and status, then one chip
// per entity. Its zoom button (top right, `zoom: false` removes it) switches it to the full card and back; a click
// anywhere else brings it back too.
// The subclass implements `_drawMini(items)`, which builds the chips and calls `_paintMini`.
// Zoomed in, everything is shown (`only_alerts` and `hide_when_clear` only apply to the compact view). With
// `alertsOnly`, the compact view always shows only what needs a look (no `only_alerts` option then): quiet entities
// show once zoomed in.
const rcMini = (Base, tag, styles, { alertsOnly = false } = {}) =>
  class extends Base {
    static tag = tag;
    static defaults = (({ only_alerts, ...rest }) => ({ ...rest, ...(alertsOnly ? {} : { only_alerts }), zoom: true }))(
      Base.defaults,
    );
    static styles = `${Base.styles}${RC_MINI_STYLES}${styles}`;

    constructor() {
      super();
      // A click anywhere else brings the card back to its compact view.
      this._onUnzoom = (ev) => {
        if (rcOutside(this, ev)) rcUnzoom(this);
      };
    }

    connectedCallback() {
      super.connectedCallback?.();
      this._unzoom ??= watchOutside(this, this._onUnzoom);
      this._unzoom.on();
    }

    disconnectedCallback() {
      super.disconnectedCallback?.();
      this._unzoom?.off();
      // Left (another dashboard view, a conditional card hidden): back to the compact view.
      rcUnzoom(this);
    }

    getCardSize() {
      if (this._zoomed) return super.getCardSize();
      return this.style.display === "none" ? 0 : 1;
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6, rows: "auto" };
    }

    _draw(items) {
      const config = this._config;
      // The base card's own filter does the work: off zoomed in, always on in an `alertsOnly` compact view.
      if (this._zoomed) this._config = { ...config, only_alerts: false, hide_when_clear: false };
      else if (alertsOnly) this._config = { ...config, only_alerts: true };
      try {
        if (this._zoomed) super._draw(items);
        else this._drawMini(items);
      } finally {
        this._config = config;
      }
      this._addZoom();
    }

    _paintMini({ level, icon, status, chips, cls = "", allOff = false }) {
      const c = this._config;
      const nav = c.navigation_path;
      // With `allOff` the status is the "turn everything off" button, like the full card's pill.
      const st = allOff
        ? `<button class="st action" title="${rcEsc(this._t("turn_all_off"))}"><ha-icon icon="mdi:power"></ha-icon><span class="pt">${rcEsc(status)}</span></button>`
        : `<span class="st" title="${rcEsc(status)}"><span class="pt">${rcEsc(status)}</span></span>`;
      this.shadowRoot.innerHTML = `
        <style>${RC_BASE_STYLES}${this.constructor.styles}</style>
        <ha-card class="lvl-${level}${cls}">
          <div class="mini">
            <div class="badge" title="${rcEsc(status)}"><ha-icon icon="${rcEsc(icon)}"></ha-icon></div>
            <div class="body">
              <div class="head${nav ? " nav" : ""}"${nav ? ' role="link" tabindex="0"' : ""}>
                <div class="title">${rcEsc(c.title || this._areaName() || this._t("title"))}</div>
                ${st}
              </div>
              <div class="rs">${chips}</div>
            </div>
          </div>
        </ha-card>`;
      const root = this.shadowRoot;
      if (nav) rcBindNav(root.querySelector(".head"), nav);
      root.querySelector(".st.action")?.addEventListener("click", (ev) => this._allOff(ev));
      for (const el of root.querySelectorAll(".r")) el.addEventListener("click", () => rcMoreInfo(this, el.dataset.id));
    }

    // Zoom button at the end of the header, top right in both views, added once per render.
    // Its click is the overviews' (rcZoomClick): stop the tap on the title (navigation_path), toggle, keep the
    // keyboard focus (Enter / Space: no click count) on the button that replaced this one.
    _addZoom() {
      const head = this._config.zoom && this.shadowRoot.querySelector(".head");
      if (!head || head.querySelector(".zoom")) return;
      const button = document.createElement("button");
      button.className = "zoom";
      button.title = this._t(this._zoomed ? "zoom_out" : "zoom_in");
      button.innerHTML = `<ha-icon icon="${rcZoomIcon(this)}"></ha-icon>`;
      button.addEventListener("click", (ev) => rcZoomClick(this, ev));
      head.appendChild(button);
    }
  };

// Lights and plugs mini cards: the status counts what is on out of the total (*2/5 on*), with the full card's
// "turn everything off" button; then a tinted pill (icon and name) for each entity on, its icon alone for the others.
// The subclass may implement `_chipExtra(item)`, shown after the name (a plug's power draw).
const rcToggleMini = (Base, tag, styles) =>
  class extends rcMini(Base, tag, `${RC_TOGGLE_MINI_STYLES}${styles}`) {
    _chipExtra() {
      return "";
    }

    _drawMini(items) {
      const s = this._summary(items, true);
      if (!s) return;
      const chips = s.shown
        .map((i) => {
          const cls = i.unavailable ? " na" : i.on ? " on pill" : " off";
          const style = i.on && i.color ? ` style="--t:${rcEsc(i.color)}"` : "";
          return `
          <button class="r${cls}" data-id="${rcEsc(i.id)}"${style} title="${rcEsc(i.name)} — ${rcEsc(i.state)}">
            <ha-icon icon="${rcEsc(i.icon)}"></ha-icon>${i.on ? `<span>${rcEsc(i.name)}</span>${this._chipExtra(i)}` : ""}
          </button>`;
        })
        .join("");
      this._paintMini({ level: s.level, icon: s.icon, status: s.status, chips, allOff: s.allOff });
    }
  };

// ── Overviews: the open room ─────────────────────────────────────────────────
// What both overviews share around their room tiles: a tap follows the room's `navigation_path` or unfolds its
// details in the `.panel` (filled by the subclass's `_fillPanel`, from `_roomGrid`), a click anywhere else folds it
// back and returns to the rooms needing a look. The subclass implements `_shownRooms()` (the tiles shown) and
// `_clearPanel()` (drops its detail cards); `_beforeFold()` (optional) runs first on an outside click.
const rcRoomsPanel = (Base) =>
  class extends Base {
    constructor() {
      super();
      this._onOutside = (ev) => {
        if (!rcOutside(this, ev)) return;
        this._beforeFold?.();
        if (this._openArea) this._toggle(null);
        rcUnzoom(this);
      };
    }

    // A new config rebuilds the room details, which take part of it (language, exclude, thresholds…).
    setConfig(config) {
      this._panelArea = null;
      super.setConfig(config);
    }

    connectedCallback() {
      super.connectedCallback?.();
      this._outside ??= watchOutside(this, this._onOutside);
      this._outside.on();
    }

    disconnectedCallback() {
      super.disconnectedCallback?.();
      this._outside?.off();
      // Left (another dashboard view, a conditional card hidden): folded back as by a click elsewhere, so that the
      // card does not come back with a room open, zoomed or its popup open.
      this._beforeFold?.();
      if (this._openArea) this._toggle(null);
      rcUnzoom(this);
    }

    _tap(aid) {
      const x = this._shownRooms().find((r) => r.id === aid);
      if (x?.navigation_path) rcNavigate(x.navigation_path);
      else this._toggle(this._openArea === aid ? null : aid);
    }

    // Opens a room's details (the render fills the panel), or folds them back.
    _toggle(aid) {
      this._openArea = aid;
      this._panelArea = null;
      this._sig = null;
      this._render();
      if (aid) return;
      const panel = this.shadowRoot.querySelector(".panel");
      panel.hidden = true;
      panel.innerHTML = "";
      this._clearPanel();
    }
  };

// ── Editor ───────────────────────────────────────────────────────────────────
// Fields shared by the room cards' editors.
const rcAreaFields = (navigation) => [
  { name: "area", selector: { area: {} } },
  { name: "title", selector: { text: {} } },
  ...(navigation ? [{ name: "navigation_path", selector: { navigation: {} } }] : []),
  { name: "columns", selector: { number: { min: 1, max: 4, mode: "box" } } },
];
// Compact tiles (default) or large ones, the size of Home Assistant's Tile card.
const rcLayoutField = (i18n, lang) => ({
  name: "layout",
  selector: {
    select: {
      mode: "dropdown",
      options: ["compact", "tiles"].map((value) => ({ value, label: rcT(i18n, lang, `ed_layout_${value}`) })),
    },
  },
});
const rcBooleans = (...names) => names.map((name) => ({ name, selector: { boolean: {} } }));

// "Advanced" section, folded, with the options that are lists or maps (edited as YAML) and the language. Its fields
// sit at the root of the config (`flatten`).
const RC_ADVANCED_HELPERS = ["language", "entities", "thresholds", "rooms"];
const rcAdvanced = (i18n, lang, ...names) => [
  {
    name: "advanced",
    type: "expandable",
    flatten: true,
    schema: names.map((name) =>
      name === "language"
        ? {
            name,
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { value: "", label: rcT(i18n, lang, "ed_language_auto") },
                  { value: "en", label: "English" },
                  { value: "fr", label: "Français" },
                  { value: "de", label: "Deutsch" },
                  { value: "es", label: "Español" },
                  { value: "sr", label: "Српски" },
                  { value: "sr-Latn", label: "Srpski (latinica)" },
                  { value: "it", label: "Italiano" },
                  { value: "nl", label: "Nederlands" },
                  { value: "pt", label: "Português (Portugal)" },
                  { value: "pl", label: "Polski" },
                  { value: "ro", label: "Română" },
                  { value: "da", label: "Dansk" },
                  { value: "sv", label: "Svenska" },
                  { value: "bg", label: "Български" },
                  { value: "ru", label: "Русский" },
                  { value: "uk", label: "Українська" },
                  { value: "hu", label: "Magyar" },
                  { value: "sk", label: "Slovenčina" },
                  { value: "cs", label: "Čeština" },
                  { value: "sl", label: "Slovenščina" },
                  { value: "lv", label: "Latviešu" },
                  { value: "el", label: "Ελληνικά" },
                ],
              },
            },
          }
        : { name, selector: { object: {} } },
    ),
  },
];
// Entity picker limited to `ids`, left out when there is none.
const rcEntitiesField = (name, ids) =>
  ids.length ? [{ name, selector: { entity: { multiple: true, include_entities: ids } } }] : [];

// Include list: the entities of the card's domains (narrowed by `card.includeMatch` when set), anywhere in the home,
// that the card does not show yet (entities already included stay in the list).
const rcIncludeField = (card, hass, config) => {
  if (!hass) return [];
  const shown = new Set(
    rcProbe(card, hass, { ...config, entities: undefined, include: [] })
      ._entries()
      .map((e) => e.entity),
  );
  const ids = Object.keys(hass.states).filter(
    (id) =>
      card.includeDomains.includes(id.split(".")[0]) &&
      (!card.includeMatch || card.includeMatch(hass, id)) &&
      !shown.has(id) &&
      !hass.entities?.[id]?.hidden &&
      !hass.entities?.[id]?.entity_category,
  );
  for (const e of config?.include || []) {
    const id = typeof e === "string" ? e : e.entity;
    if (!ids.includes(id)) ids.push(id);
  }
  return rcEntitiesField("include", ids);
};

// A detached card of class `card`, with `config` over its defaults, to run its discovery from the editor.
const rcProbe = (card, hass, config) => {
  const probe = document.createElement(card.tag);
  probe._hass = hass;
  probe._config = { ...card.defaults, ...config };
  return probe;
};

// Exclude list limited to what the card finds in the chosen room, with the card's own rules
// (entities already excluded stay in the list).
const rcExcludeField = (card, hass, config) => {
  const ids =
    hass && config?.area
      ? rcProbe(card, hass, { ...config, entities: undefined, exclude: [] })
          ._entries()
          .map((e) => e.entity)
      : [];
  return rcEntitiesField("exclude", ids);
};

// `schema(lang, hass, config)` lists the fields; options left at the card's default are not written to the YAML
// (list defaults such as `exclude: []` are not shown in the form: an empty list is never written anyway).
// `autos` maps an option to its default worked out from the config (`(hass, config) => value`): shown in the form
// while unset, and kept out of the YAML when left at it.
// Entity lists the form edits with an entity picker (ids only): an item written `{ entity, name, icon }` in YAML shows as its entity,
// and gets its name and icon back when the form changes the list (ha-room-card#77).
const RC_ENTITY_LISTS = ["include"];
const rcListIds = (list) => (Array.isArray(list) ? list.map((e) => (typeof e === "string" ? e : e?.entity)).filter(Boolean) : list);
const rcListKeep = (ids, before) =>
  Array.isArray(ids) ? ids.map((id) => (Array.isArray(before) ? before.find((e) => typeof e === "object" && e?.entity === id) : undefined) ?? id) : ids;

const rcEditor = ({ card, helpers, schema, autos = {} }) => {
  const i18n = card.i18n;
  const defaults = { show_title: true, ...Object.fromEntries(Object.entries(card.defaults).filter(([, v]) => !Array.isArray(v))) };
  return class extends HTMLElement {
    setConfig(config) {
      this._config = config;
      this._update();
    }

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    _update() {
      if (!this._hass || !this._config) return;
      const lang = rcLang(i18n, this._hass, this._config);
      // Read by the label and helper callbacks, set once on the form: a language change must reach them too.
      this._lang = lang;
      if (!this._form) {
        this._form = document.createElement("ha-form");
        this._form.computeLabel = (s) => rcT(i18n, this._lang, `ed_${s.name}`);
        this._form.computeHelper = (s) =>
          helpers.includes(s.name) ? rcT(i18n, this._lang, `ed_${s.name}_helper`) : undefined;
        this._form.addEventListener("value-changed", (ev) => {
          const config = { ...ev.detail.value };
          for (const k of RC_ENTITY_LISTS) if (k in config) config[k] = rcListKeep(config[k], this._config[k]);
          for (const k of Object.keys(config)) {
            const v = config[k];
            if (v === "" || v == null || (Array.isArray(v) && !v.length) || defaults[k] === v) delete config[k];
          }
          for (const [k, auto] of Object.entries(autos)) {
            const untouched = this._config[k] === undefined && config[k] === auto(this._hass, this._config);
            if (untouched || config[k] === auto(this._hass, config)) delete config[k];
          }
          this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
        });
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      // A new data or schema object re-renders the whole form, and the schema runs the card's discovery:
      // both only change with the config, the language or the registries.
      const memo = (this._memo ||= {});
      const h = this._hass;
      this._form.data = rcMemo(memo, "data", [this._config, h.areas], () => {
        const data = { ...defaults, ...this._config };
        for (const k of RC_ENTITY_LISTS) if (k in data) data[k] = rcListIds(data[k]);
        for (const [k, auto] of Object.entries(autos)) data[k] ??= auto(h, this._config);
        return data;
      });
      this._form.schema = rcMemo(memo, "schema", [lang, this._config, h.entities, h.devices, h.areas], () =>
        schema(lang, h, this._config),
      );
    }
  };
};

const rcRegister = (card, editor, name, description) => {
  if (customElements.get(card.tag)) return;
  customElements.define(card.tag, card);
  customElements.define(`${card.tag}-editor`, editor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: card.tag,
    name,
    description,
    preview: true,
    documentationURL: "https://github.com/juju35/ha-water-pump-card",
  });
};

if (!customElements.get("water-pump-card")) {
  console.info(`%c HA-WATER-PUMP-CARD %c v${RC_VERSION} `, "background:#2b8be6;color:#fff;font-weight:700", "");
}

// ── Common styles ────────────────────────────────────────────────────────────
const RC_BASE_STYLES = `
  :host {
    --rc-ok: var(--success-color, #43a047);
    --rc-warn: var(--warning-color, #ffa600);
    --rc-alert: var(--error-color, #db4437);
    --rc-info: var(--info-color, #039be5);
    --rc-light: var(--state-light-active-color, #ffb300);
    --rc-plug: var(--state-switch-on-color, var(--primary-color, #03a9f4));
    --rc-idle: var(--secondary-text-color, #9e9e9e);
    --rc-na: var(--disabled-color, #9e9e9e);
    display: block;
    min-width: 0;
  }
  /* The card answers its own width (container queries). That containment drops its content from its natural width: in
     a wrapper sized by its content (inline-block, a grid's auto column, a flex row: layout-card, button-card…) it would
     shrink to its padding. The empty grid below (no height) gives the host a natural width of 344 px there, as a
     preferred width only: its column is minmax(0, …), so the card still shrinks to its column in a grid card, a
     horizontal stack or a 1fr column, even wrapped in a <div> (hui-card in layout-card). contain-intrinsic-inline-size
     or a min-width in px would be a minimum there, and the card would overflow. */
  :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 344px); height: 0; }
  ha-card { padding: 12px; overflow: hidden; container-type: inline-size; }
  ha-card.lvl-alert { box-shadow: 0 0 0 1px color-mix(in srgb, var(--rc-alert) 45%, transparent), var(--ha-card-box-shadow, none); }

  .head { display: flex; align-items: center; gap: 10px; }
  .head.nav { cursor: pointer; }
  .head.nav:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; border-radius: 4px; }
  .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
           background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
  .badge ha-icon { --mdc-icon-size: 24px; }
  .lvl-alert .badge { animation: rc-pulse 1.6s ease-in-out infinite; }
  /* Narrow header: the title keeps a few letters (never 0 px), the status pill shrinks and ellipsises, the icon buttons
     (zoom, power) never shrink; under 200 px the pill is only its coloured dot, its text kept for screen readers. */
  .title { flex: 1 1 0; min-width: 5ch; font-size: 16px; font-weight: 500; color: var(--primary-text-color);
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
           /* show_title: false keeps the title's room (the pill and buttons stay in place) */
  :host([hide-title]) .head > .title { visibility: hidden; }
  .pill { all: unset; flex: 0 1 auto; min-width: 0; box-sizing: border-box; position: relative;
          display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 500;
          padding: 1px 8px; border-radius: 999px; background: color-mix(in srgb, var(--c) 14%, transparent);
          /* Coloured text is half the accent, half the text colour: 4.5:1 on its tint in light and dark themes, where
             the bare accent (amber above all) is not. */
          color: color-mix(in srgb, var(--c) 50%, var(--primary-text-color, #212121)); }
  .pt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill ha-icon { flex: none; }
  /* A card this narrow (6 columns of the Sections view on a phone): the title is at its few letters already, so the
     status pill goes to a line of its own under it, where its whole label fits, rather than end with "…". */
  @container (max-width: 260px) {
    .head { flex-wrap: wrap; row-gap: 4px; }
    .head::after { content: ""; order: 1; flex: 1 0 100%; }
    .head > .pill { order: 2; margin-left: 50px; max-width: calc(100% - 50px); }
  }
  @container (max-width: 200px) {
    /* Under 200 px the pill is only its dot again: back on the title's line. */
    .head { flex-wrap: nowrap; }
    .head::after { content: none; }
    .head > .pill { order: 0; margin-left: 0; max-width: none; }
    .head > .pill .pt, .st .pt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    .head > .pill:not(.action), .st { flex: none; padding: 0; width: 18px; height: 18px; justify-content: center; background: none; }
    .head > .pill:not(.action)::before, .st::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
    .head > .pill.action { padding: 1px 4px; }
    /* A full card this narrow (6 columns of the Sections view on a phone): a smaller badge, no side chip in the header. */
    .head { gap: 6px; }
    .head > .badge { width: 32px; height: 32px; }
    .head > .badge ha-icon { --mdc-icon-size: 20px; }
    .head > .chip { display: none; }
  }
  .pill.action { cursor: pointer; }
  .pill.action:hover { background: color-mix(in srgb, var(--c) 24%, transparent); }
  .pill.action:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .pill ha-icon { --mdc-icon-size: 12px; margin-left: -2px; }

  .grid { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
  .tile { all: unset; position: relative; overflow: hidden; box-sizing: border-box; cursor: pointer; min-width: 0;
          display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 5px; border-radius: 10px;
          touch-action: pan-y; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
          background: color-mix(in srgb, var(--t) 9%, var(--secondary-background-color, transparent));
          border: 1px solid color-mix(in srgb, var(--t) 22%, transparent); transition: background .2s, border-color .2s; }
  .tile.off, .tile.na { background: var(--secondary-background-color, transparent); border-color: transparent; }
  .tile.na { --t: var(--rc-na); opacity: .7; }
  .tile:hover { background: color-mix(in srgb, var(--t) 15%, var(--secondary-background-color, transparent)); }
  .tile:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .ic, .txt { position: relative; }
  .ic { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
        color: var(--t); background: color-mix(in srgb, var(--t) 20%, transparent); }
  .ic ha-icon { --mdc-icon-size: 16px; }
  .txt { display: flex; flex-direction: column; min-width: 0; }
  .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* A reading is never cut: on a narrow tile it goes on to a second line (the name, a label, keeps its ellipsis). */
  .state { font-size: 11px; line-height: 1.2; color: var(--secondary-text-color); overflow-wrap: break-word; }
  /* A card this narrow (a phone, 6 columns of the Sections view): one tile per row, whatever the columns option. */
  @container (max-width: 260px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  /* layout: tiles — the size of Home Assistant's Tile card — 56 px high, a 40 px icon, the name over the state. */
  .layout-tiles .grid { gap: 8px; }
  .layout-tiles .tile { min-height: 56px; gap: 10px; padding: 8px 10px 8px 8px; border-radius: 12px; }
  .layout-tiles .ic { width: 40px; height: 40px; }
  .layout-tiles .ic ha-icon { --mdc-icon-size: 24px; }
  .layout-tiles .txt { gap: 2px; }
  .layout-tiles .name { font-size: 14px; line-height: 1.25; }
  .layout-tiles .state { font-size: 12px; line-height: 1.25; }

  @keyframes rc-blink { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
  @keyframes rc-pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 45%, transparent) }
                        50% { box-shadow: 0 0 0 7px transparent } }
  @media (prefers-reduced-motion: reduce) { .tile, .lvl-alert .badge { animation: none; transition: none; } }
`;

// Mini cards: layout, chips and zoom button. A chip is plain (icon and text) until it needs a look: then a tinted pill.
// The zoom / detail button of the mini cards and the overviews.
const RC_ZOOM_STYLES = `
  /* 40 px to tap, laid out as the 24 px it looks (the negative margins). */
  .zoom { all: unset; flex: none; cursor: pointer; width: 40px; height: 40px; margin: -12px -12px -12px -8px; border-radius: 50%;
          display: grid; place-items: center; color: var(--secondary-text-color); }
  .zoom ha-icon { --mdc-icon-size: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--rc-idle) 16%, transparent); color: var(--primary-text-color); }
  .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
`;

// Lights and plugs mini cards: the "turn everything off" status (not filled: tinted on hover, like the zoom button)
// and the chips of the entities that are off (icon alone, grey).
const RC_TOGGLE_MINI_STYLES = `
  .st.action { all: unset; flex: 0 1 auto; min-width: 0; box-sizing: border-box; position: relative; cursor: pointer;
               display: inline-flex; align-items: center; gap: 3px; margin-left: auto; padding: 1px 6px; border-radius: 999px;
               font-size: 11px; font-weight: 500; color: var(--c); }
  .st.action ha-icon { --mdc-icon-size: 12px; flex: none; }
  .st.action:hover { background: color-mix(in srgb, var(--c) 14%, transparent); }
  .st.action:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  @container (max-width: 200px) {
    .st.action { width: auto; height: auto; padding: 1px 4px; }
    .st.action::before { content: none; }
  }
  .r.off, .r.na { padding: 0 3px; }
  .r.off ha-icon, .r.na ha-icon { margin-right: 0; }
  .r.off { --t: var(--rc-idle); }
  .r.na  { --t: var(--rc-na); opacity: .7; }
  .r small { flex: none; font-size: 10px; font-weight: 400; opacity: .8; margin-left: 4px; }
`;

// The overviews' room grid: the tiles, their icon, chips row, empty state and details panel. Each overview sets the
// tile's default tint and its own levels (`.room { --t: … }`, `.room.lvl-…`), the chips' spacing and the panel extras.
const RC_ROOM_GRID_STYLES = `
  .grid { display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
  @container (max-width: 340px) { .grid:not(.fixed) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  /* A card this narrow (6 columns of the Sections view on a phone): one room per row, whatever the columns option. Two
     left the name a letter or two ("B…") and pushed a chip out of its tile. */
  @container (max-width: 260px) { .grid.grid { grid-template-columns: minmax(0, 1fr); } }
  .grid[hidden] { display: none; }
  .room { all: unset; box-sizing: border-box; cursor: pointer; min-width: 0;
          display: grid; grid-template-columns: 26px minmax(0, 1fr); grid-template-areas: "ic name" "ic state" "chips chips";
          column-gap: 7px; align-items: center; align-content: start; padding: 6px 7px; border-radius: 10px;
          background: var(--secondary-background-color, transparent); border: 1px solid transparent;
          transition: background .2s, border-color .2s; }
  .room.lvl-warn, .room.lvl-alert {
    background: color-mix(in srgb, var(--t) 9%, var(--secondary-background-color, transparent));
    border-color: color-mix(in srgb, var(--t) 22%, transparent); }
  .room:hover { background: color-mix(in srgb, var(--t) 13%, var(--secondary-background-color, transparent)); }
  .room:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .room.sel { border-color: color-mix(in srgb, var(--primary-color) 55%, transparent); }
  .room .ic { grid-area: ic; align-self: start; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
              color: var(--t); background: color-mix(in srgb, var(--t) 16%, transparent); }
  .room.lvl-ok .ic { color: var(--primary-text-color); background: color-mix(in srgb, var(--rc-idle) 14%, transparent); }
  .room .ic ha-icon { --mdc-icon-size: 15px; }
  .room .name { grid-area: name; }
  /* The state (a sentence: "Water leak", "Too humid +1") wraps between its words only; a word too long for its line
     ends with "…" rather than being broken ("Pr|es|en|ce"). */
  .room .state { grid-area: state; overflow-wrap: normal; overflow: hidden; text-overflow: ellipsis; }
  .room:not(.lvl-ok) .state { color: color-mix(in srgb, var(--t) 50%, var(--primary-text-color, #212121)); }
  .chips { grid-area: chips; display: flex; flex-wrap: wrap; }
  .chips:empty { display: none; }
  .empty { grid-column: 1 / -1; padding: 12px; text-align: center; font-size: 13px; color: var(--secondary-text-color); }
  .panel { margin-top: 8px; border-radius: 12px; overflow: hidden; background: var(--secondary-background-color, transparent);
           --ha-card-background: transparent; --card-background-color: transparent;
           --ha-card-box-shadow: none; --ha-card-border-width: 0; }
  .panel[hidden] { display: none; }
  /* The unfolded room cards are custom elements with no display of their own: inline, the separator between them
     (border-top) would only paint on an empty first line box around their block <ha-card>. */
  .panel > * { display: block; }
  @media (prefers-reduced-motion: reduce) { .room { animation: none; transition: none; } }
`;

const RC_MINI_STYLES = `${RC_ZOOM_STYLES}
  /* The badge sits 12px from the card's top-left corner, like the other ha-* cards, beside the title and the readings. */
  ha-card:has(.mini) { padding: 12px; }
  .mini { display: flex; align-items: flex-start; gap: 10px; }
  /* The badge keeps the full card's size (40 px, icon 24 px): the body is at least as tall, a lone title line centred
     beside it. */
  .body { flex: 1; min-width: 0; min-height: 40px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .mini .head { gap: 8px; }
  .mini .title { line-height: 1.25; }
  .st { flex: 0 1 auto; min-width: 0; position: relative; display: inline-flex; align-items: center;
        margin-left: auto; font-size: 11px; font-weight: 500; color: var(--c); }
  .rs { display: flex; flex-wrap: wrap; gap: 2px 4px; margin-left: -4px; }
  .rs:empty { display: none; }
  /* A chip never runs past the card: a long name ends with an ellipsis. */
  .r { all: unset; cursor: pointer; display: inline-flex; align-items: baseline; gap: 1px; padding: 0 5px 0 4px;
       box-sizing: border-box; min-width: 0; max-width: 100%; overflow: hidden;
       border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 24px; white-space: nowrap; --t: var(--rc-ok);
       color: var(--primary-text-color); }
  .r ha-icon { --mdc-icon-size: 13px; flex: none; color: var(--t); align-self: center; margin-right: 2px; }
  .r > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .r.pill { color: color-mix(in srgb, var(--t) 50%, var(--primary-text-color, #212121)); background: color-mix(in srgb, var(--t) 14%, transparent); }
  .r:hover { background: color-mix(in srgb, var(--t) 20%, var(--secondary-background-color, transparent)); }
  .r:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
`;
