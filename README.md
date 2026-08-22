# Rummikub

Joc de Rummikub per jugar contra **1, 2 o 3 oponents controlats per IA**, amb una
dificultat que **s'adapta automàticament a l'experiència del jugador**: el sistema
manté un perfil amb una puntuació d'habilitat (estil Elo) que puja i baixa segons
els resultats, i tria el nivell dels rivals perquè les partides siguin sempre
equilibrades.

## Estat del projecte

| Fase | Contingut | Estat |
|------|-----------|-------|
| 1 | Estructura del repositori i motor del joc (`packages/core`) | ✅ feta |
| 2 | Aplicació web (`apps/web`) | ⏳ pendent |

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
│   └── web/                   # Fase 2: aplicació web (Vite + React), encara buida
└── docs/
    ├── ARQUITECTURA.md        # Decisions de disseny i mapa de mòduls
    ├── REGLES.md              # Regles implementades i pendents
    └── IA-ADAPTATIVA.md       # Com s'adapta la dificultat al jugador
```

## Com provar-ho

```bash
npm install
npm test            # tests del motor
npm run typecheck   # comprovació de tipus
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
- [ ] **Fase 2**: aplicació web a `apps/web` (Vite + React + TypeScript) amb
      arrossegar i deixar anar, perfil desat a `localStorage` i pantalles de
      partida, configuració i estadístiques.
- [ ] Solver òptim (reordenació completa de la taula per part de la IA experta).
- [ ] Intercanvi de jokers de la taula.
- [ ] Ajust de dificultat dins de la mateixa partida (rubber banding).
