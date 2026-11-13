/*
 * Trafikverket Trafikkarta – Lovelace card
 * Draws traffic flow sites (coloured by speed, sized by flow), road conditions
 * (coloured lines) and road weather stations around the configured home position.
 *
 *   type: custom:trafikverket-map-card
 *   title: Trafik runt hemmet      # optional
 *   height: 450                    # px, optional
 *   entry: <config_entry_id>       # optional, if you have several locations
 *   show_flow: true
 *   show_road: true
 *   show_weather: true
 *   dark_mode: false               # optional: true | false | auto – overrides the
 *                                  # "Map style" setting of the integration
 *   zoom_margin_km: 10             # start view = radius + this margin (km)
 *   tile_url: https://tile.openstreetmap.org/{z}/{x}/{y}.png   # optional
 *
 * Leaflet is loaded from unpkg.com the first time the card is shown.
 */

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;

let leafletPromise;
function loadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error("Kunde inte ladda Leaflet"));
      document.head.appendChild(s);
    });
  }
  return leafletPromise;
}

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function speedColor(speed) {
  if (speed == null) return "#9e9e9e";
  if (speed >= 70) return "#2e7d32";
  if (speed >= 50) return "#9e9d24";
  if (speed >= 30) return "#ef6c00";
  return "#c62828";
}

const ROAD_COLORS = { 1: "#43a047", 2: "#ffb300", 3: "#e53935", 4: "#1e88e5" };
const ROAD_TEXT = { 1: "Normalt", 2: "Besvärligt (risk för)", 3: "Mycket besvärligt", 4: "Is- och snövägbana" };
const SIDE = { northBound: "Norrgående", southBound: "Södergående", eastBound: "Östgående", westBound: "Västgående",
  clockwise: "Medurs", anticlockwise: "Moturs", innerRing: "Inre ring", outerRing: "Yttre ring",
  bothWays: "Båda riktningar", allDirections: "Alla riktningar" };

function fmtTime(iso) {
  if (!iso) return "–";
  try { return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return iso; }
}

class TrafikverketMapCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      height: 450, show_flow: true, show_road: true, show_weather: true, zoom_margin_km: 10,
      tile_url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ...config,
    };
    this._built = false;
  }

  static getStubConfig() {
    return { title: "Trafik runt hemmet" };
  }

  getCardSize() {
    return Math.ceil((this._config?.height || 450) / 50) + 1;
  }

  getGridOptions() {
    return { columns: 12, rows: Math.ceil((this._config?.height || 450) / 56) + 1, min_rows: 4 };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    else this._scheduleUpdate();
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
        .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
        .legend b { display:block; margin-top: 4px; }
        .temp { background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);
                border: 1px solid #1976d2; border-radius: 10px; padding: 1px 5px; font: 600 11px sans-serif;
                white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
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
    loadLeaflet()
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
      attribution: '&copy; OpenStreetMap | Data: Trafikverket',
    }).addTo(this._map);
    this._layers = {
      home: L.layerGroup().addTo(this._map),
      road: L.layerGroup().addTo(this._map),
      flow: L.layerGroup().addTo(this._map),
      weather: L.layerGroup().addTo(this._map),
    };
    const overlays = {};
    if (this._config.show_flow) overlays["Trafikflöden"] = this._layers.flow;
    if (this._config.show_road) overlays["Väglag"] = this._layers.road;
    if (this._config.show_weather) overlays["Väder"] = this._layers.weather;
    L.control.layers(null, overlays, { collapsed: true }).addTo(this._map);
    this._addLegend(L);
    this._addAreaButton(L);
    this._map.setView([59.33, 18.06], 10);
    new ResizeObserver(() => this._map && this._map.invalidateSize()).observe(el);
    this._area = null;
    this._areaKey = "";
    this._lastSig = "";
    this._update();
  }

  _addLegend(L) {
    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const d = L.DomUtil.create("div", "legend");
      d.innerHTML =
        "<b>Medelhastighet</b>" +
        [["#2e7d32", "≥ 70 km/h"], ["#9e9d24", "50–70"], ["#ef6c00", "30–50"], ["#c62828", "< 30"], ["#9e9e9e", "okänd"]]
          .map(([c, t]) => `<div><i style="background:${c}"></i>${t}</div>`).join("") +
        (this._config.show_road
          ? "<b>Väglag</b>" + Object.entries(ROAD_COLORS)
              .map(([k, c]) => `<div><i style="background:${c};border-radius:0;height:4px"></i>${ROAD_TEXT[k]}</div>`).join("")
          : "");
      L.DomEvent.disableClickPropagation(d);
      return d;
    };
    legend.addTo(this._map);
  }

  _addAreaButton(L) {
    const ctrl = L.control({ position: "topleft" });
    ctrl.onAdd = () => {
      const bar = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const a = L.DomUtil.create("a", "area-btn", bar);
      a.href = "#";
      a.title = "Zooma till området";
      a.setAttribute("role", "button");
      a.setAttribute("aria-label", "Zooma till området");
      a.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="' +
        "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M3.05,13H1V11H3.05C3.5,6.83 6.83,3.5 11,3.05V1H13V3.05" +
        "C17.17,3.5 20.5,6.83 20.95,11H23V13H20.95C20.5,17.17 17.17,20.5 13,20.95V23H11V20.95C6.83,20.5 3.5,17.17 3.05,13" +
        "M12,5A7,7 0 0,0 5,12A7,7 0 0,0 12,19A7,7 0 0,0 19,12A7,7 0 0,0 12,5Z" + '"/></svg>';
      L.DomEvent.disableClickPropagation(bar);
      L.DomEvent.on(a, "click", (e) => { L.DomEvent.preventDefault(e); this._fitArea(true); });
      return bar;
    };
    ctrl.addTo(this._map);
  }

  _fitArea(animate = false) {
    if (!this._map || !this._area) return;
    const { center, radiusKm } = this._area;
    const margin = Math.max(0, Number(this._config.zoom_margin_km) || 0);
    const viewKm = radiusKm + margin; // e.g. 10 km radius -> show 20 km around home
    this._map.fitBounds(this._L.latLng(center).toBounds(viewKm * 2000), { padding: [0, 0], animate });
  }

  _scheduleUpdate() {
    if (this._pending) return;
    this._pending = setTimeout(() => { this._pending = null; this._update(); }, 500);
  }

  _collect() {
    const entry = this._config.entry;
    const states = Object.values(this._hass.states);
    const mine = (s) => !entry || s.attributes.config_entry_id === entry;
    const home = states.find((s) => s.attributes.trafikverket_home && mine(s));
    const geo = states.filter((s) => s.entity_id.startsWith("geo_location.") && s.attributes.tv_type && mine(s));
    return { home, geo };
  }

  _update() {
    if (!this._map || !this._hass) return;
    const L = this._L;
    const { home, geo } = this._collect();
    const dark = this._isDark(home);
    const sig = (home ? home.last_updated : "") + geo.map((s) => s.entity_id + s.last_updated).join("|") + dark;
    if (sig === this._lastSig) return;
    this._lastSig = sig;

    this.shadowRoot.getElementById("map").classList.toggle("dark", dark);
    Object.values(this._layers).forEach((l) => l.clearLayers());

    if (home) {
      const a = home.attributes;
      const center = [a.home_latitude, a.home_longitude];
      L.circle(center, { radius: a.radius_km * 1000, color: "#1976d2", weight: 1, fill: true, fillOpacity: 0.04, interactive: false })
        .addTo(this._layers.home);
      L.circleMarker(center, { radius: 6, color: "#fff", weight: 2, fillColor: "#1976d2", fillOpacity: 1 })
        .bindTooltip("Hem – klicka för att zooma till området")
        .on("click", () => this._fitArea(true))
        .addTo(this._layers.home);
      this._area = { center, radiusKm: a.radius_km };
      // Zoom to the area the first time and whenever position or radius changes.
      const key = `${a.home_latitude},${a.home_longitude},${a.radius_km}`;
      if (key !== this._areaKey) {
        this._areaKey = key;
        this._fitArea(false);
      }
    }

    let nFlow = 0, nRoad = 0, nWeather = 0, newest = null;
    for (const s of geo) {
      const a = s.attributes;
      const ll = [a.latitude, a.longitude];
      if (a.tv_type === "flow" && this._config.show_flow) {
        nFlow++;
        const color = speedColor(a.average_speed);
        const r = Math.min(18, 5 + Math.sqrt(a.flow || 0) / 3);
        const lanes = (a.lanes || []).map((l) =>
          `<tr><td>${esc(SIDE[l.side] || l.side || "")}</td><td>fält ${esc(l.lane ?? "–")}</td><td>${esc(l.vehicle_type)}</td>` +
          `<td>${esc(l.flow)} f/h</td><td>${l.speed != null ? esc(l.speed) + " km/h" : "–"}</td></tr>`).join("");
        L.circleMarker(ll, { radius: r, color: "#fff", weight: 1.5, fillColor: color, fillOpacity: 0.85 })
          .bindTooltip(`${a.average_speed ?? "–"} km/h · ${a.flow} f/h`)
          .bindPopup(`<b>Mätpunkt ${esc(a.site_id)}</b><br>Flöde: <b>${esc(a.flow)}</b> fordon/h<br>` +
            `Medelhastighet: <b>${esc(a.average_speed ?? "–")}</b> km/h (lägst ${esc(a.min_speed ?? "–")})<br>` +
            `Kvalitet: ${esc(a.data_quality ?? "–")} · Mätt ${fmtTime(a.measurement_time)} · ${esc(s.state)} km bort` +
            (lanes ? `<table>${lanes}</table>` : ""), { maxWidth: 360 })
          .addTo(this._layers.flow);
        if (a.measurement_time && (!newest || a.measurement_time > newest)) newest = a.measurement_time;
      } else if (a.tv_type === "road" && this._config.show_road) {
        nRoad++;
        const color = ROAD_COLORS[a.condition_code] || "#757575";
        const popup = `<b>${esc(a.road_number || "Väg")}: ${esc(a.condition_text || "")}</b><br>` +
          (a.condition_info ? esc(a.condition_info) + "<br>" : "") +
          (a.warning ? `Varning: ${esc(a.warning)}<br>` : "") +
          (a.cause ? `Orsak: ${esc(a.cause)}<br>` : "") +
          (a.measure ? `Åtgärd: ${esc(a.measure)}<br>` : "") +
          (a.location_text ? `<i>${esc(a.location_text)}</i>` : "");
        const lines = a.lines && a.lines.length ? a.lines : [[ll]];
        for (const line of lines) {
          if (line.length > 1) {
            L.polyline(line, { color, weight: a.condition_code > 1 ? 6 : 4, opacity: a.condition_code > 1 ? 0.9 : 0.5 })
              .bindPopup(popup).addTo(this._layers.road);
          } else {
            L.circleMarker(line[0], { radius: 5, color, fillOpacity: 0.8 }).bindPopup(popup).addTo(this._layers.road);
          }
        }
      } else if (a.tv_type === "weather" && this._config.show_weather) {
        nWeather++;
        const t = a.air_temperature != null ? `${Math.round(a.air_temperature * 10) / 10}°` : "–";
        const icon = L.divIcon({ className: "", html: `<div class="temp">${esc(t)}</div>`, iconSize: null, iconAnchor: [18, 10] });
        L.marker(ll, { icon, zIndexOffset: 500 })
          .bindPopup(`<b>${esc(a.station)}</b><br>` +
            `Luft: ${esc(a.air_temperature ?? "–")} °C · Väg: ${esc(a.surface_temperature ?? "–")} °C<br>` +
            `Fukt: ${esc(a.humidity ?? "–")} % · Vind: ${esc(a.wind_speed ?? "–")} m/s (byar ${esc(a.wind_gust ?? "–")}) ` +
            `${a.wind_direction != null ? esc(a.wind_direction) + "°" : ""}<br>` +
            `Nederbörd: ${esc(a.precipitation_text ?? "–")}` +
            (a.precipitation_30min != null ? ` (${esc(a.precipitation_30min)} mm/30 min)` : "") + "<br>" +
            (a.grip != null ? `Friktion: ${esc(a.grip)}<br>` : "") +
            `Mätt ${fmtTime(a.sample)} · ${esc(s.state)} km bort`)
          .addTo(this._layers.weather);
      }
    }

    const footer = this.shadowRoot.getElementById("footer");
    footer.textContent = home
      ? `${nFlow} mätpunkter · ${nRoad} väglagssträckor · ${nWeather} väderstationer · senaste mätning ${fmtTime(newest)} · uppdateras var ${home.attributes.scan_interval_min} min`
      : "Hittar ingen Trafikverket Trafikkarta-integration.";
  }
}

customElements.define("trafikverket-map-card", TrafikverketMapCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "trafikverket-map-card",
  name: "Trafikverket Trafikkarta",
  description: "Trafikflöden, väglag och vägväder från Trafikverket på en karta.",
  preview: false,
});
