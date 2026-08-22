# Aplicació web

Interfície del Rummikub: **Vite + React + TypeScript**, que importa tota la
lògica de joc de `@rummikub/core` (workspace).

```bash
npm run dev        # servidor de desenvolupament (http://localhost:5173)
npm run build      # build de producció a dist/
npm run preview    # serveix el build de producció a /rummikub/
npm test           # tests d'aquest paquet
npm run test:e2e   # proves de navegador sobre el build de producció
```

## Estat

**Completa.** Partida contra 1, 2 o 3 bots amb totes les regles aplicades pel
motor; cada resultat mou la teva habilitat, que tria els rivals de la partida
següent; s'hi juga amb el ratolí, amb el dit o amb el teclat; una partida a
mitges es pot continuar més tard; i es publica sola a GitHub Pages, instal·lable
al mòbil i jugable sense connexió.

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

## Proves de navegador

El que abans era una llista per repassar a mà ara ho comprova `npm run test:e2e`
(Playwright), a `e2e/`:

- Partida sencera contra 1, 2 i 3 bots, sense errors de consola.
- El motor rebutja la sortida de menys de 30 punts i la jugada de menys de 3
  fitxes, i no deixa endur-se al faristol una fitxa que ja era a la taula.
- «Desfer canvis» retorna el torn a com estava.
- Arrossegar del faristol a la taula, i l'ajuda que marca les jugades possibles.
- El perfil es conserva, els oponents proposats pugen amb l'habilitat, i una
  partida a mitges es pot continuar.
- Rutes correctes sota `/rummikub/`, manifest i icones, i jugar sense connexió.
- En pantalla petita: res no desborda i els objectius de toc fan 44 px.

Tot s'executa dues vegades, en **escriptori i en mòbil**, i contra el **build de
producció servit a `/rummikub/`**, que és exactament el que es publica: així una
ruta base mal configurada es detecta aquí i no un cop desplegat.

Els bots juguen sense pausa durant les proves (`VITE_BOT_DELAY=0`) perquè una
partida sencera duri segons; és l'única diferència amb el build públic.

## Publicació

`npm run build` genera el lloc a `dist/`, ja preparat per a
`https://segueix.github.io/rummikub/`. La ruta base es pot canviar amb
`BASE_PATH` sense tocar codi.

L'aplicació es pot instal·lar al mòbil (manifest i icones a `public/`) i,
un cop visitada, funciona sense connexió gràcies a `public/sw.js`. Aquest
demana **sempre la pàgina a la xarxa primer** i només fa servir la còpia desada
si no hi ha connexió, de manera que una versió nova arriba de seguida; els
fitxers de codi, en canvi, es poden servir de la memòria sense por perquè porten
el nom amb empremta i canvien de nom quan canvien de contingut.

## Notes de disseny

- **Sense router**: la navegació és un estat de `App.tsx`. No hi ha enllaços
  profunds ni URL per compartir, així que un router seria pes de més. Si algun
  dia calgués historial del navegador, és aquí on s'hi posaria.
- **`@rummikub/core` es resol sol**: el paquet publica el seu codi font
  TypeScript (`main` → `src/index.ts`) i Vite el transpila com a codi del
  projecte gràcies a l'enllaç de workspace. No calen àlies ni `optimizeDeps`.
- **L'emmagatzematge no pot tombar el joc**: `localStorage` falla en navegació
  privada, amb galetes bloquejades o amb la quota exhaurida. `createWebStore()`
  ho comprova escrivint-hi de debò i, si no pot, degrada a memòria.
