/**
 * El joc es va dir «rummikub» fins que es va reanomenar per no fer servir una
 * marca registrada. Les claus del navegador portaven aquell nom, i canviar-les
 * sense més hauria fet perdre el perfil i la partida a mitges de tothom que ja
 * hi jugava: aquí es copien un sol cop a les claus noves i s'esborren les
 * velles. Quan ja no quedi ningú amb claus velles, això es podrà retirar.
 */
const RENAMED_KEYS: readonly [string, string][] = [
  ['rummikub:profile:local', 'remigi:profile:local'],
  ['rummikub:game', 'remigi:game'],
];

export function migrateOldStorage(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): void {
  try {
    for (const [oldKey, newKey] of RENAMED_KEYS) {
      const value = storage.getItem(oldKey);
      if (value === null) continue;
      if (storage.getItem(newKey) === null) storage.setItem(newKey, value);
      storage.removeItem(oldKey);
    }
  } catch {
    // Sense emmagatzematge (navegació privada estricta) no hi ha res a migrar.
  }
}
