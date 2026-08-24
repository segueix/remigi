/**
 * Els personatges dels bots: un planter de noms d'usuari amb avatar d'on
 * surten els rivals de cada partida.
 *
 * Els noms són d'estil «jugador en línia» i es trien a l'atzar i sense
 * repetir-se en començar cada partida. El nom queda desat dins de l'estat de
 * la partida (el motor només hi veu una cadena), així que una partida represa
 * conserva els mateixos rivals.
 *
 * L'avatar —l'emoji i els dos colors del fons degradat— es dedueix del nom, i
 * per això no s'ha de desar enlloc. Un nom que no és al planter (una partida
 * desada d'una versió anterior) rep l'avatar de recanvi.
 */
export interface BotPersona {
  name: string;
  emoji: string;
  /** Els dos colors del degradat de l'avatar, de dalt a baix. */
  colors: [string, string];
}

export const BOT_PERSONAS: readonly BotPersona[] = [
  { name: 'GuineuAstuta', emoji: '🦊', colors: ['#fdba74', '#c2410c'] },
  { name: 'LlopDeNit', emoji: '🐺', colors: ['#cbd5e1', '#334155'] },
  { name: 'DofiVeloç', emoji: '🐬', colors: ['#7dd3fc', '#0369a1'] },
  { name: 'LleóDaurat', emoji: '🦁', colors: ['#fcd34d', '#b45309'] },
  { name: 'GataMandra', emoji: '🐈', colors: ['#f9a8d4', '#9d174d'] },
  { name: 'PolpVuitMans', emoji: '🐙', colors: ['#d8b4fe', '#7e22ce'] },
  { name: 'ÓssaBruna', emoji: '🐻', colors: ['#d6b28a', '#7c4a1e'] },
  { name: 'PingüíFred', emoji: '🐧', colors: ['#bae6fd', '#155e75'] },
  { name: 'TauróBlanc', emoji: '🦈', colors: ['#a5b4fc', '#3730a3'] },
  { name: 'PapallonaBlava', emoji: '🦋', colors: ['#93c5fd', '#1d4ed8'] },
  { name: 'AbellaReina', emoji: '🐝', colors: ['#fde047', '#a16207'] },
  { name: 'CocoDrilo', emoji: '🐊', colors: ['#86efac', '#166534'] },
  { name: 'CavallFort', emoji: '🐴', colors: ['#e7c398', '#92400e'] },
  { name: 'PaóReial', emoji: '🦚', colors: ['#5eead4', '#0f766e'] },
  { name: 'CastorManetes', emoji: '🦫', colors: ['#fca5a5', '#9f1239'] },
  { name: 'MarietaDeLaSort', emoji: '🐞', colors: ['#fecaca', '#b91c1c'] },
  { name: 'EriçóPunxes', emoji: '🦔', colors: ['#d4c5b0', '#78350f'] },
  { name: 'ConillLlest', emoji: '🐇', colors: ['#e9d5ff', '#6b21a8'] },
  { name: 'EsquirolSaltador', emoji: '🐿️', colors: ['#fdb974', '#9a3412'] },
  { name: 'CrancPinces', emoji: '🦀', colors: ['#fda4af', '#be123c'] },
  { name: 'FlamencRosa', emoji: '🦩', colors: ['#fbcfe8', '#db2777'] },
  { name: 'KoalaSon', emoji: '🐨', colors: ['#c7d2fe', '#4338ca'] },
  { name: 'ÀguilaUllDeFalcó', emoji: '🦅', colors: ['#fed7aa', '#7c2d12'] },
  { name: 'MussolSavi', emoji: '🦉', colors: ['#bfdbfe', '#1e3a8a'] },
];

/** Avatar de recanvi per a noms que no són al planter (partides antigues). */
const FALLBACK: Pick<BotPersona, 'emoji' | 'colors'> = {
  emoji: '🤖',
  colors: ['#d1d5db', '#4b5563'],
};

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

/** L'avatar (emoji i colors) del bot amb aquest nom. */
export function botPersona(name: string): Pick<BotPersona, 'emoji' | 'colors'> {
  return BOT_PERSONAS.find((persona) => persona.name === name) ?? FALLBACK;
}

/** L'avatar del bot amb aquest nom. */
export function botEmoji(name: string): string {
  return botPersona(name).emoji;
}
