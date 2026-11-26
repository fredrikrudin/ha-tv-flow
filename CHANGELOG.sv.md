# Ändringslogg

🇬🇧 [English](CHANGELOG.md) · 🇸🇪 **Svenska**

Alla ändringar i **ha-tv-flow (Trafikverket Trafikkarta)** dokumenteras här.

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionsnumren följer [Semantic Versioning](https://semver.org/lang/sv/).
Nyaste versionen står överst. Varje release på GitHub har taggen `vX.Y.Z`.

## [Ej släppt]

## [1.8.3] – 2026-11-26

### Rättat
- Korten registreras först när Home Assistant startar, före kartpunkternas ikoner och websocket-gränssnittet. Ett problem i någon av dem kan inte längre hindra korten från att laddas ("Custom element doesn't exist").
- Schemabiblioteket (probatio eller voluptuous) hämtas nu från Home Assistants egen konfigurationsvalidering i stället för det som råkar vara installerat, så installationsguiden, inställningarna och websocket-gränssnittet alltid matchar den Home Assistant-version som körs.

## [1.8.2] – 2026-11-26

### Ändrat
- **Mätpunkter på samma plats slås ihop till en kartpunkt.** Trafikverket har ofta ett id per riktning eller körfält vid samma mätplats, vilket gav flera symboler ovanpå varandra. Mätpunkter inom 100 m från varandra blir nu en punkt – både på Home Assistants karta och i alla kort – med lägsta id:t och antalet sammanslagna (t.ex. *Trafikflöde 1234 +3*). Flödet summeras, hastigheten viktas efter flöde, och popup-rutan och kortet *Mätpunkt* visar alla körfält med sitt id.
- Kortet *Mätpunkt* hittar en sammanslagen plats via vilket av dess id som helst (`site_id`).
- `slowest_sites` listar mätplatser i stället för enskilda mätpunkter (nya nycklar `site_ids` och `label`).
- Gamla `geo_location`-entiteter för sammanslagna mätpunkter tas bort automatiskt.

## [1.8.1] – 2026-11-26

### Rättat
- **Alla kort visade "Custom element doesn't exist" efter uppdatering till 1.8.0.** Aktuella versioner av Home Assistant använder schemabiblioteket *probatio* i stället för *voluptuous*, som inte längre installeras. Websocket-gränssnittet från 1.8.0 importerade voluptuous, så integrationen kunde inte laddas – och därmed inga kort. Integrationen använder nu probatio (eller voluptuous i äldre versioner av Home Assistant).
- Installationsguiden och inställningarna hade samma beroende och använder nu samma reserv.
- Ett problem i websocket-gränssnittet kan inte längre stoppa integrationen från att laddas; korten använder då `geo_location`-entiteterna som reserv.

## [1.8.0] – 2026-11-26

### Tillagt
- **Kartpunkter i Home Assistant** (*Konfigurera → Dashboard och karta*): välj hur integrationens `geo_location`-entiteter (mätpunkter, väglagssträckor, väderstationer och händelser som `geo_location.road_works_…`) visas på Home Assistants egen karta:
  - **Ikoner** (ny standard) – små färgade symboler utan namnetiketter: hastighetsklass för mätpunkter, väglag för sträckor, vädersymbol för stationer och typ för händelser.
  - **Namn** – Home Assistants standardutseende med början av namnet.
  - **Dolda** – inga `geo_location`-entiteter skapas, och befintliga tas bort.
- Websocket-kommandot `trafikverket_map/map_data`, som korten använder för att hämta kartpunkterna direkt från integrationen.
- Attributet `slowest_sites` på `sensor.tv_flow_lowest_speed` och `difficult_roads` på `sensor.tv_flow_road_condition_count` (sparas inte i historiken).

### Ändrat
- Alla kort (karta, vägöversikt, trafikläge och mätpunkt) hämtar punkterna via websocket i stället för att läsa `geo_location`-entiteter, så de fungerar i alla tre lägena. Med äldre versioner av integrationen används entiteterna som reserv.
- Listorna i *Läget nu* i dashboarden (långsammaste mätpunkter, besvärliga sträckor) läser de nya sensorattributen i stället för `geo_location`-entiteter; de statiska dashboards är uppdaterade.
- Ett klick på en punkt i korten öppnar bara en entitetsdialog när entiteten finns.
- Kartpunkternas data byggs en gång per hämtning i en gemensam modul (`mapdata.py`) för både entiteterna och websocket.

## [1.7.0] – 2026-11-26

### Tillagt
- Kortet **Trafikläge nu** `custom:trafikverket-traffic-card`: trafikstatus (fritt flöde / tät trafik / köbildning), medelhastighet, lägsta hastighet och totalt flöde med trend jämfört med för 30 minuter sedan, fördelning på hastighetsklasser, hastighetsgraf från historiken och de långsammaste mätpunkterna.
- Kortet **Mätpunkt** `custom:trafikverket-site-card`: en mätpunkt (vald med `site_id` eller den närmaste) med hastighet och flöde per riktning och körfält, och kövarning.
- Ny sektion **Trafikläge** i den automatiska dashboarden (andra plats som standard) med båda korten; de statiska dashboarderna är uppdaterade. Dashboard-steget har nu *Plats 1–8*.

### Ändrat – prestanda
- Kartkortet och vägöversiktskortet räknar inte längre om vid varje tillståndsändring i Home Assistant. De uppdateras bara när integrationen har hämtat ny data (eller senast en gång i minuten), i stället för att gå igenom alla entiteter varje gång.
- Kartkortet uppdaterar markörer stegvis: bara markörer vars data ändrats ritas om, borttagna tas bort och resten lämnas orörda. Att dölja en kategori i teckenförklaringen ritar inte längre om kartan.
- Integrationen skriver bara om en `geo_location`-entitets tillstånd när dess data faktiskt har ändrats, vilket minskar antalet skrivningar och arbetet i Home Assistant vid varje hämtning.
- Korten registreras från en lista (`CARD_FILES`) i stället för en rad per fil.

## [1.6.2] – 2026-11-19

### Rättat
- **Ändrad ordning under *Konfigurera → Dashboard och karta* syntes inte.** Den genererade dashboarden använde `dense_section_placement`, som låter Home Assistant flytta sektioner för att fylla luckor – så skärmen följde inte *Plats 1–7*. Det är borttaget; sektionerna visas nu i exakt den valda ordningen (även i de statiska dashboarderna).
- **Ändrade inställningar syntes inte i en öppen dashboard.** Home Assistant bygger en genererad dashboard när sidan laddas. När du sparar inställningarna meddelar integrationen nu de dashboards som använder `custom:tv-flow` att de har ändrats (händelsen `lovelace_updated`), så att en öppen dashboard erbjuder *Uppdatera*.
- Sparad ordning från äldre versioner (t.ex. den borttagna sektionen "warnings" från 1.2.5) visas inte längre som ett tomt val i inställningarna.

### Tillagt
- Test för meddelandet till dashboarderna (`tests/test_dashboard_notify.py`).

## [1.6.1] – 2026-11-18

### Rättat
- Den råa tillståndsnyckeln (t.ex. `very_difficult`) kunde synas som text i varningen under *Läget nu* och i vägöversiktskortet, när Home Assistants översättning av enum-tillståndet inte fanns tillgänglig.

### Tillagt
- Attributet `state_text` på `sensor.tv_flow_road_condition` och `sensor.tv_flow_precipitation`: tillståndet som färdig text på Home Assistants språk. Korten och dashboarderna använder det i första hand, så de är inte längre beroende av gränssnittets översättning av enum-tillstånd.

## [1.6.0] – 2026-11-18

### Tillagt
- **Visa vägarbeten på kartan** (på som standard) under *Konfigurera → Experimentella funktioner*. Stäng av för att bara visa olyckor och hinder; vägarbeten försvinner då även ur teckenförklaringen.
- **Markörer för händelser: symboler eller text** under *Konfigurera → Experimentella funktioner*. *Symboler* (standard) visar en färgad cirkel med en ikon för olycka, hinder och vägarbete. *Text* visar en färgad etikett med typen utskriven på gränssnittets språk, t.ex. "Olycka" / "Accident".
- Kortalternativen `show_road_works` och `event_markers` som går före inställningarna för ett visst kort.

### Ändrat
- Händelsemarkörerna använder ikoner i stället för bokstäverna "!" och "V".

## [1.5.1] – 2026-11-18

### Rättat
- **`sensor.tv_flow_road_condition` blev *unavailable*** så fort en vägsträcka hade varningar. I Trafikverkets schema för RoadCondition kan `Warning`, `Cause`, `Measure` och `ConditionInfo` innehålla flera värden och kommer då som listor, vilket kraschade sensorns attribut. Värdena normaliseras nu: entiteter och kort får läsbar text (t.ex. "Halka, Snöfall"), och sensorns attribut `warnings` och `causes` listar varje värde en gång.
- Samma listor visas inte längre som `['Halka']` i kartans popup-rutor, vägöversiktskortet eller dashboardens listor.
- Textfälten för trafikhändelser (experimentellt) hanteras på samma sätt.

### Tillagt
- Regressionstest med väglagsfält som innehåller listor.

## [1.5.0] – 2026-11-16

### Tillagt
- **Engelska och svenska.** Hela gränssnittet följer Home Assistants språk: svenska om Home Assistant är på svenska, annars engelska. Det gäller installationsguiden, inställningarna, sensorernas namn och tillstånd, `geo_location`-entiteternas namn, kartkortet (teckenförklaring, popup-rutor, sidfot), vägöversiktskortet och den automatiska dashboarden.
- Statisk dashboard på båda språken: `dashboards/tv-flow-dashboard.yaml` (engelska) och `dashboards/tv-flow-dashboard.sv.yaml` (svenska). Båda genereras från den automatiska dashboarden så att de är identiska.
- README och ändringslogg på engelska (`README.md`, `CHANGELOG.md`). De svenska versionerna finns kvar som `README.sv.md` och `CHANGELOG.sv.md`.
- Attributen `condition_key` på väglagsentiteter och `message_type_text` på händelser.

### Ändrat
- ⚠️ **`sensor.tv_flow_road_condition` och `sensor.tv_flow_precipitation` är nu enum-sensorer.** Tillståndet är en språkoberoende nyckel som Home Assistant visar översatt: väglag `normal`, `difficult`, `very_difficult`, `ice_snow`, `no_data` och nederbörd `no`, `rain`, `freezing_rain`, `snow`, `sleet`, `yes`. **Automationer och villkor som jämför med den gamla svenska texten måste uppdateras**, t.ex. `to: "Is- och snövägbana"` → `to: ice_snow`.
- `geo_location`-entiteternas namn följer språket, så entitets-id:n kan ändras, t.ex. `geo_location.trafikflode_123` → `geo_location.traffic_flow_123` på engelska. Korten och dashboarderna påverkas inte.
- Alla kommentarer i källkoden och alla loggmeddelanden är nu på engelska.
- Text som kommer från Trafikverket (vägnamn, varningar, orsaker, händelsetexter) är fortfarande på svenska.

## [1.4.1] – 2026-11-15

### Rättat
- **Kartan startade ofta långt utzoomad.** I sektionsvyer skapas kortet ibland innan det har fått en storlek, och då räknade Leaflet fram zoomen mot en yta på 0×0. Nu anpassas kartan igen när kortet får sin storlek, så länge du inte själv har panorerat eller zoomat. Knappen ⌖ gör att kartan följer storleksändringar igen.

### Ändrat
- Kartan startar nu på **exakt vald radie**, med lite luft runt cirkeln. Tidigare var det radien + 10 km.
- Ny inställning **Marginal runt området vid start** (0–50 km, standard 0) under *Konfigurera → Dashboard och karta*. `zoom_margin_km` på kortet går fortfarande före.

### Dokumentation
- Ny notis i README och LICENSE om att projektet inte är knutet till, godkänt av eller sponsrat av Trafikverket. Vi uppskattar bara deras öppna API.

## [1.4.0] – 2026-11-14

### Tillagt
- **Valbar teckenförklaring i kartkortet.** Klicka på en rad för att dölja eller visa en kategori: hastighetsklasser för mätpunkter, väglagsklasser, händelsetyper och väderstationer. Varje rad visar antal objekt, dolda rader blir grå, *Visa alla* återställer och rubriken fäller ihop rutan.
- Valet sparas i webbläsaren per kort och plats.
- Kortalternativen `hidden:` (dolda kategorier från början) och `legend: false` (ingen teckenförklaring).
- Sidfoten visar hur många kategorier som är dolda.

### Ändrat
- Lagerväljaren uppe till höger är borttagen; teckenförklaringen ersätter den.

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

[Ej släppt]: https://github.com/fredrikrudin/ha-tv-flow/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.7.0
[1.6.2]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.6.2
[1.6.1]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.6.1
[1.6.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.6.0
[1.5.1]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.5.1
[1.5.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.5.0
[1.4.1]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.4.1
[1.4.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.4.0
[1.3.1]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.3.1
[1.3.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.3.0
[1.2.7]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.2.7
[1.2.6]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.2.6
[1.2.5]: https://github.com/fredrikrudin/ha-tv-flow/compare/58311e7...2aebc4c
[1.2.0]: https://github.com/fredrikrudin/ha-tv-flow/compare/7b2a0f0...58311e7
[1.1.0]: https://github.com/fredrikrudin/ha-tv-flow/releases/tag/v1.1.0
[1.0.0]: https://github.com/fredrikrudin/ha-tv-flow/compare/fdc1e45...4b625de
[1.0.0-beta]: https://github.com/fredrikrudin/ha-tv-flow/commit/fdc1e45
