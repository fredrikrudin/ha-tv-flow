# Ändringslogg

Alla ändringar i **ha-tv-flow (Trafikverket Trafikkarta)** dokumenteras här.

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionsnumren följer [Semantic Versioning](https://semver.org/lang/sv/).
Nyaste versionen står överst. Varje release på GitHub har taggen `vX.Y.Z`.

## [Ej släppt]

## [1.3.1] – 2026-11-14

### Rättat
- Uppstarten misslyckades med *"Situation does not contain schemaversion 1.5. Valid versions for Situation are 1.6"* när **Händelser på kartan** var påslaget. Situation använder nu schemaversion **1.6**.

### Ändrat
- Byter Trafikverket schemaversion igen väljer integrationen själv den version som felmeddelandet anger och hämtar på nytt. Versionen visas i attributet `schema_overrides` på `sensor.tv_flow_data_usage`.
- Andra fel som nämner en viss datamängd stänger bara av den datamängden, i stället för att hela uppstarten misslyckas.

## [1.3.0] – 2026-11-14

### Borttaget
- **Trafikvarningarna** är borttagna tills vidare: varningskortet `custom:trafikverket-warning-card`, sektionen *Varningar* i dashboarderna och sensorn `sensor.tv_flow_active_warnings`. Har du kvar kortet eller sensorn i en egen dashboard kan du ta bort dem.

### Tillagt
- Inställningssteget **Experimentella funktioner** under Konfigurera.
- Den experimentella funktionen **Händelser på kartan** (av som standard). Den visar trafikhändelser som lagret *Händelser* i kartkortet: röd för olyckor, orange för hinder och brun för vägarbeten. Andra händelsetyper visas inte. Teckenförklaringen får en rad för händelser när det finns några på kartan.

### Ändrat
- Trafikhändelser (Situation) hämtas bara när den experimentella funktionen är på. Inställningen *Hämta trafikhändelser* under datamängder är borttagen.
- Dashboard-steget har nu *Plats 1–7* igen.

## [1.2.7] – 2026-11-14

### Rättat
- Uppstarten misslyckades fortfarande, nu med *"För många ogiltiga fält i frågan"*. Trafikverket avvisade fler fält i frågan för trafikhändelser än vad omförsöken hann ta bort ett i taget.

### Ändrat
- Avvisar Trafikverket ett fält hämtas den datamängden i stället **utan fältlista** (hela objektet) från nästa försök. Det behövs högst ett extra anrop, och de andra datamängderna behåller sina begränsade fältlistor.
- Avvisas en datamängd även utan fältlista, till exempel på grund av filterfältet, **stängs den av** tills Home Assistant startas om. Trafik, väglag och väder fortsätter då att fungera, och felet visas i `errors`.
- `sensor.tv_flow_data_usage` har de nya attributen `fetched_without_field_list` och `disabled_data_sets`.

## [1.2.6] – 2026-11-14

### Rättat
- Uppstarten misslyckades med *"Invalid query attribute Situation.Deviation.Id"*. Fältet `Deviation.Id` finns inte i Situation 1.5 och är borttaget. Händelser får i stället ett stabilt id från situationens id.

### Ändrat
- Klienten rättar själv frågor med ogiltiga fält. Svarar Trafikverket *"Invalid query attribute X"* tas X bort och frågan körs om direkt. Det gäller både när hela anropet avvisas och när fel kommer per datamängd. Borttagna fält visas i attributet `rejected_fields` på `sensor.tv_flow_data_usage`.

### Tillagt
- Tester för uteslutna fält och omförsök (`tests/test_api_retry.py`).

## [1.2.5] – 2026-11-14

### Tillagt
- Datamängden **trafikhändelser** (Situation 1.5): olyckor, hinder, viktig trafikinformation, restriktioner, trafikmeddelanden och vägarbeten inom radien. Den kan slås av och på under datainställningarna.
- **Varningskortet** `custom:trafikverket-warning-card`. Det är dolt tills det finns en varning inom radien (en händelse eller en sträcka med besvärligt väglag) och visar då händelserna, allvarligast först, tillsammans med aktuella förhållanden från närmaste väderstation.
- Sensorerna `sensor.tv_flow_active_warnings`, `_incidents`, `_accidents` och `_road_works`.
- Lagret **Händelser** i kartkortet, med färgade markörer och sträckor (`show_situations`).
- Sektionen **Varningar** i den automatiska och den statiska dashboarden. Den döljs med ett synlighetsvillkor när det inte finns någon varning.

### Ändrat
- **Kartstil** har flyttats från *Datamängd och uppdateringsintervall* till *Konfigurera → Dashboard och karta*.
- Dashboard-steget har nu *Plats 1–8*.

### Känt problem
- Uppstarten misslyckas på grund av ett ogiltigt fält i frågan för trafikhändelser. Rättat i 1.2.6.

## [1.2.0] – 2026-11-14

### Tillagt
- **Vägöversikt**, kortet `custom:trafikverket-road-card`: färgad status som bygger på Trafikverkets väglag och en egen uppskattning av halkrisk, skälen till statusen (t.ex. rimfrostrisk, snöfall, låg friktion), vägbane- och lufttemperatur med daggpunkt, friktion, nederbörd, vind, varningar och de besvärligaste sträckorna.
- Sektionen **Vägöversikt** i den automatiska och den statiska dashboarden, först i standardordningen.
- Väderstationer har även attributet `water` (vatten på vägbanan).

### Ändrat
- Dashboarderna använder `dense_section_placement` så att sektionerna fyller ut raderna.

## [1.1.0] – 2026-11-13

### Tillagt
- **Automatisk dashboard** via strategin `custom:tv-flow`. Hela dashboarden byggs utifrån integrationens inställningar.
- Inställningssteget **Dashboard**: välj sektion eller *Visa inte* på varje plats, och ställ in kartans höjd.
- Stöd för flera platser i den automatiska dashboarden (`entry:`), med filtrering per plats.
- `sensor.tv_flow_flow_sites` har attributen `entity_ids`, `dashboard_sections` och `map_height`. De sparas inte i historiken.
- Filen `dashboards/tv-flow-strategy.yaml`.

## [1.0.0] – 2026-11-13

Första stabila versionen.

### Ändrat
- Ny ordning i den statiska dashboarden: Väder vid vägen → Väglag → Trafikkarta → Läget nu → Historik → Datamängd, med fyra kolumner på breda skärmar.
- Kartkortet startar utzoomat till inställd radie + 10 km (`zoom_margin_km`).

### Rättat
- **Vädret visades inte.** WeatherObservation innehåller alla observationer från de senaste sju dagarna, så frågan fick gamla mätningar som sedan filtrerades bort. Nu hämtas bara mätningar från den senaste timmen, nyast först (`$dateadd`, `orderby="Sample desc"`). Rättningen är verifierad mot ett riktigt API-svar.
- Alla väderstationer slogs ihop till en när id-fält saknades i svaret. Nu används namn och position som reserv.

### Tillagt
- Fel i en enskild datamängd stoppar inte de andra. Felen visas i attributet `errors` på `sensor.tv_flow_data_usage`.
- Knappen **⌖** och klick på hemmarkören zoomar tillbaka till området. Kartan zoomar också om automatiskt när plats eller radie ändras.
- Ett riktigt API-svar (Järvsö) som testfall.

## [1.0.0-beta] – 2026-11-13

Första publika versionen.

### Tillagt
- Custom integration för Home Assistant som hämtar **trafikflöden** (TrafficFlow 1.5), **väglag** (RoadCondition 1.3) och **vägväder** (WeatherObservation 2.1) från Trafikverkets öppna API inom valfri radie, i ett anrop per intervall.
- **Installationsguide**: API-nyckel (kontrolleras direkt), sök ort eller välj på karta (OpenStreetMap Nominatim), finjustera position och radie, datamängd och uppdateringsintervall.
- Begränsning av datamängden: uppdateringsintervall, max antal objekt, max ålder på mätningar, val av datamängder och "hämta bara nödvändiga fält" (INCLUDE).
- `geo_location`-entiteter för mätpunkter, väglagssträckor och väderstationer.
- Sammanfattande sensorer med fasta id:n (`sensor.tv_flow_*`) och väderentiteten `weather.tv_flow`.
- Kartkortet `custom:trafikverket-map-card` (Leaflet + OpenStreetMap). Mätpunkterna färgas efter hastighet och storleken visar flödet, väglaget ritas som linjer och väderstationerna visar temperatur.
- Inställningen **Kartstil**: standard OpenStreetMap, mörk eller följ temat.
- Färdig statisk dashboard (`dashboards/tv-flow-dashboard.yaml`).
- README med installation via Marketplace (Home Assistant 2026.11+), HACS och manuellt.
- Licens CC BY-NC 4.0.

[Ej släppt]: https://github.com/fredrikrudin/ha-tv-flow/compare/v1.3.1...HEAD
[1.3.1]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.3.1
[1.3.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.3.0
[1.2.7]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.2.7
[1.2.6]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.2.6
[1.2.5]: https://github.com/fredrikrudin/ha-tv-flow/compare/58311e7...2aebc4c
[1.2.0]: https://github.com/fredrikrudin/ha-tv-flow/compare/7b2a0f0...58311e7
[1.1.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.1.0
[1.0.0]: https://github.com/fredrikrudin/ha-tv-flow/compare/fdc1e45...4b625de
[1.0.0-beta]: https://github.com/fredrikrudin/ha-tv-flow/commit/fdc1e45
