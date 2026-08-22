/**
 * Emmagatzematge clau–valor mínim. El motor només depèn d'aquesta interfície;
 * cada entorn hi posa la seva implementació:
 *  - MemoryStore: tests i simulacions.
 *  - JsonFileStore (jsonFileStore.ts): CLI i Node.
 *  - localStorage: l'adaptador es farà a l'app web (Fase 2).
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}
