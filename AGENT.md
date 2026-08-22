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
| 3 | Pantalla de partida jugable | ⬜ Pendent |
| 4 | Cicle adaptatiu complet a la web | ⬜ Pendent |
| 5 | Experiència d'usuari i polit | ⬜ Pendent |
| 6 | Motor avançat (solver òptim i regles pendents) | ⬜ Pendent |
| 7 | Desplegament | ⬜ Pendent |

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
- [2026-08-22] El cercador d'escales només fa servir jokers per omplir **forats
  interns** (extrems sempre reals): un test suposava que també allargava
  extrems amb joker. S'ha ajustat el test a l'heurística documentada i la
  millora queda apuntada a la Fase 6.
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

**Estat**: ⬜ Pendent

**Objectiu**: es pot jugar una partida sencera al navegador contra 1, 2 o 3
bots, amb totes les regles aplicades pel motor.

### Tasques

- [ ] Components de fitxa, jugada (meld), taula i faristol, amb els colors i
      valors reals (`COLOR_LABELS` per a textos).
- [ ] Interacció per moure fitxes: seleccionar i col·locar (clic) com a mínim;
      arrossegar i deixar anar si no complica el calendari (sinó, passa a Fase 5).
- [ ] Zona d'edició del torn: l'usuari manipula una **còpia de treball** de la
      taula; «Acabar jugada» construeix el `Move` `play` amb la taula sencera i
      crida `applyMove` dins de `try/catch`.
- [ ] Mostrar el missatge del `RulesError` en català quan la jugada no és legal,
      i botó «Desfer canvis del torn» (restaurar l'estat del començament del torn).
- [ ] Botó «Robar fitxa» (`draw`), que també fa de «passar» amb el sac buit.
- [ ] Torns dels bots amb `decideAiMove` + retard artificial (~1 s) i indicació
      visual de qui juga i de què ha jugat (ressaltar fitxes noves).
- [ ] Final de partida: pantalla de resultat amb `finalScores`, guanyador i
      botó de partida nova.
- [ ] Selector de partida a Inici: nombre d'oponents (1–3) i nivell de cada un
      (de moment manual; l'automàtic ve a la Fase 4).
- [ ] Tests dels components/fluxos clau que siguin raonables sense navegador
      (p. ex. reducers/hooks del torn); la resta, checklist manual documentada.

### Criteris d'acceptació

- Partida completa jugable contra 1, 2 i 3 bots sense errors de consola.
- És impossible fer trampes des de la UI: tota validació passa pel motor
  (provar expressament: sortida de <30, retirar fitxes de la taula, jugada de 2).
- La partida sempre pot acabar (victòria o bloqueig amb sac buit).
- `typecheck`, `test` i `build` en verd.

### Problemes trobats

*(cap encara)*

---

## Fase 4 — Cicle adaptatiu complet a la web

**Estat**: ⬜ Pendent

**Objectiu**: la dificultat s'adapta de debò a l'experiència del jugador: el
perfil viu al navegador, es proposa la partida segons l'Elo i cada resultat
l'actualitza.

### Tasques

- [ ] A Inici, mode «Oponents automàtics» per defecte: `suggestOpponents`
      pre-selecciona els nivells segons el perfil (amb `describeSuggestion` com
      a explicació) i l'usuari pot canviar-los a mà.
- [ ] En acabar cada partida: `recordGame` amb els nivells reals dels rivals i
      el resultat, i desat immediat amb `ProfileRepository`.
- [ ] Pantalla d'Estadístiques: Elo actual, partides i victòries, historial
      (rivals, resultat, data) i gràfic simple de l'evolució de l'Elo
      (`history[].ratingAfter`).
- [ ] Gestió del perfil: reiniciar perfil (amb confirmació); opcional, més d'un
      perfil al mateix dispositiu.
- [ ] Test d'integració del cicle amb `MemoryStore`: partida guanyada → Elo
      puja i queda desat; partida perduda → baixa.

### Criteris d'acceptació

- Jugar dues partides seguides: l'Elo canvia després de cada una i **es
  conserva en tancar i reobrir el navegador**.
- Amb un perfil nou (Elo 1100), la proposta automàtica és de nivell fàcil/mitjà;
  editant l'Elo a mà a localStorage cap amunt, proposa nivells més alts.
- `typecheck`, `test` i `build` en verd.

### Problemes trobats

*(cap encara)*

---

## Fase 5 — Experiència d'usuari i polit

**Estat**: ⬜ Pendent

**Objectiu**: que jugar-hi sigui còmode i agradable a ordinador i a mòbil.

### Tasques

- [ ] Disseny responsiu (taula i faristol usables en pantalla petita) i
      interacció tàctil per moure fitxes.
- [ ] Arrossegar i deixar anar complet (si va quedar pendent de la Fase 3),
      amb alternativa accessible per teclat.
- [ ] Animacions curtes: robar, baixar jugades, torn dels bots, victòria.
- [ ] Desar la **partida en curs** (serialitzar `GameState` a localStorage) i
      oferir «Continuar la partida» en tornar a obrir.
- [ ] Ordenar el faristol (per color / per número) i ressaltar jugades
      possibles com a *ajuda* opcional (fent servir `findRackMelds`).
- [ ] Accessibilitat bàsica: contrast, mides de toc, focus visible, textos
      alternatius; tot el text de la UI en català.
- [ ] Revisió de rendiment (una partida llarga no ha de degradar la UI).

### Criteris d'acceptació

- Partida completa jugable amb comoditat en un mòbil (o emulació de mòbil).
- Tancar la pestanya a mitja partida i reobrir: es pot continuar exactament on era.
- `typecheck`, `test` i `build` en verd.

### Problemes trobats

*(cap encara)*

---

## Fase 6 — Motor avançat (solver òptim i regles pendents)

**Estat**: ⬜ Pendent

**Objectiu**: apujar el sostre de la IA i completar les variants de regles
apuntades com a pendents a `docs/REGLES.md` i `docs/ARQUITECTURA.md`.

### Tasques

- [ ] **Solver amb reordenació de taula**: cerca que combina fitxes pròpies i
      de la taula per maximitzar les fitxes jugades, mantenint tota la taula
      vàlida. Activar-lo només quan `rearrangesTable` és `true` (expert).
      Vigilar el cost: posar un límit de temps/nodes perquè el torn del bot no
      es noti lent a la UI.
- [ ] Escales amb joker també als **extrems** (limitació heretada de la Fase 1).
- [ ] **Intercanvi de joker**: recuperar un joker de la taula substituint-lo
      per la fitxa real, amb l'obligació de jugar-lo el mateix torn (regla
      oficial); nous codis de `RulesError` i tests.
- [ ] Elo amb **marge de resultat** (punts pendents) i no només guanyar/perdre.
- [ ] *Rubber banding* opcional i desactivable: ajustar lleugerament el
      `mistakeRate` dels bots durant la partida segons la diferència de fitxes.
- [ ] Actualitzar `docs/` (regles noves, arquitectura del solver) i el
      simulador si cal per mesurar les millores.

### Criteris d'acceptació

- Tests nous per a cada regla i per al solver (casos de reordenació coneguts).
- `npm run simulate -- --games 200`: l'expert amb solver nou guanya clarament
  més que l'expert antic (comparar abans/després i apuntar els números aquí).
- El torn d'un bot expert no triga més d'~1 s de càlcul en una partida normal.
- `typecheck` i `test` en verd; cap canvi trenca l'API pública sense documentar-ho.

### Problemes trobats

*(cap encara)*

---

## Fase 7 — Desplegament

**Estat**: ⬜ Pendent

**Objectiu**: el joc és públic en una URL i s'hi pot jugar des de qualsevol
dispositiu.

### Tasques

- [ ] Build estàtic de producció d'`apps/web` (tot és client: no cal servidor).
- [ ] Desplegament automàtic (GitHub Pages amb GitHub Actions, o equivalent que
      prefereixi l'usuari — **preguntar-ho abans de configurar res**), amb la
      `base` de Vite ben configurada per a la ruta de publicació.
- [ ] CI mínima: `typecheck` + `test` + `build` a cada push.
- [ ] Opcional: PWA (manifest + service worker) per jugar sense connexió.
- [ ] README de l'arrel amb l'enllaç públic i instruccions actualitzades.

### Criteris d'acceptació

- La URL pública carrega i s'hi juga una partida sencera des d'un mòbil real.
- El perfil persisteix entre visites a la versió publicada.
- La CI falla si es trenca un test (provar-ho expressament amb un canvi trivial
  revertit, o verificar-ho en un push real).

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
