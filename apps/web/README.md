# Aplicació web

Interfície del Rummikub: **Vite + React + TypeScript**, que importa tota la
lògica de joc de `@rummikub/core` (workspace).

```bash
npm run dev        # servidor de desenvolupament (http://localhost:5173)
npm run build      # build de producció a dist/
npm run preview    # serveix el build de producció
npm test           # tests d'aquest paquet
```

## Estat

L'**esquelet** (Fase 2) està fet: perfil del jugador desat al navegador,
navegació entre pantalles i el motor integrat i funcionant. **Encara no s'hi pot
jugar**: la taula jugable és la Fase 3 (vegeu `AGENT.md` a l'arrel).

## Estructura

```
src/
├── main.tsx                  # punt d'entrada
├── App.tsx                   # navegació entre pantalles
├── styles.css                # estils de base (tema clar i fosc)
├── storage/
│   ├── webStore.ts           # adaptador de localStorage a KeyValueStore
│   └── webStore.test.ts
├── state/
│   └── useProfile.ts         # càrrega i desat del perfil del jugador
└── screens/
    ├── HomeScreen.tsx        # nom del jugador i entrada a la partida
    ├── GameScreen.tsx        # prova de fum del motor (Fase 3: jugable)
    └── StatsScreen.tsx       # dades del perfil (Fase 4: historial i gràfic)
```

## Notes de disseny

- **Sense router**: la navegació és un estat de `App.tsx`. No hi ha enllaços
  profunds ni URL per compartir, així que un router seria pes de més; si a la
  Fase 5 cal historial del navegador, s'hi afegeix allà.
- **`@rummikub/core` es resol sol**: el paquet publica el seu codi font
  TypeScript (`main` → `src/index.ts`) i Vite el transpila com a codi del
  projecte gràcies a l'enllaç de workspace. No calen àlies ni `optimizeDeps`.
- **L'emmagatzematge no pot tombar el joc**: `localStorage` falla en navegació
  privada, amb galetes bloquejades o amb la quota exhaurida. `createWebStore()`
  ho comprova escrivint-hi de debò i, si no pot, degrada a memòria.
