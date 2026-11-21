# La partida del dia

Cada dia hi ha **una partida igual per a tothom**, a dalt de la taula de l'inici
(«Partida del dia #N», en un bàner sota els tres modes). Codi: `apps/web/src/dia/daily.ts` (lògica pura),
`apps/web/src/screens/DiaScreen.tsx` i `App.tsx`.

## Igual per a tothom

- El dia és el de **Barcelona** (`Europe/Madrid`, `dayKey`): la partida canvia
  a mitjanit de Barcelona per a tothom, sigui on sigui. L'inici en mostra el
  compte enrere (`msUntilNextDay`).
- La llavor surt d'aquesta data (`daySeed`, FNV-1a de `remigi:dia:AAAA-MM-DD`).
- No cal cap servidor ni cap acció diària: cada aparell calcula la llavor pel
  seu compte i el generador amb llavor (mulberry32) barreja el sac igual.
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

## Com es juga i es comparteix

- El bàner de l'inici porta **directament a la partida**. Si ja s'ha jugat
  avui, porta al resultat i al rànquing.
- En acabar, a dalt hi ha la **posició al rànquing d'avui** («Ets el 3r de
  25», `fetchDayPlace`) i un sol botó: **«📣 Comparteix: em superes?»**, amb el
  resultat, els quadrets i un enllaç `…/remigi/?partida=dia` que obre
  directament la partida del dia.
- **Entrar amb Google** només es fa a dalt de l'inici. En entrar amb el nom de
  casa («Jugador»), es demana un sol cop amb quin nom vols jugar, i es proposa
  el nom de pila del compte.

## Quota gratuïta de Firestore (pla Spark)

Límits diaris: 50.000 lectures i 20.000 escriptures. Per arribar al màxim de
gent sense pagar:

| Què | Cost per jugador |
|---|---|
| Obrir l'app amb sessió (llegir el compte i la ratxa) | 2 lectures |
| Rànquing d'avui: top 10 (`RANKING_SIZE`), desat 10 min a l'aparell (`cloud/cache.ts`) | ≤ 10 lectures |
| Rànquing de ratxes: top 10 de les vives, filtrat a Firestore | ≤ 10 lectures |
| Posició al rànquing: dos recomptes amb la puntuació que l'app ja sap | 2 lectures |
| Pujar el resultat del dia (sense llegir-lo abans) i la ratxa | 2 escriptures |
| Nivell i lliga: com a molt cada 30 min, i en tancar o amagar l'app | ~1–3 escriptures |

Uns 25 lectures i 4 escriptures al dia per jugador: uns 2.000–3.000
jugadors diaris dins de la quota gratuïta. Els rànquings desats s'esborren
quan puges el teu resultat, perquè et vegis de seguida.

El rànquing de ratxes demana l'índex compost de `firestore.indexes.json`
(`jugadors`: `lastDay` ↑, `streak` ↓). Mentre no hi sigui, funciona igual però
llegeix més files (30) i les filtra a l'aparell.

## Desempat

El rànquing del dia ordena per un sol camp, `score` (menys, millor):

- **Victòria:** `jugades × 1000 + (999 − punts dels rivals)`. Primer menys
  jugades; amb les mateixes, qui deixa els rivals amb més punts a la mà
  (guanyar «més fort»).
- **Derrota:** `1.000.000 + punts a la mà × 1000 + jugades`. Sempre per sota de
  qualsevol victòria.

El resultat porta el camp `rivals` (punts que els quedaven als rivals). Els
resultats d'abans no en porten: compten com a 0 i l'app els torna a puntuar en
llegir-los. Si les regles publicades encara són les d'abans, l'app desa el
format antic (sense `rivals`) perquè el resultat no es perdi.

## Dificultat de la setmana i sortida garantida

`apps/web/src/dia/plan.ts`. Igual per a tothom, segons el dia de la setmana a
Barcelona (sense Expert, per no trencar la ratxa de tothom cada setmana):

| Dia | Rivals | Força | Etiqueta |
|---|---|---|---|
| Dilluns | 2 | 1000 | Fàcil ● |
| Dimarts | 2 | 1100 | Suau ●● |
| Dimecres | 2 | 1200 | Mitjà ●●● |
| Dijous | 2 | 1250 | Mitjà+ ●●● |
| Divendres | 2 | 1300 | Exigent ●●●● |
| Dissabte | 2 | 1400 | Avançat ●●●●● |
| Diumenge | 3 | 1350 | Taula de 4 ●●●● |

**Sempre es pot obrir.** Abans de la sortida inicial només es pot obrir o
robar, i els rivals juguen sempre igual davant de la mateixa taula: el camí fins
a la sortida és el mateix per a tothom. L'app prova fins a 12 barreges del dia
(`candidateSeed`) i es queda amb la primera amb què la sortida de 30 punts és
possible com a molt al **3r torn** del jugador (`openingTurn`). No ha de ser al
primer: es pot obrir, però no ve regalat. El càlcul és determinista (cerca
limitada per passos, no per temps) i dona la mateixa barreja a tots els
aparells; es desa al mòbil (`remigi:dia:pla`, lligat a la versió del motor).

En 300 dies simulats, sense el filtre 122 (41 %) no permetien obrir fins passat
el 3r torn; amb el filtre, cap.

El bàner diu el dia i la dificultat («Divendres · Exigent ●●●●○»), i la ratxa
porta també els dies jugats seguits (`playedStreak`).

## Entrar amb Google a l'iPhone

- **Safari només obre la finestra de Google dins del mateix toc.** Per això,
  a l'inici Firebase es carrega per endavant (el botó «Entra» surt quan ja és
  a punt) i `signInWithGoogle` obre la finestra sense cap espera abans.
- **Navegadors integrats d'apps** (Instagram, Facebook, Messenger, TikTok,
  LinkedIn…): Google no hi deixa entrar («403: disallowed_useragent»). L'app
  ho detecta (`cloud/browser.ts`) i diu que s'obri l'enllaç a Safari o Chrome.
- **Redirecció**: si la finestra no es pot obrir, es prova la redirecció; si
  en tornar no hi ha sessió, l'app ho diu (`checkRedirect`).
- Pendent si encara falla a l'app instal·lada de l'iPhone: servir els fitxers
  d'inici de sessió de Firebase des del mateix domini (`eltauler.cat/__/auth/`)
  i fer servir aquest domini com a `authDomain`.
