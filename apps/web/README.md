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
│   ├── bots.ts               # el planter de rivals: noms i avatars
│   ├── bots.test.ts
│   ├── meldOwners.ts         # qui ha jugat cada jugada de la taula
│   ├── meldOwners.test.ts
│   └── useGame.ts            # estat de la partida i torns dels bots
├── components/
│   ├── icons.tsx             # icones dels botons del torn
│   ├── PlayerMenu.tsx        # el desplegable del teu jugador
│   ├── TileView.tsx          # una fitxa
│   ├── MeldView.tsx          # una jugada
│   ├── BoardView.tsx         # la taula
│   └── RackView.tsx          # el faristol, amb ordenació i compte de fitxes
└── screens/
    ├── GameScreen.tsx        # la partida, el menú del jugador i el resultat
    └── StatsScreen.tsx       # historial: habilitat, gràfic i reinici
```

## La taula de joc

**L'app entra directament a la taula**: si hi ha una partida a mig jugar es
continua sola, i si no se'n reparteix una de nova amb els rivals que toquen per
l'habilitat del perfil. El perfil es crea sol la primera vegada («Jugador»).
Tot el que abans era la pantalla d'inici viu ara al **menú del teu jugador**
(tocant la teva targeta, a dalt): el nom, el nombre de rivals i el seu nivell
(automàtic o fixat), «Partida nova», «Historial» i «Com es juga». L'historial
es pinta per sobre de la partida, que no es desmunta: en tornar és exactament
on era.

La partida ocupa **tota la pantalla**, com un joc i no com una pàgina: a dalt la
tira de jugadors i el torn, al mig la taula de feltre verd —que es queda tot
l'espai que sobra—, i a baix el faristol de fusta amb les fitxes i els botons
del torn. La pàgina no es desplaça mai; si mai cal, es desplacen per dins la
taula o el faristol. Les fitxes de la taula són un pèl més petites que les del
faristol perquè s'hi vegin més jugades de cop; les del faristol conserven els
44 px de toc al mòbil.

El feltre és fosc en tots dos temes, com una taula de debò. Per això tot el que
s'hi posa a sobre —marcs dels bots, jugades invàlides, destinacions— fa servir
sempre les **versions clares** dels colors (variables amb sufix `-taula`).

Els botons del torn van sempre en **una sola línia**, amb icona de traç
(`components/icons.tsx`, SVG en línia, sense llibreries) i rètol; quan el rètol
no hi cap s'amaga i queda la icona, com en una app. El nom accessible el porta
`aria-label` i no canvia mai. Amb el **mòbil apaïsat**, tot el que no és taula
s'estreny: jugadors amb el nom en lletra menuda, faristol en una sola filera
amb desplaçament horitzontal, i botons només amb icona.

El manifest no clava cap orientació (`"orientation": "any"`): l'app instal·lada
gira amb el telèfon. I a la dreta dels botons del torn hi ha **«Gira la
pantalla»**, que posa el joc a pantalla completa i el gira a l'orientació
contrària (el bloqueig d'orientació dels navegadors demana pantalla completa);
només surt on pot funcionar, i per això als iPhone no hi és: allà girar el
telèfon fa el mateix.

## Els rivals

No jugues contra «Bot 1» sinó contra algú: hi ha un **planter de 24
personatges** amb nom d'usuari i avatar amb degradat de colors propi
(`game/bots.ts`) —GuineuAstuta, PolpVuitMans, MussolSavi…— i cada partida en
tria de diferents a l'atzar. L'anell de l'avatar conserva el color de taula del
bot, que és el que lliga amb els marcs de les seves jugades. El nom viatja dins de l'estat del motor —que només hi veu
una cadena—, així que una partida represa conserva els mateixos rivals;
l'avatar es dedueix del nom i no cal desar-lo. Un nom que no és al planter (una
partida desada d'una versió anterior) rep l'avatar de recanvi.

## Com es juga un torn

Dues maneres, totes dues amb el mateix resultat:

- **Arrossegar** la fitxa fins on la vols deixar. Amb el ratolí, prem i mou;
  amb el dit, **mantén la fitxa premuda un instant** (una vibració curta ho
  confirma) i enduu-te-la — una lliscada normal sobre les fitxes desplaça la
  taula o el faristol, que és el que fa possible arribar a jugades que no són
  a la pantalla.
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

## Explicar les regles

El menú del jugador porta **«Com es juga (i com s'obre)»**, amb exemples fets
amb fitxes de debò: un grup, una escala, i el cas que enganya — tres fitxes que
sumen 30 sense ser ni grup ni escala. Ve desplegat mentre no s'ha jugat cap
partida i plegat després, de manera que a qui ja hi juga només li ocupa una
línia.

Durant el torn, si hi ha jugades marcades en vermell, la pista de la sortida
inicial explica **per què no sumen punts**. Dir només «en portes 0» amb fitxes a
la taula desconcerta: sembla que el joc no les vegi.

## Qui ha jugat què

Dues marques per no perdre el fil de la partida:

- **La fitxa que acabes de robar** queda amb un recuadre daurat de ratlles al
  faristol fins que tornes a jugar o a robar. Trobar-la entre tretze fitxes més
  no hauria de ser un joc a part. Va per fora de la fitxa (`outline`), de
  ratlles i d'un color que no fa servir res més, per no confondre's ni amb la
  fitxa triada ni amb els colors dels bots.
- **El marc de colors marca l'últim moviment**: les jugades que el jugador de
  torn acaba de posar o de modificar porten el marc del seu color —el del bot,
  o el teu color d'acció si les has baixades tu— i les marques del moviment
  anterior s'esborren. Així el marc respon a «què ha canviat des que no miro?»
  en comptes d'anar acumulant colors per tota la taula. Robar o passar no
  esborra res: l'últim moviment amb fitxes continua sent el d'abans.

Qui ha tocat cada jugada no és estat del joc —el motor no en sap res, i és el
que toca— sinó que es dedueix a `game/meldOwners.ts` comparant la taula d'abans
i la de després de cada moviment. La jugada s'identifica per **les seves fitxes**
i no per la posició: una jugada es proposa reordenant la taula sencera, i una
que no ha canviat ha de conservar el color encara que hagi canviat de lloc.

**La tinta dels números** també està mesurada. El vermell i el taronja
s'assemblaven massa a la pantalla —ΔE 23, i només 6 amb daltonisme simulat, que
és tant com dir el mateix color—: ara el vermell és més intens i fosc i el
taronja tira cap al groc, i la distància entre tots dos passa a ΔE 46 (13 amb
daltonisme). El vermell, a més, contrasta més amb el crema de la fitxa que abans
(5.5:1 en comptes de 4.5:1) i el taronja es queda igual (3.3:1).

Els colors dels bots estan mesurats igual, no triats a ull: es distingeixen entre ells també amb
daltonisme simulat (separació mínima ΔE 36 en tema clar i 33 en fosc), no es
confonen amb el vermell d'una jugada invàlida ni amb el color d'acció, i
contrasten com a mínim 3.9:1 amb el fons. Per si de cas, el nom del bot també
surt en text: al títol emergent de la jugada i al costat del color, a la llista.

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
tancar la pestanya a mitges i continuar-la després. Amb ella es desen els colors
de les jugades, que si no es perdrien en continuar; com que són informació només
visual, si venen malmesos es descarten sense tocar la partida. El que hi ha desat es valida
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
- Arrossegar del faristol a la taula amb el ratolí; amb tocs de debò, lliscar
  sobre les fitxes desplaça la taula i mantenir premut arrossega.
- L'app entra directament a la partida; el nom, els rivals i la partida nova es
  fan des del menú del jugador, i l'historial en porta el retorn i el reinici.
- El perfil es conserva, els oponents proposats pugen amb l'habilitat, i una
  partida a mitges es continua sola en tornar a obrir (colors inclosos).
- La fitxa robada es marca i deixa d'estar-ho en jugar; només l'últim moviment
  porta marc (d'un sol color), la jugada que baixes tu inclosa, i tocar una
  jugada marcada li treu el marc.
- Els rivals tenen nom i avatar propis i diferents entre ells, i la partida
  s'encaixa a la pantalla sense desplaçament de pàgina.
- Els botons del torn van en una sola línia a totes les mides, i al mòbil
  apaïsat tot cap a la pantalla amb objectius de toc de 44 px.
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
`BASE_PATH` sense tocar codi. La publicació la fa
`.github/workflows/desplega.yml` des de `main`.

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
