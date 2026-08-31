# Remigi

El Remigi és un **rummy de fitxes** per jugar contra **1, 2 o 3 oponents
controlats per IA**, amb una
dificultat que **s'adapta automàticament a l'experiència del jugador**: el sistema
manté un perfil amb una puntuació d'habilitat (estil Elo) que puja i baixa segons
els resultats, i tria el nivell dels rivals perquè les partides siguin sempre
equilibrades.

## Estat del projecte

El pla complet, fase a fase, és a **[`AGENT.md`](AGENT.md)**.

| Fase | Contingut | Estat |
|------|-----------|-------|
| 1 | Motor del joc (`packages/core`) | ✅ feta |
| 2 | Esquelet de l'aplicació web (`apps/web`) | ✅ feta |
| 3 | Pantalla de partida jugable | ✅ feta |
| 4 | Cicle adaptatiu complet a la web | ✅ feta |
| 5 | Experiència d'usuari i polit | ✅ feta |
| 6 | Motor avançat (IA que reordena la taula) | ✅ feta |
| 7 | Desplegament a GitHub Pages | ✅ feta |

**Ja s'hi pot jugar**: <https://segueix.github.io/remigi/>. Cada partida compta
per al teu perfil, els rivals s'ajusten al teu nivell, i pots jugar amb el ratolí
o amb el dit i deixar una partida a mitges per continuar-la després.

## Estructura del repositori

```
remigi/
├── packages/
│   └── core/                  # Motor del joc (TypeScript pur, sense dependències de UI)
│       ├── src/
│       │   ├── core/          # Regles: fitxes, jugades, taula, torns, puntuació
│       │   │   ├── constants.ts
│       │   │   ├── types.ts
│       │   │   ├── random.ts      # RNG amb llavor (partides reproduïbles)
│       │   │   ├── tiles.ts       # Les 106 fitxes i el sac
│       │   │   ├── melds.ts       # Validació de grups i escales (amb jokers)
│       │   │   ├── board.ts       # Validació de la taula
│       │   │   ├── game.ts        # Estat de partida i moviments (funcions pures)
│       │   │   └── scoring.ts     # Punts pendents i puntuació final
│       │   ├── ai/            # Oponents artificials (implementació interna)
│       │   │   ├── difficulty.ts  # 5 nivells: novell, fàcil, mitjà, avançat, expert
│       │   │   ├── solver.ts      # Cerca de jugades possibles
│       │   │   ├── rearrange.ts   # Repartiment òptim de la taula (nivell expert)
│       │   │   └── aiPlayer.ts    # Decisió de moviment segons el nivell
│       │   ├── engine/        # El motor: API pública i versionada de la IA
│       │   │   ├── version.ts     # ENGINE_VERSION
│       │   │   ├── engine.ts      # createEngine → play / analyze
│       │   │   └── index.ts       # Entrada del build de dist/remigi-engine.js
│       │   ├── adaptive/      # Dificultat adaptativa
│       │   │   ├── rating.ts               # Càlcul Elo
│       │   │   ├── experience.ts           # Perfil i historial del jugador
│       │   │   └── adaptiveDifficulty.ts   # Tria d'oponents segons l'habilitat
│       │   ├── persistence/   # Desat del perfil (memòria i fitxer JSON)
│       │   ├── cli/
│       │   │   └── simulate.ts    # Simulador IA contra IA (usa l'API del motor)
│       │   └── index.ts       # API pública del paquet
│       ├── scripts/           # Build de l'artefacte del motor i prova de fum
│       └── test/              # Tests (vitest), amb la regressió del motor
├── apps/
│   └── web/                   # Aplicació web (Vite + React + TypeScript)
│       ├── src/
│       │   ├── screens/       # Inici, Partida, Estadístiques
│       │   ├── components/    # Fitxa, jugada, taula i faristol
│       │   ├── game/          # Lògica del torn, arrossegar i estat de la partida
│       │   ├── state/         # Perfil, resultats i partida desada
│       │   └── storage/       # Adaptador de localStorage
│       ├── e2e/               # Proves de navegador (Playwright)
│       └── public/            # Manifest, icones i service worker
├── .github/workflows/         # CI i desplegament a GitHub Pages
├── AGENT.md                   # Pla de fases i registre de problemes
└── docs/
    ├── ARQUITECTURA.md        # Decisions de disseny i mapa de mòduls
    ├── ENGINE.md              # El motor de la IA: API, artefacte i versionat
    ├── REGLES.md              # Regles implementades i pendents
    └── IA-ADAPTATIVA.md       # Com s'adapta la dificultat al jugador
```

## Jugar-hi

**https://segueix.github.io/remigi/**

És una aplicació que funciona del tot al navegador: es pot instal·lar al mòbil
com una app i, un cop visitada, també s'hi pot jugar sense connexió.

> ⚠️ Mentre la font de Pages no sigui «GitHub Actions», aquesta adreça pot
> tornar a mostrar aquest README en comptes del joc. Vegeu **Publicació**.

## Com provar-ho en local

```bash
npm install
npm run dev         # aplicació web a http://localhost:5173
npm test            # tests del motor i de la web
npm run test:e2e    # proves de navegador sobre el build de producció
npm run typecheck   # comprovació de tipus
npm run build       # build de producció de la web
npm run build:engine # genera dist/remigi-engine.js (el motor de la IA, sol)
npm run test:engine  # només els tests del motor (API, artefacte i regressió)
npm run simulate    # partides IA contra IA (mostra que els nivells estan ordenats)
```

Per a les proves de navegador la primera vegada cal el navegador:
`npx playwright install chromium` dins d'`apps/web`.

## Publicació

El desplegament és automàtic: cada canvi que arriba a `main` construeix el joc i
el publica a GitHub Pages (`.github/workflows/desplega.yml`). La CI
(`.github/workflows/ci.yml`) passa tipus, tests, build i proves de navegador a
cada push i a cada pull request.

### La font de Pages ha de ser «GitHub Actions»

*Settings → Pages → Build and deployment → Source: **GitHub Actions***.

Això no és un detall: **mentre la font sigui «Deploy from a branch», cada canvi
a `main` engega dos desplegaments alhora** — el d'aquest projecte i el generador
antic de Jekyll, que agafa el repositori tal com és i en publica el README.
Publiquen tots dos al mateix lloc i **guanya el que acaba l'últim**, que sol ser
el Jekyll per pocs segons. El resultat és que el joc apareix i, al cap d'un
moment, el substitueix el README.

Va passar de debò: amb la fusió de la PR núm. 4, el desplegament del joc va
acabar a les 21:24:04 i el de Jekyll a les 21:24:11.

El flux demana aquest canvi ell mateix (`enablement: true` a
`configure-pages`), però si el permís no basta s'ha de fer a mà. Un cop
canviat, el generador de Jekyll deixa d'executar-se i el problema desapareix.

Si el desplegament no s'engega sol després d'un canvi a `main`, es pot llançar a
mà des de *Actions → Desplega a GitHub Pages → Run workflow*.

La ruta base del build surt del nom del repositori. Si el projecte canvia de nom
o es publica en una altra ruta, es pot passar `BASE_PATH` al build sense tocar
el codi.

## Fer servir el motor des de codi

La IA és un **motor independent** amb API estable i versionada (vegeu
[`docs/ENGINE.md`](docs/ENGINE.md)): l'app li passa l'estat i ell retorna la
jugada, com un motor d'escacs.

```ts
import { createEngine, createGame, applyMove } from '@remigi/core';

const engine = createEngine({ seed: 7 }); // amb llavor: partides reproduïbles

let state = createGame({
  players: [
    { name: 'Tu', kind: 'human' },
    { name: 'Bot 1', kind: 'ai', aiLevel: 'medium' },
    { name: 'Bot 2', kind: 'ai', aiLevel: 'easy' },
  ],
  seed: 42,
});

// Torn d'una IA: el motor decideix i diu què ha costat decidir-ho.
const decision = engine.play(state);
state = applyMove(state, decision.move);
// decision → { move, engineVersion, level, thinkingTimeMs, nodes, ... }
```

`npm run build:engine` empaqueta exactament aquest motor en un únic fitxer
(`packages/core/dist/remigi-engine.js`) executable amb Node pelat o des d'un
Web Worker, sense React ni DOM.

## Full de ruta

- [x] Motor de regles complet: 106 fitxes, grups i escales amb jokers, sortida
      inicial de 30 punts, reordenació de la taula, final de partida i puntuació.
- [x] IA amb 5 nivells de dificultat parametritzats.
- [x] Sistema adaptatiu: perfil del jugador amb Elo i tria automàtica d'oponents.
- [x] Simulador i tests.
- [x] Esquelet de la web: perfil desat a `localStorage`, navegació i motor
      integrat.
- [x] Partida jugable contra 1, 2 o 3 bots, amb validació en viu i resultat final.
- [x] Cicle adaptatiu tancat: els rivals surten de la teva habilitat, cada
      resultat l'actualitza, i les estadístiques en mostren l'evolució.
- [x] Arrossegar fitxes (ratolí i dit), partida desada per continuar-la després,
      ajuda opcional i accessibilitat.
- [x] IA experta que reparteix de nou la taula sencera, intercanvi de jokers,
      Elo amb marge de resultat i ajust de dificultat dins de la partida.
- [x] Publicació automàtica a GitHub Pages, CI amb proves de navegador, i
      instal·lable al mòbil amb joc sense connexió.
- [x] Seguir la partida amb un cop d'ull: la fitxa que acabes de robar queda
      marcada, i l'últim moviment porta marc de color — el del bot que l'ha
      fet, o el teu si la jugada l'has baixada tu.
- [x] Taula de joc a pantalla completa: feltre verd, faristol de fusta amb les
      fitxes a sota, i rivals amb nom i avatar que canvien a cada partida.
- [x] Directes a la taula: sense pantalla d'inici, amb el nom, el nivell, la
      partida nova i l'historial en un menú que s'obre tocant el teu jugador, i
      rivals amb nom d'usuari i avatar de colors.
- [x] La IA encapsulada com a motor independent i substituïble
      (`remigi-engine`): API pública versionada, artefacte d'un sol fitxer per
      a Node o Web Worker, i regressió comportamental que garanteix que cada
      nivell juga exactament igual que abans.
- [x] El torn, a mida del mòbil: les fitxes de la taula s'encongeixen a mesura
      que s'omple perquè es vegin totes, el faristol el col·loques tu, un sol
      botó tanca el torn, i un rellotge de 30, 60 o 120 segons compta a la
      taula (quan s'acaba, es desfà el que no has validat i robes).
