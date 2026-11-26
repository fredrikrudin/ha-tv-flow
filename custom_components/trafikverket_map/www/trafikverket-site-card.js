/*
 * Trafikverket Trafikkarta – measurement site card ("Mätpunkt")
 *
 *   type: custom:trafikverket-site-card
 *   site_id: 1234             # optional; default = the nearest site
 *   title: My commute         # optional
 *   entry: <config_entry_id>  # optional, if you have several locations
 *   queue_speed: 30           # km/h – below this the site shows a queue warning
 *
 * Shows one traffic flow measurement site: overall speed and flow, and speed and
 * flow per direction and lane. The site id is shown on the map popup and in the
 * attributes of the geo_location entity (site_id).
 *
 * The UI follows Home Assistant's language: Swedish for "sv", English otherwise.
 */

(() => {
  const I18N = {
    sv: {
      locale: "sv-SE",
      card_name: "Trafikverket Mätpunkt",
      card_desc: "En mätpunkt för trafikflöde: hastighet och flöde per riktning och körfält.",
      not_found: "Hittar ingen Trafikverket Trafikkarta-integration.",
      no_site: (id) => (id ? `Mätpunkt ${id} finns inte inom radien just nu.` : "Inga mätpunkter inom radien."),
      site: "Mätpunkt", nearest: "närmast", km_away: "km bort",
      speed: "Medelhastighet", flow: "Flöde", vehicles_h: "fordon/h", lowest: "lägst",
      lane: "Körfält", queue: "Kö", queue_text: (v) => `Kö – ${v} km/h`,
      measured: "Mätt", quality: { good: "god", degraded: "försämrad", bad: "dålig" }, quality_label: "Datakvalitet",
      all_vehicles: "alla fordon",
      side: { northBound: "Norrgående", southBound: "Södergående", eastBound: "Östgående", westBound: "Västgående",
              clockwise: "Medurs", anticlockwise: "Moturs", innerRing: "Inre ring", outerRing: "Yttre ring",
              bothWays: "Båda riktningar", allDirections: "Alla riktningar", unknown: "Okänd riktning" },
    },
    en: {
      locale: "en-GB",
      card_name: "Trafikverket Measurement Site",
      card_desc: "One traffic flow measurement site: speed and flow per direction and lane.",
      not_found: "No Trafikverket Trafikkarta integration found.",
      no_site: (id) => (id ? `Site ${id} is not within the radius right now.` : "No measurement sites within the radius."),
      site: "Site", nearest: "nearest", km_away: "km away",
      speed: "Average speed", flow: "Flow", vehicles_h: "vehicles/h", lowest: "lowest",
      lane: "Lane", queue: "Queue", queue_text: (v) => `Queue – ${v} km/h`,
      measured: "Measured", quality: { good: "good", degraded: "degraded", bad: "bad" }, quality_label: "Data quality",
      all_vehicles: "all vehicles",
      side: { northBound: "Northbound", southBound: "Southbound", eastBound: "Eastbound", westBound: "Westbound",
              clockwise: "Clockwise", anticlockwise: "Anticlockwise", innerRing: "Inner ring", outerRing: "Outer ring",
              bothWays: "Both directions", allDirections: "All directions", unknown: "Unknown direction" },
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
        const st = hass.states[id];
        if (st.attributes.tv_type && (!entryId || st.attributes.config_entry_id === entryId)) out.push(st);
      }
      return out;
    }
  }

  /** "1001", or "1001 +3" for a location merged from four sites. */
  const siteLabel = (a) => {
    const n = (a.site_ids || []).length - 1;
    return n > 0 ? `${a.site_id} +${n}` : String(a.site_id);
  };

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
  const fmt = (v, d, locale) => (v === null ? "–" : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString(locale));
  const time = (iso, locale) => {
    if (!iso) return "–";
    try { return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }); } catch (e) { return "–"; }
  };
  // Same colours as the map card's speed classes.
  const speedColor = (v) => (v == null ? "#9e9e9e" : v >= 70 ? "#2e7d32" : v >= 50 ? "#9e9d24" : v >= 30 ? "#ef6c00" : "#c62828");
  const MAX_BAR_SPEED = 120;

  /**
   * Group lane records by direction. Records with vehicle type "anyVehicle" are
   * totals; if a direction has them, the per-type records are not added again.
   */
  function byDirection(lanes) {
    const dirs = {};
    for (const l of lanes || []) {
      const side = l.side || "unknown";
      (dirs[side] = dirs[side] || []).push(l);
    }
    return Object.entries(dirs).map(([side, recs]) => {
      // A merged location holds several SiteIds: pick totals per site, not per direction.
      const bySite = {};
      for (const r of recs) (bySite[r.site_id ?? ""] = bySite[r.site_id ?? ""] || []).push(r);
      const multi = Object.keys(bySite).length > 1;
      const counted = Object.values(bySite).flatMap((rs) => {
        const any = rs.filter((r) => r.vehicle_type === "anyVehicle");
        return any.length ? any : rs;
      });
      let flow = 0, wsum = 0, wspeed = 0;
      for (const r of counted) {
        const f = Number(r.flow) || 0;
        flow += f;
        const sp = num(r.speed);
        if (sp !== null && sp > 0) { const w = Math.max(f, 1); wspeed += sp * w; wsum += w; }
      }
      // One row per lane (totals preferred), sorted by lane number
      const laneRows = {};
      for (const r of counted) {
        const lane = r.lane || "–";
        const key = multi ? `${lane}|${r.site_id}` : lane;
        const row = (laneRows[key] = laneRows[key] || { lane, site: multi ? r.site_id : null, flow: 0, speed: null, types: [] });
        row.flow += Number(r.flow) || 0;
        if (num(r.speed) !== null) row.speed = num(r.speed);
        if (r.vehicle_type) row.types.push(r.vehicle_type);
      }
      return {
        side, flow, speed: wsum ? wspeed / wsum : null,
        lanes: Object.values(laneRows).sort((a, b) =>
          String(a.lane).localeCompare(String(b.lane), undefined, { numeric: true }) || String(a.site).localeCompare(String(b.site))),
      };
    }).sort((a, b) => a.side.localeCompare(b.side));
  }

  class TrafikverketSiteCard extends HTMLElement {
    setConfig(config) {
      this._config = { queue_speed: 30, ...config };
      this._sig = "";
    }

    static getStubConfig() { return {}; }
    getCardSize() { return 4; }
    getGridOptions() { return { columns: 6, min_columns: 3, rows: "auto" }; }

    set hass(hass) {
      this._hass = hass;
      const lang = langOf(hass);
      if (!this._dataChanged(lang)) return;
      this._refresh(lang);
    }

    /** True when the integration fetched new data (home / data usage sensor changed) or once a minute. */
    _dataChanged(lang) {
      const states = this._hass.states;
      const c = this._config;
      let home = this._homeId && states[this._homeId];
      if (!home || !home.attributes.trafikverket_home || (c.entry && home.attributes.config_entry_id !== c.entry)) {
        home = Object.values(states).find(
          (s) => s.attributes.trafikverket_home && (!c.entry || s.attributes.config_entry_id === c.entry));
        this._homeId = home ? home.entity_id : null;
      }
      const ids = (home && home.attributes.entity_ids) || {};
      const usage = ids.data_usage && states[ids.data_usage];
      const sig = [lang, home && home.last_updated, usage && usage.last_updated].join("|");
      const now = Date.now();
      if (sig === this._trigger && this.shadowRoot && now - (this._lastFull || 0) < 60000) return false;
      this._trigger = sig;
      this._lastFull = now;
      return true;
    }

    async _refresh(lang) {
      const home = this._homeId ? this._hass.states[this._homeId] : null;
      const token = (this._token = (this._token || 0) + 1);
      const points = await fetchPoints(this._hass, home ? home.attributes.config_entry_id : this._config.entry);
      if (token !== this._token) return;
      const site = this._findSite(points, home);
      const sig = [lang, site && site.entity_id, site && site.last_updated].join("|");
      if (sig === this._sig && this.shadowRoot && this.shadowRoot.innerHTML) return;
      this._sig = sig;
      this._render(site, I18N[lang]);
    }

    /** The configured site, or the nearest one. */
    _findSite(points, home) {
      const c = this._config;
      const eid = home ? home.attributes.config_entry_id : c.entry;
      let best = null;
      for (const s of points) {
        const a = s.attributes;
        if (a.tv_type !== "flow" || (eid && a.config_entry_id !== eid)) continue;
        // A merged location matches any of its SiteIds.
        if (c.site_id) { if ((a.site_ids || [a.site_id]).some((id) => String(id) === String(c.site_id))) return s; }
        else if (!best || Number(s.state) < Number(best.state)) best = s;
      }
      return best;
    }

    _moreInfo(entityId) {
      // Map points without a geo_location entity (setting "Hidden") have no dialog.
      if (!entityId || !this._hass.states[entityId]) return;
      this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    }

    _render(site, t) {
      const root = this.shadowRoot || this.attachShadow({ mode: "open" });
      const c = this._config;
      const loc = t.locale;
      if (!this._homeId) {
        root.innerHTML = `<ha-card><div style="padding:16px">${esc(t.not_found)}</div></ha-card>`;
        return;
      }
      if (!site) {
        root.innerHTML = `<ha-card>${c.title ? `<div style="padding:12px 16px 0;font-weight:500">${esc(c.title)}</div>` : ""}
          <div style="padding:16px;color:var(--secondary-text-color)">${esc(t.no_site(c.site_id))}</div></ha-card>`;
        return;
      }
      const a = site.attributes;
      const speed = num(a.average_speed);
      const color = speedColor(speed);
      const queue = speed !== null && speed < (Number(c.queue_speed) || 30);
      const dirs = byDirection(a.lanes);
      const quality = a.data_quality ? (t.quality[a.data_quality] || a.data_quality) : null;

      const dirHtml = dirs.map((d) => `
        <div class="dir">
          <div class="dh"><span>${esc(t.side[d.side] || d.side)}</span>
            <b style="color:${speedColor(d.speed)}">${fmt(d.speed, 0, loc)} km/h</b>
            <small>${fmt(d.flow, 0, loc)} ${esc(t.vehicles_h)}</small></div>
          ${d.lanes.map((l) => `
            <div class="lane">
              <span class="ln">${esc(t.lane)} ${esc(String(l.lane).replace(/^lane/i, ""))}${l.site ? ` <small>· ${esc(l.site)}</small>` : ""}</span>
              <div class="track"><div class="fill" style="width:${Math.min(100, ((l.speed || 0) / MAX_BAR_SPEED) * 100)}%;background:${speedColor(l.speed)}"></div></div>
              <span class="lv">${fmt(l.speed, 0, loc)} km/h</span>
              <span class="lf">${fmt(l.flow, 0, loc)}</span>
            </div>`).join("")}
        </div>`).join("");

      root.innerHTML = `
        <style>
          ha-card { overflow: hidden; cursor: default; }
          .title { padding: 12px 16px 0; font-size: 1.1em; font-weight: 500; color: var(--primary-text-color); }
          .head { display: flex; align-items: center; gap: 14px; padding: 12px 16px 6px; cursor: pointer; }
          .gauge { width: 64px; height: 64px; border-radius: 50%; display: flex; flex-direction: column; align-items: center;
                   justify-content: center; border: 5px solid ${color}; flex: none; }
          .gauge b { font-size: 1.35em; line-height: 1; color: var(--primary-text-color); }
          .gauge small { font-size: .65em; color: var(--secondary-text-color); }
          .hn { font-weight: 600; color: var(--primary-text-color); }
          .hs { font-size: .85em; color: var(--secondary-text-color); }
          .q { display: inline-block; margin-top: 4px; padding: 1px 8px; border-radius: 10px; font-size: .8em; font-weight: 600;
               color: #fff; background: var(--error-color, #c62828); }
          .dirs { padding: 0 12px 6px; }
          .dir { padding: 6px 4px; border-top: 1px solid var(--divider-color); }
          .dh { display: flex; align-items: baseline; gap: 8px; font-size: .9em; color: var(--primary-text-color); margin-bottom: 2px; }
          .dh span { flex: 1; } .dh small { color: var(--secondary-text-color); }
          .lane { display: grid; grid-template-columns: 70px 1fr 60px 44px; gap: 8px; align-items: center; font-size: .8em; padding: 2px 0; }
          .ln, .lf { color: var(--secondary-text-color); } .lf { text-align: right; }
          .lv { text-align: right; color: var(--primary-text-color); }
          .track { height: 6px; border-radius: 3px; background: var(--secondary-background-color); overflow: hidden; }
          .fill { height: 100%; border-radius: 3px; }
          .foot { padding: 2px 16px 10px; font-size: .75em; color: var(--secondary-text-color); }
        </style>
        <ha-card>
          ${c.title ? `<div class="title">${esc(c.title)}</div>` : ""}
          <div class="head" id="head">
            <div class="gauge"><b>${fmt(speed, 0, loc)}</b><small>km/h</small></div>
            <div>
              <div class="hn">${esc(t.site)} ${esc(siteLabel(a))}${c.site_id ? "" : ` <small>(${esc(t.nearest)})</small>`}</div>
              <div class="hs">${fmt(num(a.flow), 0, loc)} ${esc(t.vehicles_h)} · ${esc(t.lowest)} ${fmt(num(a.min_speed), 0, loc)} km/h · ${fmt(num(site.state), 1, loc)} ${esc(t.km_away)}</div>
              ${queue ? `<span class="q">${esc(t.queue_text(fmt(speed, 0, loc)))}</span>` : ""}
            </div>
          </div>
          ${dirs.length ? `<div class="dirs">${dirHtml}</div>` : ""}
          <div class="foot">${esc(t.measured)} ${time(a.measurement_time, loc)}${quality ? ` · ${esc(t.quality_label)}: ${esc(quality)}` : ""}</div>
        </ha-card>`;
      const head = root.getElementById ? root.getElementById("head") : null;
      if (head) head.addEventListener("click", () => this._moreInfo(site.entity_id));
    }
  }

  if (!customElements.get("trafikverket-site-card")) {
    customElements.define("trafikverket-site-card", TrafikverketSiteCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "trafikverket-site-card",
      name: I18N.en.card_name,
      description: I18N.en.card_desc,
      preview: false,
    });
  }
})();
