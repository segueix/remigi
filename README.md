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
| 7 | Desplegament | ⏳ pendent |

**Ja s'hi pot jugar**: `npm install && npm run dev`. Cada partida compta per al
teu perfil, els rivals s'ajusten al teu nivell, i pots jugar amb el ratolí o amb
el dit i deixar una partida a mitges per continuar-la després.

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
│       │   │   └── aiPlayer.ts    # Decisió de moviment segons el nivell
│       │   ├── adaptive/      # Dificultat adaptativa
│       │   │   ├── rating.ts               # Càlcul Elo
│       │   │   ├── experience.ts           # Perfil i historial del jugador
│       │   │   └── adaptiveDifficulty.ts   # Tria d'oponents segons l'habilitat
│       │   ├── persistence/   # Desat del perfil (memòria, fitxer JSON; localStorage a la fase web)
│       │   ├── cli/
│       │   │   └── simulate.ts    # Simulador IA contra IA per validar el motor
│       │   └── index.ts       # API pública del paquet
│       └── test/              # Tests (vitest)
├── apps/
│   └── web/                   # Aplicació web (Vite + React + TypeScript)
│       └── src/
│           ├── screens/       # Inici, Partida, Estadístiques
│           ├── components/    # Fitxa, jugada, taula i faristol
│           ├── game/          # Lògica del torn i estat de la partida
│           ├── state/         # Perfil del jugador i registre de resultats
│           └── storage/       # Adaptador de localStorage
├── AGENT.md                   # Pla de fases i registre de problemes
└── docs/
    ├── ARQUITECTURA.md        # Decisions de disseny i mapa de mòduls
    ├── REGLES.md              # Regles implementades i pendents
    └── IA-ADAPTATIVA.md       # Com s'adapta la dificultat al jugador
```

## Com provar-ho

```bash
npm install
npm run dev         # aplicació web a http://localhost:5173
npm test            # tests (motor + web)
npm run typecheck   # comprovació de tipus
npm run build       # build de producció de la web
npm run simulate    # partides IA contra IA (mostra que els nivells estan ordenats)
```

Exemple d'ús del motor des de codi:

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
- [ ] **Ara**: desplegament públic (Fase 7).
