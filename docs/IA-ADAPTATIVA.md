# IA adaptativa

Com aconsegueix el joc que els oponents estiguin sempre «a l'alçada» del jugador,
ni avorrits ni impossibles. Tot el codi és a `packages/core/src/ai/` i
`packages/core/src/adaptive/`.

## 1. Nivells de dificultat (`ai/difficulty.ts`)

Tots els bots fan servir el mateix cercador de jugades; el nivell només canvia
els paràmetres que el limiten o hi introdueixen errors «humans»:

| Nivell | Elo | Error per torn | Allarga la taula | Juga jokers |
|---|---|---|---|---|
| Novell (`rookie`) | 800 | 35% | no | no |
| Fàcil (`easy`) | 1000 | 20% | no | sí |
| Mitjà (`medium`) | 1200 | 10% | sí | sí |
| Avançat (`advanced`) | 1400 | 4% | sí | sí |
| Expert (`expert`) | 1600 | 0% | sí | sí |

L'expert, a més, **reparteix de nou la taula sencera** a cada torn per encabir-hi
tantes fitxes com pot (`rearrangesTable`). És el que el separa de la resta: en un
duel a 200 partides contra la versió que només allarga jugades, les guanya
totes.

«Error per torn» (`mistakeRate`) és la probabilitat que el bot «no vegi» la
millor jugada trobada i robi fitxa, que és exactament l'error més habitual d'un
jugador humà d'aquell nivell.

## 2. Perfil i experiència del jugador (`adaptive/experience.ts`)

Cada jugador té un `PlayerProfile` persistent:

- **`rating`**: valoració Elo. Es comença a 1100 i continua servint per mesurar
  l'habilitat i conservar compatibilitat amb perfils anteriors;
- **`adaptiveStep`**: mig graó de dificultat adaptativa (0 = Novell, 2 = Fàcil,
  4 = Mitjà, 6 = Avançat, 8 = Expert);
- **`adaptiveCalibrating`**: indica si encara és a l'escalada inicial;
- **`gamesPlayed`, `wins`**: experiència acumulada;
- **`history`**: les darreres 50 partides (rivals, resultat, evolució de l'Elo).

Després de cada partida, `recordGame` actualitza l'Elo del jugador contra la
mitjana dels rivals de la partida (`adaptive/rating.ts`):

- guanyar contra rivals més forts puja molt; contra rivals fluixos, poc;
- perdre contra rivals fluixos baixa molt; contra rivals forts, poc;
- el **factor K** comença alt (40) i baixa amb l'experiència (24, després 16):
  les primeres partides serveixen per situar ràpidament el nivell del jugador,
  i després la valoració s'estabilitza;
- el **marge del resultat** hi posa el matís: guanyar per molts punts mou la
  valoració un 25% més que guanyar-ne per pocs, i perdre de pallissa la baixa
  més que perdre per poc (`marginFromPoints`).

## 3. Tria d'oponents (`adaptive/adaptiveDifficulty.ts`)

El mode **adaptatiu és el predeterminat**. Un perfil nou no es col·loca d'entrada
segons l'Elo: fa una calibració curta i entenedora:

1. primera partida: **Novell**;
2. si guanya: **Fàcil**;
3. si torna a guanyar: **Mitjà**;
4. després **Avançat** i **Expert**, sempre que continuï guanyant.

Durant aquesta escalada tots els rivals tenen el mateix nivell i **no es mostra
cap número d'habilitat provisional**. Quan arriba la **primera derrota**, s'acaba
la calibració i el marge d'aquella derrota fixa el primer nivell del jugador:

- derrota ajustada: conserva el nivell que estava provant;
- derrota intermèdia: queda a mig graó entre aquell nivell i l'anterior;
- derrota clara: baixa al nivell anterior.

En aquell moment el número d'habilitat es fa visible i queda alineat amb el
nivell assignat (Novell 800, Novell–Fàcil 900, Fàcil 1000, etc.). A partir
d'aquí comença l'ajust fi i el nivell adaptatiu passa a moure's en **mig graons**:

- victòria: puja mig graó;
- derrota: baixa mig graó;
- amb dos rivals, un mig graó es representa amb un rival de cada nivell
  adjacent: per exemple **Fàcil + Mitjà**.

Així, si el jugador guanya a Fàcil però perd a Mitjà, el sistema pot quedar-se
un temps entre tots dos en lloc d'obligar-lo a repetir sempre un únic nivell. Si
millora i torna a encadenar victòries, continua pujant.

Amb un sol rival, els dos nivells adjacents s'alternen entre partides. Amb tres,
s'alterna quin dels dos nivells es repeteix per no esbiaixar sempre la dificultat
cap al mateix costat.

Els perfils antics, que no tenen desat aquest mig graó, es recuperen a partir del
seu Elo perquè no perdin el nivell acumulat. Les partides amb nivell triat
manualment continuen movent l'Elo, però **no alteren l'escala adaptativa**.

Des de la configuració es pot **reiniciar només el nivell adaptatiu**. Això
torna la calibració a Novell i reinicia l'habilitat provisional, però conserva
el nom del jugador, les partides, les victòries i l'historial.

## 4. El cicle complet

```
partida nova ──► suggestOpponents(perfil) ──► createGame(...)
     ▲                                             │
     │                                             ▼
guardar perfil ◄── recordGame(resultat) ◄── partida jugada
```

## 5. Ajust dins de la mateixa partida (opcional)

L'adaptació per Elo actua **entre** partides. Amb la casella «Ajusta la
dificultat durant la partida» activada, els bots també s'ajusten **dins** d'una:
`rubberBandedMistakeRate` els fa equivocar-se una mica més quan al jugador li
queden moltes més fitxes, i afinar quan va guanyant. L'ajust està acotat (mai
per damunt d'un 50% d'error) i el nivell de sortida no canvia.

Ve **desactivat** per defecte: canviar el rival a mitja partida ha de ser una
decisió explícita del jugador, no una sorpresa.

## Millores previstes

- Perfils múltiples al mateix dispositiu (ja ho suporta `ProfileRepository`,
  només cal interfície).
- Estratègia a llarg termini de la IA: guardar-se fitxes per a jugades futures i
  tenir en compte què li pot quedar al rival.
