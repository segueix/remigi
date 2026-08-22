# Aplicació web (Fase 2 — pendent)

Aquí anirà l'aplicació web del Rummikub. Encara no està començada: la Fase 1 s'ha
centrat en el motor del joc (`packages/core`), que ja conté tota la lògica que la
web necessitarà.

## Pla previst

- **Stack**: Vite + React + TypeScript, important `@rummikub/core` des del
  workspace (el motor són funcions pures sobre un estat immutable, pensades per
  encaixar directament amb l'estat de React).
- **Pantalles**:
  - *Inici*: nom del jugador, tria d'1–3 oponents (o deixar que el sistema
    adaptatiu els triï segons el perfil).
  - *Partida*: taula i faristol amb arrossegar i deixar anar, botons "Robar" i
    "Acabar jugada", validació en viu amb els missatges d'error del motor.
  - *Final de ronda*: puntuacions (`finalScores`) i actualització del perfil.
  - *Estadístiques*: evolució de l'Elo, historial de partides.
- **Persistència**: perfil del jugador amb un adaptador `localStorage` que
  implementarà la interfície `KeyValueStore` de `@rummikub/core`.
- **Torns de la IA**: `decideAiMove` és síncron i ràpid; s'executarà amb un petit
  retard artificial perquè el torn del bot es pugui seguir visualment.
