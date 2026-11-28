# Jugadors automàtics de la partida del dia

Perfils que juguen cada dia la partida del dia i en publiquen el resultat a la
classificació, barrejats amb la gent, per donar sensació de participació
mentre hi ha pocs jugadors. Quan n'hi hagi prou, es retiren (vegeu
[Retirar-los](#retirar-los)).

## Com funcionen

- **Juguen de debò.** Cada jugador fa la mateixa partida del dia que tothom
  (mateixa barreja, mateixos rivals, que juguen igual), amb el motor del joc
  fent de jugador al lloc del jugador humà (`apps/web/src/bots/automatic.ts`,
  `playDaily`). El resultat és el que surt de la partida: jugades, punts a la mà
  i punts dels rivals (desempat).
- **Més fort o més fluix segons el dia.** La força de cada dia és la mitjana del
  jugador (`rating`) més o menys un marge (`spread`), a l'atzar però sempre la
  mateixa per a aquell jugador i aquell dia.
- **Alguns dies no juguen** (`skipRate`, per exemple 0,15 ≈ 1 dia de cada 7).
- **Publiquen dins de la seva franja** de Barcelona (`from`, `to`): cada dia,
  un minut a l'atzar dins de la franja. Publica la primera execució de la tasca
  que arriba després d'aquest minut (vegeu [Horari](#horari)).
- **No se salten cap dia que els toca.** Les execucions programades de GitHub
  poden arribar hores tard o no arribar (el 22-11-2026 no van arribar ni la de
  les 9 h ni la de les 11 h). Per això cada execució mira la fitxa del jugador
  (`jugadors/{uid}`, l'últim dia que va publicar) i publica el que falti: el
  d'avui si ja ha passat la seva hora i, si ahir li tocava i no va publicar,
  també el d'ahir (`botPending`).
- **Ratxa pròpia**: la de partides guanyades seguides, a `jugadors/{uid}` com la
  de qualsevol jugador. Si un dia no juga o perd, torna a zero.
- Tot és determinista per jugador i dia: si la tasca s'executa dues vegades no
  canvia res, i no publica mai dos cops el mateix dia.

## Peces

| Peça | Què fa |
|---|---|
| `tools/jugadors-automatics/jugadors.json` | La llista de jugadors automàtics |
| `tools/jugadors-automatics/publica.ts` | Decideix qui publica ara, juga i escriu a Firestore |
| `apps/web/src/bots/automatic.ts` | La lògica (pura i amb proves): força del dia, hora, partida, ratxa |
| `.github/workflows/jugadors-automatics.yml` | La tasca programada: 9 cops al dia, amb reserves (vegeu [Horari](#horari)) |
| Secret `FIREBASE_SERVICE_ACCOUNT` (GitHub) | La clau de servei de Firebase per escriure |

La tasca escriu amb la clau de servei (Firebase Admin), que no passa per les
regles de Firestore: per això un jugador automàtic no necessita compte de
Google.

## Horari

La mateixa tasca fa també la **fotografia de la classificació**
(`classificacio/{dia}`: tots els resultats en un sol document, vegeu
`apps/web/src/cloud/snapshot.ts`). Totes les execucions programades fan el
mateix, `publica.ts --auto`: **tot el que falti**, segons l'hora de Barcelona i
el que ja hi ha a Firestore, en aquest ordre:

1. els jugadors automàtics que ahir havien de jugar i no van publicar;
2. la classificació **final d'ahir**, si encara no està tancada (a partir de
   les 6 h, o de seguida si el pas 1 hi ha afegit algú);
3. els jugadors automàtics d'avui als quals ja ha arribat l'hora;
4. la fotografia d'avui, si ja ha passat una de les hores (9, 15 o 22 h a
   l'hivern; 10, 16 i 23 h a l'estiu) i la que hi ha és d'abans (`snapshotDue`);
5. els rànquings de la **setmana i del mes fins ahir** (`setmana/{AAAA-Www}`,
   `mes/{AAAA-MM}`), un cop la classificació d'ahir és la final i si encara no
   compten fins ahir (es fa just després del pas 2; vegeu
   [PARTIDA-DEL-DIA.md](PARTIDA-DEL-DIA.md#setmana-i-mes)). A mà:
   `publica.ts --periodes`, o «periodes» a **Run workflow**.

Hi ha execucions de reserva: si una no arriba, la següent ho posa al dia, i si
sobren no repeteixen res. Hores fixes en UTC, a minuts lluny de l'inici de
l'hora (que és quan GitHub en descarta més):

| UTC | Barcelona (hivern / estiu) | Per a |
|---|---|---|
| 07:17 | 8:17 / 9:17 | jugadors · tancar ahir |
| 08:17 | 9:17 / 10:17 | jugadors · fotografia de les 9 h |
| 09:17 | 10:17 / 11:17 | jugadors |
| 10:17 | 11:17 / 12:17 | jugadors |
| 11:37 | 12:37 / 13:37 | jugadors que falten |
| 14:17 | 15:17 / 16:17 | fotografia de les 15 h |
| 16:17 | 17:17 / 18:17 | reserva |
| 21:17 | 22:17 / 23:17 | fotografia de les 22 h |
| 21:47 | 22:47 / 23:47 | reserva |

Amb menys de 50 jugadors (`LIVE_LIMIT`), l'app llegeix la classificació en
directe i sencera; amb més, llegeix la fotografia (1 lectura) i hi posa la teva
fila al seu lloc, provisional si has jugat després de l'última. La classificació
ho diu: «Actualitzada a les 15 h · s'actualitza a les 9, 15 i 22 h».

## Posar-ho en marxa (un sol cop)

1. **Crea la clau de servei de Firebase.** Consola de Firebase → ⚙
   **Configuración del proyecto → Cuentas de servicio → Generar nueva clave
   privada** → es baixa un fitxer `.json`. Guarda'l bé: dona accés total a la
   base de dades.
2. **Desa-la a GitHub.** `segueix/remigi` → **Settings → Secrets and variables
   → Actions → New repository secret**. Nom: `FIREBASE_SERVICE_ACCOUNT`. Valor:
   tot el contingut del fitxer `.json` (obre'l amb un editor de text, copia-ho
   tot i enganxa-ho). Després, esborra el fitxer de l'ordinador.
3. **Publica les regles de Firestore** (`firestore.rules`): inclouen la lectura
   pública de `classificacio`, `setmana` i `mes`.
4. **Prova-ho.** `segueix/remigi` → **Actions → Partida del dia (jugadors i
   classificació) → Run workflow**, amb «auto» i «Prova» marcat: diu què faria
   sense escriure res. Per fer ara tot el que falti, desmarca «Prova»; perquè
   els jugadors no esperin la seva hora, marca també «Els jugadors no esperen
   la seva hora».

A partir d'aquí, la tasca s'executa sola cada dia.

## Crear un jugador nou

1. Afegeix-lo a `tools/jugadors-automatics/jugadors.json`:

   ```json
   {
     "key": "nom-curt",
     "alias": "NomQueSurt",
     "uid": "28 lletres i xifres a l'atzar",
     "rating": 1200,
     "spread": 180,
     "skipRate": 0.15,
     "from": "08:00",
     "to": "12:00",
     "active": true
   }
   ```

   | Camp | Què és |
   |---|---|
   | `key` | Nom curt, només per als registres |
   | `alias` | El nom de la classificació (com a molt 24 caràcters) |
   | `uid` | Identificador únic a Firestore, de 28 caràcters com els de Google. Genera'l amb `node -e "const a='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';console.log(Array.from({length:28},()=>a[Math.floor(Math.random()*a.length)]).join(''))"`. **No el canviïs mai** un cop en marxa: perdria la ratxa |
   | `rating` | Força mitjana: 800 Novell, 1000 Fàcil, 1200 Mitjà, 1400 Avançat, 1600 Expert |
   | `spread` | Quant puja o baixa cada dia (180 → de 1020 a 1380 si la mitjana és 1200) |
   | `skipRate` | Probabilitat de no jugar un dia (0 = cada dia, 0,3 ≈ 2 dies per setmana) |
   | `from`, `to` | Franja per publicar, hora de Barcelona. Publica la primera execució de la tasca que arriba després del seu minut (vegeu [Horari](#horari)) |
   | `active` | `false` perquè deixi de jugar |
   | `start` | Opcional. Primer dia que juga (AAAA-MM-DD). Posa-hi el dia que entra a `main`: sense, la primera execució també publicaria el dia abans |
   | `curve` | Opcional. Com es mou la força mitjana amb els dies (vegeu [Corbes](#corbes-i-reaccio)) |
   | `adapt` | Opcional. Com reacciona al resultat del dia abans (vegeu [Corbes](#corbes-i-reaccio)) |

2. Prova'l en local, sense escriure res:

   ```bash
   cd tools/jugadors-automatics
   npm ci
   npx tsx publica.ts --auto --prova                # el que faria ara
   npx tsx publica.ts --auto --prova --dia=2026-12-01
   ```

3. Puja el canvi a `main` (amb una pull request). L'endemà ja juga.

**Consells perquè semblin gent diferent:** forces diferents (un de 1000, un de
1250, un de 1400), `skipRate` diferent (un que juga cada dia, un altre que en
salta sovint), noms d'estils diferents (un nom de pila, un sobrenom, un nom amb
números), i franges diferents (un a primera hora, un altre a mig matí).

**Referència:** MirdeTost juga amb `rating` 1450 i `spread` 80 (1370–1530).
La configuració anterior, 1200 ±180, reordenava poc la taula i allargava
moltes partides. En una comparació de 14 dies (20-11 a 03-12-2026), la
mitjana baixa de 24 a 17,2 jugades i passa de 3 a 9 victòries. És una mostra,
no un límit: encara hi ha derrotes i partides llargues o bloquejades.

Els punts dels rivals són la suma de totes les seves mans: +118 contra dos
rivals són 59 punts de mitjana per rival, no 118 punts a la mà de MirdeTost.
No es retallen jugades ni punts, ni es tornen a jugar partides per triar un
resultat més favorable. El canvi afecta les publicacions següents; les ja
publicades es conserven.

## Corbes i reacció

Sense `curve` ni `adapt`, la força de cada dia és `rating` ± `spread` (com
MirdeTost, Guineueta i Despertaferro). Amb aquests camps, cada jugador té la
seva pròpia forma (`curveRating` i `adaptDelta` a `automatic.ts`):

**Força del dia = corba(dia) + reacció(dia abans) ± `spread`**, entre 800 i 1600.

| `curve.kind` | Camps | Què fa |
|---|---|---|
| `aprenent` | `start`, `from`, `halfLife` | Comença a `from` el dia `start` i s'acosta a `rating`: fa la meitat del camí en `halfLife` dies, la meitat del que queda en uns altres `halfLife`, etc. |
| `ones` | `period`, `amplitude` | Puja i baixa al voltant de `rating`, ±`amplitude`, amb un cicle de `period` dies (bones i males temporades) |
| `setmana` | `offsets` (7 valors, de diumenge a dissabte) | `rating` més l'ajust del dia de la setmana |

`adapt` = `{ win, loss, max }`: si el dia abans va jugar, suma `win` per cada
victòria de la ratxa que porta, o `loss` si va perdre; com a molt ±`max`. Si
el dia abans no va jugar, res. La reacció es calcula amb la fitxa
(`jugadors/{uid}`), així que `--prova` sense Firestore no la mostra (surt la
força sense reacció). Ni la corba ni la reacció canvien si juga ni a quina
hora publica.

## Retirar-los

- **Un sol jugador:** posa `"active": false` a `jugadors.json`. Deixa de jugar
  l'endemà; els resultats d'abans es queden a la classificació dels dies que van
  jugar (avui i ahir), i la seva ratxa s'apaga sola en dos dies.
- **Tots:** desactiva la tasca a **Actions → Jugadors automàtics → ⋯ → Disable
  workflow**, o posa'ls tots a `false`.
- Per esborrar-ne el rastre del tot: a Firestore, esborra els documents amb el
  seu `uid` a `jugadors` i a `dia/{dia}/resultats` dels dies que vulguis.

## Cost

- **GitHub Actions:** 9 execucions al dia d'un minut escàs ≈ 270 minuts al mes
  (els 2.000 minuts gratuïts del pla gratuït són per a tots els repositoris
  privats del compte).
- **Firestore:** per execució, 1 lectura per jugador automàtic (la fitxa) i 2
  de les classificacions d'ahir i d'avui; quan publica, 1 lectura més i 2
  escriptures; per cada fotografia, una lectura per jugador del dia i 1
  escriptura. Res.

## Jugadors actuals

| `key` | Nom | Força | Marge | No juga | Franja | Execució (hivern / estiu) |
|---|---|---|---|---|---|---|
| `guineueta` | Guineueta | 1150 | ±200 | 30 % | 07:00–09:15 | 8:17 o 9:17 / 9:17 |
| `mirdetost` | MirdeTost | 1450 | ±80 | 15 % | 09:20–10:15 | 10:17 / 10:17 |
| `urgellenc` | Urgellenc | 1050 → 1450 (aprenent) | ±60 | 10 % | 10:20–11:15 | 11:17 / 11:17 |
| `capitaenciam` | CapitàEnciam | 1250 + dia de la setmana | ±60 | 25 % | 11:20–13:35 | 12:37 o 15:17 / 12:17 o 13:37 |
| `despertaferro` | Despertaferro | 1400 | ±50 | 5 % | 15:20–17:15 | 17:17 / 16:17 o 18:17 |
| `garrapinyada` | Garrapinyada | 1300 ±180 (ones de 9 dies) | ±40 | 20 % | 18:20–22:15 | 22:17 / 23:17 |

**Cada un publica en una execució diferent**, a l'hivern i a l'estiu: les
franges acaben a :15 i comencen a :20, a banda i banda d'una execució de les
dues estacions. Si una execució arriba tard o no arriba, la següent pot
publicar-ne dos alhora. Si es canvien les franges o l'horari de la tasca, cal
tornar a comprovar que no comparteixen execució.

- **Guineueta**: matinera i irregular. Força mitjana-baixa amb molta variació
  (950–1350) i salta uns 2 dies per setmana. Publica a primera hora (8:17 o 9:17 a
  l'hivern).
- **Despertaferro**: força mitjana-alta i molt constant (1350–1450), una mica
  per sota de MirdeTost, i gairebé no falla cap dia. Publica a la tarda (17:17 a l'hivern; 16:17 o
  18:17 a l'estiu).
- **Urgellenc**: l'aprenent tossut. Comença fluix (1050 el 28-11-2026) i
  millora amb una corba d'aprenentatge: ~1250 a les 3 setmanes, ~1350 a les 6,
  i s'acosta a 1450 sense arribar-hi. Quan perd, l'endemà s'hi posa més
  (+60); les victòries no el canvien. Publica a mig matí (11:17).
- **Garrapinyada**: de ratxes. La força fa ones de 9 dies entre 1120 i 1480, i
  a més s'engresca quan guanya (+30 per victòria seguida, fins a +120) i
  s'enfonsa quan perd (−40): ratxes llargues bones i dolentes. Salta 1 dia de
  cada 5. Publica al vespre (22:17 a l'hivern, 23:17 a
  l'estiu).
- **CapitàEnciam**: de cap de setmana. Fort el dissabte i el diumenge (1400),
  fluix entre setmana (1100 el dimecres), i es confia quan guanya (−35 per
  victòria seguida, fins a −105) i es pica quan perd (+20): poques ratxes
  llargues. Salta 1 dia de cada 4. Publica a l'hora de dinar (12:37 o 15:17 a
  l'hivern; 12:17 o 13:37 a l'estiu).
