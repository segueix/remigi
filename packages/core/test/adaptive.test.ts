import { describe, expect, it } from 'vitest';
import { suggestOpponents } from '../src/adaptive/adaptiveDifficulty';
import { createProfile, kFactor, recordGame, STARTING_RATING } from '../src/adaptive/experience';
import { expectedScore, updateRating } from '../src/adaptive/rating';

describe('valoració Elo', () => {
  it('amb valoracions iguals, la probabilitat esperada és del 50%', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it('guanyar contra un rival més fort puja més que contra un de més fluix', () => {
    const vsStronger = updateRating(1000, 1400, 1, 32) - 1000;
    const vsWeaker = updateRating(1000, 800, 1, 32) - 1000;
    expect(vsStronger).toBeGreaterThan(vsWeaker);
    expect(updateRating(1000, 800, 0, 32)).toBeLessThan(1000);
  });
});

describe('perfil del jugador', () => {
  it('comença amb la valoració inicial i el factor K va baixant amb l’experiència', () => {
    expect(createProfile('u1', 'Anna').rating).toBe(STARTING_RATING);
    expect(kFactor(0)).toBeGreaterThan(kFactor(15));
    expect(kFactor(15)).toBeGreaterThan(kFactor(50));
  });

  it('registra partides sense modificar el perfil original', () => {
    const profile = createProfile('u1', 'Anna');
    const afterWin = recordGame(profile, ['expert'], true, new Date('2026-01-01'));
    expect(afterWin.rating).toBeGreaterThan(profile.rating);
    expect(afterWin.gamesPlayed).toBe(1);
    expect(afterWin.wins).toBe(1);
    expect(afterWin.history).toHaveLength(1);
    expect(profile.gamesPlayed).toBe(0);

    const afterLoss = recordGame(afterWin, ['rookie', 'rookie'], false, new Date('2026-01-02'));
    expect(afterLoss.rating).toBeLessThan(afterWin.rating);
    expect(afterLoss.wins).toBe(1);
  });
});

describe('tria adaptativa d’oponents', () => {
  it('proposa rivals fluixos a un principiant i forts a un jugador expert', () => {
    const beginner = { ...createProfile('u1', 'Nou'), rating: 750 };
    expect(suggestOpponents(beginner, 1)).toEqual(['rookie']);

    const strong = { ...createProfile('u2', 'Crac'), rating: 1650 };
    expect(suggestOpponents(strong, 1)).toEqual(['expert']);
  });

  it('amb més d’un oponent, dispersa els nivells al voltant del principal', () => {
    const profile = { ...createProfile('u1', 'Mitjana'), rating: 1200 };
    expect(suggestOpponents(profile, 2)).toEqual(['easy', 'medium']);
    expect(suggestOpponents(profile, 3)).toEqual(['easy', 'medium', 'advanced']);
  });
});
