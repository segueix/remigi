import { describe, expect, it } from 'vitest';
import {
  PUBLIC_REMIGI_URL,
  buildProfileTransferUrl,
  parseProfileTransferUrl,
  stripProfileTransferParams,
} from './profileTransfer';

describe('transferència del nivell entre dispositius', () => {
  it('comparteix sempre la web pública eltauler.cat/remigi', () => {
    expect(PUBLIC_REMIGI_URL).toBe('https://eltauler.cat/remigi/');
    expect(buildProfileTransferUrl({ rating: 1184, gamesPlayed: 27, wins: 13 })).toBe(
      'https://eltauler.cat/remigi/?nivell=1184&partides=27&victories=13',
    );
  });

  it('recupera el nivell compartit', () => {
    expect(
      parseProfileTransferUrl(
        'https://eltauler.cat/remigi/?nivell=1420&partides=34&victories=19',
      ),
    ).toEqual({ rating: 1420, gamesPlayed: 34, wins: 19 });
  });

  it('rebutja valors manipulats o incoherents', () => {
    expect(parseProfileTransferUrl('https://eltauler.cat/remigi/?nivell=-1&partides=2')).toBeNull();
    expect(
      parseProfileTransferUrl(
        'https://eltauler.cat/remigi/?nivell=1200&partides=3&victories=4',
      ),
    ).toBeNull();
    expect(parseProfileTransferUrl('https://eltauler.cat/remigi/?nivell=hola&partides=3')).toBeNull();
  });

  it('neteja els paràmetres de transferència després d’importar o cancel·lar', () => {
    expect(
      stripProfileTransferParams(
        'https://eltauler.cat/remigi/?nivell=1200&partides=8&victories=4&tema=fosc#taula',
      ),
    ).toBe('/remigi/?tema=fosc#taula');
  });
});
