import { describe, expect, it } from 'vitest';
import { dailyInviteUrl } from '../dia/daily';
import { gameUrl } from './gameUrl';

describe('l’adreça que es comparteix', () => {
  it('és sempre eltauler.cat/remigi, mai la de GitHub Pages', () => {
    expect(gameUrl()).toBe('https://eltauler.cat/remigi/');
    expect(dailyInviteUrl(gameUrl())).toBe('https://eltauler.cat/remigi/?partida=dia');
    expect(gameUrl()).not.toContain('github.io');
  });
});
