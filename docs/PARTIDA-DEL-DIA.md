# La partida del dia

Cada dia hi ha **una partida igual per a tothom**, a dalt de la taula de l'inici
(«Partida del dia #N», en un bàner sota els tres modes). Codi: `apps/web/src/dia/daily.ts` (lògica pura),
`apps/web/src/screens/DiaScreen.tsx` i `App.tsx`.

## Igual per a tothom

- La llavor surt de la data local (`daySeed`, FNV-1a de `remigi:dia:AAAA-MM-DD`).
- Amb la llavor, el motor reparteix: la teva mà de 14 fitxes i **la resta del
  sac en el mateix ordre** són iguals a tots els aparells.
- Rivals: 2, de nivell Mitjà, amb noms triats amb la mateixa llavor.
- Comença sempre el jugador.
- Els rivals juguen amb una llavor per torn (`turnSeed`): davant de la mateixa
  taula, la mateixa jugada. Si dos jugadors fan les mateixes jugades, la
  partida és idèntica.

## Puntuació

| Resultat | Què compta | Millor |
|---|---|---|
| Guanyes (número 1 de la taula) | Les teves jugades (torns teus, robar inclòs) | Menys |
| No guanyes | Punts que et queden a la mà (joker, 30) | Menys |

Qualsevol victòria és millor que qualsevol derrota (`compareResults`).

Es juga **un sol cop al dia**: compta el primer resultat. Una partida a mitges
es desa (`remigi:game:dia`) i es reprèn; si s'acaba un altre dia, compta per al
dia en què es va començar.

## Ratxa

- **Ratxa**: dies seguits que has quedat número 1. Si avui encara no has jugat,
  la d'ahir continua viva fins que s'acaba el dia.
- **Millor ratxa** i quadrets dels últims 7 dies (🟩 número 1, 🟥 no, ⬜ no
  jugada).
- El resultat es comparteix (menú del mòbil o WhatsApp) amb el número del dia,
  el resultat, la ratxa, els quadrets i l'enllaç.

No mou l'habilitat del joc lliure. Es desa a `remigi:dia` (els últims 400 dies).

## Rànquings amb el compte de Google

Projecte de Firebase `remigi-c37ac` (pla Spark, gratuït). Codi:
`apps/web/src/cloud/` (`firebase.ts` connexió, `ranking.ts` lògica pura,
`useCloud.ts` sessió) i `apps/web/src/screens/DiaRanking.tsx`.

- **Entrar amb Google** és opcional i es fa des de la pantalla de la partida
  del dia. Sense compte tot funciona igual; els rànquings es poden mirar.
- Al rànquing només surt l'**àlies** (el nom del jugador a Remigi), mai el nom
  ni el correu de Google.
- El SDK de Firebase es baixa a demanda: només si s'obre la partida del dia o
  si en aquest aparell ja s'havia entrat amb Google.
- **Rànquing d'avui** (`dia/{dia}/resultats/{uid}`): ordenat per `score`
  (victòria: jugades; derrota: 1000 + punts a la mà). Es crea un sol cop.
- **Rànquing de ratxes** (`jugadors/{uid}`): àlies, ratxa, millor ratxa i
  últim dia jugat. Una ratxa només compta si s'ha jugat avui o ahir.
- En acabar la partida del dia (o en entrar amb Google després), el resultat
  d'avui o d'ahir i la ratxa pugen sols.

### Què es desa al compte de Google

Només això, i res més (cap historial de partides, temporades acabades ni
reptes):

| On | Què | Qui ho llegeix |
|---|---|---|
| `perfils/{uid}` | Nom; nivell (habilitat, partides, victòries, calibratge); lliga en curs: escala, localitat, configuració i la temporada d'ara amb els rivals (nom, població, força), el calendari i la classificació; quantes temporades acabades | Només el jugador |
| `jugadors/{uid}` | Àlies i ratxa (rànquing de ratxes) | Tothom |
| `dia/{dia}/resultats/{uid}` | Resultat de la partida del dia | Tothom |

- **En entrar** en un aparell: de cada part es queda la més avançada (nivell:
  més partides; lliga: més temporades i jornades). L'historial de l'aparell es
  conserva. La ratxa de la partida del dia es recupera de `jugadors/{uid}`.
- **Després**, cada canvi del nivell o la lliga es puja (ajuntant els canvis
  en 2 s). No es puja res fins que s'ha llegit el compte, perquè un aparell
  nou no esborri el que hi havia.
- Firestore no accepta llistes dins de llistes: el calendari es desa com un
  text per jornada (`a,b,c|d,e,f`).
- Codi: `cloud/cloudSave.ts` (pur) i `cloud/useCloudSync.ts`. Es pot entrar
  amb Google des de la pantalla del dia o des del perfil.

### Configuració de Firebase (es fa a la consola)

1. Authentication → Método de acceso → **Google** habilitat.
2. Authentication → Configuración → **Dominios autorizados**:
   `segueix.github.io` i `eltauler.cat` (i `localhost`).
3. Firestore Database creada (modo producción, `eur3`).
4. Firestore Database → **Reglas**: enganxar [`firestore.rules`](../firestore.rules)
   i **Publicar**. Sense aquestes regles, els rànquings no carreguen
   (`permission-denied`).

### Límits

La partida es juga al navegador: qui en sàpiga pot enviar un resultat fals.
Les regles només deixen escriure el propi resultat, un cop per dia i amb
valors coherents. Com que la partida del dia és determinista, es podria
verificar reproduint les jugades amb Cloud Functions (pla Blaze).
