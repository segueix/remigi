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
    expect(
      buildProfileTransferUrl({
        rating: 1184,
        gamesPlayed: 27,
        wins: 13,
        adaptiveStep: 3,
        adaptiveCalibrating: false,
      }),
    ).toBe(
      'https://eltauler.cat/remigi/?nivell=1184&partides=27&victories=13&grao=3&calibrant=0',
    );
  });

  it('recupera el nivell compartit', () => {
    expect(
      parseProfileTransferUrl(
        'https://eltauler.cat/remigi/?nivell=1420&partides=34&victories=19&grao=5&calibrant=0',
      ),
    ).toEqual({
      rating: 1420,
      gamesPlayed: 34,
      wins: 19,
      adaptiveStep: 5,
      adaptiveCalibrating: false,
    });
  });

  it('continua acceptant enllaços antics sense el graó adaptatiu', () => {
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
        'https://eltauler.cat/remigi/?nivell=1200&partides=8&victories=4&grao=3&calibrant=0&tema=fosc#taula',
      ),
    ).toBe('/remigi/?tema=fosc#taula');
  });
});
