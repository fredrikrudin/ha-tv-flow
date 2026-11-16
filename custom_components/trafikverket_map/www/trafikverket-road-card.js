/*
 * Trafikverket Trafikkarta – road status card
 *
 *   type: custom:trafikverket-road-card
 *   title: Road conditions now   # optional
 *   entry: <config_entry_id>     # optional, if you have several locations
 *   max_roads: 3                 # difficult road sections listed (0 = none)
 *
 * Combines Trafikverket's road condition with the nearest road weather
 * station (surface/air temperature, dew point, grip, precipitation, wind)
 * and adds an *estimated* slipperiness risk.
 *
 * The UI follows Home Assistant's language: Swedish for "sv", English otherwise.
 * Road names, warnings and causes come from Trafikverket and stay Swedish.
 */

(() => {
  const I18N = {
    sv: {
      locale: "sv-SE",
      stub_title: "Väglag nu",
      card_name: "Trafikverket Vägöversikt",
      card_desc: "Kort sammanfattning av väglag, vägbanetemperatur, friktion, nederbörd och varningar.",
      not_found: "Hittar ingen Trafikverket Trafikkarta-integration.",
      levels: { 1: "Normalt väglag", 2: "Risk för halka", 3: "Mycket besvärligt", 4: "Is- och snöväglag" },
      road_states: { normal: "Normalt", difficult: "Besvärligt (risk för)", very_difficult: "Mycket besvärligt",
                     ice_snow: "Is- och snövägbana", no_data: "Inga uppgifter" },
      grip: { good: "Bra", moderate: "Måttlig", poor: "Dålig", very_slippery: "Mycket halt" },
      reasons: {
        ice: "Is på vägbanan",
        snow_on_road: "Snö på vägbanan",
        grip: (cls, v) => `Friktion ${cls.toLowerCase()} (${v})`,
        freezing_rain: "Underkylt regn",
        snowfall: "Snöfall",
        sleet: "Snöblandat regn",
        rain_cold: "Nederbörd mot kall vägbana",
        water_frozen: "Vatten på vägbana under 0 °C",
        frost: "Daggpunkt över vägbanans temperatur – risk för rimfrost",
        below_zero: "Vägbanan under 0 °C",
      },
      sections: (n) => `${n} besvärliga sträckor`,
      estimate: "Uppskattning från närmaste väderstation",
      surface: "Vägbana", air: "Luft", dew: "dagg", grip_label: "Friktion",
      precipitation: "Nederbörd", wind: "Vind", gusts: "byar",
      road: "Väg", more: (n) => `+ ${n} till`,
      foot: (st, km, t) => `${st} · ${km} km bort · mätt ${t}`,
      no_station: "Ingen väderstation inom radien",
    },
    en: {
      locale: "en-GB",
      stub_title: "Road conditions now",
      card_name: "Trafikverket Road Status",
      card_desc: "Short summary of road conditions, road surface temperature, grip, precipitation and warnings.",
      not_found: "No Trafikverket Trafikkarta integration found.",
      levels: { 1: "Normal road conditions", 2: "Risk of slippery roads", 3: "Very difficult", 4: "Ice and snow" },
      road_states: { normal: "Normal", difficult: "Difficult (risk of)", very_difficult: "Very difficult",
                     ice_snow: "Ice and snow", no_data: "No data" },
      grip: { good: "Good", moderate: "Moderate", poor: "Poor", very_slippery: "Very slippery" },
      reasons: {
        ice: "Ice on the road",
        snow_on_road: "Snow on the road",
        grip: (cls, v) => `${cls} grip (${v})`,
        freezing_rain: "Freezing rain",
        snowfall: "Snowfall",
        sleet: "Sleet",
        rain_cold: "Precipitation on a cold road surface",
        water_frozen: "Water on the road below 0 °C",
        frost: "Dew point above road surface temperature – risk of frost",
        below_zero: "Road surface below 0 °C",
      },
      sections: (n) => `${n} difficult sections`,
      estimate: "Estimate from the nearest weather station",
      surface: "Road surface", air: "Air", dew: "dew", grip_label: "Grip",
      precipitation: "Precipitation", wind: "Wind", gusts: "gusts",
      road: "Road", more: (n) => `+ ${n} more`,
      foot: (st, km, t) => `${st} · ${km} km away · measured ${t}`,
      no_station: "No weather station within the radius",
    },
  };
  const langOf = (hass) => {
    const l = String((hass && ((hass.locale && hass.locale.language) || hass.language)) || "en").toLowerCase();
    return l.startsWith("sv") ? "sv" : "en";
  };

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
  const fmt = (v, d = 1, locale = "en-GB") =>
    (v === null ? "–" : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString(locale));
  const time = (iso, locale) => {
    if (!iso) return "–";
    try { return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return "–"; }
  };

  const LEVEL_STYLE = {
    1: { icon: "mdi:check-circle", color: "var(--success-color, #43a047)" },
    2: { icon: "mdi:alert", color: "var(--warning-color, #ffa000)" },
    3: { icon: "mdi:alert-octagon", color: "var(--error-color, #e53935)" },
    4: { icon: "mdi:snowflake-alert", color: "#1e88e5" },
  };
  const ROAD_ICON = { 2: "🟡", 3: "🔴", 4: "🔵" };

  // Rough grip classes for Trafikverket's 0–1 grip value.
  function gripClass(g) {
    if (g === null) return null;
    if (g >= 0.5) return { key: "good", level: 1 };
    if (g >= 0.35) return { key: "moderate", level: 2 };
    if (g >= 0.25) return { key: "poor", level: 3 };
    return { key: "very_slippery", level: 3 };
  }

  /** Estimate slipperiness from the station data. Returns { level, reasons[] }. */
  function estimate(w, t) {
    const reasons = [];
    let level = 1;
    if (!w) return { level, reasons };
    const R = t.reasons;
    const surf = num(w.surface_temperature);
    const dew = num(w.dewpoint);
    const grip = num(w.grip);
    const p = w.precipitation;
    const cold = surf !== null && surf <= 1;

    if (w.ice === true) { level = Math.max(level, 4); reasons.push(R.ice); }
    if (w.snow === true) { level = Math.max(level, 4); reasons.push(R.snow_on_road); }
    const gc = gripClass(grip);
    if (gc && gc.level >= 2) { level = Math.max(level, gc.level); reasons.push(R.grip(t.grip[gc.key], fmt(grip, 2, t.locale))); }
    if (p === "freezing_rain") { level = Math.max(level, 3); reasons.push(R.freezing_rain); }
    if (cold) {
      if (p === "snow" || p === "sleet") { level = Math.max(level, 2); reasons.push(p === "snow" ? R.snowfall : R.sleet); }
      if (p === "rain" || p === "yes") { level = Math.max(level, 2); reasons.push(R.rain_cold); }
      if (w.water === true && surf <= 0) { level = Math.max(level, 2); reasons.push(R.water_frozen); }
      if (dew !== null && surf <= 0 && dew >= surf) { level = Math.max(level, 2); reasons.push(R.frost); }
      if (surf <= 0 && !reasons.length) reasons.push(R.below_zero);
    }
    return { level, reasons };
  }

  class TrafikverketRoadCard extends HTMLElement {
    setConfig(config) {
      this._config = { max_roads: 3, ...config };
      this._sig = "";
    }

    static getStubConfig(hass) { return { title: I18N[langOf(hass)].stub_title }; }
    getCardSize() { return 4; }
    getGridOptions() { return { columns: 6, min_columns: 4, rows: "auto" }; }

    set hass(hass) {
      this._hass = hass;
      const lang = langOf(hass);
      const d = this._collect();
      const sig = lang + [d.home, d.station, d.road, ...d.roads].map((s) => (s ? s.entity_id + s.last_updated : "-")).join("|");
      if (sig === this._sig && this.shadowRoot) return;
      this._sig = sig;
      this._render(d, I18N[lang]);
    }

    _collect() {
      const entry = this._config.entry;
      const states = Object.values(this._hass.states);
      const home = states.find((s) => s.attributes.trafikverket_home && (!entry || s.attributes.config_entry_id === entry));
      const eid = home ? home.attributes.config_entry_id : entry;
      const ids = home ? home.attributes.entity_ids || {} : {};
      const mine = (s) => !eid || s.attributes.config_entry_id === eid;
      const geo = states.filter((s) => s.entity_id.startsWith("geo_location.") && mine(s));
      const stations = geo.filter((s) => s.attributes.tv_type === "weather" && num(s.attributes.surface_temperature ?? s.attributes.air_temperature) !== null);
      const station = stations.sort((a, b) => Number(a.state) - Number(b.state))[0] || null;
      const roads = geo
        .filter((s) => s.attributes.tv_type === "road" && num(s.attributes.condition_code) > 1)
        .sort((a, b) => b.attributes.condition_code - a.attributes.condition_code || Number(a.state) - Number(b.state));
      const road = ids.road_condition ? this._hass.states[ids.road_condition] : null;
      return { home, station, road, roads };
    }

    /** Localized state of the road condition sensor (an enum since v1.5.0). */
    _roadStateText(road, t) {
      if (!road) return "–";
      if (typeof this._hass.formatEntityState === "function") {
        try { return this._hass.formatEntityState(road); } catch (e) { /* fall back below */ }
      }
      return t.road_states[road.state] || road.state;
    }

    _moreInfo(entityId) {
      if (!entityId) return;
      this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    }

    _render({ home, station, road, roads }, t) {
      const root = this.shadowRoot || this.attachShadow({ mode: "open" });
      if (!home) {
        root.innerHTML = `<ha-card><div class="empty" style="padding:16px">${esc(t.not_found)}</div></ha-card>`;
        return;
      }
      const loc = t.locale;
      const f = (v, d = 1) => fmt(v, d, loc);
      const w = station ? station.attributes : null;
      const tvCode = roads.length ? Math.max(...roads.map((r) => r.attributes.condition_code)) : 1;
      const est = estimate(w, t);
      const level = Math.max(tvCode, est.level);
      const L = LEVEL_STYLE[level];
      const warnings = (road && road.attributes.warnings) || [];
      const causes = (road && road.attributes.causes) || [];
      const grip = num(w && w.grip);
      const gc = gripClass(grip);
      const surf = num(w && w.surface_temperature);
      const air = num(w && w.air_temperature);
      const dew = num(w && w.dewpoint);
      const wind = num(w && w.wind_speed);
      const gust = num(w && w.wind_gust);
      const p30 = num(w && w.precipitation_30min);

      const metric = (icon, label, value, sub, warn) => `
        <div class="m ${warn ? "warn" : ""}">
          <ha-icon icon="${icon}"></ha-icon>
          <div><div class="v">${value}</div><div class="l">${esc(label)}${sub ? ` · ${esc(sub)}` : ""}</div></div>
        </div>`;

      const chips = [...new Set([...warnings, ...causes])]
        .map((c) => `<span class="chip">${esc(c)}</span>`).join("");
      const maxRoads = Math.max(0, Number(this._config.max_roads) || 0);
      const roadRows = roads.slice(0, maxRoads).map((r) => {
        const a = r.attributes;
        return `<div class="road" data-entity="${esc(r.entity_id)}">
          <span>${ROAD_ICON[a.condition_code] || "⚪"}</span>
          <span class="rn">${esc(a.road_number || t.road)}</span>
          <span class="rt">${esc(a.condition_text || "")}${a.warning ? ` · ${esc(a.warning)}` : ""}</span>
          <span class="rd">${f(num(r.state))} km</span></div>`;
      }).join("");
      const more = roads.length > maxRoads && maxRoads > 0 ? `<div class="more">${esc(t.more(roads.length - maxRoads))}</div>` : "";

      root.innerHTML = `
        <style>
          ha-card { overflow: hidden; }
          .title { padding: 12px 16px 0; font-size: 1.1em; font-weight: 500; color: var(--primary-text-color); }
          .status { display: flex; align-items: center; gap: 12px; margin: 12px 12px 4px; padding: 10px 12px;
                    border-radius: 12px; background: color-mix(in srgb, ${L.color} 16%, transparent); cursor: pointer; }
          .status ha-icon { color: ${L.color}; --mdc-icon-size: 32px; }
          .st { font-size: 1.15em; font-weight: 600; color: var(--primary-text-color); }
          .ss { font-size: .85em; color: var(--secondary-text-color); }
          .reasons { margin: 4px 16px 0; font-size: .85em; color: var(--primary-text-color); }
          .reasons li { margin: 2px 0; }
          .reasons small { color: var(--secondary-text-color); }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; padding: 10px 12px; }
          .m { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px;
               background: var(--secondary-background-color); }
          .m ha-icon { color: var(--state-icon-color, var(--secondary-text-color)); --mdc-icon-size: 20px; flex: none; }
          .m.warn ha-icon { color: var(--warning-color, #ffa000); }
          .v { font-weight: 600; color: var(--primary-text-color); }
          .l { font-size: .75em; color: var(--secondary-text-color); }
          .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; }
          .chip { font-size: .8em; padding: 2px 8px; border-radius: 10px;
                  background: color-mix(in srgb, var(--warning-color, #ffa000) 20%, transparent); color: var(--primary-text-color); }
          .roads { padding: 0 12px 6px; }
          .road { display: grid; grid-template-columns: 20px auto 1fr auto; gap: 6px; align-items: baseline;
                  padding: 4px 4px; border-top: 1px solid var(--divider-color); font-size: .9em; cursor: pointer; }
          .rn { font-weight: 600; white-space: nowrap; }
          .rt { color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .rd, .more { color: var(--secondary-text-color); font-size: .85em; white-space: nowrap; }
          .more { padding: 2px 4px 0 30px; }
          .foot { padding: 4px 16px 10px; font-size: .75em; color: var(--secondary-text-color); }
        </style>
        <ha-card>
          ${this._config.title ? `<div class="title">${esc(this._config.title)}</div>` : ""}
          <div class="status" id="status">
            <ha-icon icon="${L.icon}"></ha-icon>
            <div>
              <div class="st">${esc(t.levels[level])}</div>
              <div class="ss">Trafikverket: ${esc(this._roadStateText(road, t))}${roads.length ? ` · ${esc(t.sections(roads.length))}` : ""}</div>
            </div>
          </div>
          ${est.reasons.length ? `<ul class="reasons">${est.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}
             <small>${esc(t.estimate)}</small></ul>` : ""}
          ${w ? `<div class="grid">
            ${metric("mdi:road", t.surface, surf === null ? "–" : `${f(surf)} °C`, null, surf !== null && surf <= 0)}
            ${metric("mdi:thermometer", t.air, air === null ? "–" : `${f(air)} °C`, dew === null ? null : `${t.dew} ${f(dew)}°`)}
            ${metric("mdi:car-traction-control", t.grip_label, grip === null ? "–" : f(grip, 2), gc ? t.grip[gc.key] : null, gc && gc.level >= 2)}
            ${metric("mdi:weather-snowy-rainy", t.precipitation, esc((w && w.precipitation_text) || "–"), p30 ? `${f(p30)} mm/30 min` : null,
                     w && w.precipitation && w.precipitation !== "no")}
            ${metric("mdi:weather-windy", t.wind, wind === null ? "–" : `${f(wind)} m/s`, gust ? `${t.gusts} ${f(gust)}` : null, gust !== null && gust >= 15)}
          </div>` : ""}
          ${chips ? `<div class="chips">${chips}</div>` : ""}
          ${roadRows ? `<div class="roads">${roadRows}${more}</div>` : ""}
          <div class="foot">${w ? esc(t.foot(w.station, f(num(station.state)), time(w.sample, loc))) : esc(t.no_station)}</div>
        </ha-card>`;

      root.getElementById("status").addEventListener("click", () => this._moreInfo(road && road.entity_id));
      root.querySelectorAll(".road").forEach((el) => el.addEventListener("click", () => this._moreInfo(el.dataset.entity)));
    }
  }

  if (!customElements.get("trafikverket-road-card")) {
    customElements.define("trafikverket-road-card", TrafikverketRoadCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "trafikverket-road-card",
      name: I18N.en.card_name,
      description: I18N.en.card_desc,
      preview: false,
    });
  }
})();
