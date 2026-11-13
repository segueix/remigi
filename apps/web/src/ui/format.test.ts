import { describe, expect, it } from 'vitest';
import { leaguePoints, ordinal, signed } from './format';

describe('els formats', () => {
  it('escriu els punts amb signe', () => {
    expect([signed(25), signed(-10), signed(0)]).toEqual(['+25', '−10', '0']);
  });
  it('escriu els ordinals en català', () => {
    expect([1, 2, 3, 4, 5, 12].map(ordinal)).toEqual(['1r', '2n', '3r', '4t', '5è', '12è']);
  });
  it('escriu els mitjos punts amb coma', () => {
    expect([leaguePoints(3), leaguePoints(2.5)]).toEqual(['3', '2,5']);
  });
});
