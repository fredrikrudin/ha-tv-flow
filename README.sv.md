# ha-tv-flow – Trafikverket Trafikkarta för Home Assistant

🇬🇧 [English](README.md) · 🇸🇪 **Svenska**

Custom integration för Home Assistant som hämtar **trafikflöden**, **väglag** och **vägväder** från Trafikverkets öppna API och visar dem på en karta runt ditt hem (eller valfri plats).

> **Obs!** Det här är ett fristående hobbyprojekt. Det är **inte** knutet till, godkänt av eller sponsrat av Trafikverket på något sätt. Vi uppskattar helt enkelt deras öppna API! 💚
>
> *This is an independent project, not affiliated with, endorsed by or sponsored by Trafikverket in any way. We just appreciate their open API!*

- 🚗 **Trafikflöden** (TrafficFlow 1.5) – mätpunkter färgade efter medelhastighet och storleksatta efter flöde (fordon/h), med detaljer per körfält och riktning.
- 🛣️ **Väglag** (RoadCondition 1.3) – vägsträckor ritade som linjer, färgade efter väglagskod, med varningar, orsak och åtgärd.
- 🧪 **Experimentellt:** olyckor, hinder och vägarbeten som ett eget lager på kartan.
- 🌡️ **Lokalt väder** (WeatherObservation 2.1) – närmaste vägväderstation som `weather`-entitet och sensorer (luft- och vägbanetemperatur, vind, nederbörd, sikt, friktion).
- 📍 **Valfri radie** runt hemmet eller en sökt ort.
- 📉 **Begränsad datamängd** – du väljer uppdateringsintervall, max antal objekt, vilka datatyper som hämtas och att bara nödvändiga fält skickas. Allt hämtas i **ett** anrop per intervall.
- 🛒 **Installeras via Marketplace** (Home Assistant 2026.11+) eller HACS.
- 📊 **Trafikwidgets** – trafikstatus med trend och graf, och valfri mätpunkt per riktning och körfält.
- 🗂️ **Automatisk dashboard** – välj ordning och innehåll i inställningarna.
- 🧭 **Installationsguide** i flera steg: API-nyckel → sök ort eller välj på karta → radie → datamängd.
- 🌍 **Svenska och engelska** – gränssnittet följer Home Assistants språk.

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
| `show_flow` / `show_road` / `show_weather` / `show_situations` | `true` | Ta med lagret alls |
| `show_road_works` | inställning | Visa vägarbeten (experimentella händelser). Utelämna för att följa inställningen *Visa vägarbeten på kartan*. |
| `event_markers` | inställning | `symbols` eller `text` för händelsemarkörer. Utelämna för att följa inställningen *Markörer för händelser*. |
| `legend` | `true` | Visa teckenförklaringen |
| `hidden` | – | Kategorier som är dolda från början, t.ex. `[speed:fast, road:1]` (se nedan) |
| `dark_mode` | – | `true`, `false` eller `auto`. Utelämna för att följa inställningen **Kartstil** under Konfigurera → Dashboard och karta. |
| `zoom_margin_km` | inställning | Marginal i km utanför radien i startvyn. Utelämna för att följa inställningen *Marginal runt området vid start*. |
| `tile_url` | OpenStreetMap | Egen kartserver |

Kartan startar inzoomad på **vald radie**. Vill du se lite mer av omgivningen anger du en marginal under **Konfigurera → Dashboard och karta → Marginal runt området vid start** (t.ex. 10 km). Knappen ⌖ under +/– (eller ett klick på hemmarkören) går tillbaka till samma vy, och kartan zoomar om automatiskt när du ändrar plats eller radie.

Kortet laddar kartbiblioteket Leaflet från `unpkg.com` och kartbilder från OpenStreetMap, så webbläsaren behöver internetåtkomst.

### Trafikläge nu – aktuell trafik i en blick

`custom:trafikverket-traffic-card` sammanfattar trafiken inom radien just nu:

- **Status** i färg: *Fritt flöde*, *Tät trafik* eller *Köbildning*, med hur många mätpunkter det gäller.
- **Medelhastighet, lägsta hastighet och totalt flöde**, med trendpil jämfört med för 30 minuter sedan (från historiken).
- En **stapel** som visar hur mätpunkterna fördelar sig på hastighetsklasserna (samma färger som kartan).
- En **hastighetsgraf** för de senaste timmarna.
- De **långsammaste mätpunkterna** med riktning, hastighet, flöde och avstånd. Klicka på en rad för detaljer.

```yaml
type: custom:trafikverket-traffic-card
title: Trafikläge nu
max_sites: 5        # antal långsammaste mätpunkter (0 = ingen lista)
hours: 3            # grafens längd i timmar (0 = ingen graf)
queue_speed: 30     # km/h – under detta räknas en mätpunkt som kö
slow_speed: 50      # km/h – under detta räknas en mätpunkt som tät trafik
# entry: <config_entry_id>
```

Statusen är en uppskattning: Trafikverket anger inte hastighetsgränser, så en mätpunkt på en 50-gata kan se ut som tät trafik i normal fart. Justera `queue_speed` och `slow_speed` efter dina vägar. Graf och trend kräver historiken (recorder, på som standard).

### Mätpunkt – en mätpunkt i detalj

`custom:trafikverket-site-card` visar en mätpunkt, till exempel på din pendlingsväg: hastighet och flöde totalt, och hastighet och flöde **per riktning och körfält**, med kövarning under `queue_speed`.

```yaml
type: custom:trafikverket-site-card
site_id: 1234       # utelämna för närmaste mätpunkt
title: Min pendling
# queue_speed: 30
```

Mätpunktens id syns i kartans popup-ruta (*Mätpunkt 1234*). Trafikverket har ofta ett id per riktning eller körfält på samma plats; mätpunkter inom 100 m från varandra visas som en punkt (t.ex. *Mätpunkt 1234 +3*) med alla körfält, och `site_id` kan vara vilket av dem som helst.

Båda korten finns också i sektionen **Trafikläge** i den automatiska dashboarden (andra plats som standard). Har du sparat en egen ordning lägger du till den under *Plats 1–8*.

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

### Experimentella funktioner

Under **Konfigurera → Experimentella funktioner** finns funktioner som fortfarande testas. De är avstängda som standard och kan ändras eller tas bort i kommande versioner.

| Funktion | Vad den gör |
|---|---|
| **Händelser på kartan** | Hämtar Trafikverkets trafikhändelser (Situation 1.6) inom radien och visar dem som lagret *Händelser* i kartkortet: 🔴 **olyckor**, 🟠 **hinder** och 🟤 **vägarbeten**. Klicka på en markör för rubrik, beskrivning, plats och tider. Sträckor ritas som streckade linjer. Sensorerna `sensor.tv_flow_accidents`, `_incidents` och `_road_works` skapas när funktionen är på. |
| **Visa vägarbeten på kartan** | På som standard. Stäng av för att bara visa olyckor och hinder (vägarbeten försvinner då även ur teckenförklaringen). |
| **Markörer för händelser** | *Symboler* (standard): färgad cirkel med en ikon – 🚗 olycka, 🛑 hinder, 👷 vägarbete. *Text*: färgad etikett med typen utskriven, t.ex. "Olycka", på gränssnittets språk. |

Lagret kan döljas i teckenförklaringen eller med `show_situations: false` på kortet. Om Trafikverket inte godtar frågan stängs bara händelserna av, och resten fortsätter fungera (se Felsökning).

### Välj vad som visas i teckenförklaringen

Klicka på en rad i **teckenförklaringen** för att dölja eller visa den kategorin på kartan. Dolda rader blir grå, och **Visa alla** återställer. Siffran till höger visar hur många objekt varje rad har. Rubriken *Teckenförklaring* fäller ihop eller ut rutan.

Valet sparas i webbläsaren per kort och plats, så kartan ser likadan ut nästa gång. Vill du ha ett annat utgångsläge för alla användare anger du `hidden:` på kortet med någon av dessa nycklar:

| Nyckel | Kategori |
|---|---|
| `speed:fast`, `speed:medium`, `speed:slow`, `speed:crawl`, `speed:unknown` | Mätpunkter ≥ 70, 50–70, 30–50, < 30 km/h, okänd |
| `road:1`, `road:2`, `road:3`, `road:4` | Väglag normalt, besvärligt, mycket besvärligt, is/snö |
| `event:Olycka`, `event:Hinder`, `event:Vägarbete` | Händelser (experimentellt) |
| `weather` | Väderstationer |

Exempel – visa bara köer och besvärligt väglag från början:

```yaml
type: custom:trafikverket-map-card
hidden: [speed:fast, speed:medium, road:1]
```

### Färger

- **Mätpunkter:** grön ≥ 70 km/h, gulgrön 50–70, orange 30–50, röd < 30, grå = okänd. Större cirkel = mer trafik.
- **Väglag:** grön normalt, gul besvärligt (risk för), röd mycket besvärligt, blå is- och snövägbana.
- **Händelser** (experimentellt): röd olycka, orange hinder, brun vägarbete.

### Kartpunkter på Home Assistants egen karta

Integrationen kan även skapa `geo_location`-entiteter för sina punkter, som Home Assistant visar på sin egen karta (panelen *Karta* och det inbyggda kartkortet). Välj hur under **Konfigurera → Dashboard och karta → Kartpunkter i Home Assistant**:

| Läge | Resultat |
|---|---|
| **Ikoner** (standard) | Varje punkt visas som en liten färgad symbol utan namn: hastighetsklass för mätpunkter, väglag för sträckor, vädersymbol för stationer och typ för händelser. |
| **Namn** | Home Assistants standardutseende – en cirkel med början av namnet (t.ex. *Väg 893 Bete*). |
| **Dolda** | Inga `geo_location`-entiteter skapas och befintliga tas bort. Ingenting syns på Home Assistants karta. |

Integrationens egna kort fungerar i alla tre lägena – de hämtar punkterna direkt från integrationen och är inte beroende av entiteterna. I läget *Dolda* visar ett klick på en punkt i korten popup-rutan men öppnar ingen entitetsdialog.

Med *Ikoner* eller *Namn* kan punkterna visas på Home Assistants vanliga kartkort:

```yaml
type: map
geo_location_sources:
  - trafikverket_flow
  - trafikverket_road
  - trafikverket_weather
  - trafikverket_situation   # experimentella händelser
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

**Ändra ordning och innehåll:** **Inställningar → Enheter och tjänster → Trafikverket Trafikkarta → Konfigurera → Dashboard och karta**. Välj vad som ska visas på *Plats 1–8*, eller *Visa inte* för att dölja en sektion. Där ställer du också in **kartstil** (standard OpenStreetMap, mörk eller följ temat), **marginal runt området vid start** och kartans höjd.

När du har sparat visar en öppen dashboard **"Instrumentpanelen har uppdaterats – Uppdatera"** efter några sekunder; klicka *Uppdatera* (eller ladda om sidan) för att bygga om den. Kartstil och marginal gäller direkt; ordning, sektioner och kartans höjd kräver uppdateringen. Sektionerna visas i exakt den valda ordningen, även om det ger en lucka bredvid den tvåspaltiga kartan eller historiken på breda skärmar.

Tillgängliga sektioner:

| Sektion | Innehåll |
|---|---|
| Vägöversikt | Kort sammanfattning: status, varför, vägbana, friktion, nederbörd, vind, varningar |
| Trafikläge | Trafikstatus, hastighet och flöde med trend, hastighetsklasser, hastighetsgraf, långsammaste mätpunkter och närmaste mätpunkt |
| Väder vid vägen | Väderkort och rutor för luft, vägbana, vind, fukt, nederbörd, sikt och friktion |
| Väglag | Sämsta väglag, antal besvärliga sträckor och en lista med varningar och åtgärder |
| Trafikkarta | Kartan med mätpunkter, väglag och väderstationer (två kolumner bred) |
| Läget nu | Varning vid besvärligt väglag, hastighet, flöde och de långsammaste mätpunkterna |
| Historik | Hastighet och temperaturer senaste dygnet, trafikflöde senaste veckan |
| Datamängd | Hämtad datamängd och aktuella inställningar |

Standardordningen är Vägöversikt → Trafikläge → Väder vid vägen → Väglag → Trafikkarta → Läget nu → Historik → Datamängd. Sektioner vars data är avstängd, till exempel väder, hoppas över automatiskt.

Har du flera platser lägger du till `entry: <config_entry_id>` under `strategy:`. Värdet finns som attributet `config_entry_id` på `sensor.tv_flow_flow_sites` (eller `_2` osv.).

Vill du ändra enskilda kort kan du välja **⋮ → Ta kontroll** i redigeringsläget. Då görs dashboarden om till vanlig YAML som du redigerar själv, men den följer inte längre inställningarna.

### Statisk dashboard

[`dashboards/tv-flow-dashboard.sv.yaml`](dashboards/tv-flow-dashboard.sv.yaml) innehåller samma dashboard som vanlig YAML på svenska, för den som vill redigera allt själv. Den engelska versionen är [`dashboards/tv-flow-dashboard.yaml`](dashboards/tv-flow-dashboard.yaml).

## 6. Entiteter

Sensorerna och väderentiteten får fasta id:n oavsett språk. Lägger du till fler platser får de `_2`, `_3` osv. Namnen på `geo_location`-entiteterna följer Home Assistants språk. `geo_location`-entiteterna finns bara när *Kartpunkter i Home Assistant* är *Ikoner* eller *Namn* (se ovan).

| Entitet | Beskrivning |
|---|---|
| `sensor.tv_flow_flow_sites` | Antal mätpunkter i radien (har även hemposition och radie som attribut) |
| `sensor.tv_flow_total_flow` | Summa fordon/h |
| `sensor.tv_flow_average_speed` | Flödesviktad medelhastighet |
| `sensor.tv_flow_lowest_speed` | Lägsta medelhastighet bland mätpunkterna (köindikator). Attributet `slowest_sites` listar de sex långsammaste mätplatserna (mätpunkts-id, etikett, hastighet, flöde, avstånd). |
| `sensor.tv_flow_road_condition` | Sämsta väglaget i radien. Enum-sensor: tillståndet är `normal`, `difficult`, `very_difficult`, `ice_snow` eller `no_data` och visas översatt. Attributet `state_text` innehåller den färdiga texten på Home Assistants språk. |
| `sensor.tv_flow_road_condition_count` | Antal sträckor med besvärligt väglag. Attributet `difficult_roads` listar upp till sex, värst först (väg, väglag, varning, åtgärd, plats, avstånd). |
| `weather.tv_flow` | Lokalt väder från närmaste vägväderstation. Trafikverket mäter nederbördstyp men inte molnighet, så väderläget utan nederbörd är en uppskattning (dimma vid sikt < 1 km, annars växlande/mulet). |
| `sensor.tv_flow_air_temperature`, `_surface_temperature`, `_humidity`, `_wind_speed`, `_wind_direction`, `_precipitation`, `_precipitation_30min`, `_visibility`, `_grip` | Väder från närmaste station. `_precipitation` är en enum-sensor: `no`, `rain`, `freezing_rain`, `snow`, `sleet` eller `yes`. |
| `sensor.tv_flow_data_usage`, `sensor.tv_flow_response_size` | Diagnostik: hämtad datamängd |
| `geo_location.trafikflode_<id>` | En per mätpunkt (tillstånd = avstånd i km). På engelska: `geo_location.traffic_flow_<id>`. |
| `geo_location.vaglag_*` | En per väglagssträcka (engelska: `road_condition_*`) |
| `geo_location.vaderstation_*` | En per väderstation (engelska: `weather_station_*`) |
| `geo_location.*` (händelser) | En per händelse när *Händelser på kartan* är påslaget, t.ex. `geo_location.road_works_vag_893_bete_0` |

Exempel på automation – varna för halka:

```yaml
trigger:
  - platform: state
    entity_id: sensor.tv_flow_road_condition
    to: ice_snow
action:
  - service: notify.mobile_app_telefon
    data:
      message: "Is- och snövägbana i närheten av hemmet."
```

## Språk

Gränssnittet finns på **svenska och engelska** och följer Home Assistants språk: svenska om Home Assistant är på svenska, annars engelska. Det gäller installationsguiden, inställningarna, sensorernas namn och tillstånd, kortens texter och den automatiska dashboarden. Byter du språk laddar du om sidan i webbläsaren.

Text som kommer direkt från Trafikverket, till exempel vägnamn, varningar, orsaker och händelsebeskrivningar, är alltid på svenska eftersom det är så den levereras.

> **Från v1.5.0** är `sensor.tv_flow_road_condition` och `sensor.tv_flow_precipitation` enum-sensorer. Har du automationer eller villkor som jämför med den gamla svenska texten, till exempel `to: "Is- och snövägbana"`, behöver du byta till nyckeln, här `to: ice_snow` (se tabellen ovan).

## Felsökning

- **"Ogiltig API-nyckel"** – kontrollera att hela nyckeln är inklistrad. Om nyckeln senare slutar fungera ber Home Assistant automatiskt om en ny.
- **Inga mätpunkter** – det finns inga trafikflödesdetektorer inom radien. Öka radien eller välj en plats nära en större väg.
- **Inget väder / tomma värden** – öppna `sensor.tv_flow_data_usage` → attribut. `errors` visar eventuella fel per datatyp från Trafikverket och `raw_counts` hur många poster som kom tillbaka. Ett fel i en datatyp stoppar inte de andra.
- **"Invalid query attribute …"** – godtar Trafikverket inte ett fält hämtas den datamängden automatiskt utan fältlista. Fungerar inte heller det stängs datamängden av, och resten fortsätter fungera. Se attributen `rejected_fields`, `fetched_without_field_list`, `disabled_data_sets` och `schema_overrides` på `sensor.tv_flow_data_usage`, och rapportera gärna som ett issue.
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
python3 tests/test_api_retry.py
python3 tests/test_dashboard_notify.py
python3 tests/test_mapdata.py
```

Korten hämtar kartpunkterna via websocket-kommandot `trafikverket_map/map_data` (valfritt `entry_id`). Det returnerar `{entry_id, fetched_at, items}`, där varje punkt ser ut som ett tillstånd i Home Assistant (`entity_id`, `state` = avstånd i km, `attributes` med `latitude`, `longitude`, `tv_type` och punktens data). `entity_id` är det riktiga `geo_location`-id:t när entiteten finns, annars `trafikverket_map.<nyckel>`.

API-schemana (XSD) som integrationen bygger på finns i `docs/schemas/`.

## Ändringslogg

Alla ändringar per version finns i [CHANGELOG.sv.md](CHANGELOG.sv.md) (engelska: [CHANGELOG.md](CHANGELOG.md)).

## Licens

[CC BY-NC 4.0](LICENSE) – fri att använda, dela och ändra för icke-kommersiellt bruk med angivande av upphovsperson.
Data kommer från Trafikverkets öppna API och används enligt Trafikverkets villkor. Kartdata © OpenStreetMap-bidragsgivare.

Projektet är inte knutet till, godkänt av eller sponsrat av Trafikverket. Namnet Trafikverket används bara för att beskriva var datan kommer ifrån.
