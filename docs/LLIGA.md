# Les tres maneres de jugar: joc lliure, repte i lliga

En obrir Remigi surten tres opcions, l'una al costat de l'altra (també al mòbil):

| | Joc lliure (esquerra) | Repte (centre) | Lliga (dreta) |
|---|---|---|---|
| Què és | La partida de sempre | Unes quantes partides seguides, i se sumen els punts | Temporades de lliga, del poble al món, amb 30 s de relax i música entre jornades |
| Rivals | Els que triïs (1–3), automàtics o fixats | 1–3, al nivell que triïs | 2 o 3 per partida, els del calendari |
| Nivell | Adaptatiu (puja i baixa amb tu) o fixat | Fix: Novell … Expert | El del graó: de Novell (local) a Expert (mundial) |
| Mou la teva habilitat | Sí | No | No |

Cada mode té **la seva partida a mitges** (`remigi:game`, `remigi:game:repte`,
`remigi:game:lliga`): deixar una jornada de lliga per fer una partida lliure no
fa perdre res. El joc lliure conserva la clau de sempre, així que les partides
desades abans dels modes es reprenen igual.

Codi: `apps/web/src/screens/HomeScreen.tsx`, `RepteScreen.tsx`,
`LligaScreen.tsx`; lògica pura a `apps/web/src/lliga/league.ts`,
`apps/web/src/repte/challenge.ts` i `apps/web/src/state/freePlay.ts`; tot ho
lliga `App.tsx`.

## 1. Joc lliure: sempre amb els rivals que havies triat

Abans, la configuració només vivia dins de la partida desada: en acabar-se la
partida s'esborrava, i en tornar a obrir l'app es perdien el nombre de rivals i
el nivell fixat (tornaven 2 rivals automàtics). Ara les preferències es desen a
part (`remigi:lliure`: nombre de rivals, nivell `auto` o fixat, i l'ajust dins
de la partida) cada cop que comença una partida lliure.

- **Nivell fixat**: la partida nova és exactament la triada (p. ex. 3 Experts).
- **Nivell automàtic**: la força surt de l'habilitat del perfil d'aquell
  moment, que és on la va deixar l'última partida lliure.
- **El repte i la lliga no mouen l'habilitat** (`useRecordResult` només registra
  el joc lliure): tenen el seu propi marcador, i així el nivell automàtic del
  joc lliure continua on el vas deixar.

## 2. Repte

Tries **quantes partides** (3, 5 o 10), **el nivell** (Novell, Fàcil, Mitjà,
Avançat, Expert) i **quants rivals** (1–3). Cada partida suma els teus punts de
`finalScores`: si guanyes, els que els rivals tenen a la mà; si perds, en restes
els teus. En acabar el repte surt el total, les victòries i si és un **rècord**
per a aquella mateixa configuració; l'historial guarda els 40 últims reptes.

- Cada partida porta una sessió (`inici del repte#partida`): només compta la
  partida que toca, un sol cop, encara que el final de partida es pinti dues
  vegades o es recarregui.
- El repte va a l'historial **en el moment** d'acabar l'última partida, no quan
  es torna a obrir la pantalla.
- Es pot abandonar (no queda enlloc) o repetir amb la mateixa configuració.

## 3. Lliga

### L'escala: set nivells, tres grups cadascun

Els noms són els de les lligues d'escacs d'El Tauler (`LLIGA.md` §6 de
`segueix/eltauler`), amb la localitat del jugador:

| Nivell | Lliga (exemple: Vic) | Grup C | Grup B | Grup A |
|---|---|---|---|---|
| Municipal | Lliga de Vic | 800 | 840 | 880 |
| Comarcal | Lliga Comarcal d'Osona | 920 | 960 | 1000 |
| Provincial | Lliga Provincial de Barcelona | 1040 | 1080 | 1120 |
| Territori | Lliga Catalana (Valenciana, Balear…) | 1160 | 1200 | 1240 |
| Països Catalans | Lliga dels Països Catalans | 1280 | 1320 | 1360 |
| Europa | Lliga Europea | 1400 | 1440 | 1480 |
| Món | Lliga Mundial | 1520 | 1560 | 1600 |

Les xifres són la **força mitjana dels rivals** de cada graó: 21 graons de 40
punts, de **Novell (800) a la lliga local** fins a **Expert (1600) a la
mundial**. A diferència d'El Tauler, la força no surt de la puntuació del
jugador: pujar vol dir, de debò, jugar contra rivals més forts.

**Es puja d'un en un: de la C a la B, de la B a la A**, i de la A a la C del
nivell següent (Municipal A → Comarcal C). En sentit contrari, de la C es baixa
a la A del nivell anterior. Al primer graó no es baixa; a l'últim no es puja, i
el primer és «Campió del món». L'escalada de la pantalla mostra les lletres de
tots els graons (C B A · C B A…), i el final de temporada ho diu així:
«Puges al Grup B de la Lliga de Vic», «Puges al Grup A de la Lliga de Vic»,
«Puges a la Lliga Comarcal d'Osona · Grup C: nivell nou!» (`movementText`).

### Configuració de la temporada

| Opció | Valors |
|---|---|
| Rivals per partida | 2 (taules de 3) o 3 (taules de 4) |
| Jugadors a la lliga, tu inclòs | taules de 3: 6, 9, 12 o 15 · taules de 4: 8, 12 o 16 |
| Jornades (partides per acabar la lliga) | de 3 a 15; per defecte 7 |

La mida de la lliga és sempre un múltiple de la taula: cada jornada tothom
juga. La pantalla diu si amb les jornades triades et trobes amb tots els rivals
(`ceil((jugadors − 1) / rivals per partida)`). La configuració es recorda per a
les temporades següents.

**Pugen i baixen** una quarta part de la lliga, com a mínim un
(`round(jugadors / 4)`): 2 de 6, 2 de 8, 3 de 12, 4 de 16.

### Els rivals

- **Força**: repartida de −80 a +80 al voltant del graó (dos graons per banda),
  amb una mica de soroll, i encabida dins de 800–1600 en proporció, com fa El
  Tauler amb el ROC als extrems. Es fixa en crear la temporada i el motor la
  juga tal qual (força contínua, `opponentRatings`).
- **Noms**: de persona, amb `rivalNames` de `nomslliga.js` d'El Tauler, i
  l'origen amb `rivalOrigins` de `localitats.js` (del poble a la lliga local,
  de pobles de la comarca a la comarcal… de països a l'europea i la mundial).
  Els dos fitxers són **còpies** convertides a mòdul ES
  (`apps/web/src/lliga/nomsLliga.js` i `localitats.js`, amb els seus `.d.ts`).
  Si canvien a El Tauler, s'han de tornar a copiar.
- No es repeteixen els noms de les darreres temporades (`recentNames`, 90).
- **Avatar**: les inicials sobre un dels degradats del planter, triat pel nom
  (sempre el mateix per al mateix rival).

### On jugues

Remigi viu a `eltauler.cat/remigi/`, al mateix origen que El Tauler, i
comparteixen `localStorage`. Si el jugador ja va dir a la lliga d'escacs on
juga (`chess_leagueCareer.home`), «On jugues?» surt **ja omplert** amb aquell
lloc i ho diu. Només es llegeix: Remigi no hi escriu mai. A Catalunya el
municipi es tria d'una llista (Idescat) i en surten comarca i província; als
altres territoris es tria la comarca i el municipi s'escriu; fora dels Països
Catalans s'escriuen país i municipi. Amb «Ara no», les lligues es diuen «Lliga
Local», «Lliga Comarcal»… Una temporada que encara no ha començat es torna a
sortejar amb el lloc nou.

### Calendari

Es fa sencer en crear la temporada, amb la llavor de la temporada
(`makeSchedule`). Per a cada jornada es proven 60 repartiments a l'atzar i es
millora el millor amb intercanvis entre taules; el cost és, per a cada parella
d'una taula, el quadrat de les vegades que ja s'han trobat, amb pes 10 per a les
teves parelles. Amb les jornades justes, **et trobes amb tots els rivals abans
de repetir-ne cap** (comprovat amb 40 llavors per a cada mida: cap fallada).
El pitjor cas (16 jugadors, 15 jornades) tarda ~0,3 s, un sol cop per temporada.

### Puntuació i classificació

Cada partida és un enfrontament contra cada rival de la taula, com en una lliga
d'escacs: **1 punt per cada jugador que acaba per sota teu** (per punts de la
partida), ½ si empateu. A una taula de quatre, guanyar dona 3 punts; quedar
segon, 2. Desempats (`standings`):

1. punts de lliga;
2. enfrontaments directes entre els empatats (només si tots s'hi han trobat);
3. **diferència**: la suma dels punts de les partides;
4. victòries (primer de la taula);
5. força i nom, perquè l'ordre sigui sempre el mateix.

### Les partides entre rivals

Les altres taules de cada jornada se simulen quan acabes la teva (amb una llavor
de la temporada i la jornada: recarregar no torna a tirar els daus). El model es
va **mesurar fent jugar el motor mateix**: 200 partides per cel·la, taules de 3
i 4 amb forces separades 120 punts al voltant de 800, 1000, 1200, 1400 i 1600.

**Qui guanya**: Plackett–Luce sobre 10^(k·força/400). El pendent k, ajustat per
màxima versemblança a cada nivell, no és constant: als nivells baixos i mitjans
la diferència de força pesa molt més del que diria l'Elo, i entre experts gairebé
gens.

| força mitjana | 800 | 1000 | 1200 | 1400 | 1600 |
|---|---|---|---|---|---|
| k (taules de 3 / de 4) | 1,2 / 0,6 | 4,1 / 2,8 | 3,4 / 2,6 | 1,6 / 2,0 | 0,1 / 0,7 |
| k que es fa servir | 0,9 | 3,4 | 3,0 | 1,8 | 0,5 |

**Punts a la mà dels perdedors** (mitjana, del millor perdedor al pitjor):

| taula | 800 | 1000 | 1200 | 1400 | 1600 |
|---|---|---|---|---|---|
| de 3 | 122 · 157 | 94 · 120 | 41 · 57 | 26 · 49 | 18 · 40 |
| de 4 | 105 · 125 · 154 | 75 · 94 · 119 | 39 · 51 · 69 | 21 · 38 · 65 | 13 · 29 · 76 |

Cada perdedor treu la mitjana de la seva posició multiplicada per un factor a
l'atzar entre 0,55 i 1,45 (ordenats perquè qui queda més avall en tingui més), i
el guanyador s'emporta la suma: el marcador de cada taula suma zero, com una
partida de debò. Entre forces es fa interpolació lineal.

### Entre jornades: 30 segons de relax

Com a les lligues d'escacs d'El Tauler a 30 s, 1 i 2 minuts, en acabar una
jornada no surt el resum llarg sinó una pantalla amb poc text
(`LeagueInterlude.tsx`):

- el resultat en curt («2n de 4 · +2 punts · −31»), verd si guanyes i vermell
  si quedes últim;
- la **jornada que toca, gran i en un requadre** («JORNADA 3/7»);
- «comença en» i el **compte enrere de 30 a 0**;
- la teva posició a la classificació **cara a cara** amb la dels rivals de la
  jornada següent (posició, punts i força);
- la **música composta** en aquell moment (§4), amb el seu nom («Sona: Rumba de
  la classificació · la menor · flauta») i «Silencia».

A zero comença sola la jornada següent; «Juga ara» no espera; «Classificació» i
«Inici» aturen el compte. El compte enrere **només corre amb l'app a la
vista**: amb la pestanya amagada es queda quiet, i la música també. L'última
jornada acaba amb el resum de sempre i el final de la temporada. El
compositor es baixa (a part, 16 kB comprimits) mentre es juga la jornada, de
manera que la música és a punt quan s'acaba.

### Final de temporada

En acabar l'última jornada la temporada es tanca **de seguida** (`closeSeason`):
el palmarès (30 temporades) apunta la posició, els punts, la diferència i si es
puja, es baixa o es continua, i el graó es mou. La pantalla ensenya la posició
gran (or, plata, bronze; vermell si baixes), on jugaràs la temporada següent i
la classificació final, amb la configuració per començar-la.

Una temporada es pot **abandonar**: no compta per a res (ni puja ni baixa).

### Desat

`remigi:lliga` = `{ career, season }`, validat en carregar: una temporada que no
quadra es descarta i es conserva la trajectòria; una trajectòria que no quadra
torna a començar. Cada jornada té sessió (`llavor#jornada`) i només es
comptabilitza la que toca.

## 4. Música composta il·limitada

És el sistema d'El Tauler (`radioambient.js`, LLIGA.md §8 de
`segueix/eltauler`), copiat a `apps/web/src/musica/radioambient.js` com a mòdul
ES i carregat a demanda. Cada vegada que cal música, l'app **compon una peça
nova**: tria un dels cinc estils (Passeig de jornada, Tic-tac del rellotge,
Rumba de la classificació, Groove de la jugada i Himne de la lliga), diferent de
l'anterior, i amb una llavor en surten la tonalitat, el tempo, la progressió
d'acords (frases A · A' · B), la melodia, el solista i la variant
d'acompanyament. La sintetitza al dispositiu amb Web Audio: un bucle de 32 s
que sona fins que s'atura. **No se'n repeteix cap**: es recorden les empremtes
de les 200 darreres (`remigi:musica-vistes`), i també es tenen en compte les que
ja han sonat a la lliga d'escacs d'El Tauler (`eltauler_league_jingle_seen`,
només es llegeix).

**Música composta** (botó de l'inici, `MusicScreen.tsx`) és el registre, com el
d'El Tauler: de cada peça només es desa la recepta (estil i llavor), així que
es poden tornar a **escoltar** en bucle, marcar com a **preferides** o **baixar
en MP3** (quatre voltes, uns 2 minuts, amb lamejs de cdnjs carregat només el
primer cop; mono, 22.050 Hz, 64 kbps). Les 5 darreres a la vista, les
preferides i l'arxiu per dies; se'n guarden 200 i fins a 100 preferides
(`remigi:musica-registre`). També s'hi pot compondre'n una de nova, apagar la
música entre jornades o canviar-ne el volum (`remigi:musica`).

## 5. Límits

- El model de les partides simulades surt de partides entre bots, no de
  persones; la força relativa entre nivells del motor és més abrupta que
  l'Elo (vegeu `AGENT.md`, «Un esglaó entre Avançat i Expert»).
- Al primer graó, la meitat dels rivals queden encabits a 800 (el mínim del
  motor): la lliga local és Novell de debò.
- Les dades de localitats i noms són còpies: no se sincronitzen soles amb El
  Tauler.
- Abandonar una temporada permet fugir d'un descens. És deliberat (no es vol
  obligar a acabar una temporada que no ve de gust), però queda apuntat.

## 6. Proves

- Unitat: `lliga/league.test.ts` (escala, noms, configuració, rivals, calendari,
  simulació, classificació, tancament i desat), `repte/challenge.test.ts`,
  `state/freePlay.test.ts`, `ui/format.test.ts` i les inicials de
  `game/bots.test.ts`.
- Unitat (música): `musica/musica.test.ts` (cada peça és nova i d'estil
  diferent, no repeteix les d'El Tauler ni hi escriu, la recepta torna a donar
  la mateixa peça, síntesi de 32 s, registre i preferides, nom de l'MP3).
- Navegador: `e2e/modes.spec.ts` (les tres opcions de costat també al mòbil,
  el joc lliure que recorda 3 Experts després de recarregar sense partida, la
  tornada a l'inici i represa, un repte de 3 partides amb el total i sense
  moure l'habilitat, la localitat d'El Tauler i els noms de les lligues, i una
  temporada sencera de 3 jornades amb la pantalla de relax —«Classificació»
  atura el compte i «Juga ara» no espera— fins a començar la següent; i, amb el
  rellotge del navegador simulat, que el compte no corre amb l'app amagada,
  que a zero comença sola la jornada amb els rivals anunciats, que la música
  composta sona i queda al registre, i que «Silencia» es recorda).
- La baixada en MP3 s'ha comprovat amb el lamejs real des de Node: un fitxer
  MPEG layer III vàlid de 64 kbps i 22,05 kHz.
