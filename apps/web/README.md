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

**Completa** (fases 3 a 5): partida contra 1, 2 o 3 bots amb totes les regles
aplicades pel motor; cada resultat mou la teva habilitat, que tria els rivals de
la partida següent; s'hi juga amb el ratolí, amb el dit o amb el teclat; i una
partida a mitges es pot continuar més tard. El que queda és de motor (Fase 6) i
de desplegament (Fase 7). Vegeu `AGENT.md`.

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
│   ├── useProfile.ts         # càrrega, desat i reinici del perfil
│   ├── gameOutcome.ts        # el resultat d'una partida → perfil actualitzat
│   ├── gameOutcome.test.ts
│   ├── useRecordResult.ts    # registra el resultat un sol cop per partida
│   ├── savedGame.ts          # desa i valida la partida en curs
│   ├── savedGame.test.ts
│   └── useSavedGame.ts
├── game/
│   ├── turnDraft.ts          # lògica pura de l'edició del torn
│   ├── turnDraft.test.ts
│   ├── useDragTile.ts        # arrossegar amb ratolí, dit o llapis
│   └── useGame.ts            # estat de la partida i torns dels bots
├── components/
│   ├── TileView.tsx          # una fitxa
│   ├── MeldView.tsx          # una jugada
│   ├── BoardView.tsx         # la taula
│   └── RackView.tsx          # el faristol, amb ordenació
└── screens/
    ├── HomeScreen.tsx        # nom, oponents (automàtics o a mà) i perfil
    ├── GameScreen.tsx        # la partida, el resultat i el canvi d'habilitat
    └── StatsScreen.tsx       # habilitat, gràfic d'evolució i historial
```

## Com es juga un torn

Dues maneres, totes dues amb el mateix resultat:

- **Arrossegar** la fitxa fins on la vols deixar (funciona amb ratolí i amb dit).
- **Tocar per triar i tocar per deixar**: una jugada de la taula, un lloc buit
  de la taula, «+ Jugada nova» o el faristol. Aquesta és també la via per
  teclat, i per això no desapareix.

En deixar-la sobre una jugada, s'insereix a la posició que la fa vàlida si n'hi
ha cap: un 6 vermell entra sol a l'esquerra de 7-8-9.

Mentre dura el torn es treballa sobre una **còpia de la taula**, que pot quedar
temporalment invàlida (per partir una escala en dues cal passar per estats
intermedis). Les jugades incorrectes es marquen en vermell, però **qui mana és
el motor**: «Acabar jugada» li envia la taula sencera i, si la rebutja, es mostra
el seu missatge. La interfície no duplica cap regla; només impedeix el que no té
sentit ni intentar, com endur-se al faristol una fitxa que ja era a la taula.

## Com s'adapta al jugador

En acabar cada partida, `useRecordResult` la registra al perfil amb els nivells
que s'han jugat de debò, i l'habilitat puja o baixa segons el resultat i la
força dels rivals. A l'inici, aquesta habilitat és la que proposa els oponents
de la partida següent, de manera que les partides tendeixin a estar igualades;
sempre es poden triar a mà.

El registre es fa **una sola vegada per partida**: es recorda quin estat de
partida ja s'ha comptat, perquè ni un render de més ni el doble muntatge del
mode estricte de React puguin comptar dos cops el mateix resultat.

## Continuar una partida

La partida es desa a cada moviment i s'esborra quan s'acaba, així que es pot
tancar la pestanya a mitges i continuar-la després. El que hi ha desat es valida
abans de fer-lo servir: pot ser d'una versió anterior o haver-se quedat a
mitges, i davant del dubte val més començar de nou que carregar un estat que
petaria.

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
- [ ] En acabar una partida, l'habilitat canvia i el canvi es conserva després
      de recarregar.
- [ ] A Inici, pujar o baixar l'habilitat canvia els oponents proposats.
- [ ] Arrossegar una fitxa amb el ratolí i amb el dit.
- [ ] Deixar la partida a mitges, recarregar i continuar-la des de l'inici.
- [ ] Amb `prefers-reduced-motion`, cap animació.

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
