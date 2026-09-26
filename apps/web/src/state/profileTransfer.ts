/**
 * Transferència manual del nivell entre dispositius.
 *
 * La URL és deliberadament canònica: encara que el build es provi a localhost
 * o a GitHub Pages, el que es comparteix sempre apunta a la web pública de
 * Remigi a eltauler.cat.
 */
export const PUBLIC_REMIGI_URL = 'https://eltauler.cat/remigi/';

export interface ProfileProgress {
  rating: number;
  gamesPlayed: number;
  wins: number;
  /** Mig graó adaptatiu; absent en enllaços antics. */
  adaptiveStep?: number;
  /** Si encara està fent l'escalada inicial. */
  adaptiveCalibrating?: boolean;
}

const MAX_RATING = 4000;
const MAX_GAMES = 100_000;

export function isValidProfileProgress(value: ProfileProgress): boolean {
  return (
    Number.isInteger(value.rating) &&
    value.rating >= 0 &&
    value.rating <= MAX_RATING &&
    Number.isInteger(value.gamesPlayed) &&
    value.gamesPlayed >= 0 &&
    value.gamesPlayed <= MAX_GAMES &&
    Number.isInteger(value.wins) &&
    value.wins >= 0 &&
    value.wins <= value.gamesPlayed &&
    (value.adaptiveStep === undefined ||
      (Number.isInteger(value.adaptiveStep) && value.adaptiveStep >= 0 && value.adaptiveStep <= 8)) &&
    (value.adaptiveCalibrating === undefined || typeof value.adaptiveCalibrating === 'boolean')
  );
}

export function buildProfileTransferUrl(progress: ProfileProgress): string {
  if (!isValidProfileProgress(progress)) throw new Error('Progrés de perfil no vàlid');
  const url = new URL(PUBLIC_REMIGI_URL);
  url.searchParams.set('nivell', String(progress.rating));
  url.searchParams.set('partides', String(progress.gamesPlayed));
  url.searchParams.set('victories', String(progress.wins));
  if (progress.adaptiveStep !== undefined) {
    url.searchParams.set('grao', String(progress.adaptiveStep));
    url.searchParams.set('calibrant', progress.adaptiveCalibrating ? '1' : '0');
  }
  return url.toString();
}

export function parseProfileTransferUrl(href: string): ProfileProgress | null {
  try {
    const url = new URL(href);
    const nivell = url.searchParams.get('nivell');
    const partides = url.searchParams.get('partides');
    if (nivell === null || partides === null) return null;

    const grao = url.searchParams.get('grao');
    const calibrant = url.searchParams.get('calibrant');
    const progress: ProfileProgress = {
      rating: Number(nivell),
      gamesPlayed: Number(partides),
      wins: Number(url.searchParams.get('victories') ?? 0),
      ...(grao === null
        ? {}
        : {
            adaptiveStep: Number(grao),
            adaptiveCalibrating: calibrant === '1',
          }),
    };
    return isValidProfileProgress(progress) ? progress : null;
  } catch {
    return null;
  }
}

/** Treu només els paràmetres de transferència i conserva qualsevol altre estat de la URL. */
export function stripProfileTransferParams(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('nivell');
  url.searchParams.delete('partides');
  url.searchParams.delete('victories');
  url.searchParams.delete('grao');
  url.searchParams.delete('calibrant');
  return `${url.pathname}${url.search}${url.hash}`;
}
