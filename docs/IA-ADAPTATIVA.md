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

«Error per torn» (`mistakeRate`) és la probabilitat que el bot «no vegi» la
millor jugada trobada i robi fitxa, que és exactament l'error més habitual d'un
jugador humà d'aquell nivell. L'expert té reservat, a més, el paràmetre
`rearrangesTable` per quan el solver sàpiga reordenar la taula sencera.

## 2. Perfil i experiència del jugador (`adaptive/experience.ts`)

Cada jugador té un `PlayerProfile` persistent:

- **`rating`**: valoració Elo. Es comença a 1100 (entre Fàcil i Mitjà).
- **`gamesPlayed`, `wins`**: experiència acumulada.
- **`history`**: les darreres 50 partides (rivals, resultat, evolució de l'Elo).

Després de cada partida, `recordGame` actualitza l'Elo del jugador contra la
mitjana dels rivals de la partida (`adaptive/rating.ts`):

- guanyar contra rivals més forts puja molt; contra rivals fluixos, poc;
- perdre contra rivals fluixos baixa molt; contra rivals forts, poc;
- el **factor K** comença alt (40) i baixa amb l'experiència (24, després 16):
  les primeres partides serveixen per situar ràpidament el nivell del jugador,
  i després la valoració s'estabilitza.

## 3. Tria d'oponents (`adaptive/adaptiveDifficulty.ts`)

Quan comença una partida, `suggestOpponents(perfil, quants)` tria els nivells:

- el **nivell principal** és el que té l'Elo més proper al del jugador — per
  construcció, això empeny el percentatge de victòries cap al **50%**;
- amb **2 oponents**: el principal i un de mig graó per sota;
- amb **3 oponents**: un per sota, el principal i un per sobre, de manera que la
  partida tingui varietat sense deixar de ser equilibrada.

El jugador sempre pot ignorar la proposta i triar els nivells a mà: la tria
adaptativa és un suggeriment, no una imposició (la interfície ho oferirà així).

## 4. El cicle complet

```
partida nova ──► suggestOpponents(perfil) ──► createGame(...)
     ▲                                             │
     │                                             ▼
guardar perfil ◄── recordGame(resultat) ◄── partida jugada
```

## Millores previstes

- **Rubber banding** (opcional i desactivable): ajustar lleugerament el
  `mistakeRate` dels bots durant la partida segons com d'avançat o endarrerit va
  el jugador, per suavitzar les ratxes.
- Tenir en compte el **marge de derrota** (punts pendents) i no només
  guanyar/perdre a l'hora d'actualitzar l'Elo.
- Perfils múltiples al mateix dispositiu (ja ho suporta `ProfileRepository`,
  només cal interfície).
