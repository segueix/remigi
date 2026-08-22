# AGENT — Pla de fases del Rummikub

Document de treball per a l'agent. Defineix **totes les fases** del projecte, en
l'ordre en què s'han de fer, amb les tasques, els criteris per donar cada fase
per acabada i un registre de problemes. **Aquest document és l'estat de la
veritat del projecte**: mira'l abans de començar cap feina i actualitza'l en
acabar-la.

## Protocol de treball de l'agent

1. **Abans de començar**: llegeix aquest document i localitza la primera fase
   que no estigui `✅ Feta`. Treballa **una fase a la vegada**, en ordre, tret
   que l'usuari digui expressament una altra cosa.
2. **Mentre treballes**: marca les caselles de tasca (`[ ]` → `[x]`) a mesura
   que les completis i posa la fase `🔄 En curs`.
3. **Per tancar una fase**: han de complir-se **tots els criteris d'acceptació**
   (executa les ordres indicades i comprova-les de debò). Llavors posa la fase
   `✅ Feta` amb la data.
4. **Problemes**: qualsevol entrebanc (bug, decisió no prevista, limitació,
   canvi de pla) s'apunta a l'apartat *Problemes trobats* de la fase, amb el
   format: `- [data] Problema — com s'ha resolt (o per què queda pendent)`.
   Si un problema es deixa per més endavant, afegeix-lo també com a tasca a la
   fase que toqui.
5. **Cada lliurament**: `npm run typecheck` i `npm test` en verd, commit amb
   missatge descriptiu **que inclogui l'actualització d'aquest AGENT.md**, i
   push a la branca de treball indicada per la sessió.
6. **Regles del repositori** (no negociables sense parlar-ho amb l'usuari):
   - `packages/core` es manté **pur**: sense dependències de navegador ni d'UI;
     tot estat immutable i serialitzable; l'única API pública és `src/index.ts`
     (i `persistence/jsonFileStore.ts` importat a banda, perquè depèn de Node).
   - Les capes només depenen en aquesta direcció:
     `core ← ai ← adaptive ← (persistence, cli, web)`.
   - Identificadors de codi en anglès; comentaris, docs, missatges d'error i UI
     en **català**.
   - Documentació de referència: `docs/ARQUITECTURA.md`, `docs/REGLES.md`,
     `docs/IA-ADAPTATIVA.md`. Si una fase canvia el que hi diu, actualitza-les.

## Estat general

| Fase | Nom | Estat |
|---|---|---|
| 1 | Estructura i motor del joc | ✅ Feta (2026-08-22, reverificada 2026-08-22) |
| 2 | Esquelet de l'aplicació web | ✅ Feta (2026-08-22) |
| 3 | Pantalla de partida jugable | ✅ Feta (2026-08-22) |
| 4 | Cicle adaptatiu complet a la web | ✅ Feta (2026-08-22) |
| 5 | Experiència d'usuari i polit | ✅ Feta (2026-08-22) |
| 6 | Motor avançat (solver òptim i regles pendents) | ✅ Feta (2026-08-22) |
| 7 | Desplegament | ✅ Feta (2026-08-22) |

Llegenda: `⬜ Pendent` · `🔄 En curs` · `✅ Feta (data)` · `⏸️ Aturada (motiu)`

---

## Fase 1 — Estructura i motor del joc

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: monorepo amb el motor complet del Rummikub a `packages/core`,
independent de la interfície, amb IA per nivells i sistema adaptatiu, tot provat.

### Tasques

- [x] Monorepo npm workspaces (`packages/*`, `apps/*`), TypeScript estricte.
- [x] Regles completes a `src/core/`: 106 fitxes amb id únic, grups i escales
      amb jokers, sortida inicial de 30 punts, reordenació de taula, robar i
      passar, partida bloquejada, puntuació final. Errors com a `RulesError`
      amb codi estable i missatge en català.
- [x] Estat immutable (`applyMove` retorna estat nou) i RNG amb llavor.
- [x] IA a `src/ai/`: un sol cercador de jugades (`solver.ts`) i 5 nivells
      parametritzats (`difficulty.ts`): novell, fàcil, mitjà, avançat, expert.
- [x] Sistema adaptatiu a `src/adaptive/`: perfil amb Elo (K decreixent),
      historial, i `suggestOpponents` per triar 1–3 rivals segons l'habilitat.
- [x] Persistència a `src/persistence/`: interfície `KeyValueStore`,
      `MemoryStore`, `JsonFileStore` (Node) i `ProfileRepository`.
- [x] Simulador IA contra IA (`npm run simulate`) amb invariant de conservació.
- [x] Docs en català a `docs/`.
- [x] **Cobertura de tota l'API pública** (74 tests): a més de fitxes, jugades,
      partida, solver i sistema adaptatiu, també `core/board.ts`,
      `core/scoring.ts`, `ai/difficulty.ts`, `ai/aiPlayer.ts` (errors "humans"
      amb RNG controlat), la capa `persistence/` sencera (bateria comuna per a
      qualsevol `KeyValueStore`, `JsonFileStore` sobre disc i
      `ProfileRepository`) i el contracte de `src/index.ts`.

### Criteris d'acceptació (verificats)

- `npm run typecheck` i `npm test` en verd. ✔ (74/74, reverificat 2026-08-22)
- `npm run simulate -- --games 100` acaba sempre i ordena els nivells. ✔
  (Expert 59%, Mitjà 39%, Novell 2%; ~95 torns/partida)

### Problemes trobats

- [2026-08-22] L'script arrel `npm run simulate` no reenviava els arguments: el
  `npm` intermedi es menjava `--games` — resolt afegint `--` final a l'script
  de l'arrel (`npm run simulate -w @rummikub/core --`).
- [2026-08-22] El cercador d'escales només feia servir jokers per omplir
  **forats interns** (extrems sempre reals): un test suposava que també
  allargava extrems amb joker. Es va ajustar el test a l'heurística
  documentada, i la millora es va fer a la **Fase 6**, on els jokers ja poden
  anar també als extrems.
- [2026-08-22] **Buit de cobertura**: en reverificar la fase es va detectar que
  `core/board.ts`, `ai/difficulty.ts` i tota la capa `persistence/` eren API
  pública **sense cap test**. Resolt afegint-ne (38 → 74 tests).
- [2026-08-22] **Bug de puntuació** (el va destapar un dels tests nous):
  `finalScores` feia `totalPending - 2 * pending[guanyador]`, de manera que en
  una **partida bloquejada** el guanyador es penalitzava les seves pròpies
  fitxes i el marcador **no sumava zero** (una partida d'exemple donava −36).
  En victòria neta no es notava, perquè el guanyador té 0 fitxes. Resolt:
  `totalPending - pending[guanyador]`, que deixa igual la victòria neta,
  quadra el bloqueig i alinea el codi amb el que ja deia `docs/REGLES.md`.
  S'hi ha afegit l'invariant «la puntuació sempre suma zero» com a test.

---

## Fase 2 — Esquelet de l'aplicació web

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: `apps/web` arrenca amb Vite + React + TypeScript, importa
`@rummikub/core` del workspace i té la navegació i la persistència de base.
Encara sense partida jugable: només l'esquelet sòlid on penjar les fases 3 i 4.

### Tasques

- [x] Crear `apps/web` (Vite 8 + React 19 + TypeScript), paquet `@rummikub/web`,
      amb `@rummikub/core` com a dependència de workspace.
- [x] Comprovar que Vite resol el paquet core (el seu `main` apunta a font
      `.ts`): **funciona sense àlies ni `optimizeDeps`** — risc descartat.
- [x] `LocalStorageStore` implementant `KeyValueStore`, amb `createWebStore()`
      que comprova de debò si es pot escriure i degrada a `MemoryStore` si no.
- [x] Estructura de pantalles i navegació mínima (estat a `App.tsx`, sense
      router): **Inici**, **Partida**, **Estadístiques**.
- [x] Pàgina d'inici funcional: demana/recorda el nom i crea el perfil amb
      `ProfileRepository` sobre l'emmagatzematge del navegador.
- [x] Prova de fum del motor a la UI: `createGame` real, amb els jugadors, les
      fitxes de cadascun, el nivell dels bots i el sac.
- [x] Scripts a l'arrel (`dev`, `build`, `preview`); READMEs actualitzats.
- [x] 7 tests de l'adaptador d'emmagatzematge, inclosa la degradació i la
      persistència del perfil «entre recàrregues».

### Criteris d'acceptació (verificats)

- `npm install` net des de zero (esborrant `node_modules` i el lockfile);
  `npm run typecheck` i `npm test` en verd. ✔ (74 core + 7 web)
- `npm run build -w @rummikub/web` compila sense errors. ✔ (198 kB, 63 kB gzip)
- `npm run dev` mostra la pantalla d'inici; en recarregar, el nom del jugador
  es conserva. ✔ Verificat amb Chromium (Playwright): perfil desat i recuperat,
  motor repartint 14 fitxes a 3 jugadors i 64 al sac, sense errors de consola
  ni desbordament horitzontal a 390 px.

### Problemes trobats

- [2026-08-22] `defineConfig` importat de `vite` no accepta l'apartat `test` i
  el typecheck fallava (TS2769) — resolt important-lo de `vitest/config`.
- [2026-08-22] **Conflicte de versions de vitest**: el core anava amb vitest 2,
  que porta Vite 5 a dins, i la web necessita Vite 8. Tenir-hi dues versions
  majors del mateix runner era demanar problemes, així que s'ha unificat tot el
  monorepo a **vitest 4**. Els 74 tests del core hi passen sense cap canvi.
- [2026-08-22] Risc que hi havia apuntat sobre la resolució de `@rummikub/core`
  amb font TypeScript: **no s'ha materialitzat**. Vite el transpila com a codi
  del projecte a través de l'enllaç de workspace, tant en `dev` com en `build`.
  El risc queda tancat a la llista de sota.

---

## Fase 3 — Pantalla de partida jugable

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: es pot jugar una partida sencera al navegador contra 1, 2 o 3
bots, amb totes les regles aplicades pel motor.

### Tasques

- [x] Components de fitxa, jugada, taula i faristol, amb colors i valors reals
      (`COLOR_LABELS` per als textos d'accessibilitat).
- [x] Interacció per **seleccionar i col·locar** (clic): tries una fitxa i cliques
      on la deixes. `insertSmart` la posa a la posició que fa vàlida la jugada.
      L'arrossegar i deixar anar queda per a la Fase 5, com preveia el pla.
- [x] Còpia de treball del torn (`turnDraft.ts`, funcions pures); «Acabar jugada»
      envia la taula sencera a `applyMove` dins d'un `try/catch`.
- [x] Missatge del `RulesError` en català i botó «Desfer canvis».
- [x] Botó «Robar fitxa», que passa a dir «Passar torn» amb el sac buit.
- [x] Torns dels bots amb `decideAiMove` i pausa (`VITE_BOT_DELAY`, 900 ms per
      defecte), amb el jugador actiu ressaltat i animació a les fitxes que
      acaba de baixar.
- [x] Final de partida amb `finalScores`, guanyador, avís si ha estat bloqueig i
      botó de partida nova.
- [x] Selector a Inici: nombre d'oponents (1–3) i nivell de cadascun.
- [x] Ordenació del faristol (per número o per color), que el pla situava a la
      Fase 5 però surt gairebé de franc i fa la partida molt més còmoda.
- [x] 22 tests de la lògica del torn + checklist manual a `apps/web/README.md`.

### Criteris d'acceptació (verificats)

- Partida completa jugable contra 1, 2 i 3 bots sense errors de consola. ✔
  Verificat amb Chromium: les tres partides arriben al final i mostren la
  puntuació de tothom.
- És impossible fer trampes des de la UI. ✔ Verificat un per un: sortida inicial
  de 9 punts → *«la sortida inicial demana 30 punts i n'has jugat 9»*; jugada
  d'una sola fitxa → *«una jugada necessita com a mínim 3 fitxes»*; i una fitxa
  que ja era a la taula no es pot endur al faristol.
- La partida sempre pot acabar. ✔ Les tres partides de prova han acabat per
  bloqueig amb el sac buit, i el marcador suma zero (+420 −121 −299).
- `typecheck`, `test` i `build` en verd. ✔ (74 core + 22 web; 212 kB, 67 kB gzip)

### Problemes trobats

- [2026-08-22] El botó «+ Jugada nova» portava la classe `meld`, així que
  comptava com una jugada més: en col·locar-hi fitxes, cadascuna anava a una
  jugada nova en comptes d'ajuntar-se. Ho va destapar la prova de fer una
  sortida inicial vàlida al navegador. Resolt separant-lo (`new-meld` sol): no
  és una jugada, és el botó per crear-ne una.
- [2026-08-22] Els efectes de React s'executen dues vegades en mode estricte i
  el bot podia jugar dos cops el mateix torn. Resolt amb el `clearTimeout` del
  cleanup i una comprovació dins de `setGame`, que és qui té l'estat de debò.
- [2026-08-22] En treure una fitxa d'una jugada que es queda buida, la jugada
  desapareix i les següents es desplacen, així que l'índex de destinació que
  venia de la interfície ja no assenyalava el mateix lloc. Detectat escrivint
  els tests de `moveTile`; resolt amb `adjustIndex` i cobert amb un test propi.

### Limitacions conegudes (per a fases següents)

- `insertSmart` tria la primera posició que fa vàlida la jugada, que no sempre
  és la que l'usuari vol en casos ambigus. L'arrossegar i deixar anar de la
  Fase 5 donarà control exacte.
- ~~La `key` de cada jugada depèn de les seves fitxes~~ — **resolt a la Fase 5**:
  ara la clau és la posició, així afegir una fitxa a una jugada ja no en torna a
  muntar el component ni s'endú l'animació.

---

## Fase 4 — Cicle adaptatiu complet a la web

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: la dificultat s'adapta de debò a l'experiència del jugador: el
perfil viu al navegador, es proposa la partida segons l'Elo i cada resultat
l'actualitza.

### Tasques

- [x] A Inici, mode «Oponents automàtics» per defecte: `suggestOpponents`
      tria els nivells segons el perfil i `describeSuggestion` ho explica;
      «Prefereixo triar-los jo» passa a manual partint de la proposta.
- [x] En acabar cada partida, `useRecordResult` la registra **una sola vegada**
      amb els nivells realment jugats i la desa de seguida; el resultat mostra
      com ha canviat l'habilitat (p. ex. «1100 → 1070 (−30)»).
- [x] Pantalla d'Estadístiques: habilitat, partides, victòries i percentatge;
      gràfic d'evolució i historial complet (rivals, resultat, data).
- [x] Reiniciar el perfil amb confirmació en dos passos (`reset()` al hook).
- [x] Tests d'integració del cicle amb `MemoryStore`, inclosa una partida jugada
      de debò pel motor de punta a punta (7 tests nous, 29 en total a la web).

### Criteris d'acceptació (verificats)

- Dues partides seguides mouen l'habilitat i el canvi es conserva en tancar i
  reobrir. ✔ Verificat amb Chromium: 1100 → 1070 → 1041, amb les dues partides
  a l'historial i els rivals que s'havien jugat de debò.
- La proposta puja amb l'habilitat. ✔ Amb un perfil nou proposa «Novell, Fàcil»
  («Fàcil» amb un sol rival); posant l'habilitat a 1600 passa a «Avançat,
  Expert» («Expert» amb un sol rival).
- `typecheck`, `test` i `build` en verd. ✔ (74 core + 29 web; 218 kB, 69 kB gzip)
- Extra: el gràfic i l'historial aguanten 24 partides sense desbordar ni estirar
  la pàgina, i es poden recórrer amb el teclat.

### Problemes trobats

- [2026-08-22] El criteri deia que un perfil nou (1100) hauria de proposar
  «fàcil/mitjà», però amb **dos** rivals proposa **Novell i Fàcil**: 1100 queda
  just entre Fàcil (1000) i Mitjà (1200), i l'empat es resol cap avall (decisió
  ja documentada als riscos), i a sobre amb dos rivals la regla és «un per sota
  i un al nivell». No s'ha tocat: fa que les primeres partides siguin planeres i
  el jugador pugi de pressa, que és el que es vol en començar. Si es prefereix
  que estiguin igualades des del primer moment, la regla a canviar és la de dos
  rivals a `suggestOpponents` (passar de `[main-1, main]` a `[main, main+1]`).
- [2026-08-22] El perfil canvia d'identitat a cada render, així que posar-lo a
  les dependències de l'efecte que registra el resultat el feia córrer sense
  parar. Resolt llegint-lo per referència, de manera que l'efecte només depèn
  de la partida; el registre queda blindat, a més, per l'estat ja comptat.
- [2026-08-22] Els colors d'accent de la interfície no passen els controls de la
  guia de visualització com a color de dades (en tema clar la croma queda per
  sota del mínim i en fosc la lluminositat se'n va del marc). El gràfic fa
  servir `#0d9488`, que passa els sis controls sobre les dues superfícies i és
  de la mateixa família.

---

## Fase 5 — Experiència d'usuari i polit

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: que jugar-hi sigui còmode i agradable a ordinador i a mòbil.

### Tasques

- [x] Disseny responsiu i interacció tàctil: fitxes de 44 px de costat, taula i
      faristol amb desplaçament propi, botons del torn de 44 px d'alçada.
- [x] Arrossegar i deixar anar amb esdeveniments de punter (`useDragTile`), que
      funcionen igual amb ratolí i amb dit. El «tria i col·loca» a clics de la
      Fase 3 continua sent l'alternativa accessible per teclat, amb un botó
      «Torna la fitxa al faristol» per al cas que el faristol sigui buit.
- [x] Animacions curtes en robar, en guanyar i a les fitxes que acaba de baixar
      un bot, totes desactivades amb `prefers-reduced-motion`.
- [x] Partida en curs desada a cada moviment i oferta de continuar-la en tornar
      a obrir, amb validació del que hi ha desat (`state/savedGame.ts`).
- [x] ~~Ordenar el faristol (per color / per número)~~ — avançat a la Fase 3.
- [x] Ajuda opcional: marca les fitxes de la mà que poden formar jugada
      (`findRackMelds`), calculada només quan està encesa.
- [x] Accessibilitat: mides de toc, focus visible, `aria-live` per al canvi de
      torn i `role="alert"` per als errors, etiquetes a totes les fitxes.
- [x] Revisió de rendiment amb mesures reals.
- [x] Extra: tota la taula és zona per crear jugada nova, i la clau de cada
      jugada passa a ser la posició (resol la limitació apuntada a la Fase 3).

### Criteris d'acceptació (verificats)

- Partida completa jugable amb comoditat en un mòbil. ✔ Verificat en un Pixel 5
  emulat (393 px): partida sencera a base de tocs, arrossegament amb el dit,
  fitxes de 44×56 px, botons de 44 px i cap desbordament horitzontal.
- Tancar la pestanya a mitja partida i continuar-la. ✔ Es reprèn al mateix torn
  i amb les mateixes fitxes a la mà; en acabar-se, deixa d'oferir-se.
- `typecheck`, `test` i `build` en verd. ✔ (74 core + 36 web; 223 kB, 71 kB gzip)
- Rendiment: la resposta del torn **no es degrada** a mesura que creix la taula
  (90 ms el primer torn per escalfament; després 40–55 ms estables fins a 31
  fitxes a la taula). Inclou el temps d'anada i tornada de l'automatització, així
  que el treball real de la interfície és força menor.
- Tema fosc i moviment reduït comprovats: contrast de 6,3:1 al número de la
  fitxa i animacions efectivament desactivades.

### Problemes trobats

- [2026-08-22] Els botons del torn feien 42 px d'alçada i l'enllaç «Deixar la
  partida» només 24: per sota dels 44 recomanats per al tacte. Detectat
  mesurant-los en el mòbil emulat; resolt amb una alçada mínima en pantalles
  petites.
- [2026-08-22] **Compromís del tacte**: per poder arrossegar amb el dit cal
  `touch-action: none` a les fitxes, i això impedeix desplaçar la pàgina
  lliscant just damunt d'una fitxa. S'ha compensat donant desplaçament propi a
  la taula i al faristol, i mantenint el «tria i col·loca» a tocs, que no
  necessita arrossegar gens. Queda anotat perquè és una decisió, no un descuit.
- [2026-08-22] Una escala llarga no cap en una pantalla estreta i desquadrava la
  pàgina. Resolt fent que la taula es desplaci per dins, sense partir les
  jugades.
- [2026-08-22] Una primera mesura de rendiment no valia res: la partida
  s'acabava abans d'omplir-se la taula i es mesurava amb la taula buida.
  Repetida seguint la mida de la taula a cada torn, que és el que es volia
  saber.

---

## Fase 6 — Motor avançat (solver òptim i regles pendents)

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: apujar el sostre de la IA i completar les variants de regles
apuntades com a pendents a `docs/REGLES.md` i `docs/ARQUITECTURA.md`.

### Tasques

- [x] **Solver amb reordenació de taula** (`ai/rearrange.ts`): reparteix de nou
      totes les fitxes de la taula més les que calgui de la mà, quedant-se'n a
      la mà les mínimes. Treballa amb recomptes per color i número (les còpies
      són intercanviables) i recorre les caselles en ordre fix, de manera que
      cada repartiment es genera una sola vegada. Sostre de nodes i comprovació
      de la proposta abans de fer-la servir.
- [x] Escales amb joker també als **extrems**.
- [x] **Intercanvi de joker**: comprovat que ja funcionava sense cap regla nova
      (vegeu *Problemes trobats*), i fixat amb tests.
- [x] Elo amb **marge de resultat** (`marginFromPoints`), connectat a la web des
      de la puntuació final.
- [x] *Rubber banding* opcional (`rubberBandedMistakeRate`), desactivat per
      defecte i amb casella pròpia a la pantalla d'inici.
- [x] `docs/` actualitzats i simulador ampliat amb temps de decisió i mode duel.

### Criteris d'acceptació (verificats)

- Tests nous per a cada regla i per al solver. ✔ 97 tests al motor (abans 81):
  reordenació, intercanvi de joker, marge d'Elo i ajust dins de la partida.
- L'expert nou guanya clarament més que l'antic. ✔ Mesurat de dues maneres:
  - Duel directe a 200 partides amb el mateix repartiment i alternant qui
    comença: **200–0** per a l'expert amb reordenació.
  - Contra Mitjà i Novell, 100 partides amb les mateixes llavors: **92%** de
    victòries amb reordenació contra **56%** sense (el 56% és el control que
    confirma que l'expert antic segueix jugant com abans).
- El torn de l'expert no arriba a ~1 s. ✔ Mitjana 9 ms, p95 60 ms, pitjor
  **176 ms** en 100 partides.
- `typecheck` i `test` en verd. ✔ (97 core + 36 web)
- API pública: `recordGame` accepta ara `boolean | GameOutcome` (compatible amb
  el que hi havia), `decideAiMove` té un quart paràmetre d'opcions, i s'hi
  exporten `bestRearrangement`, `marginFromPoints` i `rubberBandedMistakeRate`.

### Problemes trobats

- [2026-08-22] **L'intercanvi de joker ja funcionava.** En anar a implementar-lo
  es va veure que surt sol de com està plantejat el moviment de jugar: com que
  es valida la taula sencera resultant, substituir el joker per la fitxa de debò
  i tornar-lo a col·locar és una reordenació més. I les dues restriccions de la
  regla oficial ja hi eren: no te'l pots endur a la mà (`TILE_REMOVED`) i no el
  pots tocar abans d'obrir (`REARRANGE_BEFORE_OPENING`). No s'hi ha afegit cap
  codi d'error nou: hauria estat inventar-se una restricció per tenir-la.
- [2026-08-22] Un duel 200–0 fa desconfiar. S'hi va fer un control: l'expert
  sense reordenació, contra Mitjà i Novell, guanya el 56% de les partides, molt
  a prop del 59% que donava a la Fase 1. Per tant no estava trencat, i el 200–0
  és real: en un cara a cara l'avantatge s'acumula a cada torn.
- [2026-08-22] Arreglar els jokers als extrems de les escales va abaixar
  lleugerament l'expert antic (59% → 56%) perquè també enforteix el nivell
  mitjà, que és el seu rival directe. És el comportament esperat, no una
  regressió.
- [2026-08-22] `pkill -f vite` matava el propi intèrpret d'ordres, perquè la
  seva línia també conté «vite». Anotat perquè no torni a passar: cal filtrar
  per `node.*vite`.

---

## Fase 7 — Desplegament

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: el joc és públic en una URL i s'hi pot jugar des de qualsevol
dispositiu.

### Tasques

- [x] Build estàtic de producció amb la `base` a `/rummikub/`, configurable amb
      `BASE_PATH` sense tocar codi.
- [x] Desplegament automàtic a **GitHub Pages** (triat per l'usuari) a cada
      canvi que arriba a `main`, amb el desplegament oficial de Pages.
- [x] CI a cada push i pull request: tipus, tests, build i proves de navegador.
- [x] **37 proves de navegador** (Playwright) que substitueixen la checklist
      manual de la Fase 3, executades en escriptori i mòbil contra el build de
      producció servit a `/rummikub/`.
- [x] PWA: manifest, icones i service worker per jugar sense connexió.
- [x] READMEs amb l'enllaç públic, com publicar i com provar-ho.

### Criteris d'acceptació (verificats)

- La URL pública carrega i s'hi juga una partida sencera. ✔ **Verificat contra
  el build de producció servit a `/rummikub/`**, no contra el servidor de
  desenvolupament: partides senceres contra 1, 2 i 3 bots en escriptori i en
  mòbil (Pixel 5). El que encara no es pot verificar des d'aquí és la URL de
  github.io: depèn que s'activi Pages al repositori (vegeu més avall).
- El perfil persisteix entre visites. ✔ Prova pròpia a `e2e/perfil.spec.ts`,
  inclosa la represa d'una partida a mitges.
- La CI falla si es trenca un test. ✔ Comprovat sense fer trampes: es va rompre
  una asserció a posta i `npm test` va sortir amb codi 1, que és el que fa
  fallar el pas de la CI.
- Extra: es pot jugar **sense connexió** un cop visitat (prova amb la xarxa
  tallada) i instal·lar com a aplicació (manifest i icones comprovats).

### Cal fer una vegada al repositori

El desplegament no pot funcionar fins que **Pages estigui activat**:
*Settings → Pages → Build and deployment → Source: **GitHub Actions***. És
l'única passa manual, i s'ha de fer des de la interfície de GitHub.

### Problemes trobats

- [2026-08-22] `vite preview` compta com a `serve`, no com a `build`, així que
  amb la `base` posada només per al build servia el lloc des de l'arrel mentre
  els fitxers generats apuntaven a `/rummikub/`: **totes** les proves de
  navegador fallaven de cop. Resolt aplicant la base també a `preview`, cosa que
  a més fa que les proves comprovin exactament el que es publica.
- [2026-08-22] La prova de l'ajuda partia d'una premissa fràgil: una mà de 14
  fitxes a l'atzar pot no tenir cap jugada possible, i llavors no marcar-ne cap
  és el comportament correcte. Resolt robant fitxes fins que n'hi hagi alguna.
- [2026-08-22] `pkill -f vite` matava el propi intèrpret d'ordres (la seva línia
  també conté «vite»). Ja anotat a la Fase 6; aquí va tornar a passar. La manera
  segura és filtrar per port: `lsof -t -i:4173`.

---

## El projecte, acabat

Les set fases estan fetes. Si es reprèn el projecte, això és el que hi ha
apuntat com a següent pas natural, per ordre de profit:

- **Estratègia a llarg termini de la IA**: ara maximitza les fitxes del torn
  actual, sense guardar-se'n per a jugades futures ni comptar les del rival.
- **Perfils múltiples** al mateix dispositiu (`ProfileRepository` ja ho suporta,
  només cal interfície).
- **Rondes encadenades** amb marcador acumulat: la puntuació ja suma zero, que
  és el que ho fa possible.
- Límit de temps per torn.

### Problemes trobats

*(cap encara)*

---

## Riscos coneguts (a vigilar quan toqui)

- ~~**Vite + workspace amb font TS**~~ (Fase 2): **tancat**. `@rummikub/core`
  publica `main` apuntant a `src/index.ts` i Vite 8 el transpila com a codi del
  projecte, tant en `dev` com en `build`. No calen àlies ni `optimizeDeps`.
  Compte si algun dia es publica el paquet fora del monorepo: llavors sí que
  caldrà compilar-lo i canviar `main`/`types` cap a `dist`.
- **Cost del solver òptim** (Fase 6): la reordenació completa de taula és
  combinatòria; cal límit de temps/nodes i, si s'escau, executar-lo en un
  Web Worker perquè no bloquegi la UI.
- **localStorage no disponible** (navegació privada, permisos): tots els
  accessos han de degradar a memòria sense trencar la partida (previst a la
  Fase 2).
- **Empat d'Elo entre dos nivells**: `suggestOpponents` tria el més fluix en
  cas d'empat exacte (comportament actual del `closestDifficultyIndex`); és
  intencionat (val més quedar-se curt que passar-se), no ho «arreglis» sense
  motiu.
