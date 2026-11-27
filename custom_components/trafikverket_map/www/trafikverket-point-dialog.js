/*
 * Trafikverket Trafikkarta – details window for one map point.
 *
 * Shared by all cards of the integration: window.tvPointDialog.open(hass, point, origin).
 * `point` has the shape of a Home Assistant state object (from the websocket API
 * trafikverket_map/map_data or a geo_location entity). Unlike Home Assistant's
 * more-info dialog (whose state for geo_location entities is always the distance),
 * this window shows what matters for each kind of point:
 *   - flow site: speed history (last 24 h), flow and lanes
 *   - event (road works, accident …): start, end, status and description
 *   - road condition and weather station: their details
 */
(() => {
  if (window.tvPointDialog) return;

  const I18N = {
    sv: {
      locale: "sv-SE",
      close: "Stäng",
      entity: "Visa entitet",
      speed: "Hastighet", lowest: "Lägst", flow: "Flöde", distance: "Avstånd", km_away: "km bort",
      vehicles_h: "fordon/h", history: "Hastighet senaste 24 timmarna", avg: "medel", min: "lägst",
      no_history: "Ingen historik ännu – den fylls på vid varje hämtning.",
      loading: "Hämtar historik …",
      lanes: "Körfält", lane: "Körfält", site_ids: "Mätpunkter", measured: "Mätt",
      side: { northBound: "Norrgående", southBound: "Södergående", eastBound: "Östgående", westBound: "Västgående",
              anyDirection: "Båda riktningar", unknown: "Okänd riktning" },
      type: "Typ", road: "Väg", location: "Plats", direction: "Riktning", start: "Start", end: "Slut",
      until_further_notice: "Tills vidare", status: "Status", impact: "Påverkan", limit: "Tillfällig begränsning",
      restriction: "Restriktion", more: "Mer information hos Trafikverket",
      ongoing: (left) => `Pågår${left ? ` – ${left} kvar` : ""}`, upcoming: (until) => `Börjar om ${until}`, ended: "Avslutad",
      dur: { d: (n) => `${n} ${n === 1 ? "dag" : "dagar"}`, h: (n) => `${n} tim`, m: (n) => `${n} min` },
      condition: "Väglag", warning: "Varning", cause: "Orsak", measure: "Åtgärd", info: "Information",
      air: "Lufttemperatur", surface: "Vägbanans temperatur", humidity: "Luftfuktighet", wind: "Vind", gusts: "byar",
      precipitation: "Nederbörd", grip: "Friktion", visibility: "Sikt",
    },
    en: {
      locale: "en-GB",
      close: "Close",
      entity: "Show entity",
      speed: "Speed", lowest: "Lowest", flow: "Flow", distance: "Distance", km_away: "km away",
      vehicles_h: "vehicles/h", history: "Speed, last 24 hours", avg: "average", min: "lowest",
      no_history: "No history yet – it fills up with every fetch.",
      loading: "Loading history …",
      lanes: "Lanes", lane: "Lane", site_ids: "Sites", measured: "Measured",
      side: { northBound: "Northbound", southBound: "Southbound", eastBound: "Eastbound", westBound: "Westbound",
              anyDirection: "Both directions", unknown: "Unknown direction" },
      type: "Type", road: "Road", location: "Location", direction: "Direction", start: "Start", end: "End",
      until_further_notice: "Until further notice", status: "Status", impact: "Impact", limit: "Temporary limit",
      restriction: "Restriction", more: "More information from Trafikverket",
      ongoing: (left) => `Ongoing${left ? ` – ${left} left` : ""}`, upcoming: (until) => `Starts in ${until}`, ended: "Ended",
      dur: { d: (n) => `${n} ${n === 1 ? "day" : "days"}`, h: (n) => `${n} h`, m: (n) => `${n} min` },
      condition: "Road condition", warning: "Warning", cause: "Cause", measure: "Action", info: "Information",
      air: "Air temperature", surface: "Road surface temperature", humidity: "Humidity", wind: "Wind", gusts: "gusts",
      precipitation: "Precipitation", grip: "Grip", visibility: "Visibility",
    },
  };

  const langOf = (hass) => {
    const l = String((hass && ((hass.locale && hass.locale.language) || hass.language)) || "en").toLowerCase();
    return l.startsWith("sv") ? "sv" : "en";
  };
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
  const fmt = (v, d, loc) => (num(v) === null ? "–" : Number(v).toLocaleString(loc, { maximumFractionDigits: d }));
  const speedColor = (v) => (v === null ? "#9e9e9e" : v >= 70 ? "#43a047" : v >= 50 ? "#9ccc65" : v >= 30 ? "#fb8c00" : "#e53935");

  /** Date and time, with weekday and year only when needed. */
  function fmtDate(iso, loc) {
    if (!iso) return "–";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    const now = new Date();
    const opts = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
    if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
    if (Math.abs(d - now) < 7 * 86400e3) opts.weekday = "short";
    return d.toLocaleString(loc, opts);
  }

  /** "3 dagar", "5 tim", "20 min". */
  function duration(ms, t) {
    const m = Math.max(1, Math.round(ms / 60000));
    if (m >= 2 * 1440) return t.dur.d(Math.round(m / 1440));
    if (m >= 120) return t.dur.h(Math.round(m / 60));
    return t.dur.m(m);
  }

  const row = (label, value) =>
    value === null || value === undefined || value === "" ? "" : `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;

  /* --------------------------------------------------------------- history */

  /**
   * Speed history: the integration's in-memory series (every mode, since start)
   * merged with the recorder history of the geo_location entity (survives restarts).
   */
  async function speedHistory(hass, point) {
    const a = point.attributes;
    const out = [];
    try {
      const res = await hass.callWS({
        type: "trafikverket_map/point_history", key: a.tv_key || `flow_${a.site_id}`,
        ...(a.config_entry_id ? { entry_id: a.config_entry_id } : {}),
      });
      for (const x of (res && res.items) || []) out.push({ t: Date.parse(x.t), speed: num(x.speed), min: num(x.min_speed) });
    } catch (e) { /* older integration version */ }
    if (hass.states[point.entity_id]) {
      try {
        const res = await hass.callWS({
          type: "history/history_during_period", start_time: new Date(Date.now() - 24 * 3600e3).toISOString(),
          entity_ids: [point.entity_id], minimal_response: false, no_attributes: false, significant_changes_only: false,
        });
        let attrs = {};
        for (const r of (res && res[point.entity_id]) || []) {
          attrs = r.a || attrs;
          const when = (r.lu || r.lc) * 1000;
          if (when && num(attrs.average_speed) !== null) out.push({ t: when, speed: num(attrs.average_speed), min: num(attrs.min_speed) });
        }
      } catch (e) { /* recorder not available */ }
    }
    // Sort and drop near-duplicates (the same fetch seen from both sources).
    out.sort((x, y) => x.t - y.t);
    const merged = [];
    for (const p of out) {
      if (p.speed === null || isNaN(p.t)) continue;
      const last = merged[merged.length - 1];
      if (last && p.t - last.t < 90e3) continue;
      merged.push(p);
    }
    return merged;
  }

  /** Small SVG line chart: average speed (solid) and lowest speed (dashed). */
  function chart(points, t) {
    const W = 460, H = 150, L = 30, R = 6, T = 8, B = 20;
    const t0 = Date.now() - 24 * 3600e3, t1 = Date.now();
    const start = Math.min(t0, points[0].t);
    const max = Math.max(110, ...points.map((p) => p.speed || 0)) ;
    const x = (v) => L + ((v - start) / (t1 - start)) * (W - L - R);
    const y = (v) => T + (1 - v / max) * (H - T - B);
    const path = (key) => points.filter((p) => p[key] !== null)
      .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
    const bands = [[70, max, "#43a047"], [50, 70, "#9ccc65"], [30, 50, "#fb8c00"], [0, 30, "#e53935"]]
      .map(([lo, hi, c]) => `<rect x="${L}" y="${y(hi)}" width="${W - L - R}" height="${y(lo) - y(hi)}" fill="${c}" opacity=".08"/>`).join("");
    const grid = [30, 50, 70, 90].filter((v) => v < max).map((v) =>
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".12"/>` +
      `<text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join("");
    const ticks = [];
    for (let h = 0; h <= 24; h += 6) {
      const tv = t1 - (24 - h) * 3600e3;
      if (tv < start) continue;
      const label = new Date(tv).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" });
      const anchor = h === 24 ? "end" : x(tv) - L < 20 ? "start" : "middle";
      ticks.push(`<text x="${x(tv)}" y="${H - 5}" text-anchor="${anchor}">${label}</text>`);
    }
    const last = points[points.length - 1];
    const dots = points.length < 40
      ? points.map((p) => `<circle cx="${x(p.t)}" cy="${y(p.speed)}" r="2.2" fill="${speedColor(p.speed)}"/>`).join("") : "";
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">
      ${bands}${grid}${ticks.join("")}
      <path d="${path("min")}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3" opacity=".5"/>
      <path d="${path("speed")}" fill="none" stroke="var(--primary-color, #03a9f4)" stroke-width="2"/>
      ${dots}
      <circle cx="${x(last.t)}" cy="${y(last.speed)}" r="4" fill="${speedColor(last.speed)}" stroke="#fff" stroke-width="1.5"/>
    </svg>
    <div class="legend"><span><i class="solid"></i>${esc(t.avg)}</span><span><i class="dash"></i>${esc(t.min)}</span></div>`;
  }

  /* --------------------------------------------------------------- content */

  function flowBody(a, point, t) {
    const loc = t.locale;
    const speed = num(a.average_speed);
    const lanes = (a.lanes || []).filter((l) => l.vehicle_type === "anyVehicle" || !(a.lanes || []).some(
      (o) => o.vehicle_type === "anyVehicle" && o.side === l.side && o.lane === l.lane && o.site_id === l.site_id));
    const multi = (a.site_ids || []).length > 1;
    const laneRows = lanes
      .sort((p, q) => String(p.side).localeCompare(String(q.side)) || String(p.lane).localeCompare(String(q.lane), undefined, { numeric: true }))
      .map((l) => `<tr><td>${esc(t.side[l.side] || l.side || "")}</td>` +
        `<td>${esc(t.lane)} ${esc(String(l.lane ?? "–").replace(/^lane/i, ""))}${multi && l.site_id ? ` <small>· ${esc(l.site_id)}</small>` : ""}</td>` +
        `<td class="n"><b style="color:${speedColor(num(l.speed))}">${fmt(l.speed, 0, loc)}</b> km/h</td>` +
        `<td class="n">${fmt(l.flow, 0, loc)} ${esc(t.vehicles_h)}</td></tr>`).join("");
    return `
      <div class="kpis">
        <div><b style="color:${speedColor(speed)}">${fmt(speed, 0, loc)}</b><span>km/h · ${esc(t.speed)}</span></div>
        <div><b>${fmt(a.min_speed, 0, loc)}</b><span>km/h · ${esc(t.lowest)}</span></div>
        <div><b>${fmt(a.flow, 0, loc)}</b><span>${esc(t.vehicles_h)}</span></div>
        <div><b>${fmt(point.state, 1, loc)}</b><span>${esc(t.km_away)}</span></div>
      </div>
      <h3>${esc(t.history)}</h3>
      <div id="history" class="muted">${esc(t.loading)}</div>
      ${laneRows ? `<h3>${esc(t.lanes)}</h3><table class="lanes">${laneRows}</table>` : ""}
      <p class="muted small">${multi ? `${esc(t.site_ids)}: ${esc(a.site_ids.join(", "))} · ` : ""}${esc(t.measured)} ${esc(fmtDate(a.measurement_time, loc))}</p>`;
  }

  function eventStatus(a, t) {
    const now = Date.now();
    const start = a.start_time ? Date.parse(a.start_time) : null;
    const end = a.end_time ? Date.parse(a.end_time) : null;
    if (start && start > now) return t.upcoming(duration(start - now, t));
    if (end && end < now) return t.ended;
    return t.ongoing(end ? duration(end - now, t) : "");
  }

  function situationBody(a, point, t) {
    const loc = t.locale;
    const end = a.end_time ? esc(fmtDate(a.end_time, loc)) : a.until_further_notice ? esc(t.until_further_notice) : "–";
    return `
      ${a.header ? `<p class="lead">${esc(a.header)}</p>` : ""}
      ${a.message && a.message !== a.header ? `<p>${esc(a.message)}</p>` : ""}
      <table class="facts">
        ${row(t.status, `<b>${esc(eventStatus(a, t))}</b>`)}
        ${row(t.start, esc(fmtDate(a.start_time, loc)))}
        ${row(t.end, end)}
        ${row(t.type, esc(a.message_type_text || a.message_type))}
        ${row(t.road, esc([a.road_number, a.road_name].filter(Boolean).join(" – ")))}
        ${row(t.location, esc(a.location_text))}
        ${row(t.direction, esc(a.direction))}
        ${row(t.limit, esc(a.temporary_limit))}
        ${row(t.restriction, esc(a.restriction))}
        ${row(t.impact, esc(a.severity_text))}
        ${row(t.distance, `${fmt(point.state, 1, loc)} ${esc(t.km_away)}`)}
      </table>
      ${a.web_link ? `<p><a href="${esc(a.web_link)}" target="_blank" rel="noopener">${esc(t.more)} ↗</a></p>` : ""}`;
  }

  function roadBody(a, point, t) {
    return `<table class="facts">
      ${row(t.condition, `<b>${esc(a.condition_text)}</b>`)}
      ${row(t.info, esc(a.condition_info))}
      ${row(t.warning, esc(a.warning))}
      ${row(t.cause, esc(a.cause))}
      ${row(t.measure, esc(a.measure))}
      ${row(t.location, esc(a.location_text))}
      ${row(t.distance, `${fmt(point.state, 1, t.locale)} ${esc(t.km_away)}`)}
    </table>`;
  }

  function weatherBody(a, point, t) {
    const loc = t.locale;
    const unit = (v, u, d = 1) => (num(v) === null ? null : `${fmt(v, d, loc)} ${u}`);
    return `<table class="facts">
      ${row(t.air, unit(a.air_temperature, "°C"))}
      ${row(t.surface, unit(a.surface_temperature, "°C"))}
      ${row(t.humidity, unit(a.humidity, "%", 0))}
      ${row(t.wind, num(a.wind_speed) === null ? null : `${fmt(a.wind_speed, 1, loc)} m/s` +
        (num(a.wind_gust) !== null ? ` (${t.gusts} ${fmt(a.wind_gust, 1, loc)})` : ""))}
      ${row(t.precipitation, esc(a.precipitation_text))}
      ${row(t.grip, num(a.grip) === null ? null : fmt(a.grip, 2, loc))}
      ${row(t.visibility, unit(a.visibility, "m", 0))}
      ${row(t.measured, esc(fmtDate(a.sample, loc)))}
      ${row(t.distance, `${fmt(point.state, 1, loc)} ${esc(t.km_away)}`)}
    </table>`;
  }

  const STYLE = `
    .tvpd-back { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.5); display: flex;
                 align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; }
    .tvpd { background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121);
            border-radius: var(--ha-card-border-radius, 12px); width: 100%; max-width: 520px; max-height: 92vh;
            overflow: auto; box-shadow: 0 8px 32px rgba(0,0,0,.4); font-family: var(--paper-font-body1_-_font-family, sans-serif); }
    .tvpd header { display: flex; align-items: center; gap: 12px; padding: 14px 16px 6px; position: sticky; top: 0;
                   background: inherit; }
    .tvpd header img { width: 36px; height: 36px; flex: none; }
    .tvpd header h2 { flex: 1; margin: 0; font-size: 1.15em; font-weight: 500; line-height: 1.3; }
    .tvpd header button { background: none; border: 0; color: inherit; font-size: 26px; line-height: 1; cursor: pointer; padding: 4px 8px; }
    .tvpd .body { padding: 4px 16px 16px; font-size: 14px; }
    .tvpd h3 { font-size: .9em; font-weight: 500; margin: 16px 0 6px; color: var(--secondary-text-color, #727272); }
    .tvpd .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
    .tvpd .kpis div { background: var(--secondary-background-color, #f5f5f5); border-radius: 8px; padding: 8px 4px; }
    .tvpd .kpis b { display: block; font-size: 1.5em; }
    .tvpd .kpis span { font-size: .75em; color: var(--secondary-text-color, #727272); }
    .tvpd .chart { width: 100%; height: auto; display: block; font-size: 10px; fill: var(--secondary-text-color, #727272); }
    .tvpd .legend { display: flex; gap: 14px; font-size: .75em; color: var(--secondary-text-color, #727272); }
    .tvpd .legend i { display: inline-block; width: 16px; margin-right: 5px; vertical-align: middle; border-top: 2px solid var(--primary-color, #03a9f4); }
    .tvpd .legend i.dash { border-top: 1.5px dashed currentColor; }
    .tvpd table { width: 100%; border-collapse: collapse; }
    .tvpd table.lanes td { padding: 3px 4px; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.08)); }
    .tvpd table.facts th { text-align: left; font-weight: normal; color: var(--secondary-text-color, #727272);
                           padding: 5px 12px 5px 0; vertical-align: top; white-space: nowrap; width: 1%; }
    .tvpd table.facts td { padding: 5px 0; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.08)); }
    .tvpd .n { text-align: right; white-space: nowrap; }
    .tvpd .lead { font-size: 1.05em; font-weight: 500; margin: 4px 0 8px; }
    .tvpd .muted { color: var(--secondary-text-color, #727272); }
    .tvpd .small { font-size: .8em; }
    .tvpd a { color: var(--primary-color, #03a9f4); }
    .tvpd footer { display: flex; justify-content: flex-end; padding: 0 16px 14px; }
    .tvpd footer button { background: none; border: 0; color: var(--primary-color, #03a9f4); font: inherit; font-weight: 500; cursor: pointer; padding: 6px 4px; }
  `;

  function open(hass, point, origin) {
    if (!point || !point.attributes) return;
    const t = I18N[langOf(hass)];
    const a = point.attributes;
    close();
    if (!document.getElementById("tvpd-style")) {
      const st = document.createElement("style");
      st.id = "tvpd-style";
      st.textContent = STYLE;
      document.head.appendChild(st);
    }
    const body = a.tv_type === "flow" ? flowBody(a, point, t)
      : a.tv_type === "situation" ? situationBody(a, point, t)
      : a.tv_type === "road" ? roadBody(a, point, t)
      : weatherBody(a, point, t);
    const hasEntity = !!(hass.states && hass.states[point.entity_id]);
    const back = document.createElement("div");
    back.className = "tvpd-back";
    back.id = "tvpd";
    back.innerHTML = `
      <div class="tvpd" role="dialog" aria-modal="true">
        <header>
          ${a.entity_picture || a.icon_picture ? `<img src="${esc(a.entity_picture || a.icon_picture)}" alt="">` : ""}
          <h2>${esc(a.friendly_name || point.entity_id)}</h2>
          <button class="x" title="${esc(t.close)}" aria-label="${esc(t.close)}">×</button>
        </header>
        <div class="body">${body}</div>
        ${hasEntity ? `<footer><button class="entity">${esc(t.entity)}</button></footer>` : ""}
      </div>`;
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    back.querySelector(".x").addEventListener("click", close);
    const ent = back.querySelector(".entity");
    if (ent) ent.addEventListener("click", () => {
      close();
      (origin || document.querySelector("home-assistant") || document.body).dispatchEvent(
        new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: point.entity_id } }));
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);

    if (a.tv_type === "flow") {
      speedHistory(hass, point).then((pts) => {
        const el = back.querySelector("#history");
        if (!el) return;
        if (pts.length < 2) { el.textContent = t.no_history; return; }
        el.classList.remove("muted");
        el.innerHTML = chart(pts, t);
      });
    }
  }

  function onKey(e) { if (e.key === "Escape") close(); }

  function close() {
    const el = document.getElementById("tvpd");
    if (el) el.remove();
    document.removeEventListener("keydown", onKey);
  }

  window.tvPointDialog = { open, close };
})();
