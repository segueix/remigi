import { createProfile, type PlayerProfile } from '../adaptive/experience';
import type { KeyValueStore } from './storage';

const KEY_PREFIX = 'rummikub:profile:';

/** Desa i recupera perfils de jugador sobre qualsevol KeyValueStore. */
export class ProfileRepository {
  constructor(private readonly store: KeyValueStore) {}

  async load(id: string): Promise<PlayerProfile | null> {
    const raw = await this.store.get(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as PlayerProfile) : null;
  }

  async loadOrCreate(id: string, name: string): Promise<PlayerProfile> {
    return (await this.load(id)) ?? createProfile(id, name);
  }

  async save(profile: PlayerProfile): Promise<void> {
    await this.store.set(KEY_PREFIX + profile.id, JSON.stringify(profile));
  }

  async remove(id: string): Promise<void> {
    await this.store.remove(KEY_PREFIX + id);
  }
}
