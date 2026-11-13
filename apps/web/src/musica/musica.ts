import type { JinglePlayer, JingleSpec, JingleStyle, RadioAmbient } from './radioambient';

/**
 * La música composta il·limitada d'El Tauler, a Remigi (docs/LLIGA.md §4).
 *
 * Cada vegada que cal música, l'app en compon una peça nova amb
 * `radioambient.js`: un estil diferent del de l'última vegada i una llavor que
 * no doni cap peça ja sentida (se'n recorden les empremtes de les 200
 * darreres). Del que sona només es desa la recepta (estil i llavor, uns 60
 * bytes), perquè la mateixa llavor torna a donar la mateixa peça: així el
 * registre en pot guardar moltes i es poden tornar a escoltar o baixar.
 *
 * Remigi i El Tauler comparteixen `localStorage` a eltauler.cat: les peces
 * que ja han sonat a la lliga d'escacs tampoc no es repeteixen aquí. De les
 * claus d'El Tauler només se'n llegeix; Remigi escriu a les seves.
 */

export const MUSIC_PREFS_KEY = 'remigi:musica';
export const MUSIC_REGISTRY_KEY = 'remigi:musica-registre';
export const MUSIC_SEEN_KEY = 'remigi:musica-vistes';
export const MUSIC_LAST_KEY = 'remigi:musica-darrer';
/** Empremtes de les peces que han sonat a la lliga d'escacs d'El Tauler. */
export const EL_TAULER_SEEN_KEY = 'eltauler_league_jingle_seen';

export const SEEN_MAX = 200;
export const REGISTRY_RECENT = 200;
export const REGISTRY_FAVS = 100;
export const REGISTRY_LATEST = 5;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/* ---------- Preferències ---------- */

export interface MusicPrefs {
  /** Sona música a la pantalla entre jornades de la lliga. */
  on: boolean;
  /** Volum, de 0 a 100. */
  volume: number;
}

export const DEFAULT_MUSIC: MusicPrefs = { on: true, volume: 60 };

export function parseMusicPrefs(raw: string | null): MusicPrefs {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<MusicPrefs>) : null;
    if (!value || typeof value !== 'object') return { ...DEFAULT_MUSIC };
    const volume = Number(value.volume);
    return {
      on: typeof value.on === 'boolean' ? value.on : DEFAULT_MUSIC.on,
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(100, Math.round(volume))) : DEFAULT_MUSIC.volume,
    };
  } catch {
    return { ...DEFAULT_MUSIC };
  }
}

/* ---------- Compositor: sempre una peça nova ---------- */

function readList(store: Store | null, key: string): string[] {
  try {
    const value: unknown = JSON.parse(store?.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Compon una peça nova en bucle (32 s, sense final: sona fins que s'atura):
 * estil diferent de l'anterior i, de 20 llavors a l'atzar, la primera que
 * no doni cap peça sentida ni aquí ni a El Tauler. Apunta la peça com a
 * sentida.
 */
export function composeNew(R: RadioAmbient, store: Store | null, random: () => number = Math.random): JingleSpec {
  let last: string | null = null;
  try {
    last = store?.getItem(MUSIC_LAST_KEY) ?? null;
  } catch {
    last = null;
  }
  const seen = readList(store, MUSIC_SEEN_KEY);
  const heard = new Set([...seen, ...readList(store, EL_TAULER_SEEN_KEY)]);
  const style = R.pickJingle(random, last);
  let spec = R.composeJingle(style, Math.floor(random() * 4294967295) + 1, { loop: true });
  for (let k = 1; k < 20 && heard.has(R.jingleFingerprint(spec)); k++) {
    spec = R.composeJingle(style, Math.floor(random() * 4294967295) + 1, { loop: true });
  }
  try {
    store?.setItem(MUSIC_LAST_KEY, style);
    store?.setItem(MUSIC_SEEN_KEY, JSON.stringify([...seen, R.jingleFingerprint(spec)].slice(-SEEN_MAX)));
  } catch {
    // Sense emmagatzematge, la música sona igual (però es podria repetir).
  }
  return spec;
}

/* ---------- Registre de les peces compostes ---------- */

export interface Piece {
  style: JingleStyle;
  seed: number;
  /** Quan va sonar (ms des de 1970). */
  at: number;
  fav: boolean;
}

const STYLES: readonly JingleStyle[] = ['fanfarria', 'galop', 'rumba', 'funk', 'himne'];

export const pieceKey = (piece: Pick<Piece, 'style' | 'seed'>) => `${piece.style}:${piece.seed}`;

export function registryList(store: Store | null): Piece[] {
  try {
    const value: unknown = JSON.parse(store?.getItem(MUSIC_REGISTRY_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (p): p is Piece =>
          typeof p === 'object' && p !== null && STYLES.includes((p as Piece).style) && Number((p as Piece).seed) > 0,
      )
      .map((p) => ({ style: p.style, seed: Number(p.seed) >>> 0, at: Number(p.at) || 0, fav: p.fav === true }));
  } catch {
    return [];
  }
}

function registrySave(store: Store | null, list: Piece[]): Piece[] {
  const favs = list.filter((p) => p.fav).slice(0, REGISTRY_FAVS);
  const rest = list.filter((p) => !p.fav).slice(0, REGISTRY_RECENT);
  const keep = list.filter((p) => favs.includes(p) || rest.includes(p));
  try {
    store?.setItem(MUSIC_REGISTRY_KEY, JSON.stringify(keep));
  } catch {
    // Sense emmagatzematge no hi ha registre.
  }
  return keep;
}

/** Apunta una peça que ha sonat (la més nova primer; si ja hi era, conserva si és preferida). */
export function registerPiece(store: Store | null, piece: Pick<Piece, 'style' | 'seed'>, at = Date.now()): Piece[] {
  const list = registryList(store);
  const old = list.findIndex((p) => pieceKey(p) === pieceKey(piece));
  const entry: Piece = { style: piece.style, seed: piece.seed >>> 0, at, fav: old >= 0 ? list[old].fav : false };
  if (old >= 0) list.splice(old, 1);
  return registrySave(store, [entry, ...list]);
}

export function toggleFavourite(store: Store | null, key: string): Piece[] {
  const list = registryList(store);
  const piece = list.find((p) => pieceKey(p) === key);
  if (piece) piece.fav = !piece.fav;
  return registrySave(store, list);
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface RegistryGroups {
  latest: Piece[];
  favs: Piece[];
  days: { day: string; label: string | null; items: Piece[] }[];
}

/** Les 5 darreres a la vista, després les preferides i l'arxiu per dies. */
export function registryGroups(list: readonly Piece[], now = Date.now()): RegistryGroups {
  const all = [...list].sort((a, b) => b.at - a.at);
  const latest = all.slice(0, REGISTRY_LATEST);
  const favs = all.slice(REGISTRY_LATEST).filter((p) => p.fav);
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const days: RegistryGroups['days'] = [];
  for (const piece of all.slice(REGISTRY_LATEST).filter((p) => !p.fav)) {
    const key = dayKey(piece.at);
    let group = days[days.length - 1];
    if (!group || group.day !== key) {
      group = { day: key, label: key === today ? 'Avui' : key === yesterday ? 'Ahir' : null, items: [] };
      days.push(group);
    }
    group.items.push(piece);
  }
  return { latest, favs, days };
}

/** Nom del fitxer MP3, sense accents (alguns navegadors canvien els noms no ASCII). */
export function mp3FileName(title: string): string {
  const ascii = `Remigi - ${title.replace(/ · /g, ' - ')}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^\x20-\x7e]/g, '');
  return `${ascii.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()}.mp3`;
}

/* ---------- Càrrega a demanda i reproductor ---------- */

let radio: Promise<RadioAmbient> | null = null;

/** El compositor, que es baixa només el primer cop que cal (~30 kB comprimits). */
export function loadRadio(): Promise<RadioAmbient> {
  radio ??= import('./radioambient').then((module) => module.default);
  return radio;
}

let player: JinglePlayer | null = null;

/** Un sol reproductor per a tota l'app: només sona una peça alhora. */
export async function jinglePlayer(): Promise<{ R: RadioAmbient; player: JinglePlayer }> {
  const R = await loadRadio();
  player ??= R.createJinglePlayer();
  return { R, player };
}

/** Atura el que soni (amb un esvaïment curt). */
export function stopMusic(fade = true): void {
  player?.stop(fade);
}

/** Amb l'app amagada la música s'atura on és, i continua en tornar-hi. */
export function pauseMusic(): void {
  player?.pause();
}

export function resumeMusic(): void {
  player?.resume();
}

const LAMEJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';

/** lamejs, el codificador MP3, es baixa el primer cop que es vol baixar una peça (com a El Tauler). */
export function loadLame(): Promise<import('./radioambient').Lame> {
  const w = window as unknown as { lamejs?: import('./radioambient').Lame };
  if (w.lamejs?.Mp3Encoder) return Promise.resolve(w.lamejs);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = LAMEJS_URL;
    script.async = true;
    script.onload = () => (w.lamejs?.Mp3Encoder ? resolve(w.lamejs) : reject(new Error('lamejs')));
    script.onerror = () => reject(new Error('lamejs'));
    document.head.appendChild(script);
  });
}
