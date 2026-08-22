# Rummikub

Joc de Rummikub per jugar contra **1, 2 o 3 oponents controlats per IA**, amb una
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

**Ja s'hi pot jugar**: <https://segueix.github.io/rummikub/>. Cada partida compta
per al teu perfil, els rivals s'ajusten al teu nivell, i pots jugar amb el ratolí
o amb el dit i deixar una partida a mitges per continuar-la després.

## Estructura del repositori

```
rummikub/
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
│       │   ├── ai/            # Oponents artificials
│       │   │   ├── difficulty.ts  # 5 nivells: novell, fàcil, mitjà, avançat, expert
│       │   │   ├── solver.ts      # Cerca de jugades possibles
│       │   │   ├── rearrange.ts   # Repartiment òptim de la taula (nivell expert)
│       │   │   └── aiPlayer.ts    # Decisió de moviment segons el nivell
│       │   ├── adaptive/      # Dificultat adaptativa
│       │   │   ├── rating.ts               # Càlcul Elo
│       │   │   ├── experience.ts           # Perfil i historial del jugador
│       │   │   └── adaptiveDifficulty.ts   # Tria d'oponents segons l'habilitat
│       │   ├── persistence/   # Desat del perfil (memòria i fitxer JSON)
│       │   ├── cli/
│       │   │   └── simulate.ts    # Simulador IA contra IA per validar el motor
│       │   └── index.ts       # API pública del paquet
│       └── test/              # Tests (vitest)
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
    ├── REGLES.md              # Regles implementades i pendents
    └── IA-ADAPTATIVA.md       # Com s'adapta la dificultat al jugador
```

## Jugar-hi

**https://segueix.github.io/rummikub/**

És una aplicació que funciona del tot al navegador: es pot instal·lar al mòbil
com una app i, un cop visitada, també s'hi pot jugar sense connexió.

## Com provar-ho en local

```bash
npm install
npm run dev         # aplicació web a http://localhost:5173
npm test            # tests del motor i de la web
npm run test:e2e    # proves de navegador sobre el build de producció
npm run typecheck   # comprovació de tipus
npm run build       # build de producció de la web
npm run simulate    # partides IA contra IA (mostra que els nivells estan ordenats)
```

Per a les proves de navegador la primera vegada cal el navegador:
`npx playwright install chromium` dins d'`apps/web`.

## Publicació

El desplegament és automàtic: cada canvi que arriba a `main` construeix el joc i
el publica a GitHub Pages (`.github/workflows/desplega.yml`). La CI
(`.github/workflows/ci.yml`) passa tipus, tests, build i proves de navegador a
cada push i a cada pull request.

La font de Pages ha de ser **GitHub Actions** (*Settings → Pages → Build and
deployment*). Si algun dia es tornés a posar «Deploy from a branch», el lloc
passaria a ser aquest README convertit amb Jekyll en comptes del joc.

Si el desplegament no s'engega sol després d'un canvi a `main`, es pot llançar a
mà des de *Actions → Desplega a GitHub Pages → Run workflow*. Va caldre fer-ho
la primera vegada, just després de la fusió que va afegir el flux.

La ruta base del build surt del nom del repositori. Si el projecte canvia de nom
o es publica en una altra ruta, es pot passar `BASE_PATH` al build sense tocar
el codi.

## Fer servir el motor des de codi

`@rummikub/core` és independent de la interfície i es pot fer servir sol:

```ts
import { createGame, applyMove, decideAiMove } from '@rummikub/core';

let state = createGame({
  players: [
    { name: 'Tu', kind: 'human' },
    { name: 'Bot 1', kind: 'ai', aiLevel: 'medium' },
    { name: 'Bot 2', kind: 'ai', aiLevel: 'easy' },
  ],
  seed: 42,
});

// Torn d'una IA:
state = applyMove(state, decideAiMove(state, state.currentPlayer));
```

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
