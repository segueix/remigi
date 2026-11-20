# La partida del dia

Cada dia hi ha **una partida igual per a tothom**, a dalt de la taula de l'inici
(«Partida del dia #N»). Codi: `apps/web/src/dia/daily.ts` (lògica pura),
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
