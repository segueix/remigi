# Regles implementades

Referència de les regles del Rummikub tal com les aplica el motor
(`packages/core/src/core/`). Els codis entre parèntesis són els `RulesError.code`
que retorna el motor quan es trenca la regla.

## Material

- **106 fitxes**: números de l'1 al 13 en 4 colors (vermell, blau, negre,
  taronja), 2 còpies de cada, més 2 jokers.
- Cada jugador comença amb **14 fitxes**. La resta queda al **sac**.
- Partides de **2 a 4 jugadors** (`BAD_PLAYER_COUNT`); l'ús previst és 1 humà
  contra 1–3 IA.

## Jugades vàlides

- **Grup**: 3 o 4 fitxes del **mateix número** i **colors tots diferents**.
- **Escala**: 3 o més fitxes del **mateix color** amb **números consecutius**
  (l'1 no continua després del 13).
- **Joker**: substitueix qualsevol fitxa; val el número de la fitxa que
  substitueix. Una jugada no pot ser només de jokers.

## Torn

A cada torn, el jugador fa **una** d'aquestes dues coses:

1. **Robar** una fitxa del sac (`draw`). Si el sac és buit, robar és passar.
2. **Jugar** (`play`): proposar la nova disposició de la taula. El motor valida:
   - totes les jugades resultants són vàlides (`INVALID_MELD`),
   - no hi ha fitxes repetides (`DUPLICATED_TILE`) ni de cap altre origen
     (`FOREIGN_TILE`),
   - no desapareix cap fitxa de la taula (`TILE_REMOVED`),
   - s'hi afegeix com a mínim una fitxa de la mà (`NO_TILES_PLAYED`).

## Sortida inicial

Fins que un jugador no ha «obert», ha de baixar en un sol torn jugades noves,
fetes **només amb fitxes seves**, que sumin **30 punts o més**
(`OPENING_TOO_LOW`), i **no pot tocar** les jugades que ja hi ha a la taula
(`REARRANGE_BEFORE_OPENING`). Els jokers hi compten pel valor que substitueixen.

## Reordenar la taula

Un cop obert, el jugador pot reorganitzar la taula com vulgui dins del seu torn
(partir escales, moure fitxes entre jugades...), sempre que al final tot quedi
vàlid i hagi afegit almenys una fitxa de la mà.

## Final de partida i puntuació

- Guanya qui es queda **sense fitxes**.
- Si el sac és buit i tots els jugadors passen seguits, la partida queda
  **bloquejada** i guanya qui té menys punts pendents a la mà.
- Puntuació (`finalScores`): cada perdedor **resta** els punts de les fitxes que
  li queden (el joker penalitza 30); el guanyador **suma** els punts de tots els
  altres i no es penalitza les pròpies (només en té si hi ha hagut bloqueig).
  Per tant **la puntuació sempre suma zero**, cosa que permet encadenar rondes
  amb un marcador acumulat coherent.

## Variants encara no implementades

- **Intercanvi de joker**: agafar un joker de la taula substituint-lo per la
  fitxa real. (Previst al full de ruta.)
- Límit de temps per torn (el decidirà la interfície, no el motor).
- Rondes múltiples amb marcador acumulat (la web ho podrà fer encadenant
  partides i sumant `finalScores`).
