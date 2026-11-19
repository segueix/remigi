import { TOP_TIER, tierName, type LeagueCareer, type SeasonRecord } from './league';
import type { LeagueHome } from './localitats';

/**
 * El títol més alt del joc: guanyar la Lliga Mundial, Divisió A, el graó més
 * alt de l'escala. Aquí hi ha la part pura (qui el té, què diu el diploma i el
 * missatge per compartir); el dibuix del diploma és a `diplomaCanvas.ts` i la
 * celebració a `screens/ChampionCelebration.tsx`.
 */

/** Una temporada és de campió del món si s'ha guanyat al graó més alt. */
export function isWorldChampion(record: Pick<SeasonRecord, 'tier' | 'rank'> | null | undefined): boolean {
  return !!record && record.tier === TOP_TIER && record.rank === 1;
}

/** Les temporades guanyades a la Mundial A, de la més recent a la més antiga. */
export function worldTitles(career: Pick<LeagueCareer, 'seasons'>): SeasonRecord[] {
  return career.seasons.filter(isWorldChampion);
}

const MONTHS = [
  'gener',
  'febrer',
  'març',
  'abril',
  'maig',
  'juny',
  'juliol',
  'agost',
  'setembre',
  'octubre',
  'novembre',
  'desembre',
];

/** «19 de novembre de 2026», «4 d’abril de 2027» (amb l'apòstrof de davant vocal). */
export function catalanDate(date: Date): string {
  const month = MONTHS[date.getMonth()];
  const link = /^[aeiouàèéíòóú]/i.test(month) ? 'd’' : 'de ';
  return `${date.getDate()} ${link}${month} de ${date.getFullYear()}`;
}

/** Número de sèrie del diploma: sempre el mateix per a la mateixa temporada. */
export function diplomaSerial(record: Pick<SeasonRecord, 'finishedAt' | 'points' | 'wins'>, playerName: string): string {
  const text = `${record.finishedAt}|${record.points}|${record.wins}|${playerName}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

/** Tot el que du el diploma, ja en text, perquè el dibuix no hagi de decidir res. */
export interface DiplomaContent {
  playerName: string;
  /** «Lliga Mundial · Divisió A». */
  leagueName: string;
  title: string;
  honor: string;
  stats: string;
  dateText: string;
  serial: string;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Punts de lliga: «12 punts», «12,5 punts». */
function pointsLabel(points: number): string {
  const value = Number.isInteger(points) ? String(points) : points.toFixed(1).replace('.', ',');
  return `${value} ${points === 1 ? 'punt' : 'punts'}`;
}

export function diplomaContent(
  record: SeasonRecord,
  playerName: string,
  home: LeagueHome | null = null,
): DiplomaContent {
  const name = playerName.trim() || 'Jugador anònim';
  return {
    playerName: name,
    leagueName: tierName(TOP_TIER, home),
    title: 'Millor jugador del món',
    honor: 'per haver guanyat la',
    stats: [
      pointsLabel(record.points),
      plural(record.wins, 'victòria', 'victòries'),
      `1r de ${record.players} jugadors`,
    ].join(' · '),
    dateText: catalanDate(new Date(record.finishedAt)),
    serial: diplomaSerial(record, name),
  };
}

/** Nom del fitxer que es descarrega: «diploma-remigi-daniel.png». */
export function diplomaFileName(playerName: string): string {
  const slug = playerName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return `diploma-remigi${slug ? `-${slug}` : ''}.png`;
}

/** El missatge de WhatsApp (sense nom: parla en primera persona). */
export function shareMessage(record: SeasonRecord, url: string): string {
  return [
    '🏆🎉 Sóc el millor jugador del món al Remigi!',
    `He guanyat la Lliga Mundial · Divisió A: ${pointsLabel(record.points)} i ${plural(record.wins, 'victòria', 'victòries')} contra els millors.`,
    'T’atreveixes a jugar-me? 🎲',
    url,
  ].join('\n');
}

/** Enllaç que obre WhatsApp (mòbil o web) amb el missatge a punt per enviar. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/* ---------- Celebrar només un cop ---------- */

const SEEN_PREFIX = 'remigi:campio:';

/** S'ha celebrat ja aquest títol? (Per no tirar confeti a cada visita.) */
export function wasCelebrated(record: Pick<SeasonRecord, 'finishedAt'>, storage: Pick<Storage, 'getItem'> | null): boolean {
  try {
    return storage?.getItem(SEEN_PREFIX + record.finishedAt) === '1';
  } catch {
    return false;
  }
}

export function markCelebrated(record: Pick<SeasonRecord, 'finishedAt'>, storage: Pick<Storage, 'setItem'> | null): void {
  try {
    storage?.setItem(SEEN_PREFIX + record.finishedAt, '1');
  } catch {
    /* sense emmagatzematge es tornarà a celebrar: no passa res */
  }
}
