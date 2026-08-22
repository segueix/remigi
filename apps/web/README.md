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

**S'hi pot jugar** (Fase 3): partida completa contra 1, 2 o 3 bots, amb totes
les regles aplicades pel motor. El que encara no fa: comptar els resultats per
al perfil (Fase 4) i arrossegar i deixar anar (Fase 5). Vegeu `AGENT.md`.

## Estructura

```
src/
├── main.tsx                  # punt d'entrada
├── App.tsx                   # navegació entre pantalles
├── styles.css                # estils (tema clar i fosc)
├── storage/
│   ├── webStore.ts           # adaptador de localStorage a KeyValueStore
│   └── webStore.test.ts
├── state/
│   └── useProfile.ts         # càrrega i desat del perfil del jugador
├── game/
│   ├── turnDraft.ts          # lògica pura de l'edició del torn
│   ├── turnDraft.test.ts
│   └── useGame.ts            # estat de la partida i torns dels bots
├── components/
│   ├── TileView.tsx          # una fitxa
│   ├── MeldView.tsx          # una jugada
│   ├── BoardView.tsx         # la taula
│   └── RackView.tsx          # el faristol, amb ordenació
└── screens/
    ├── HomeScreen.tsx        # nom del jugador i configuració de la partida
    ├── GameScreen.tsx        # la partida i el resultat final
    └── StatsScreen.tsx       # dades del perfil (Fase 4: historial i gràfic)
```

## Com es juga un torn

Un sol gest per a tot: **cliques una fitxa per triar-la i cliques on la vols
deixar** (una jugada de la taula, «+ Jugada nova» o el faristol). Tornar a
clicar la fitxa triada la deselecciona. En deixar-la sobre una jugada, s'insereix
a la posició que la fa vàlida si n'hi ha cap: un 6 vermell entra sol a l'esquerra
de 7-8-9.

Mentre dura el torn es treballa sobre una **còpia de la taula**, que pot quedar
temporalment invàlida (per partir una escala en dues cal passar per estats
intermedis). Les jugades incorrectes es marquen en vermell, però **qui mana és
el motor**: «Acabar jugada» li envia la taula sencera i, si la rebutja, es mostra
el seu missatge. La interfície no duplica cap regla; només impedeix el que no té
sentit ni intentar, com endur-se al faristol una fitxa que ja era a la taula.

## Comprovacions manuals

Fins que la Fase 7 no automatitzi això a la CI, abans de tocar la pantalla de
partida val la pena repassar a mà:

- [ ] Partida sencera contra 1, 2 i 3 bots, sense errors a la consola.
- [ ] Sortida inicial de menys de 30 punts: el motor la rebutja amb el seu missatge.
- [ ] Jugada de menys de 3 fitxes: es marca en vermell i el motor la rebutja.
- [ ] Una fitxa que ja era a la taula no es pot endur al faristol.
- [ ] «Desfer canvis» retorna el torn a com estava.
- [ ] Amb el sac buit, el botó passa a dir «Passar torn» i la partida es bloqueja
      si tothom passa.
- [ ] Es veu bé a 390 px d'amplada.

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
