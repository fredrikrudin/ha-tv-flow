/*
 * Trafikverket Trafikkarta – Varningskort
 *
 * Hidden until there is a warning inside the configured radius: an accident,
 * obstacle, important traffic information, restriction or traffic message
 * (Trafikverket Situation), or a road section with difficult conditions.
 * Then it shows the events, most serious first, together with the current
 * road conditions from the nearest weather station.
 *
 *   type: custom:trafikverket-warning-card
 *   entry: <config_entry_id>          # optional, several locations
 *   types: [Olycka, Hinder, Viktig trafikinformation, Restriktion, Trafikmeddelande]
 *   include_road_conditions: true     # also warn for difficult road conditions
 *   include_road_works: false         # also warn for road works
 *   min_severity: 0                   # 1–5, ignore events with lower severity code
 *   max_items: 5
 *   show_conditions: true             # road surface, friction, precipitation …
 *   show_when_empty: false            # true = show a green "no warnings" row instead of hiding
 */

(() => {
  const DEFAULT_TYPES = ["Olycka", "Hinder", "Viktig trafikinformation", "Restriktion", "Trafikmeddelande"];
  const RANK = { "Olycka": 5, "Hinder": 4, "Viktig trafikinformation": 3, "Restriktion": 2, "Trafikmeddelande": 1, "Vägarbete": 0 };
  const STYLE = {
    "Olycka": { icon: "mdi:car-emergency", color: "var(--error-color, #d50000)" },
    "Hinder": { icon: "mdi:alert-octagon", color: "#ef6c00" },
    "Viktig trafikinformation": { icon: "mdi:alert-circle", color: "#8e24aa" },
    "Restriktion": { icon: "mdi:sign-caution", color: "var(--warning-color, #f9a825)" },
    "Trafikmeddelande": { icon: "mdi:information", color: "#546e7a" },
    "Vägarbete": { icon: "mdi:account-hard-hat", color: "#8d6e63" },
    "road": { icon: "mdi:snowflake-alert", color: "var(--warning-color, #ffa000)" },
  };
  const ROAD_COLOR = { 2: "var(--warning-color, #ffa000)", 3: "var(--error-color, #e53935)", 4: "#1e88e5" };

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
  const fmt = (v, d = 1) => (v === null ? "–" : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("sv-SE"));
  const since = (iso) => {
    if (!iso) return "";
    const t = new Date(iso);
    if (isNaN(t)) return "";
    const mins = Math.round((Date.now() - t.getTime()) / 60000);
    const hhmm = t.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    if (mins < 0) return `från ${hhmm}`;
    if (mins < 60) return `sedan ${hhmm} (${mins} min)`;
    if (mins < 24 * 60) return `sedan ${hhmm}`;
    return `sedan ${t.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}`;
  };

  class TrafikverketWarningCard extends HTMLElement {
    setConfig(config) {
      this._config = {
        types: DEFAULT_TYPES, include_road_conditions: true, include_road_works: false,
        min_severity: 0, max_items: 5, show_conditions: true, show_when_empty: false, ...config,
      };
      this._sig = null;
    }

    static getStubConfig() { return { show_when_empty: true }; }
    getCardSize() { return this._visible ? 3 : 0; }
    getGridOptions() { return { columns: "full", rows: "auto" }; }

    set hass(hass) {
      this._hass = hass;
      const d = this._collect();
      const sig = [d.home, d.station, ...d.items.map((i) => i.state)]
        .map((s) => (s ? s.entity_id + s.last_updated : "-")).join("|");
      if (sig === this._sig) return;
      this._sig = sig;
      this._render(d);
    }

    _collect() {
      const c = this._config;
      const states = Object.values(this._hass.states);
      const home = states.find((s) => s.attributes.trafikverket_home && (!c.entry || s.attributes.config_entry_id === c.entry));
      const eid = home ? home.attributes.config_entry_id : c.entry;
      const mine = (s) => s.entity_id.startsWith("geo_location.") && (!eid || s.attributes.config_entry_id === eid);
      const types = new Set([...(c.types || DEFAULT_TYPES), ...(c.include_road_works ? ["Vägarbete"] : [])]);
      const items = [];
      for (const s of states) {
        if (!mine(s)) continue;
        const a = s.attributes;
        if (a.tv_type === "situation" && types.has(a.message_type) && (num(a.severity_code) ?? 0) >= (c.min_severity || 0)) {
          items.push({ kind: "event", state: s, rank: (RANK[a.message_type] ?? 1) * 10 + (num(a.severity_code) || 0) });
        } else if (a.tv_type === "road" && c.include_road_conditions && num(a.condition_code) > 1) {
          items.push({ kind: "road", state: s, rank: 2 + num(a.condition_code) });
        }
      }
      items.sort((x, y) => y.rank - x.rank || Number(x.state.state) - Number(y.state.state));
      const station = states
        .filter((s) => mine(s) && s.attributes.tv_type === "weather")
        .sort((x, y) => Number(x.state) - Number(y.state))[0] || null;
      return { home, station, items };
    }

    _setVisible(visible) {
      this._visible = visible;
      this.style.display = visible ? "" : "none";
      this.hidden = !visible;
      // Lets Home Assistant collapse the empty slot in sections/grid layouts.
      this.dispatchEvent(new CustomEvent("card-visibility-changed", { bubbles: true, composed: true, detail: { value: visible } }));
    }

    _moreInfo(entityId) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    }

    _render({ home, station, items }) {
      const c = this._config;
      const root = this.shadowRoot || this.attachShadow({ mode: "open" });
      if (!home || (!items.length && !c.show_when_empty)) {
        root.innerHTML = "";
        this._setVisible(false);
        return;
      }
      this._setVisible(true);

      if (!items.length) {
        root.innerHTML = `
          <style>.ok{display:flex;gap:10px;align-items:center;padding:12px 16px;color:var(--primary-text-color)}
          .ok ha-icon{color:var(--success-color,#43a047)}</style>
          <ha-card><div class="ok"><ha-icon icon="mdi:check-circle"></ha-icon>Inga trafikvarningar inom radien</div></ha-card>`;
        return;
      }

      const top = items[0];
      const ta = top.state.attributes;
      const topStyle = top.kind === "road"
        ? { icon: STYLE.road.icon, color: ROAD_COLOR[ta.condition_code] || STYLE.road.color }
        : STYLE[ta.message_type] || STYLE.Trafikmeddelande;
      const nEvents = items.filter((i) => i.kind === "event").length;
      const nRoads = items.length - nEvents;
      const headline = top.kind === "road"
        ? `${ta.condition_text || "Besvärligt väglag"}${ta.road_number ? ` på ${ta.road_number}` : ""}`
        : `${ta.message_type || "Händelse"}${ta.road_number ? ` på ${ta.road_number}` : ""}`;
      const summary = [nEvents ? `${nEvents} ${nEvents === 1 ? "händelse" : "händelser"}` : "",
                       nRoads ? `${nRoads} ${nRoads === 1 ? "sträcka" : "sträckor"} med besvärligt väglag` : ""]
        .filter(Boolean).join(" · ");

      const rows = items.slice(0, Math.max(1, Number(c.max_items) || 5)).map((it) => {
        const a = it.state.attributes;
        const km = `${fmt(num(it.state.state))} km`;
        if (it.kind === "road") {
          return `<div class="row" data-entity="${esc(it.state.entity_id)}">
            <ha-icon icon="${STYLE.road.icon}" style="color:${ROAD_COLOR[a.condition_code] || STYLE.road.color}"></ha-icon>
            <div class="body">
              <div class="h">${esc(a.road_number || "Väg")} – ${esc(a.condition_text || "Besvärligt väglag")}</div>
              <div class="t">${esc([a.warning, a.cause, a.measure && `åtgärd: ${String(a.measure).toLowerCase()}`].filter(Boolean).join(" · "))}</div>
              ${a.location_text ? `<div class="loc">${esc(a.location_text)}</div>` : ""}
            </div><div class="km">${km}</div></div>`;
        }
        const st = STYLE[a.message_type] || STYLE.Trafikmeddelande;
        const text = a.header && a.message && a.message !== a.header ? a.message : "";
        const extra = [a.severity_text && `påverkan: ${String(a.severity_text).toLowerCase()}`,
                       a.temporary_limit && `begränsning: ${a.temporary_limit}`,
                       a.direction, since(a.start_time)].filter(Boolean).join(" · ");
        return `<div class="row" data-entity="${esc(it.state.entity_id)}">
          <ha-icon icon="${st.icon}" style="color:${st.color}"></ha-icon>
          <div class="body">
            <div class="h">${esc(a.message_type || "Händelse")}${a.road_number ? ` · ${esc(a.road_number)}` : ""}${a.header ? ` – ${esc(a.header)}` : ""}</div>
            ${text ? `<div class="t clamp">${esc(text)}</div>` : ""}
            ${a.location_text ? `<div class="loc">${esc(a.location_text)}</div>` : ""}
            ${extra ? `<div class="meta">${esc(extra)}</div>` : ""}
          </div><div class="km">${km}</div></div>`;
      }).join("");
      const more = items.length > (Number(c.max_items) || 5) ? `<div class="more">+ ${items.length - (Number(c.max_items) || 5)} till</div>` : "";

      let cond = "";
      const w = station && station.attributes;
      if (c.show_conditions && w) {
        const surf = num(w.surface_temperature), air = num(w.air_temperature), grip = num(w.grip);
        const parts = [
          surf !== null && `<span class="${surf <= 0 ? "cold" : ""}"><ha-icon icon="mdi:road"></ha-icon>${fmt(surf)} °C</span>`,
          air !== null && `<span><ha-icon icon="mdi:thermometer"></ha-icon>${fmt(air)} °C</span>`,
          grip !== null && `<span class="${grip < 0.35 ? "cold" : ""}"><ha-icon icon="mdi:car-traction-control"></ha-icon>${fmt(grip, 2)}</span>`,
          w.precipitation && w.precipitation !== "no" && `<span><ha-icon icon="mdi:weather-snowy-rainy"></ha-icon>${esc(w.precipitation_text || w.precipitation)}</span>`,
          num(w.wind_speed) !== null && `<span><ha-icon icon="mdi:weather-windy"></ha-icon>${fmt(num(w.wind_speed))} m/s</span>`,
        ].filter(Boolean).join("");
        if (parts) cond = `<div class="cond">${parts}<small>${esc(w.station || "")}</small></div>`;
      }

      root.innerHTML = `
        <style>
          ha-card { overflow: hidden; border-left: 6px solid ${topStyle.color}; }
          .top { display: flex; align-items: center; gap: 12px; padding: 12px 16px 6px; cursor: pointer;
                 background: color-mix(in srgb, ${topStyle.color} 14%, transparent); }
          .top ha-icon { color: ${topStyle.color}; --mdc-icon-size: 32px; flex: none; }
          .hl { font-size: 1.15em; font-weight: 600; color: var(--primary-text-color); }
          .sum { font-size: .85em; color: var(--secondary-text-color); }
          .rows { padding: 2px 12px 4px; }
          .row { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; padding: 8px 4px;
                 border-top: 1px solid var(--divider-color); cursor: pointer; }
          .row:first-child { border-top: 0; }
          .row ha-icon { --mdc-icon-size: 22px; }
          .h { font-weight: 600; color: var(--primary-text-color); }
          .t { font-size: .9em; color: var(--primary-text-color); }
          .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .loc, .meta { font-size: .8em; color: var(--secondary-text-color); }
          .km, .more { font-size: .8em; color: var(--secondary-text-color); white-space: nowrap; }
          .more { padding: 0 4px 6px 38px; }
          .cond { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 8px 16px 12px;
                  border-top: 1px solid var(--divider-color); font-size: .9em; color: var(--primary-text-color); }
          .cond span { display: inline-flex; align-items: center; gap: 4px; }
          .cond ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
          .cond .cold, .cond .cold ha-icon { color: var(--warning-color, #ffa000); font-weight: 600; }
          .cond small { margin-left: auto; color: var(--secondary-text-color); }
        </style>
        <ha-card>
          <div class="top" id="top">
            <ha-icon icon="${topStyle.icon}"></ha-icon>
            <div><div class="hl">${esc(headline)}</div><div class="sum">${esc(summary)} inom radien</div></div>
          </div>
          <div class="rows">${rows}${more}</div>
          ${cond}
        </ha-card>`;
      root.getElementById("top").addEventListener("click", () => this._moreInfo(top.state.entity_id));
      root.querySelectorAll(".row").forEach((el) => el.addEventListener("click", () => this._moreInfo(el.dataset.entity)));
    }
  }

  if (!customElements.get("trafikverket-warning-card")) {
    customElements.define("trafikverket-warning-card", TrafikverketWarningCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "trafikverket-warning-card",
      name: "Trafikverket Varningar",
      description: "Visas bara vid olycka, hinder, viktig trafikinformation eller besvärligt väglag inom radien.",
      preview: false,
    });
  }
})();
