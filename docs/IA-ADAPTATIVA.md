# IA adaptativa

Com aconsegueix el joc que els oponents estiguin sempre «a l'alçada» del jugador,
ni avorrits ni impossibles. Tot el codi és a `packages/core/src/ai/` i
`packages/core/src/adaptive/`.

## 1. Nivells de dificultat (`ai/difficulty.ts`)

Tots els bots fan servir el mateix cercador de jugades; el nivell només canvia
els paràmetres que el limiten o hi introdueixen errors «humans»:

| Nivell | Elo | Error per torn | Allarga la taula | Juga jokers | Torns amb reordenació |
|---|---|---|---|---|---|
| Novell (`rookie`) | 800 | 35% | no | no | mai |
| Fàcil (`easy`) | 1000 | 20% | no | sí | mai |
| Mitjà (`medium`) | 1200 | 10% | sí | sí | mai |
| Avançat (`advanced`) | 1400 | 4% | sí | sí | 20% |
| Expert (`expert`) | 1600 | 0% | sí | sí | 100% |

**Reordenar la taula sencera** per encabir-hi tantes fitxes com es pugui
(`rearrangesTable`) és, de lluny, el que més pesa en la força d'un bot: un rival
que no reordena mai perd **totes** les partides contra un que sempre ho fa,
tingui els errors que tingui. Per això no és un sí o un no, sinó una proporció
de torns (`rearrangeRate`) que gradua el salt entre els dos nivells alts. Amb el
20% de l'Avançat, l'Expert li guanya el 76% dels duels, just el que prediu la
diferència d'Elo (abans d'aquest canvi, quan l'Avançat no reordenava mai, l'Expert
els guanyava tots). Es pot comprovar amb `npm run simulate -- --ladder 200`.

«Error per torn» (`mistakeRate`) és la probabilitat que el bot «no vegi» la
millor jugada trobada i robi fitxa, que és exactament l'error més habitual d'un
jugador humà d'aquell nivell. Afebleix de debò els nivells baixos; en un bot que
reordena gairebé no es nota, perquè la jugada que deixa escapar la recupera el
torn següent (un expert amb un 15% d'error encara guanya la meitat dels duels
contra un de perfecte).

## 2. Un únic nivell numèric

`PlayerProfile.rating` és la font de veritat del nivell del jugador. Després
del calibratge, la força dels rivals surt d'aquest número, sense una escala
paral·lela que pugi o baixi 100 punts a cada resultat.

- `adaptiveStep`: només dirigeix l'escalada del calibratge; els valors antics
  no substitueixen el número d'un perfil ja calibrat.
- `adaptiveCalibrating`: indica si encara s'està buscant el primer nivell.
- `ratedGames`: partides valorades després del calibratge. Les primeres 10
  tenen K=40; després baixa un punt per partida fins a K=20. Si el camp falta
  en un perfil antic, es fa servir `gamesPlayed`.
- `gamesPlayed`, `wins` i les darreres 50 partides es conserven. L'historial
  també desa la força numèrica real dels rivals.

La probabilitat de victòria estimada és
`1 / (1 + suma(10 ** ((nivellRival - nivellJugador) / 400)))`.
Contra 1, 2 o 3 rivals equivalents és respectivament 1/2, 1/3 o 1/4.
La variació és `K × pesMarge × (resultat - probabilitat)`, arrodonida.
Així, amb dos rivals equivalents i marge neutre, inicialment guanyar suma
27 punts i perdre en resta 13; una victòria compensa aproximadament dues derrotes.

El marge modula K entre un 75% i un 125%. En guanyar es divideixen els punts
entre els rivals; en perdre es compta només el faristol propi, perquè els
punts negatius ja són individuals. La velocitat o el nombre de reorganitzacions
no donen punts. La probabilitat és una estimació, no una garantia empírica.

El rang ordinari és 800–1600, el que cobreix la IA. Els valors antics que
queden fora del rang no es retallen sobtadament: una victòria no els abaixa
ni una derrota els apuja. Els bots es limiten a la força disponible.

## 3. Calibratge i tria de rivals

Un perfil nou comença contra Novell i puja a Fàcil, Mitjà, Avançat i Expert
mentre guanya. Durant l'escalada no s'ensenya cap número provisional.
La primera derrota acaba el calibratge i assigna:

- marge ≤0,25: nivell provat;
- marge ≤0,65: 100 punts menys;
- marge >0,65: 200 punts menys, amb mínim 800.

Si guanya també a Expert, el calibratge acaba a 1600. En acabar o reiniciar
el calibratge, el comptador `ratedGames` torna a zero, sense esborrar totals.

Després, `suggestOpponentRatings` fixa per a tots els rivals el número del
jugador en començar la partida. La web el desa a `GameSetup.opponentRatings`
i el passa a `engine.play({ rating })` a cada torn. El resultat es valora amb
els números desats, encara que el perfil hagi canviat. Les partides desades
antigues, sense números, continuen amb els nivells fixos que tenien.

`difficultyByRating` interpola entre els dos nivells adjacents: errors,
proporció de torns amb jokers, extensions i reordenació. Les capacitats noves
s'activen gradualment, sense salts booleans. Els jokers segueixen una corba
cúbica: les simulacions mostren que una interpolació lineal arriba massa
aviat a una força semblant a Fàcil. Als cinc nivells exactes, les
jugades i el consum de RNG són els mateixos que abans. Les claus retornades
per `suggestOpponents` són descriptives; per jugar amb força contínua cal
passar també els números de `suggestOpponentRatings`.

Les partides manuals mantenen els rivals escollits i també actualitzen el
número. Si es torna al mode automàtic, els rivals segueixen aquest número.
Una partida manual no acaba ni fa avançar un calibratge pendent.
Els enllaços entre dispositius conserven també `ratedGames` (`valorades` a la URL).

## 4. El cicle complet

```
partida nova ──► suggestOpponents(perfil) ──► createGame(...)
     ▲                                             │
     │                                             ▼
guardar perfil ◄── recordGame(resultat) ◄── partida jugada
```

## 5. Ajust dins de la mateixa partida (opcional)

L'adaptació per Elo actua **entre** partides. Amb la casella «Ajusta la
dificultat durant la partida» activada, els bots també s'ajusten **dins** d'una,
segons quantes fitxes més que ells li queden al jugador:

- `rubberBandedRearrangeRate` fa que els nivells que reordenen (Avançat i
  Expert) ho facin menys sovint quan el jugador va endarrerit (un 25% menys de
  torns per cada fitxa de diferència) i més sovint quan va guanyant. És
  l'ajust que de debò iguala les partides contra els nivells alts;
- `rubberBandedMistakeRate` els fa equivocar-se una mica més quan el jugador va
  endarrerit i afinar quan va guanyant (mai per damunt d'un 50% d'error). És el
  que suavitza els nivells baixos, que no reordenen.

El nivell de sortida no canvia. Simulant un jugador que juga com l'Avançat contra
dos experts (`npm run simulate -- --rubber 900`), sense ajust guanya el 12% de
les partides; amb l'ajust antic, que només tocava els errors, també el 12%; amb
l'ajust de la reordenació, el 18%.

Ve **desactivat** per defecte: canviar el rival a mitja partida ha de ser una
decisió explícita del jugador, no una sorpresa.

## Millores previstes

- Perfils múltiples al mateix dispositiu (ja ho suporta `ProfileRepository`,
  només cal interfície).
- Estratègia a llarg termini de la IA: guardar-se fitxes per a jugades futures i
  tenir en compte què li pot quedar al rival.
