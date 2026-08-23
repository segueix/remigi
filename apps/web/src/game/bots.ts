/**
 * Els personatges dels bots: un planter de noms amb avatar d'on surten els
 * rivals de cada partida.
 *
 * Els noms es trien a l'atzar i sense repetir-se en començar cada partida, de
 * manera que no jugues sempre contra «Bot 1» sinó contra algú diferent cada
 * vegada. El nom queda desat dins de l'estat de la partida (el motor només hi
 * veu una cadena), així que una partida represa conserva els mateixos rivals.
 *
 * L'avatar es dedueix del nom, i per això no s'ha de desar enlloc. Un nom que
 * no és al planter —una partida desada d'una versió anterior, amb «Bot 1»—
 * rep l'avatar de recanvi.
 */
export interface BotPersona {
  name: string;
  emoji: string;
}

export const BOT_PERSONAS: readonly BotPersona[] = [
  { name: 'Núria', emoji: '🦉' },
  { name: 'Pau', emoji: '🐢' },
  { name: 'Ona', emoji: '🐬' },
  { name: 'Biel', emoji: '🦁' },
  { name: 'Laia', emoji: '🐈' },
  { name: 'Roc', emoji: '🐺' },
  { name: 'Mar', emoji: '🐙' },
  { name: 'Bruna', emoji: '🐻' },
  { name: 'Pol', emoji: '🐧' },
  { name: 'Aleix', emoji: '🦈' },
  { name: 'Vinyet', emoji: '🦋' },
  { name: 'Txell', emoji: '🐝' },
  { name: 'Nil', emoji: '🐊' },
  { name: 'Ferran', emoji: '🐴' },
  { name: 'Griselda', emoji: '🦚' },
  { name: 'Ot', emoji: '🦫' },
  { name: 'Mercè', emoji: '🐞' },
  { name: 'Quim', emoji: '🦔' },
  { name: 'Neus', emoji: '🐇' },
  { name: 'Jordina', emoji: '🐿️' },
  { name: 'Tià', emoji: '🦀' },
  { name: 'Rosalia', emoji: '🦩' },
  { name: 'Gal·la', emoji: '🐨' },
  { name: 'Vicenç', emoji: '🦅' },
];

/** Avatar de recanvi per a noms que no són al planter (partides antigues). */
const FALLBACK_EMOJI = '🤖';

/** Tria `count` personatges diferents a l'atzar. */
export function pickPersonas(count: number, rng: () => number = Math.random): BotPersona[] {
  const pool = [...BOT_PERSONAS];
  const picked: BotPersona[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

/** L'avatar del bot amb aquest nom. */
export function botEmoji(name: string): string {
  return BOT_PERSONAS.find((persona) => persona.name === name)?.emoji ?? FALLBACK_EMOJI;
}
