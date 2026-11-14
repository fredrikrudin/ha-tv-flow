# ha-tv-flow – Trafikverket Trafikkarta för Home Assistant

Custom integration för Home Assistant som hämtar **trafikflöden**, **väglag** och **vägväder** från Trafikverkets öppna API och visar dem på en karta runt ditt hem (eller valfri plats).

- 🚗 **Trafikflöden** (TrafficFlow 1.5) – mätpunkter färgade efter medelhastighet och storleksatta efter flöde (fordon/h), med detaljer per körfält och riktning.
- 🛣️ **Väglag** (RoadCondition 1.3) – vägsträckor ritade som linjer, färgade efter väglagskod, med varningar, orsak och åtgärd.
- 🚨 **Trafikhändelser** (Situation 1.5) – olyckor, hinder, viktig trafikinformation, restriktioner och vägarbeten på kartan, och ett varningskort som bara syns när något har hänt.
- 🌡️ **Lokalt väder** (WeatherObservation 2.1) – närmaste vägväderstation som `weather`-entitet och sensorer (luft- och vägbanetemperatur, vind, nederbörd, sikt, friktion).
- 📍 **Valfri radie** runt hemmet eller en sökt ort.
- 📉 **Begränsad datamängd** – du väljer uppdateringsintervall, max antal objekt, vilka datatyper som hämtas och att bara nödvändiga fält skickas. Allt hämtas i **ett** anrop per intervall.
- 🛒 **Installeras via Marketplace** (Home Assistant 2026.11+) eller HACS.
- 🗂️ **Automatisk dashboard** – välj ordning och innehåll i inställningarna.
- 🧭 **Installationsguide** i flera steg: API-nyckel → sök ort eller välj på karta → radie → datamängd.

---

## 1. Skaffa en API-nyckel (gratis)

1. Gå till <https://api.trafikinfo.trafikverket.se/> och klicka **Logga in / Registrera**.
2. Skapa ett konto och bekräfta e-postadressen.
3. Logga in, gå till **Mina nycklar** och skapa en ny nyckel.
4. Kopiera nyckeln – den klistras in i steg 1 i installationsguiden.

## 2. Installera integrationen

### Alternativ A – Marketplace (Home Assistant 2026.11 och senare, rekommenderas)

1. Gå till **Inställningar → Marketplace**.
2. Välj **Lägg till från länk** (*Add from link*) uppe till höger.
3. Ange `fredrikrudin/ha-tv-flow` (eller hela GitHub-adressen) och välj **Lägg till**. Frågar den efter typ väljer du **Integration**.
4. Installera **Trafikverket Trafikkarta** och starta om Home Assistant (via reparationen under **Inställningar → System → Reparationer**).
5. Fortsätt med installationsguiden nedan.

Första gången kräver Marketplace att du godkänner en riskinformation och kopplar ett GitHub-konto.

### Alternativ A2 – HACS (äldre Home Assistant än 2026.11)

1. Öppna **HACS** → menyn (⋮) → **Custom repositories**.
2. Lägg till `https://github.com/fredrikrudin/ha-tv-flow` med typen **Integration**.
3. Sök efter **Trafikverket Trafikkarta**, klicka **Download** och starta om Home Assistant.

Uppgraderar du senare till 2026.11 flyttas installationen automatiskt över till Marketplace.

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
| 4. Datamängd | Uppdateringsintervall, vilka datatyper som hämtas, väderradie, max antal objekt, max ålder på mätningar och "hämta bara nödvändiga fält". |

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
| Trafikhändelser | på | Olyckor, hinder, vägarbeten m.m. Behövs för varningskortet. |

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
| `show_flow` / `show_road` / `show_weather` / `show_situations` | `true` | Visa/dölj lager |
| `dark_mode` | – | `true`, `false` eller `auto`. Utelämna för att följa inställningen **Kartstil** under Konfigurera → Dashboard och karta. |
| `zoom_margin_km` | `10` | Startvyn visar inställd radie plus så här många km runt hemmet |
| `tile_url` | OpenStreetMap | Egen kartserver |

Kartan startar utzoomad till inställd radie + 10 km (t.ex. 20 km runt hemmet vid 10 km radie), så att hela området och lite omgivning syns. Knappen ⌖ under +/– (eller ett klick på hemmarkören) går tillbaka till samma vy, och kartan zoomar om automatiskt när du ändrar plats eller radie.

Kortet laddar kartbiblioteket Leaflet från `unpkg.com` och kartbilder från OpenStreetMap, så webbläsaren behöver internetåtkomst.

### Varningskort – syns bara vid varning

`custom:trafikverket-warning-card` är dolt så länge allt är lugnt. Det dyker upp när det finns en **olycka, ett hinder, viktig trafikinformation, en restriktion eller ett trafikmeddelande**, eller en **sträcka med besvärligt väglag**, inom din radie.

- Överst visas den allvarligaste händelsen, till exempel *Olycka på Väg 83*, och hur många händelser och sträckor som finns.
- Under den listas händelserna, allvarligast först, med rubrik, beskrivning, plats, påverkan, tillfällig begränsning, hur länge den pågått och avstånd.
- Längst ned visas aktuella förhållanden från närmaste väderstation: vägbana, luft, friktion, nederbörd och vind. Minusgrader och låg friktion markeras.

```yaml
type: custom:trafikverket-warning-card
# types: [Olycka, Hinder, Viktig trafikinformation, Restriktion, Trafikmeddelande]
# include_road_conditions: true   # varna även för besvärligt väglag
# include_road_works: false       # ta med vägarbeten
# min_severity: 0                 # 1–5, ignorera händelser med lägre påverkan
# max_items: 5
# show_conditions: true
# show_when_empty: false          # true = visa "Inga trafikvarningar" i stället för att dölja
```

Kortet döljer sig självt. I en sektionsvy kan du dessutom dölja hela sektionen med villkoret `sensor.tv_flow_active_warnings` över 0, så att ingen tom plats blir kvar. Både den automatiska och den statiska dashboarden gör så.

`sensor.tv_flow_active_warnings`, `sensor.tv_flow_accidents`, `sensor.tv_flow_incidents` och `sensor.tv_flow_road_works` kan också användas i automationer:

```yaml
trigger:
  - platform: numeric_state
    entity_id: sensor.tv_flow_accidents
    above: 0
action:
  - service: notify.mobile_app_telefon
    data:
      message: "Olycka i närheten: {{ state_attr('sensor.tv_flow_active_warnings', 'top_header') }}"
```

### Vägöversikt – kort sammanfattning

`custom:trafikverket-road-card` visar det viktigaste om väglaget på ett ställe:

- **Status** i färg: normalt, risk för halka, mycket besvärligt eller is/snö. Statusen bygger på det sämsta av Trafikverkets väglag inom radien och en egen uppskattning från närmaste väderstation.
- **Varför:** till exempel *Vägbanan under 0 °C*, *Daggpunkt över vägbanans temperatur – risk för rimfrost*, *Snöfall* eller *Friktion dålig*.
- **Mätvärden:** vägbanetemperatur, lufttemperatur med daggpunkt, friktion (bra/måttlig/dålig), nederbörd och vind med byar.
- **Varningar och orsaker** från Trafikverket, och de besvärligaste sträckorna närmast dig.

```yaml
type: custom:trafikverket-road-card
title: Väglag nu
max_roads: 3        # antal besvärliga sträckor i listan (0 = ingen lista)
# entry: <config_entry_id>   # vid flera platser
```

Klicka på statusraden eller en sträcka för att öppna detaljerna. Uppskattningen är en hjälp och ersätter inte Trafikverkets bedömning eller egen uppmärksamhet. Friktionsklasserna är ungefärliga: bra ≥ 0,5, måttlig 0,35–0,5, dålig 0,25–0,35, mycket halt < 0,25.

Kortet finns också som sektionen **Vägöversikt** i den automatiska dashboarden, och ligger först i standardordningen.

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

### Automatisk dashboard (rekommenderas)

Integrationen kan bygga hela dashboarden åt dig. Du väljer ordning och innehåll i inställningarna, så behöver du aldrig redigera YAML.

1. **Inställningar → Instrumentpaneler → Lägg till instrumentpanel → Ny instrumentpanel från grunden**, ge den t.ex. namnet *Trafik*.
2. Öppna den och välj **✏️ Redigera → ⋮ → Rå konfigurationsredigerare**.
3. Ersätt allt med:

   ```yaml
   strategy:
     type: custom:tv-flow
     title: Trafik
   ```

4. Klicka **Spara**.

**Ändra ordning och innehåll:** **Inställningar → Enheter och tjänster → Trafikverket Trafikkarta → Konfigurera → Dashboard och karta**. Välj vad som ska visas på *Plats 1–8*, eller *Visa inte* för att dölja en sektion. Där ställer du också in **kartstil** (standard OpenStreetMap, mörk eller följ temat) och kartans höjd. Ladda sedan om dashboarden i webbläsaren.

Tillgängliga sektioner:

| Sektion | Innehåll |
|---|---|
| Varningar | Varningskortet – syns bara vid olycka, hinder m.m. eller besvärligt väglag |
| Vägöversikt | Kort sammanfattning: status, varför, vägbana, friktion, nederbörd, vind, varningar |
| Väder vid vägen | Väderkort och rutor för luft, vägbana, vind, fukt, nederbörd, sikt och friktion |
| Väglag | Sämsta väglag, antal besvärliga sträckor och en lista med varningar och åtgärder |
| Trafikkarta | Kartan med mätpunkter, väglag och väderstationer (två kolumner bred) |
| Läget nu | Varning vid besvärligt väglag, hastighet, flöde och de långsammaste mätpunkterna |
| Historik | Hastighet och temperaturer senaste dygnet, trafikflöde senaste veckan |
| Datamängd | Hämtad datamängd och aktuella inställningar |

Standardordningen är Varningar → Vägöversikt → Väder vid vägen → Väglag → Trafikkarta → Läget nu → Historik → Datamängd. Sektioner vars data är avstängd, till exempel väder, hoppas över automatiskt.

Har du flera platser lägger du till `entry: <config_entry_id>` under `strategy:`. Värdet finns som attributet `config_entry_id` på `sensor.tv_flow_flow_sites` (eller `_2` osv.).

Vill du ändra enskilda kort kan du välja **⋮ → Ta kontroll** i redigeringsläget. Då görs dashboarden om till vanlig YAML som du redigerar själv, men den följer inte längre inställningarna.

### Statisk dashboard

[`dashboards/tv-flow-dashboard.yaml`](dashboards/tv-flow-dashboard.yaml) innehåller samma dashboard som vanlig YAML, för den som vill redigera allt själv.

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
- **Inget väder / tomma värden** – öppna `sensor.tv_flow_data_usage` → attribut. `errors` visar eventuella fel per datatyp från Trafikverket och `raw_counts` hur många poster som kom tillbaka. Ett fel i en datatyp stoppar inte de andra.
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
