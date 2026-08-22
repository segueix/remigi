# Arquitectura

## Visió general

El projecte és un monorepo amb workspaces d'npm:

- **`packages/core`** — el motor del joc. TypeScript pur, **sense cap dependència
  d'interfície ni de navegador**, perquè la mateixa lògica serveixi per a la web
  (Fase 2), per al simulador de terminal i per als tests.
- **`apps/web`** — l'aplicació web (pendent, Fase 2).

Dependències entre capes (sempre en aquesta direcció, mai al revés):

```
core  ◄──  ai  ◄──  adaptive
  ▲          ▲          ▲
  └──────────┴──────────┴──  persistence · cli · (futura) app web
```

## Decisions principals

### Estat immutable i funcions pures

`GameState` és JSON pur i `applyMove(state, move)` retorna un estat **nou** sense
tocar l'anterior. Això dona de franc:

- integració directa amb React (`setState(applyMove(state, move))`),
- desar i restaurar partides serialitzant l'estat,
- desfer jugades guardant estats anteriors,
- tests senzills (es forgen estats artificials, vegeu `test/helpers.ts`).

### Cada fitxa té identitat

Les 106 fitxes tenen un `id` únic (`red-7-a`, `joker-b`...). Validar un moviment
es redueix a comparar conjunts d'ids: la taula nova ha de ser exactament la taula
antiga més fitxes de la mà del jugador, sense duplicats ni desaparicions.

### El moviment «jugar» proposa la taula sencera

Un `Move` de tipus `play` porta la disposició completa de la taula resultant.
Així un sol format de moviment cobreix baixar jugades noves, allargar-ne
d'existents i reordenar la taula, i el motor només ha de validar el resultat.
Els errors es llancen com a `RulesError` amb un `code` estable (per a la lògica)
i un missatge en català (per ensenyar directament a la interfície).

### Partides reproduïbles

El barreig i les decisions de la IA fan servir un RNG amb llavor (`random.ts`).
Amb la mateixa llavor, la mateixa partida: imprescindible per depurar i testejar.

### Una sola IA, molts nivells

No hi ha un algorisme per nivell: hi ha **un únic cercador de jugades**
(`ai/solver.ts`) i **paràmetres que el limiten** (`ai/difficulty.ts`): probabilitat
d'error humà (`mistakeRate`), si pot allargar la taula (`extendsBoard`), si juga
els jokers (`usesJokers`)... Ajustar la corba de dificultat és tocar números, no
reescriure lògica. La capa adaptativa (`adaptive/`) tria aquests paràmetres
segons el perfil del jugador; vegeu `docs/IA-ADAPTATIVA.md`.

### Persistència per interfície

El motor només coneix `KeyValueStore` (get/set/remove). Implementacions:
`MemoryStore` (tests), `JsonFileStore` (Node; no s'exporta des de l'índex per no
arrossegar dependències de Node a la web) i, a la Fase 2, un adaptador de
`localStorage`.

## Limitacions conegudes (apuntades al full de ruta)

- El solver és una heurística voraç: no reordena la taula sencera per encabir-hi
  més fitxes (`rearrangesTable` és el ganxo previst) i, a les escales, fa servir
  els jokers per omplir forats interns, no per allargar extrems.
- No hi ha intercanvi de jokers de la taula.
- L'adaptació de dificultat es fa entre partides; l'ajust dins de la mateixa
  partida (*rubber banding*) està pendent.

## Com hi encaixarà l'app web (Fase 2)

- L'estat de React serà directament el `GameState`; cada acció de l'usuari
  construeix un `Move` i crida `applyMove` dins d'un `try/catch` que mostra el
  missatge del `RulesError` si el moviment no és legal.
- Els torns dels bots criden `decideAiMove` (síncron i ràpid) amb un petit retard
  perquè es puguin seguir visualment.
- En acabar, `finalScores` + `recordGame` actualitzen el perfil, i
  `suggestOpponents` proposa els rivals de la partida següent.
