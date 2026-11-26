/*
 * Trafikverket Trafikkarta – current traffic card ("Trafikläge nu")
 *
 *   type: custom:trafikverket-traffic-card
 *   title: Traffic now        # optional
 *   entry: <config_entry_id>  # optional, if you have several locations
 *   max_sites: 5              # slowest sites listed (0 = no list)
 *   hours: 3                  # length of the speed graph (0 = no graph)
 *   queue_speed: 30           # km/h – a site below this counts as a queue
 *   slow_speed: 50            # km/h – a site below this counts as dense traffic
 *
 * Shows an overall traffic status (free flow / dense traffic / queues), average
 * and lowest speed and total flow with a trend, how the sites are spread over the
 * speed classes, a speed graph from the recorder history and the slowest sites.
 *
 * The status is a rough estimate: Trafikverket does not provide speed limits, so
 * a site on a 50 km/h street can look "dense" at normal speed. Adjust
 * queue_speed / slow_speed to your roads.
 *
 * The UI follows Home Assistant's language: Swedish for "sv", English otherwise.
 */

(() => {
  const I18N = {
    sv: {
      locale: "sv-SE",
      stub_title: "Trafikläge nu",
      card_name: "Trafikverket Trafikläge",
      card_desc: "Aktuell trafik: status, hastighet, flöde med trend, fördelning och långsammaste mätpunkter.",
      not_found: "Hittar ingen Trafikverket Trafikkarta-integration.",
      status: { free: "Fritt flöde", dense: "Tät trafik", queue: "Köbildning", none: "Inga trafikdata" },
      status_sub: {
        free: (n) => `${n} mätpunkter, inga köer`,
        dense: (n, s) => `${s} av ${n} mätpunkter under normal fart`,
        queue: (n, q) => `${q} av ${n} mätpunkter med kö`,
        none: () => "Inga mätpunkter inom radien",
      },
      avg: "Medelhastighet", lowest: "Lägsta", flow: "Flöde", vehicles_h: "fordon/h",
      graph: (h) => `Medelhastighet senaste ${h} h`,
      slowest: "Långsammast just nu", site: "Mätpunkt", km_away: "km bort",
      classes: { fast: "≥ 70", medium: "50–70", slow: "30–50", crawl: "< 30", unknown: "okänd" },
      trend_up: "ökar", trend_down: "minskar", since: "jämfört med för 30 min sedan",
      side: { northBound: "norrut", southBound: "söderut", eastBound: "österut", westBound: "västerut",
              clockwise: "medurs", anticlockwise: "moturs", bothWays: "båda riktningar" },
    },
    en: {
      locale: "en-GB",
      stub_title: "Traffic now",
      card_name: "Trafikverket Traffic Now",
      card_desc: "Current traffic: status, speed, flow with trend, distribution and slowest sites.",
      not_found: "No Trafikverket Trafikkarta integration found.",
      status: { free: "Free flow", dense: "Dense traffic", queue: "Queues", none: "No traffic data" },
      status_sub: {
        free: (n) => `${n} sites, no queues`,
        dense: (n, s) => `${s} of ${n} sites below normal speed`,
        queue: (n, q) => `${q} of ${n} sites with queues`,
        none: () => "No measurement sites within the radius",
      },
      avg: "Average speed", lowest: "Lowest", flow: "Flow", vehicles_h: "vehicles/h",
      graph: (h) => `Average speed last ${h} h`,
      slowest: "Slowest right now", site: "Site", km_away: "km away",
      classes: { fast: "≥ 70", medium: "50–70", slow: "30–50", crawl: "< 30", unknown: "unknown" },
      trend_up: "rising", trend_down: "falling", since: "compared with 30 min ago",
      side: { northBound: "northbound", southBound: "southbound", eastBound: "eastbound", westBound: "westbound",
              clockwise: "clockwise", anticlockwise: "anticlockwise", bothWays: "both directions" },
    },
  };
  const langOf = (hass) => {
    const l = String((hass && ((hass.locale && hass.locale.language) || hass.language)) || "en").toLowerCase();
    return l.startsWith("sv") ? "sv" : "en";
  };
  /**
   * Map points of one location from the integration's websocket API. Falls back to
   * the geo_location entities (older integration versions).
   */
  async function fetchPoints(hass, entryId) {
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

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
  const fmt = (v, d, locale) => (v === null ? "–" : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString(locale));

  // Same speed classes and colours as the map card.
  const CLASSES = [
    { key: "fast", color: "#2e7d32", test: (v) => v != null && v >= 70 },
    { key: "medium", color: "#9e9d24", test: (v) => v != null && v >= 50 && v < 70 },
    { key: "slow", color: "#ef6c00", test: (v) => v != null && v >= 30 && v < 50 },
    { key: "crawl", color: "#c62828", test: (v) => v != null && v < 30 },
    { key: "unknown", color: "#9e9e9e", test: (v) => v == null },
  ];
  const classOf = (v) => CLASSES.find((c) => c.test(v)) || CLASSES[4];
  const STATUS_STYLE = {
    free: { icon: "mdi:car-side", color: "var(--success-color, #43a047)" },
    dense: { icon: "mdi:car-multiple", color: "var(--warning-color, #ef6c00)" },
    queue: { icon: "mdi:car-brake-alert", color: "var(--error-color, #c62828)" },
    none: { icon: "mdi:car-off", color: "var(--disabled-text-color, #9e9e9e)" },
  };

  /** Main direction of a site from its lanes (the side with most flow). */
  function mainSide(lanes) {
    const by = {};
    for (const l of lanes || []) if (l.side) by[l.side] = (by[l.side] || 0) + (Number(l.flow) || 0);
    const sides = Object.keys(by);
    if (sides.length !== 1) return sides.length > 1 ? "bothWays" : null;
    return sides[0];
  }

  /** Overall status from the sites' average speeds. */
  function status(sites, queueSpeed, slowSpeed) {
    const speeds = sites.map((s) => num(s.attributes.average_speed)).filter((v) => v !== null);
    if (!speeds.length) return { key: "none", n: 0 };
    const q = speeds.filter((v) => v < queueSpeed).length;
    const slow = speeds.filter((v) => v < slowSpeed).length;
    if (q > 0) return { key: "queue", n: speeds.length, q, slow };
    if (slow / speeds.length >= 0.25) return { key: "dense", n: speeds.length, q, slow };
    return { key: "free", n: speeds.length, q, slow };
  }

  /** Normalise a history response (minimal or full format) to [{t, v}] in time order. */
  function historyPoints(list) {
    const out = [];
    for (const p of list || []) {
      const v = num(p.s !== undefined ? p.s : p.state);
      let ts = p.lu !== undefined ? p.lu * 1000 : p.lc !== undefined ? p.lc * 1000 : Date.parse(p.last_updated || p.last_changed);
      if (v !== null && !isNaN(ts)) out.push({ t: ts, v });
    }
    return out.sort((a, b) => a.t - b.t);
  }

  /** Value about `minutes` ago (last point at or before that time). */
  function valueAgo(points, minutes) {
    const limit = Date.now() - minutes * 60000;
    let best = null;
    for (const p of points) { if (p.t <= limit) best = p; else break; }
    return best ? best.v : null;
  }

  function sparkline(points, color) {
    if (points.length < 2) return "";
    const w = 300, h = 48, pad = 2;
    const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1;
    const vs = points.map((p) => p.v);
    const lo = Math.min(...vs), hi = Math.max(...vs);
    const span = hi - lo || 1;
    const xy = points.map((p) => [
      pad + ((p.t - t0) / (t1 - t0 || 1)) * (w - 2 * pad),
      h - pad - ((p.v - lo) / span) * (h - 2 * pad),
    ]);
    const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
    const area = `${line}L${xy[xy.length - 1][0].toFixed(1)},${h}L${xy[0][0].toFixed(1)},${h}Z`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${area}" fill="${color}" opacity=".12"></path>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"></path></svg>`;
  }

  class TrafikverketTrafficCard extends HTMLElement {
    setConfig(config) {
      this._config = { max_sites: 5, hours: 3, queue_speed: 30, slow_speed: 50, ...config };
      this._sig = "";
      this._history = null;
      this._historyAt = 0;
    }

    static getStubConfig(hass) { return { title: I18N[langOf(hass)].stub_title }; }
    getCardSize() { return 5; }
    getGridOptions() { return { columns: 6, min_columns: 4, rows: "auto" }; }

    set hass(hass) {
      this._hass = hass;
      const lang = langOf(hass);
      if (!this._dataChanged(lang)) return;
      this._refresh(lang);
      this._maybeFetchHistory(lang);
    }

    async _refresh(lang) {
      const home = this._homeId ? this._hass.states[this._homeId] : null;
      const token = (this._token = (this._token || 0) + 1);
      const points = await fetchPoints(this._hass, home ? home.attributes.config_entry_id : this._config.entry);
      if (token !== this._token) return;
      this._points = points;
      this._render(I18N[lang]);
    }

    /** Only re-render when the integration has fetched new data (or once a minute). */
    _dataChanged(lang) {
      const states = this._hass.states;
      const entry = this._config.entry;
      let home = this._homeId && states[this._homeId];
      if (!home || !home.attributes.trafikverket_home || (entry && home.attributes.config_entry_id !== entry)) {
        home = Object.values(states).find(
          (s) => s.attributes.trafikverket_home && (!entry || s.attributes.config_entry_id === entry));
        this._homeId = home ? home.entity_id : null;
      }
      const ids = (home && home.attributes.entity_ids) || {};
      const pick = (id) => (id && states[id] ? states[id].last_updated : "");
      const sig = [lang, home && home.last_updated, pick(ids.average_speed), pick(ids.data_usage), this._historyAt].join("|");
      const now = Date.now();
      if (sig === this._sig && this.shadowRoot && now - (this._lastFull || 0) < 60000) return false;
      this._sig = sig;
      this._lastFull = now;
      return true;
    }

    _ids() {
      const home = this._homeId ? this._hass.states[this._homeId] : null;
      return { home, ids: (home && home.attributes.entity_ids) || {} };
    }

    /** Speed history from the recorder (at most every 5 minutes). */
    async _maybeFetchHistory(lang) {
      const hours = Number(this._config.hours) || 0;
      const { ids } = this._ids();
      if (!hours || !ids.average_speed || typeof this._hass.callWS !== "function") return;
      if (this._fetching || Date.now() - this._historyAt < 5 * 60000) return;
      this._fetching = true;
      try {
        const start = new Date(Date.now() - hours * 3600000).toISOString();
        const res = await this._hass.callWS({
          type: "history/history_during_period",
          start_time: start,
          entity_ids: [ids.average_speed, ids.total_flow].filter(Boolean),
          minimal_response: true,
          no_attributes: true,
          significant_changes_only: false,
        });
        this._history = {
          speed: historyPoints(res && res[ids.average_speed]),
          flow: historyPoints(res && res[ids.total_flow]),
        };
      } catch (e) {
        this._history = { speed: [], flow: [] }; // recorder off or no access – just no graph/trend
      } finally {
        this._historyAt = Date.now();
        this._fetching = false;
        this._sig = ""; // re-render with the graph
        this._render(I18N[lang]);
      }
    }

    _moreInfo(entityId) {
      // Map points without a geo_location entity (setting "Hidden") have no dialog.
      if (!entityId || !this._hass.states[entityId]) return;
      this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    }

    _render(t) {
      const root = this.shadowRoot || this.attachShadow({ mode: "open" });
      const { home, ids } = this._ids();
      if (!home) {
        root.innerHTML = `<ha-card><div style="padding:16px">${esc(t.not_found)}</div></ha-card>`;
        return;
      }
      const c = this._config;
      const loc = t.locale;
      const states = this._hass.states;
      const eid = home.attributes.config_entry_id;
      const sites = (this._points || []).filter((s) => s.attributes.tv_type === "flow" && s.attributes.config_entry_id === eid);
      const st = status(sites, Number(c.queue_speed) || 30, Number(c.slow_speed) || 50);
      const S = STATUS_STYLE[st.key];
      const sub = st.key === "none" ? t.status_sub.none()
        : st.key === "queue" ? t.status_sub.queue(st.n, st.q)
        : st.key === "dense" ? t.status_sub.dense(st.n, st.slow) : t.status_sub.free(st.n);

      const val = (id) => (id && states[id] ? num(states[id].state) : null);
      const avg = val(ids.average_speed), low = val(ids.lowest_speed), flow = val(ids.total_flow);
      const h = this._history || { speed: [], flow: [] };
      const trend = (now, points, unit, digits) => {
        const ago = valueAgo(points, 30);
        if (now === null || ago === null) return "";
        const d = now - ago;
        if (Math.abs(d) < (unit === "km/h" ? 2 : Math.max(20, Math.abs(ago) * 0.05))) return "";
        const up = d > 0;
        // Colour only for speed (higher = better); a flow change is neither good nor bad.
        const cls = unit === "km/h" ? (up ? "up" : "down") : "neutral";
        return `<span class="tr ${cls}" title="${esc(up ? t.trend_up : t.trend_down)} ${esc(t.since)}">` +
          `${up ? "▲" : "▼"} ${fmt(Math.abs(d), digits, loc)}</span>`;
      };
      const kpi = (label, value, unit, extra, entity) => `
        <div class="k" data-entity="${esc(entity || "")}">
          <div class="kv">${value}<small>${unit}</small>${extra || ""}</div>
          <div class="kl">${esc(label)}</div></div>`;

      // Distribution over the speed classes
      const dist = {};
      for (const s of sites) { const k = classOf(num(s.attributes.average_speed)).key; dist[k] = (dist[k] || 0) + 1; }
      const total = sites.length;
      const bar = total ? CLASSES.filter((cl) => dist[cl.key]).map((cl) =>
        `<div class="seg" style="flex:${dist[cl.key]};background:${cl.color}" title="${esc(t.classes[cl.key])} km/h: ${dist[cl.key]}"></div>`).join("") : "";
      const barLegend = total ? CLASSES.filter((cl) => dist[cl.key]).map((cl) =>
        `<span><i style="background:${cl.color}"></i>${esc(t.classes[cl.key])}: ${dist[cl.key]}</span>`).join("") : "";

      // Slowest sites
      const max = Math.max(0, Number(c.max_sites) || 0);
      const slowest = sites.filter((s) => num(s.attributes.average_speed) !== null)
        .sort((a, b) => a.attributes.average_speed - b.attributes.average_speed).slice(0, max);
      const rows = slowest.map((s) => {
        const a = s.attributes;
        const side = mainSide(a.lanes);
        return `<div class="row" data-entity="${esc(s.entity_id)}">
          <i style="background:${classOf(num(a.average_speed)).color}"></i>
          <span class="rn">${esc(t.site)} ${esc(a.site_id)}${side ? ` <small>${esc(t.side[side] || side)}</small>` : ""}</span>
          <span class="rv">${fmt(num(a.average_speed), 0, loc)} km/h</span>
          <span class="rf">${fmt(num(a.flow), 0, loc)} ${esc(t.vehicles_h)}</span>
          <span class="rd">${fmt(num(s.state), 1, loc)} km</span></div>`;
      }).join("");

      const hours = Number(c.hours) || 0;
      const graph = hours && h.speed.length > 1
        ? `<div class="graph"><div class="gl">${esc(t.graph(hours))}</div>${sparkline(h.speed, "var(--primary-color, #1976d2)")}</div>` : "";

      root.innerHTML = `
        <style>
          ha-card { overflow: hidden; }
          .title { padding: 12px 16px 0; font-size: 1.1em; font-weight: 500; color: var(--primary-text-color); }
          .status { display: flex; align-items: center; gap: 12px; margin: 12px 12px 4px; padding: 10px 12px; border-radius: 12px;
                    background: color-mix(in srgb, ${S.color} 16%, transparent); }
          .status ha-icon { color: ${S.color}; --mdc-icon-size: 32px; }
          .st { font-size: 1.15em; font-weight: 600; color: var(--primary-text-color); }
          .ss { font-size: .85em; color: var(--secondary-text-color); }
          .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 8px 12px; }
          .k { padding: 6px 8px; border-radius: 10px; background: var(--secondary-background-color); cursor: pointer; }
          .kv { font-size: 1.35em; font-weight: 600; color: var(--primary-text-color); white-space: nowrap; }
          .kv small { font-size: .55em; font-weight: 500; margin-left: 3px; color: var(--secondary-text-color); }
          .kl { font-size: .75em; color: var(--secondary-text-color); }
          .tr { font-size: .5em; margin-left: 6px; vertical-align: middle; }
          .tr.up { color: var(--success-color, #43a047); } .tr.down { color: var(--error-color, #c62828); }
          .tr.neutral { color: var(--secondary-text-color); }
          .bar { display: flex; height: 10px; margin: 6px 12px 2px; border-radius: 5px; overflow: hidden; gap: 2px; }
          .seg { min-width: 4px; }
          .bl { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 2px 12px 6px; font-size: .75em; color: var(--secondary-text-color); }
          .bl i, .row i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; }
          .graph { padding: 4px 12px 2px; }
          .graph svg { width: 100%; height: 48px; display: block; }
          .gl { font-size: .75em; color: var(--secondary-text-color); margin-bottom: 2px; }
          .list { padding: 2px 12px 10px; }
          .lh { font-size: .8em; font-weight: 600; color: var(--secondary-text-color); margin: 6px 0 2px; }
          .row { display: grid; grid-template-columns: 14px 1fr auto auto auto; gap: 8px; align-items: baseline; padding: 4px 2px;
                 border-top: 1px solid var(--divider-color); font-size: .9em; cursor: pointer; }
          .rn { color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .rn small { color: var(--secondary-text-color); }
          .rv { font-weight: 600; color: var(--primary-text-color); white-space: nowrap; }
          .rf, .rd { color: var(--secondary-text-color); font-size: .85em; white-space: nowrap; }
        </style>
        <ha-card>
          ${c.title ? `<div class="title">${esc(c.title)}</div>` : ""}
          <div class="status"><ha-icon icon="${S.icon}"></ha-icon>
            <div><div class="st">${esc(t.status[st.key])}</div><div class="ss">${esc(sub)}</div></div></div>
          <div class="kpis">
            ${kpi(t.avg, fmt(avg, 0, loc), "km/h", trend(avg, h.speed, "km/h", 0), ids.average_speed)}
            ${kpi(t.lowest, fmt(low, 0, loc), "km/h", "", ids.lowest_speed)}
            ${kpi(t.flow, fmt(flow, 0, loc), t.vehicles_h, trend(flow, h.flow, "veh", 0), ids.total_flow)}
          </div>
          ${bar ? `<div class="bar">${bar}</div><div class="bl">${barLegend}</div>` : ""}
          ${graph}
          ${rows ? `<div class="list"><div class="lh">${esc(t.slowest)}</div>${rows}</div>` : ""}
        </ha-card>`;
      root.querySelectorAll("[data-entity]").forEach((el) => {
        if (el.dataset.entity) el.addEventListener("click", () => this._moreInfo(el.dataset.entity));
      });
    }
  }

  if (!customElements.get("trafikverket-traffic-card")) {
    customElements.define("trafikverket-traffic-card", TrafikverketTrafficCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "trafikverket-traffic-card",
      name: I18N.en.card_name,
      description: I18N.en.card_desc,
      preview: false,
    });
  }
})();
