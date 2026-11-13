# ha-tv-flow – Trafikverket Trafikkarta för Home Assistant

Custom integration för Home Assistant som hämtar **trafikflöden**, **väglag** och **vägväder** från Trafikverkets öppna API och visar dem på en karta runt ditt hem (eller valfri plats).

- 🚗 **Trafikflöden** (TrafficFlow 1.5) – mätpunkter färgade efter medelhastighet och storleksatta efter flöde (fordon/h), med detaljer per körfält och riktning.
- 🛣️ **Väglag** (RoadCondition 1.3) – vägsträckor ritade som linjer, färgade efter väglagskod, med varningar, orsak och åtgärd.
- 🌡️ **Lokalt väder** (WeatherObservation 2.1) – närmaste vägväderstation som `weather`-entitet och sensorer (luft- och vägbanetemperatur, vind, nederbörd, sikt, friktion).
- 📍 **Valfri radie** runt hemmet eller en sökt ort.
- 📉 **Begränsad datamängd** – du väljer uppdateringsintervall, max antal objekt, vilka datatyper som hämtas och att bara nödvändiga fält skickas. Allt hämtas i **ett** anrop per intervall.
- 🧭 **Installationsguide** i flera steg: API-nyckel → sök ort eller välj på karta → radie → datamängd.

---

## 1. Skaffa en API-nyckel (gratis)

1. Gå till <https://api.trafikinfo.trafikverket.se/> och klicka **Logga in / Registrera**.
2. Skapa ett konto och bekräfta e-postadressen.
3. Logga in, gå till **Mina nycklar** och skapa en ny nyckel.
4. Kopiera nyckeln – den klistras in i steg 1 i installationsguiden.

## 2. Installera integrationen

### Alternativ A – HACS (rekommenderas)

1. Öppna **HACS** i Home Assistant.
2. Menyn (⋮) uppe till höger → **Custom repositories**.
3. Lägg till `https://github.com/fredrikrudin/ha-tv-flow` med typen **Integration**.
4. Sök efter **Trafikverket Trafikkarta** i HACS och klicka **Download**.
5. **Starta om Home Assistant.**

### Alternativ B – manuellt

1. Ladda ner senaste versionen (eller klona repot).
2. Kopiera mappen `custom_components/trafikverket_map` till `<config>/custom_components/` så att du får
   `<config>/custom_components/trafikverket_map/manifest.json`.
3. **Starta om Home Assistant.**

## 3. Installationsguiden

**Inställningar → Enheter och tjänster → Lägg till integration → "Trafikverket Trafikkarta"**

| Steg | Vad du gör |
|---|---|
| 1. API-konto | Klistra in API-nyckeln (den kontrolleras direkt) och ge ev. ett namn. |
| 2. Plats | Välj **Sök efter ort eller adress** eller **Välj på karta**. |
| 2b. Sök | Skriv t.ex. *Järvsö* eller *Storgatan 1, Sundsvall*. Vid flera träffar väljer du rätt i en lista. Ortsökningen använder OpenStreetMap (Nominatim) och görs bara i guiden. |
| 3. Plats och radie | Finjustera markören, dra i cirkeln eller skriv radien i km. |
| 4. Datamängd | Uppdateringsintervall, vilka datatyper som hämtas, väderradie, max antal objekt, max ålder på mätningar, "hämta bara nödvändiga fält" och kartstil. |

Allt kan ändras i efterhand via **Konfigurera** på integrationen (byt ort, flytta på kartan eller ändra datamängd). Du kan lägga till flera platser, t.ex. hemmet och fritidshuset.

### Rekommenderade inställningar

| Inställning | Standard | Kommentar |
|---|---|---|
| Radie | 10 km | Trafikflödesmätpunkter finns främst på större vägar och i storstadsområden. |
| Uppdateringsintervall | 5 min | Trafikverket uppdaterar flöden ungefär varje minut, väder var 10:e. |
| Väderradie | 30 km | Närmaste station används som lokalt väder. |
| Max objekt per fråga | 300 | Övre gräns per datatyp och hämtning. |
| Max ålder | 60 min | Döljer mätpunkter som slutat rapportera. |
| Bara nödvändiga fält | på | Minskar svarsstorleken kraftigt. |
| Kartstil | Standard OpenStreetMap | Ljus standardkarta, mörk (inverterad) eller följ Home Assistant-temat. |

Den diagnostiska sensorn **Hämtad datamängd** visar hur mycket som laddats ner sedan start, och **Senaste svarsstorlek** hur stort varje anrop är – bra för att finjustera.

## 4. Lägg till kartan i en dashboard

Integrationen levererar ett eget kartkort som registreras automatiskt (ingen resurs behöver läggas till).

```yaml
type: custom:trafikverket-map-card
title: Trafik runt hemmet
height: 450
```

| Alternativ | Standard | Beskrivning |
|---|---|---|
| `title` | – | Rubrik |
| `height` | `450` | Höjd i pixlar |
| `entry` | – | `config_entry_id` om du har flera platser och vill visa en specifik |
| `show_flow` / `show_road` / `show_weather` | `true` | Visa/dölj lager |
| `dark_mode` | – | `true`, `false` eller `auto`. Utelämna för att följa inställningen **Kartstil** i integrationen. |
| `tile_url` | OpenStreetMap | Egen kartserver |

Kortet laddar kartbiblioteket Leaflet från `unpkg.com` och kartbilder från OpenStreetMap, så webbläsaren behöver internetåtkomst.

### Färger

- **Mätpunkter:** grön ≥ 70 km/h, gulgrön 50–70, orange 30–50, röd < 30, grå = okänd. Större cirkel = mer trafik.
- **Väglag:** grön normalt, gul besvärligt (risk för), röd mycket besvärligt, blå is- och snövägbana.

### Inbyggda kartkortet

Alla punkter är även `geo_location`-entiteter och kan visas på Home Assistants vanliga kartkort:

```yaml
type: map
geo_location_sources:
  - trafikverket_flow
  - trafikverket_road
  - trafikverket_weather
entities:
  - zone.home
```

## 5. Färdig dashboard

I [`dashboards/tv-flow-dashboard.yaml`](dashboards/tv-flow-dashboard.yaml) finns en komplett dashboard i sektionslayout som bara använder inbyggda kort och integrationens kartkort.

- **Märken** överst med väder, luft- och vägbanetemperatur, medelhastighet och väglag.
- **Stor trafikkarta** med mätpunkter, väglag och väderstationer.
- **Läget nu:** varningsruta som bara syns vid besvärligt väglag, rutor för hastighet och flöde, och en lista över de långsammaste mätpunkterna.
- **Väder vid vägen:** väderkort och rutor för luft, vägbana, vind, nederbörd, sikt och friktion.
- **Väglag:** sämsta väglag och en lista över besvärliga sträckor med varning och åtgärd.
- **Historik:** hastighet och temperaturer senaste dygnet, trafikflöde senaste veckan.
- **Datamängd:** hur mycket som hämtas och aktuella inställningar.

**Så lägger du till den:**

1. **Inställningar → Instrumentpaneler → Lägg till instrumentpanel → Ny instrumentpanel från grunden**, ge den t.ex. namnet *Trafik*.
2. Öppna den, klicka **✏️ Redigera → ⋮ → Rå konfigurationsredigerare**.
3. Ersätt allt med innehållet i `tv-flow-dashboard.yaml` och klicka **Spara**.

## 6. Entiteter

Entiteterna får fasta id:n oavsett språk. Lägger du till fler platser får de `_2`, `_3` osv.

| Entitet | Beskrivning |
|---|---|
| `sensor.tv_flow_flow_sites` | Antal mätpunkter i radien (har även hemposition och radie som attribut) |
| `sensor.tv_flow_total_flow` | Summa fordon/h |
| `sensor.tv_flow_average_speed` | Flödesviktad medelhastighet |
| `sensor.tv_flow_lowest_speed` | Lägsta medelhastighet bland mätpunkterna (köindikator) |
| `sensor.tv_flow_road_condition` | Sämsta väglaget i radien |
| `sensor.tv_flow_road_condition_count` | Antal sträckor med besvärligt väglag |
| `weather.tv_flow` | Lokalt väder från närmaste vägväderstation. Trafikverket mäter nederbördstyp men inte molnighet, så väderläget utan nederbörd är en uppskattning (dimma vid sikt < 1 km, annars växlande/mulet). |
| `sensor.tv_flow_air_temperature`, `_surface_temperature`, `_humidity`, `_wind_speed`, `_wind_direction`, `_precipitation`, `_precipitation_30min`, `_visibility`, `_grip` | Väder från närmaste station |
| `sensor.tv_flow_data_usage`, `sensor.tv_flow_response_size` | Diagnostik: hämtad datamängd |
| `geo_location.trafikflode_<id>` | En per mätpunkt (tillstånd = avstånd i km) |
| `geo_location.vaglag_*` | En per väglagssträcka |
| `geo_location.vaderstation_*` | En per väderstation |

Exempel på automation – varna för halka:

```yaml
trigger:
  - platform: state
    entity_id: sensor.tv_flow_road_condition
    to: "Is- och snövägbana"
action:
  - service: notify.mobile_app_telefon
    data:
      message: "Is- och snövägbana i närheten av hemmet."
```

## Felsökning

- **"Ogiltig API-nyckel"** – kontrollera att hela nyckeln är inklistrad. Om nyckeln senare slutar fungera ber Home Assistant automatiskt om en ny.
- **Inga mätpunkter** – det finns inga trafikflödesdetektorer inom radien. Öka radien eller välj en plats nära en större väg.
- **API-fel om fält** – stäng av "Hämta bara de fält som används".
- Debuglogg:

  ```yaml
  logger:
    logs:
      custom_components.trafikverket_map: debug
  ```

## Utveckling

`custom_components/trafikverket_map/parser.py` saknar beroenden till Home Assistant och testas med

```bash
python3 tests/test_parser.py
```

API-schemana (XSD) som integrationen bygger på finns i `docs/schemas/`.

## Licens

[CC BY-NC 4.0](LICENSE) – fri att använda, dela och ändra för icke-kommersiellt bruk med angivande av upphovsperson.
Data kommer från Trafikverket. Kartdata © OpenStreetMap-bidragsgivare.
