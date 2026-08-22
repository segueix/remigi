import type { KeyValueStore } from './storage';

/**
 * Emmagatzematge en un fitxer JSON (només Node: CLI, servidor). No s'exporta des
 * de l'índex del paquet perquè l'app web no arrossegui dependències de Node;
 * importeu-lo directament d'aquest fitxer quan calgui.
 */
export class JsonFileStore implements KeyValueStore {
  constructor(private readonly filePath: string) {}

  private async readAll(): Promise<Record<string, string>> {
    const fs = await import('node:fs/promises');
    try {
      return JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private async writeAll(data: Record<string, string>): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async get(key: string): Promise<string | null> {
    return (await this.readAll())[key] ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const data = await this.readAll();
    data[key] = value;
    await this.writeAll(data);
  }

  async remove(key: string): Promise<void> {
    const data = await this.readAll();
    delete data[key];
    await this.writeAll(data);
  }
}
