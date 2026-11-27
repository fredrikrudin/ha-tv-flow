/*
 * Trafikverket Trafikkarta – map card
 * Draws traffic flow sites (coloured by speed, sized by flow), road conditions
 * (coloured lines), road weather stations and, as an experimental feature,
 * traffic events around the configured home position.
 *
 *   type: custom:trafikverket-map-card
 *   title: Traffic around home     # optional
 *   height: 450                    # px, optional
 *   entry: <config_entry_id>       # optional, if you have several locations
 *   show_flow: true
 *   show_road: true
 *   show_weather: true
 *   show_situations: true          # experimental: accidents, obstacles, road works (needs the setting)
 *   show_road_works: true          # optional, overrides the "Show road works on the map" setting
 *   event_markers: symbols         # optional: symbols | text, overrides the "Event markers" setting
 *   dark_mode: false               # optional: true | false | auto – overrides the integration's
 *                                  # "Map style" setting
 *   zoom_margin_km: 0              # optional: start view = radius + margin (km); defaults to the
 *                                  # integration's "Margin around the area at start" setting
 *   legend: true                   # show the legend (click rows to show/hide)
 *   hidden: [speed:fast, road:1]   # optional default for hidden legend rows
 *   tile_url: https://tile.openstreetmap.org/{z}/{x}/{y}.png   # optional
 *
 * The UI follows Home Assistant's language: Swedish for "sv", English otherwise.
 * Leaflet is loaded from unpkg.com the first time the card is shown.
 * This file also contains the dashboard strategy "custom:tv-flow" (see the end).
 */

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;

/* ------------------------------------------------------------------ texts */

const TV_I18N = {
  sv: {
    locale: "sv-SE",
    leaflet_error: "Kunde inte ladda kartbiblioteket (Leaflet)",
    stub_title: "Trafik runt hemmet",
    details: "Detaljer",
    card_name: "Trafikverket Trafikkarta",
    card_desc: "Trafikflöden, väglag och vägväder från Trafikverket på en karta.",
    legend: "Teckenförklaring",
    legend_toggle: "Klicka för att visa/dölja",
    show_all: "Visa alla",
    avg_speed: "Medelhastighet",
    unknown: "okänd",
    road_condition: "Väglag",
    events: "Händelser",
    other: "Övrigt",
    weather_stations: "Väderstationer",
    zoom_to_area: "Zooma till området",
    home_tooltip: "Hem – klicka för att zooma till området",
    site: "Mätpunkt",
    flow: "Flöde",
    vehicles_h: "fordon/h",
    lowest: "lägst",
    quality: "Kvalitet",
    measured: "Mätt",
    km_away: "km bort",
    lane: "fält",
    road: "Väg",
    warning: "Varning",
    cause: "Orsak",
    measure: "Åtgärd",
    temporary_limit: "Tillfällig begränsning",
    impact: "Påverkan",
    from: "Från",
    to: "till",
    air: "Luft",
    surface: "Väg",
    humidity: "Fukt",
    wind: "Vind",
    gusts: "byar",
    precipitation: "Nederbörd",
    grip: "Friktion",
    footer: (n) =>
      `${n.flow} mätpunkter · ${n.road} väglagssträckor · ${n.sit ? n.sit + " händelser · " : ""}${n.weather} väderstationer` +
      (n.hidden ? ` (${n.hidden} ${n.hidden === 1 ? "kategori dold" : "kategorier dolda"})` : "") +
      ` · senaste mätning ${n.newest} · uppdateras var ${n.interval} min`,
    not_found: "Hittar ingen Trafikverket Trafikkarta-integration.",
    road_text: { 1: "Normalt", 2: "Besvärligt (risk för)", 3: "Mycket besvärligt", 4: "Is- och snövägbana" },
    event_text: { Olycka: "Olycka", Hinder: "Hinder", Vägarbete: "Vägarbete" },
    side: {
      northBound: "Norrgående", southBound: "Södergående", eastBound: "Östgående", westBound: "Västgående",
      clockwise: "Medurs", anticlockwise: "Moturs", innerRing: "Inre ring", outerRing: "Yttre ring",
      bothWays: "Båda riktningar", allDirections: "Alla riktningar",
    },
  },
  en: {
    locale: "en-GB",
    leaflet_error: "Could not load the map library (Leaflet)",
    stub_title: "Traffic around home",
    details: "Details",
    card_name: "Trafikverket Traffic Map",
    card_desc: "Traffic flow, road conditions and road weather from Trafikverket on a map.",
    legend: "Legend",
    legend_toggle: "Click to show/hide",
    show_all: "Show all",
    avg_speed: "Average speed",
    unknown: "unknown",
    road_condition: "Road conditions",
    events: "Events",
    other: "Other",
    weather_stations: "Weather stations",
    zoom_to_area: "Zoom to area",
    home_tooltip: "Home – click to zoom to the area",
    site: "Site",
    flow: "Flow",
    vehicles_h: "vehicles/h",
    lowest: "lowest",
    quality: "Quality",
    measured: "Measured",
    km_away: "km away",
    lane: "lane",
    road: "Road",
    warning: "Warning",
    cause: "Cause",
    measure: "Action",
    temporary_limit: "Temporary limit",
    impact: "Impact",
    from: "From",
    to: "to",
    air: "Air",
    surface: "Road",
    humidity: "Humidity",
    wind: "Wind",
    gusts: "gusts",
    precipitation: "Precipitation",
    grip: "Grip",
    footer: (n) =>
      `${n.flow} sites · ${n.road} road sections · ${n.sit ? n.sit + " events · " : ""}${n.weather} weather stations` +
      (n.hidden ? ` (${n.hidden} ${n.hidden === 1 ? "category hidden" : "categories hidden"})` : "") +
      ` · latest measurement ${n.newest} · updated every ${n.interval} min`,
    not_found: "No Trafikverket Trafikkarta integration found.",
    road_text: { 1: "Normal", 2: "Difficult (risk of)", 3: "Very difficult", 4: "Ice and snow" },
    event_text: { Olycka: "Accident", Hinder: "Obstacle", Vägarbete: "Road works" },
    side: {
      northBound: "Northbound", southBound: "Southbound", eastBound: "Eastbound", westBound: "Westbound",
      clockwise: "Clockwise", anticlockwise: "Anticlockwise", innerRing: "Inner ring", outerRing: "Outer ring",
      bothWays: "Both directions", allDirections: "All directions",
    },
  },
};

/**
 * Map points of one location from the integration's websocket API. Falls back to
 * the geo_location entities (older integration versions).
 */
async function tvFetchPoints(hass, entryId) {
  try {
    const res = await hass.callWS({ type: "trafikverket_map/map_data", ...(entryId ? { entry_id: entryId } : {}) });
    return (res && res.items) || [];
  } catch (e) {
    const out = [];
    for (const id in hass.states) {
      if (!id.startsWith("geo_location.")) continue;
      const s = hass.states[id];
      if (s.attributes.tv_type && (!entryId || s.attributes.config_entry_id === entryId)) out.push(s);
    }
    return out;
  }
}

/** "sv" for a Swedish Home Assistant, otherwise "en". */
function tvLang(hass) {
  const l = String((hass && ((hass.locale && hass.locale.language) || hass.language)) || "en").toLowerCase();
  return l.startsWith("sv") ? "sv" : "en";
}

/* ---------------------------------------------------------------- helpers */

let leafletPromise;
function loadLeaflet(errorText) {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error(errorText));
      document.head.appendChild(s);
    });
  }
  return leafletPromise;
}

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Speed classes are shared by the markers, the legend and the hide/show filter.
const SPEED_CLASSES = [
  { key: "speed:fast", color: "#2e7d32", label: () => "≥ 70 km/h", test: (v) => v != null && v >= 70 },
  { key: "speed:medium", color: "#9e9d24", label: () => "50–70", test: (v) => v != null && v >= 50 && v < 70 },
  { key: "speed:slow", color: "#ef6c00", label: () => "30–50", test: (v) => v != null && v >= 30 && v < 50 },
  { key: "speed:crawl", color: "#c62828", label: () => "< 30", test: (v) => v != null && v < 30 },
  { key: "speed:unknown", color: "#9e9e9e", label: (t) => t.unknown, test: (v) => v == null },
];
const speedKey = (v) => (SPEED_CLASSES.find((c) => c.test(v)) || SPEED_CLASSES[4]).key;
const speedColor = (v) => (SPEED_CLASSES.find((c) => c.test(v)) || SPEED_CLASSES[4]).color;

// Experimental events layer: only these Trafikverket message types are drawn.
const SIT_STYLE = {
  Olycka: { color: "#d50000", icon: "mdi:car-emergency" },
  Hinder: { color: "#ef6c00", icon: "mdi:alert-octagon" },
  Vägarbete: { color: "#795548", icon: "mdi:account-hard-hat" },
};
const ROAD_COLORS = { 1: "#43a047", 2: "#ffb300", 3: "#e53935", 4: "#1e88e5" };

function fmtTime(iso, locale) {
  if (!iso) return "–";
  try {
    const d = new Date(iso);
    const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    // Events often start or end on another day: show the date then.
    return d.toDateString() === new Date().toDateString()
      ? time : `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })} ${time}`;
  } catch (e) { return iso; }
}

/** Popup content with a "Details" link that opens the integration's details window. */
function tvPopup(html, label, onDetails) {
  if (!window.tvPointDialog || typeof document.createElement !== "function") return html;
  const el = document.createElement("div");
  if (!el || !("innerHTML" in el) || typeof el.querySelector !== "function") return html;
  el.innerHTML = `${html}<div style="margin-top:6px"><a href="#" class="tv-details">${label} ›</a></div>`;
  el.querySelector(".tv-details").addEventListener("click", (e) => { e.preventDefault(); onDetails(); });
  return el;
}

/* ------------------------------------------------------------------- card */

class TrafikverketMapCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      height: 450, show_flow: true, show_road: true, show_weather: true, show_situations: true, legend: true,
      tile_url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ...config,
    };
    this._built = false;
  }

  static getStubConfig(hass) {
    return { title: TV_I18N[tvLang(hass)].stub_title };
  }

  getCardSize() {
    return Math.ceil((this._config?.height || 450) / 50) + 1;
  }

  getGridOptions() {
    return { columns: 12, rows: Math.ceil((this._config?.height || 450) / 56) + 1, min_rows: 4 };
  }

  set hass(hass) {
    this._hass = hass;
    this._t = TV_I18N[tvLang(hass)];
    if (!this._built) this._build();
    else if (this._dataChanged()) this._scheduleUpdate();
  }

  _build() {
    this._built = true;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${LEAFLET_CSS}">
      <style>
        ha-card { overflow: hidden; }
        .header { padding: 12px 16px 4px; font-size: 1.2em; font-weight: 500; }
        #map { height: ${Number(this._config.height)}px; width: 100%; background: var(--secondary-background-color); }
        .dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9); }
        .legend { background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);
                  padding: 6px 8px; border-radius: 6px; font: 12px/1.4 var(--paper-font-body1_-_font-family, sans-serif);
                  box-shadow: 0 1px 4px rgba(0,0,0,.3); }
        .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; flex: none; }
        .legend b { display: block; margin-top: 6px; }
        .legend .lh { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; user-select: none; }
        .legend .lh span { margin-left: auto; color: var(--secondary-text-color, #666); }
        .legend .li { display: flex; align-items: center; padding: 2px 4px; margin: 0 -4px; border-radius: 4px;
                      cursor: pointer; user-select: none; }
        .legend .li:hover { background: var(--secondary-background-color, #eee); }
        .legend .li.off { opacity: .4; text-decoration: line-through; }
        .legend .li em { margin-left: auto; padding-left: 10px; font-style: normal; color: var(--secondary-text-color, #666); }
        .legend .all { display: block; margin-top: 6px; color: var(--primary-color, #1976d2); cursor: pointer; }
        .legend.collapsed .lb { display: none; }
        .temp { background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);
                border: 1px solid #1976d2; border-radius: 10px; padding: 1px 5px; font: 600 11px sans-serif;
                white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
        .sit { width: 24px; height: 24px; border-radius: 50%; color: #fff; border: 2px solid #fff;
               box-shadow: 0 1px 4px rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center;
               transform: translate(-50%, -50%); }
        .sit ha-icon { --mdc-icon-size: 15px; color: #fff; display: flex; }
        .sit-text { display: inline-block; white-space: nowrap; color: #fff; font: 700 11px/1 sans-serif;
                    padding: 4px 7px; border-radius: 10px; border: 2px solid #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,.5); transform: translate(-50%, -50%); }
        .err { padding: 16px; color: var(--error-color, red); }
        .leaflet-popup-content { font: 13px/1.4 sans-serif; }
        .leaflet-popup-content table { border-collapse: collapse; }
        .leaflet-popup-content td { padding: 0 6px 0 0; }
        .area-btn { display: flex !important; align-items: center; justify-content: center; color: #333; }
        .dark .area-btn, .area-btn:hover { color: #1976d2; }
        .footer { padding: 4px 16px 8px; font-size: 11px; color: var(--secondary-text-color); }
      </style>
      <ha-card>
        ${this._config.title ? `<div class="header">${esc(this._config.title)}</div>` : ""}
        <div id="map"></div>
        <div class="footer" id="footer"></div>
      </ha-card>`;
    loadLeaflet(this._t.leaflet_error)
      .then((L) => this._initMap(L))
      .catch((e) => { root.getElementById("map").innerHTML = `<div class="err">${esc(e.message)}</div>`; });
  }

  _isDark(home) {
    let m = this._config.dark_mode;
    if (m === undefined || m === null || m === "") {
      const style = home?.attributes?.map_style || "light";
      m = style === "dark" ? true : style === "auto" ? "auto" : false;
    }
    if (m === true || m === "true") return true;
    if (m === false || m === "false") return false;
    return !!this._hass?.themes?.darkMode;
  }

  _initMap(L) {
    const el = this.shadowRoot.getElementById("map");
    this._L = L;
    this._map = L.map(el, { zoomControl: true, attributionControl: true });
    L.tileLayer(this._config.tile_url, {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap | Data: Trafikverket",
    }).addTo(this._map);
    this._layers = {
      home: L.layerGroup().addTo(this._map),
      road: L.layerGroup().addTo(this._map),
      flow: L.layerGroup().addTo(this._map),
      weather: L.layerGroup().addTo(this._map),
      situation: L.layerGroup().addTo(this._map),
    };
    this._loadLegendState();
    if (this._config.legend !== false) this._addLegend(L);
    this._addAreaButton(L);
    this._map.setView([59.33, 18.06], 10);
    // The card is often created before it has a size (sections view, hidden tab).
    // Re-fit when it gets one, until the user pans or zooms.
    this._userMoved = false;
    this._map.on("dragstart zoomstart", () => { if (!this._fitting) this._userMoved = true; });
    new ResizeObserver(() => {
      if (!this._map) return;
      this._map.invalidateSize();
      if (!this._userMoved && el.clientWidth > 0 && el.clientHeight > 0) this._fitArea(false);
    }).observe(el);
    this._area = null;
    this._areaKey = "";
    this._homeSig = null;
    this._markers = new Map();
    this._refresh();
  }

  /* --- legend: rows can be clicked to hide/show a category -------------- */

  _storageKey() {
    return `tv-flow-map-legend:${this._config.entry || "default"}`;
  }

  _loadLegendState() {
    this._hidden = new Set(Array.isArray(this._config.hidden) ? this._config.hidden : []);
    this._legendCollapsed = false;
    try {
      const raw = window.localStorage && window.localStorage.getItem(this._storageKey());
      if (raw) {
        const st = JSON.parse(raw);
        this._hidden = new Set(st.hidden || []);
        this._legendCollapsed = !!st.collapsed;
      }
    } catch (e) { /* storage unavailable – use defaults */ }
  }

  _saveLegendState() {
    try {
      window.localStorage && window.localStorage.setItem(this._storageKey(),
        JSON.stringify({ hidden: [...this._hidden], collapsed: this._legendCollapsed }));
    } catch (e) { /* ignore */ }
  }

  _addLegend(L) {
    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const d = L.DomUtil.create("div", "legend");
      L.DomEvent.disableClickPropagation(d);
      L.DomEvent.disableScrollPropagation && L.DomEvent.disableScrollPropagation(d);
      L.DomEvent.on(d, "click", (e) => this._onLegendClick(e));
      this._legendEl = d;
      return d;
    };
    legend.addTo(this._map);
  }

  _onLegendClick(e) {
    const t = e && e.target && e.target.closest ? e.target.closest("[data-key],[data-act]") : null;
    if (!t) return;
    const act = t.dataset.act;
    if (act === "collapse") {
      this._legendCollapsed = !this._legendCollapsed;
    } else if (act === "all") {
      this._hidden.clear();
    } else if (t.dataset.key) {
      const k = t.dataset.key;
      this._hidden.has(k) ? this._hidden.delete(k) : this._hidden.add(k);
    }
    this._saveLegendState();
    this._update(); // hidden categories are removed/added marker by marker
  }

  _renderLegend(counts) {
    const d = this._legendEl;
    if (!d) return;
    const c = this._config;
    const t = this._t;
    const row = (key, color, label, shape = "") =>
      `<div class="li${this._hidden.has(key) ? " off" : ""}" data-key="${key}" title="${esc(t.legend_toggle)}">` +
      `<i style="background:${color};${shape}"></i>${esc(label)}<em>${counts[key] || 0}</em></div>`;
    let body = "";
    if (c.show_flow) {
      body += `<b>${esc(t.avg_speed)}</b>` + SPEED_CLASSES.map((sc) => row(sc.key, sc.color, sc.label(t))).join("");
    }
    if (c.show_road) {
      body += `<b>${esc(t.road_condition)}</b>` + Object.entries(ROAD_COLORS)
        .map(([k, col]) => row(`road:${k}`, col, t.road_text[k], "border-radius:0;height:4px")).join("");
    }
    const events = Object.keys(SIT_STYLE).some((type) => counts[`event:${type}`]);
    if (c.show_situations && events) {
      body += `<b>${esc(t.events)}</b>` +
        Object.entries(SIT_STYLE)
          .filter(([type]) => type !== "Vägarbete" || this._showRoadWorks !== false)
          .map(([type, st]) => row(`event:${type}`, st.color, t.event_text[type])).join("");
    }
    if (c.show_weather) {
      body += `<b>${esc(t.other)}</b>` + row("weather", "#1976d2", t.weather_stations, "border-radius:3px");
    }
    if (this._hidden.size) body += `<a class="all" data-act="all">${esc(t.show_all)}</a>`;
    d.classList.toggle("collapsed", this._legendCollapsed);
    d.innerHTML = `<div class="lh" data-act="collapse">${esc(t.legend)}<span>${this._legendCollapsed ? "▸" : "▾"}</span></div>` +
      `<div class="lb">${body}</div>`;
  }

  /* --- zoom to the configured area --------------------------------------- */

  _addAreaButton(L) {
    const ctrl = L.control({ position: "topleft" });
    ctrl.onAdd = () => {
      const bar = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const a = L.DomUtil.create("a", "area-btn", bar);
      a.href = "#";
      a.title = this._t.zoom_to_area;
      a.setAttribute("role", "button");
      a.setAttribute("aria-label", this._t.zoom_to_area);
      a.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="' +
        "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M3.05,13H1V11H3.05C3.5,6.83 6.83,3.5 11,3.05V1H13V3.05" +
        "C17.17,3.5 20.5,6.83 20.95,11H23V13H20.95C20.5,17.17 17.17,20.5 13,20.95V23H11V20.95C6.83,20.5 3.5,17.17 3.05,13" +
        "M12,5A7,7 0 0,0 5,12A7,7 0 0,0 12,19A7,7 0 0,0 19,12A7,7 0 0,0 12,5Z" + '"/></svg>';
      L.DomEvent.disableClickPropagation(bar);
      L.DomEvent.on(a, "click", (e) => { L.DomEvent.preventDefault(e); this._fitArea(true, true); });
      return bar;
    };
    ctrl.addTo(this._map);
  }

  _fitArea(animate = false, byUser = false) {
    if (!this._map || !this._area) return;
    const { center, radiusKm, marginKm } = this._area;
    const cfg = this._config.zoom_margin_km;
    const margin = Math.max(0, Number(cfg !== undefined && cfg !== null && cfg !== "" ? cfg : marginKm) || 0);
    const viewKm = radiusKm + margin; // margin 0 -> exactly the chosen radius
    if (byUser) this._userMoved = false; // "zoom to area" makes the map follow resizes again
    this._fitting = true;
    try {
      this._map.fitBounds(this._L.latLng(center).toBounds(viewKm * 2000), { padding: [12, 12], animate });
    } finally {
      this._fitting = false;
    }
  }

  /* --- drawing ------------------------------------------------------------ */

  _scheduleUpdate() {
    if (this._pending) return;
    this._pending = setTimeout(() => { this._pending = null; this._refresh(); }, 500);
  }

  /** Fetch the map points (only after new data), then draw. */
  async _refresh() {
    if (!this._hass) return;
    if (!this._homeId) this._dataChanged();
    const home = this._homeId ? this._hass.states[this._homeId] : null;
    const token = (this._fetchToken = (this._fetchToken || 0) + 1);
    const points = await tvFetchPoints(this._hass, home ? home.attributes.config_entry_id : this._config.entry);
    if (token !== this._fetchToken) return; // a newer fetch is on its way
    this._points = points;
    this._update();
  }

  /**
   * Cheap check run on every hass update (Home Assistant sends one for any state
   * change anywhere). Trafikverket data only changes when the integration fetches,
   * so we watch the home sensor and the data usage sensor (its `requests`
   * attribute grows with every fetch) instead of scanning all entities.
   */
  _dataChanged() {
    const states = this._hass.states;
    const entry = this._config.entry;
    let home = this._homeId && states[this._homeId];
    if (!home || !home.attributes.trafikverket_home || (entry && home.attributes.config_entry_id !== entry)) {
      home = Object.values(states).find(
        (s) => s.attributes.trafikverket_home && (!entry || s.attributes.config_entry_id === entry));
      this._homeId = home ? home.entity_id : null;
    }
    const usageId = home && home.attributes.entity_ids && home.attributes.entity_ids.data_usage;
    const usage = usageId ? states[usageId] : null;
    const now = Date.now();
    const sig = [home && home.last_updated, usage && usage.last_updated, this._t && this._t.locale,
      this._hass.themes && this._hass.themes.darkMode].join("|");
    // Fallback: a full refresh at least once a minute (e.g. without the usage sensor).
    if (sig === this._triggerSig && now - (this._lastFull || 0) < 60000) return false;
    this._triggerSig = sig;
    this._lastFull = now;
    return true;
  }

  _collect() {
    const home = this._homeId ? this._hass.states[this._homeId] : null;
    return { home, geo: this._points || [] };
  }

  _removeMarker(id) {
    const m = this._markers.get(id);
    if (!m) return;
    m.layers.forEach((l) => this._layers[m.group].removeLayer(l));
    this._markers.delete(id);
  }

  /** Build the Leaflet layers for one entity (not yet added to the map). */
  _buildLayers(s, ctx) {
    const L = this._L;
    const { t, loc, markerStyle } = ctx;
    const a = s.attributes;
    const ll = [a.latitude, a.longitude];
    const away = `${esc(s.state)} ${t.km_away}`;
    const details = () => window.tvPointDialog && window.tvPointDialog.open(this._hass, s, this);
    const out = [];
    if (a.tv_type === "flow") {
      const r = Math.min(18, 5 + Math.sqrt(a.flow || 0) / 3);
      const ids = a.site_ids || [a.site_id];
      const lanes = (a.lanes || []).map((l) =>
        `<tr>${ids.length > 1 ? `<td>${esc(l.site_id ?? "")}</td>` : ""}<td>${esc(t.side[l.side] || l.side || "")}</td><td>${t.lane} ${esc(l.lane ?? "–")}</td><td>${esc(l.vehicle_type)}</td>` +
        `<td>${esc(l.flow)} ${t.vehicles_h}</td><td>${l.speed != null ? esc(l.speed) + " km/h" : "–"}</td></tr>`).join("");
      out.push(L.circleMarker(ll, { radius: r, color: "#fff", weight: 1.5, fillColor: speedColor(a.average_speed), fillOpacity: 0.85 })
        .bindTooltip(`${a.average_speed ?? "–"} km/h · ${a.flow} ${t.vehicles_h}`)
        .bindPopup(() => tvPopup(`<b>${t.site} ${esc(ids.join(", "))}</b><br>${t.flow}: <b>${esc(a.flow)}</b> ${t.vehicles_h}<br>` +
          `${t.avg_speed}: <b>${esc(a.average_speed ?? "–")}</b> km/h (${t.lowest} ${esc(a.min_speed ?? "–")})<br>` +
          `${t.quality}: ${esc(a.data_quality ?? "–")} · ${t.measured} ${fmtTime(a.measurement_time, loc)} · ${away}` +
          (lanes ? `<table>${lanes}</table>` : ""), t.details, details), { maxWidth: 360 }));
    } else if (a.tv_type === "road") {
      const color = ROAD_COLORS[a.condition_code] || "#757575";
      // condition_text etc. come from Trafikverket (Swedish); the class name is localized.
      const cls = t.road_text[a.condition_code] || a.condition_text || "";
      const popup = `<b>${esc(a.road_number || t.road)}: ${esc(cls)}</b><br>` +
        (a.condition_text && a.condition_text !== cls ? `${esc(a.condition_text)}<br>` : "") +
        (a.condition_info ? esc(a.condition_info) + "<br>" : "") +
        (a.warning ? `${t.warning}: ${esc(a.warning)}<br>` : "") +
        (a.cause ? `${t.cause}: ${esc(a.cause)}<br>` : "") +
        (a.measure ? `${t.measure}: ${esc(a.measure)}<br>` : "") +
        (a.location_text ? `<i>${esc(a.location_text)}</i>` : "");
      const lines = a.lines && a.lines.length ? a.lines : [[ll]];
      const content = () => tvPopup(popup, t.details, details);
      for (const line of lines) {
        out.push(line.length > 1
          ? L.polyline(line, { color, weight: a.condition_code > 1 ? 6 : 4, opacity: a.condition_code > 1 ? 0.9 : 0.5 }).bindPopup(content)
          : L.circleMarker(line[0], { radius: 5, color, fillOpacity: 0.8 }).bindPopup(content));
      }
    } else if (a.tv_type === "situation") {
      const st = SIT_STYLE[a.message_type];
      const typeText = t.event_text[a.message_type] || a.message_type;
      const popup =
        `<b>${esc(typeText)}${a.road_number ? " – " + esc(a.road_number) : ""}</b><br>` +
        (a.header ? `${esc(a.header)}<br>` : "") +
        (a.message && a.message !== a.header ? `<small>${esc(a.message)}</small><br>` : "") +
        (a.location_text ? `<i>${esc(a.location_text)}</i><br>` : "") +
        (a.temporary_limit ? `${t.temporary_limit}: ${esc(a.temporary_limit)}<br>` : "") +
        (a.severity_text ? `${t.impact}: ${esc(a.severity_text)}<br>` : "") +
        `${t.from} ${fmtTime(a.start_time, loc)}${a.end_time ? ` ${t.to} ` + fmtTime(a.end_time, loc) : ""} · ${away}`;
      for (const line of a.lines || []) {
        if (line.length > 1) out.push(L.polyline(line, { color: st.color, weight: 5, opacity: 0.8, dashArray: "6 6" }).bindPopup(() => tvPopup(popup, t.details, details)));
      }
      // Zero-size icon; the inner element centres itself on the position (works for any label width).
      const html = markerStyle === "text"
        ? `<div class="sit-text" style="background:${st.color}">${esc(typeText)}</div>`
        : `<div class="sit" style="background:${st.color}"><ha-icon icon="${st.icon}"></ha-icon></div>`;
      const icon = L.divIcon({ className: "", html, iconSize: [0, 0], iconAnchor: [0, 0] });
      out.push(L.marker(ll, { icon, zIndexOffset: a.is_warning ? 1000 : 300, title: typeText }).bindPopup(() => tvPopup(popup, t.details, details), { maxWidth: 320 }));
    } else if (a.tv_type === "weather") {
      const temp = a.air_temperature != null ? `${Math.round(a.air_temperature * 10) / 10}°` : "–";
      const icon = L.divIcon({ className: "", html: `<div class="temp">${esc(temp)}</div>`, iconSize: null, iconAnchor: [18, 10] });
      out.push(L.marker(ll, { icon, zIndexOffset: 500 })
        .bindPopup(() => tvPopup(`<b>${esc(a.station)}</b><br>` +
          `${t.air}: ${esc(a.air_temperature ?? "–")} °C · ${t.surface}: ${esc(a.surface_temperature ?? "–")} °C<br>` +
          `${t.humidity}: ${esc(a.humidity ?? "–")} % · ${t.wind}: ${esc(a.wind_speed ?? "–")} m/s (${t.gusts} ${esc(a.wind_gust ?? "–")}) ` +
          `${a.wind_direction != null ? esc(a.wind_direction) + "°" : ""}<br>` +
          `${t.precipitation}: ${esc(a.precipitation_text ?? "–")}` +
          (a.precipitation_30min != null ? ` (${esc(a.precipitation_30min)} mm/30 min)` : "") + "<br>" +
          (a.grip != null ? `${t.grip}: ${esc(a.grip)}<br>` : "") +
          `${t.measured} ${fmtTime(a.sample, loc)} · ${away}`, t.details, details)));
    }
    return out;
  }

  _update() {
    if (!this._map || !this._hass) return;
    const L = this._L;
    const t = this._t;
    const loc = t.locale;
    if (!this._homeId) this._dataChanged();
    const { home, geo } = this._collect();
    const dark = this._isDark(home);
    this.shadowRoot.getElementById("map").classList.toggle("dark", dark);
    this._markers = this._markers || new Map();

    // Home marker and radius: only redrawn when the home sensor or language changes.
    const homeSig = home ? `${home.last_updated}|${loc}` : "";
    if (homeSig !== this._homeSig) {
      this._homeSig = homeSig;
      this._layers.home.clearLayers();
      if (home) {
        const a = home.attributes;
        const center = [a.home_latitude, a.home_longitude];
        L.circle(center, { radius: a.radius_km * 1000, color: "#1976d2", weight: 1, fill: true, fillOpacity: 0.04, interactive: false })
          .addTo(this._layers.home);
        L.circleMarker(center, { radius: 6, color: "#fff", weight: 2, fillColor: "#1976d2", fillOpacity: 1 })
          .bindTooltip(t.home_tooltip)
          .on("click", () => this._fitArea(true, true))
          .addTo(this._layers.home);
        this._area = { center, radiusKm: a.radius_km, marginKm: Number(a.map_zoom_margin_km) || 0 };
        // Zoom to the area the first time and whenever position, radius or margin changes.
        const key = `${a.home_latitude},${a.home_longitude},${a.radius_km},${a.map_zoom_margin_km}`;
        if (key !== this._areaKey) {
          this._areaKey = key;
          this._userMoved = false;
          this._fitArea(false);
        }
      }
    }

    // Event options: card config overrides the integration settings.
    const ha = home ? home.attributes : {};
    const cfgRW = this._config.show_road_works;
    this._showRoadWorks = cfgRW !== undefined && cfgRW !== null ? cfgRW !== false && cfgRW !== "false"
      : ha.show_road_works !== false;
    const markerStyle = this._config.event_markers || ha.event_marker_style || "symbols";
    const ctx = { t, loc, markerStyle };
    // Anything that changes how a marker looks, apart from its own data.
    const optSig = `${loc}|${markerStyle}`;

    const n = { flow: 0, road: 0, situation: 0, weather: 0 };
    let newest = null;
    const counts = {};
    const hidden = this._hidden || new Set();
    const seen = new Set();
    let redrawn = 0;
    for (const s of geo) {
      const a = s.attributes;
      let cat = null;
      let group = null;
      if (a.tv_type === "flow" && this._config.show_flow) {
        cat = speedKey(a.average_speed); group = "flow";
      } else if (a.tv_type === "road" && this._config.show_road) {
        cat = `road:${ROAD_COLORS[a.condition_code] ? a.condition_code : 1}`; group = "road";
      } else if (a.tv_type === "situation" && this._config.show_situations && SIT_STYLE[a.message_type]) {
        if (a.message_type === "Vägarbete" && !this._showRoadWorks) continue;
        cat = `event:${a.message_type}`; group = "situation";
      } else if (a.tv_type === "weather" && this._config.show_weather) {
        cat = "weather"; group = "weather";
      } else {
        continue;
      }
      counts[cat] = (counts[cat] || 0) + 1;
      if (hidden.has(cat)) continue;
      n[group]++;
      if (group === "flow" && a.measurement_time && (!newest || a.measurement_time > newest)) newest = a.measurement_time;
      seen.add(s.entity_id);

      const sig = `${s.last_updated}|${optSig}`;
      const cached = this._markers.get(s.entity_id);
      if (cached && cached.sig === sig && cached.group === group) continue;
      this._removeMarker(s.entity_id);
      const layers = this._buildLayers(s, ctx);
      layers.forEach((l) => l.addTo(this._layers[group]));
      this._markers.set(s.entity_id, { sig, group, layers });
      redrawn++;
    }
    for (const id of [...this._markers.keys()]) if (!seen.has(id)) this._removeMarker(id);
    this._redrawn = redrawn; // for diagnostics/tests

    this._renderLegend(counts);

    const footer = this.shadowRoot.getElementById("footer");
    footer.textContent = home
      ? t.footer({ flow: n.flow, road: n.road, sit: n.situation, weather: n.weather, hidden: hidden.size,
                   newest: fmtTime(newest, loc), interval: home.attributes.scan_interval_min })
      : t.not_found;
  }
}

if (!customElements.get("trafikverket-map-card")) customElements.define("trafikverket-map-card", TrafikverketMapCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "trafikverket-map-card",
  name: TV_I18N.en.card_name,
  description: TV_I18N.en.card_desc,
  preview: false,
});

/* ==========================================================================
 * Dashboard strategy:  strategy: { type: custom:tv-flow }
 *
 * Builds the whole dashboard from the integration's settings
 * (Configure → Dashboard and map): which sections, in which order, map height.
 *   strategy:
 *     type: custom:tv-flow
 *     entry: <config_entry_id>   # optional, if you have several locations
 *     title: Traffic             # optional
 * Texts follow Home Assistant's language (Swedish or English).
 * ========================================================================== */

const TV_SECTION_ORDER = ["summary", "traffic", "weather", "road", "map", "now", "history", "data"];

const TV_DASH_I18N = {
  sv: {
    title: "Trafik", summary: "Vägöversikt", traffic: "Trafikläge", nearest_site: "Närmaste mätpunkt", weather: "Väder vid vägen", local_weather: "Lokalt väder",
    air: "Luft", surface: "Vägbana", wind: "Vind", humidity: "Luftfuktighet", precipitation: "Nederbörd",
    last_30: "Senaste 30 min", visibility: "Sikt", grip: "Friktion",
    station_line: (w) =>
      `<small>Station: **{{ state_attr('${w}', 'station') or '–' }}**, ` +
      `{{ state_attr('${w}', 'distance_km') or '–' }} km bort · ` +
      `mätt {{ (as_datetime(state_attr('${w}', 'sample')) | as_local).strftime('%H:%M') ` +
      `if state_attr('${w}', 'sample') else '–' }}</small>`,
    road: "Väglag", worst_road: "Sämsta väglag", difficult_sections: "Besvärliga sträckor",
    road_default: "Väg", road_normal: "🟢 Normalt väglag inom radien.",
    map: "Trafikkarta", now: "Läget nu",
    alert_count: (id) => `{{ states('${id}') }} sträckor med besvärligt väglag.`,
    alert_warning: "Varning", alert_cause: "Orsak",
    avg_speed: "Medelhastighet", lowest_speed: "Lägsta hastighet", traffic_flow: "Trafikflöde", sites: "Mätpunkter",
    slowest: "Långsammast just nu", site: "Mätpunkt", vehicles_h: "fordon/h", distance: "Avstånd",
    no_sites: "Inga mätpunkter med hastighet inom radien just nu.",
    history: "Historik", mean: "Medel", lowest: "Lägsta", speed_24h: "Hastighet senaste dygnet",
    temp_24h: "Temperatur luft och vägbana", flow_week: "Trafikflöde senaste veckan", vehicles_h_cap: "Fordon/h",
    data: "Datamängd", fetched: "Hämtat sedan start", per_fetch: "Per hämtning",
    data_line: (home, usage) =>
      `<small>Radie **{{ state_attr('${home}', 'radius_km') }} km** · ` +
      `väder **{{ state_attr('${home}', 'weather_radius_km') }} km** · ` +
      `uppdateras var **{{ state_attr('${home}', 'scan_interval_min') }} min** · ` +
      `{{ state_attr('${usage}', 'requests') or 0 }} anrop sedan start. ` +
      "Ordning och innehåll ändras under Inställningar → Enheter och tjänster → " +
      "Trafikverket Trafikkarta → Konfigurera → Dashboard och karta.</small>",
    badge_avg: "Snitt",
    not_found:
      "## Trafikverket Trafikkarta\nHittar ingen konfigurerad plats. Lägg till integrationen under " +
      "**Inställningar → Enheter och tjänster**, och ladda sedan om sidan.",
  },
  en: {
    title: "Traffic", summary: "Road status", traffic: "Traffic now", nearest_site: "Nearest site", weather: "Roadside weather", local_weather: "Local weather",
    air: "Air", surface: "Road surface", wind: "Wind", humidity: "Humidity", precipitation: "Precipitation",
    last_30: "Last 30 min", visibility: "Visibility", grip: "Grip",
    station_line: (w) =>
      `<small>Station: **{{ state_attr('${w}', 'station') or '–' }}**, ` +
      `{{ state_attr('${w}', 'distance_km') or '–' }} km away · ` +
      `measured {{ (as_datetime(state_attr('${w}', 'sample')) | as_local).strftime('%H:%M') ` +
      `if state_attr('${w}', 'sample') else '–' }}</small>`,
    road: "Road conditions", worst_road: "Worst road condition", difficult_sections: "Difficult sections",
    road_default: "Road", road_normal: "🟢 Normal road conditions within the radius.",
    map: "Traffic map", now: "Current situation",
    alert_count: (id) => `{{ states('${id}') }} sections with difficult road conditions.`,
    alert_warning: "Warning", alert_cause: "Cause",
    avg_speed: "Average speed", lowest_speed: "Lowest speed", traffic_flow: "Traffic flow", sites: "Measurement sites",
    slowest: "Slowest right now", site: "Site", vehicles_h: "vehicles/h", distance: "Distance",
    no_sites: "No measurement sites with speed within the radius right now.",
    history: "History", mean: "Mean", lowest: "Lowest", speed_24h: "Speed last 24 hours",
    temp_24h: "Air and road surface temperature", flow_week: "Traffic flow last week", vehicles_h_cap: "Vehicles/h",
    data: "Data usage", fetched: "Downloaded since start", per_fetch: "Per fetch",
    data_line: (home, usage) =>
      `<small>Radius **{{ state_attr('${home}', 'radius_km') }} km** · ` +
      `weather **{{ state_attr('${home}', 'weather_radius_km') }} km** · ` +
      `updated every **{{ state_attr('${home}', 'scan_interval_min') }} min** · ` +
      `{{ state_attr('${usage}', 'requests') or 0 }} requests since start. ` +
      "Change order and content under Settings → Devices & services → " +
      "Trafikverket Trafikkarta → Configure → Dashboard and map.</small>",
    badge_avg: "Average",
    not_found:
      "## Trafikverket Trafikkarta\nNo configured location found. Add the integration under " +
      "**Settings → Devices & services**, then reload the page.",
  },
};

function tvFindHome(hass, entry) {
  return Object.values(hass.states).find(
    (s) => s.attributes.trafikverket_home && (!entry || s.attributes.config_entry_id === entry)
  );
}

function tvCompact(list) {
  return list.filter(Boolean);
}

function tvTile(id, name, color, icon, extra = {}) {
  if (!id) return null;
  return { type: "tile", entity: id, name, color, ...(icon ? { icon } : {}), ...extra };
}

function tvBadge(id, name, color, extra = {}) {
  if (!id) return null;
  return { type: "entity", entity: id, name, show_name: !!name, ...(color ? { color } : {}), ...extra };
}

const TV_SECTIONS = {
  summary(ids, entry, home, d) {
    return {
      type: "grid",
      cards: [
        { type: "heading", heading: d.summary, icon: "mdi:road-variant" },
        { type: "custom:trafikverket-road-card", entry, max_roads: 3, grid_options: { columns: "full" } },
      ],
    };
  },

  traffic(ids, entry, home, d) {
    if (!ids.average_speed && !ids.flow_sites) return null;
    return {
      type: "grid",
      cards: [
        { type: "heading", heading: d.traffic, icon: "mdi:car-multiple" },
        { type: "custom:trafikverket-traffic-card", entry, max_sites: 5, hours: 3, grid_options: { columns: "full" } },
        { type: "custom:trafikverket-site-card", entry, title: d.nearest_site, grid_options: { columns: "full" } },
      ],
    };
  },

  weather(ids, entry, home, d) {
    if (!ids.weather && !ids.air_temperature) return null;
    const w = ids.weather;
    return {
      type: "grid",
      cards: tvCompact([
        { type: "heading", heading: d.weather, icon: "mdi:weather-partly-snowy-rainy" },
        w && {
          type: "weather-forecast", entity: w, name: d.local_weather, show_current: true, show_forecast: false,
          secondary_info_attribute: "wind_speed", grid_options: { columns: "full" },
        },
        tvTile(ids.air_temperature, d.air, "orange"),
        tvTile(ids.surface_temperature, d.surface, "blue-grey"),
        tvTile(ids.wind_speed, d.wind, "cyan", "mdi:weather-windy"),
        tvTile(ids.humidity, d.humidity, "light-blue"),
        tvTile(ids.precipitation, d.precipitation, "blue"),
        tvTile(ids.precipitation_30min, d.last_30, "blue", "mdi:cup-water"),
        tvTile(ids.visibility, d.visibility, "grey"),
        tvTile(ids.grip, d.grip, "amber"),
        w && { type: "markdown", text_only: true, grid_options: { columns: "full" }, content: d.station_line(w) },
      ]),
    };
  },

  road(ids, entry, home, d) {
    if (!ids.road_condition) return null;
    return {
      type: "grid",
      cards: tvCompact([
        { type: "heading", heading: d.road, icon: "mdi:road-variant" },
        tvTile(ids.road_condition, d.worst_road, "amber", null, { grid_options: { columns: "full" } }),
        tvTile(ids.road_condition_count, d.difficult_sections, "deep-orange", "mdi:alert-outline"),
        tvTile(ids.surface_temperature, d.surface, "blue-grey"),
        ids.road_condition_count && {
          type: "markdown", grid_options: { columns: "full" },
          // From a sensor attribute, so it also works without geo_location entities.
          content:
            `{%- set roads = state_attr('${ids.road_condition_count}', 'difficult_roads') or [] %}\n` +
            "{%- if roads %}\n" +
            "{% for r in roads[:6] -%}\n" +
            "{%- set icon = {2: '🟡', 3: '🔴', 4: '🔵'}[r.condition_code] | default('⚪') -%}\n" +
            `{{ icon }} **{{ r.road_number or '${d.road_default}' }}** – {{ r.condition_text }}\n` +
            "{%- if r.warning %} · {{ r.warning }}{% endif %}\n" +
            "{%- if r.measure %} · {{ r.measure | lower }}{% endif %}\n" +
            "<br><small>{{ r.location_text or '' }} ({{ r.distance_km }} km)</small>\n\n" +
            "{% endfor %}\n" +
            "{%- else %}\n" +
            `${d.road_normal}\n` +
            "{%- endif %}",
        },
      ]),
    };
  },

  map(ids, entry, home, d) {
    return {
      type: "grid",
      column_span: 2,
      cards: tvCompact([
        {
          type: "heading", heading: d.map, heading_style: "title", icon: "mdi:map-marker-radius",
          badges: tvCompact([tvBadge(ids.flow_sites, null, "blue", { show_state: true, show_icon: true })]),
        },
        {
          type: "custom:trafikverket-map-card", entry,
          height: Number(home.attributes.map_height) || 560,
          grid_options: { columns: "full", rows: "auto" },
        },
      ]),
    };
  },

  now(ids, entry, home, d) {
    if (!ids.average_speed && !ids.flow_sites) return null;
    const rc = ids.road_condition;
    return {
      type: "grid",
      cards: tvCompact([
        { type: "heading", heading: d.now, icon: "mdi:car-clock" },
        rc && {
          type: "conditional",
          // The road condition sensor is an enum: compare with the language independent keys.
          conditions: [
            { condition: "state", entity: rc, state_not: "normal" },
            { condition: "state", entity: rc, state_not: "no_data" },
          ],
          card: {
            type: "markdown",
            content:
              `<ha-alert alert-type="warning" title="{{ state_attr('${rc}', 'state_text') or state_translated('${rc}') }}">` +
              `{%- set w = state_attr('${rc}', 'warnings') or [] %}` +
              `{%- set c = state_attr('${rc}', 'causes') or [] %} ` +
              (ids.road_condition_count ? d.alert_count(ids.road_condition_count) : "") +
              `{%- if w %} ${d.alert_warning}: {{ w | join(', ') }}.{% endif %}` +
              `{%- if c %} ${d.alert_cause}: {{ c | join(', ') | lower }}.{% endif %}</ha-alert>`,
          },
          grid_options: { columns: "full" },
        },
        tvTile(ids.average_speed, d.avg_speed, "green", "mdi:speedometer"),
        tvTile(ids.lowest_speed, d.lowest_speed, "red", "mdi:speedometer-slow"),
        tvTile(ids.total_flow, d.traffic_flow, "indigo", "mdi:car-multiple"),
        tvTile(ids.flow_sites, d.sites, "blue", "mdi:map-marker-multiple"),
        ids.lowest_speed && {
          type: "markdown", title: d.slowest, grid_options: { columns: "full" },
          // From a sensor attribute, so it also works without geo_location entities.
          content:
            `{%- set sites = state_attr('${ids.lowest_speed}', 'slowest_sites') or [] %}\n` +
            "{%- if sites %}\n" +
            `| | ${d.site} | km/h | ${d.vehicles_h} | ${d.distance} |\n` +
            "|:-:|:--|--:|--:|--:|\n" +
            "{% for s in sites[:6] -%}\n" +
            "{%- set v = s.average_speed -%}\n" +
            "| {{ '🔴' if v < 30 else '🟠' if v < 50 else '🟡' if v < 70 else '🟢' }} | {{ s.label or s.site_id }} | " +
            "{{ v | round(0) | int }} | {{ s.flow }} | {{ s.distance_km }} km |\n" +
            "{% endfor %}\n" +
            "{%- else %}\n" +
            `${d.no_sites}\n` +
            "{%- endif %}",
        },
      ]),
    };
  },

  history(ids, entry, home, d) {
    const speed = tvCompact([
      ids.average_speed && { entity: ids.average_speed, name: d.mean },
      ids.lowest_speed && { entity: ids.lowest_speed, name: d.lowest },
    ]);
    const temp = tvCompact([
      ids.air_temperature && { entity: ids.air_temperature, name: d.air },
      ids.surface_temperature && { entity: ids.surface_temperature, name: d.surface },
    ]);
    if (!speed.length && !temp.length && !ids.total_flow) return null;
    return {
      type: "grid",
      column_span: 2,
      cards: tvCompact([
        { type: "heading", heading: d.history, icon: "mdi:chart-line" },
        speed.length && {
          type: "history-graph", title: d.speed_24h, hours_to_show: 24,
          entities: speed, grid_options: { columns: 12 },
        },
        temp.length && {
          type: "history-graph", title: d.temp_24h, hours_to_show: 24,
          entities: temp, grid_options: { columns: 12 },
        },
        ids.total_flow && {
          type: "statistics-graph", title: d.flow_week,
          entities: [{ entity: ids.total_flow, name: d.vehicles_h_cap }], period: "hour", days_to_show: 7,
          stat_types: ["mean", "max"], chart_type: "line", grid_options: { columns: "full" },
        },
      ]),
    };
  },

  data(ids, entry, home, d) {
    if (!ids.data_usage) return null;
    return {
      type: "grid",
      cards: tvCompact([
        { type: "heading", heading: d.data, icon: "mdi:download-network", heading_style: "subtitle" },
        tvTile(ids.data_usage, d.fetched, "purple"),
        tvTile(ids.response_size, d.per_fetch, "purple"),
        { type: "markdown", text_only: true, grid_options: { columns: "full" }, content: d.data_line(home.entity_id, ids.data_usage) },
      ]),
    };
  },
};

class TvFlowDashboardStrategy {
  static async generate(config, hass) {
    const d = TV_DASH_I18N[tvLang(hass)];
    const title = config.title || d.title;
    const home = tvFindHome(hass, config.entry);
    if (!home) {
      return { title, views: [{ title, cards: [{ type: "markdown", content: d.not_found }] }] };
    }
    const a = home.attributes;
    const ids = { flow_sites: home.entity_id, ...(a.entity_ids || {}) };
    const entry = a.config_entry_id;
    const order = Array.isArray(a.dashboard_sections) && a.dashboard_sections.length
      ? a.dashboard_sections
      : TV_SECTION_ORDER;

    const sections = order
      .filter((key, i) => TV_SECTIONS[key] && order.indexOf(key) === i)
      .map((key) => TV_SECTIONS[key](ids, entry, home, d))
      .filter(Boolean);

    const badges = tvCompact([
      ids.weather && { type: "entity", entity: ids.weather, show_name: false, show_state: true, show_icon: true },
      tvBadge(ids.air_temperature, d.air, "orange"),
      tvBadge(ids.surface_temperature, d.surface, "blue-grey"),
      tvBadge(ids.average_speed, d.badge_avg, "green"),
      tvBadge(ids.road_condition, d.road, "amber"),
    ]);

    return {
      title,
      views: [{
        title,
        path: "trafik",
        icon: "mdi:car-traffic",
        type: "sections",
        max_columns: 4,
        // No dense_section_placement: it moves sections to fill gaps, which breaks
        // the order chosen in the settings.
        badges,
        sections,
      }],
    };
  }
}

if (!customElements.get("ll-strategy-dashboard-tv-flow")) {
  customElements.define("ll-strategy-dashboard-tv-flow", class extends HTMLElement {
    static async generate(config, hass) {
      return TvFlowDashboardStrategy.generate(config, hass);
    }
  });
}
