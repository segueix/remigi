import {
  MemoryStore,
  ProfileRepository,
  STARTING_RATING,
  applyMove,
  createGame,
  createProfile,
  decideAiMove,
  type DifficultyKey,
  type GameState,
} from '@rummikub/core';
import { describe, expect, it } from 'vitest';
import { humanWon, profileAfterGame, ratingChange } from './gameOutcome';

const OPPONENTS: DifficultyKey[] = ['easy', 'medium'];

function newGame(): GameState {
  return createGame({
    seed: 7,
    players: [
      { name: 'Tu', kind: 'human' },
      { name: 'Bot 1', kind: 'ai', aiLevel: 'easy' },
      { name: 'Bot 2', kind: 'ai', aiLevel: 'medium' },
    ],
  });
}

const finishedWith = (winner: number): GameState => {
  const game = newGame();
  return { ...game, status: 'finished', winnerId: game.players[winner].id };
};

describe('qui ha guanyat', () => {
  it('reconeix la victòria del jugador humà i la dels bots', () => {
    expect(humanWon(finishedWith(0))).toBe(true);
    expect(humanWon(finishedWith(2))).toBe(false);
  });

  it('una partida sense acabar no compta com a victòria', () => {
    expect(humanWon(newGame())).toBe(false);
  });
});

describe('el resultat mou l’habilitat', () => {
  it('guanyar la puja i perdre la baixa', () => {
    const profile = createProfile('local', 'Anna');
    const guanyada = profileAfterGame(profile, finishedWith(0), OPPONENTS);
    const perduda = profileAfterGame(profile, finishedWith(1), OPPONENTS);

    expect(guanyada.rating).toBeGreaterThan(STARTING_RATING);
    expect(perduda.rating).toBeLessThan(STARTING_RATING);
    expect(guanyada.wins).toBe(1);
    expect(perduda.wins).toBe(0);
    expect(guanyada.gamesPlayed).toBe(1);
    // El perfil d'entrada no s'ha tocat.
    expect(profile.gamesPlayed).toBe(0);
  });

  it('guanyar contra rivals forts puja més que contra rivals fluixos', () => {
    const profile = createProfile('local', 'Anna');
    const contraExperts = profileAfterGame(profile, finishedWith(0), ['expert', 'expert']);
    const contraNovells = profileAfterGame(profile, finishedWith(0), ['rookie', 'rookie']);
    expect(contraExperts.rating).toBeGreaterThan(contraNovells.rating);
  });

  it('el canvi d’habilitat es pot explicar al jugador', () => {
    const profile = createProfile('local', 'Anna');
    const after = profileAfterGame(profile, finishedWith(0), OPPONENTS);
    const change = ratingChange(profile, after);
    expect(change.before).toBe(STARTING_RATING);
    expect(change.after).toBe(after.rating);
    expect(change.delta).toBe(after.rating - STARTING_RATING);
  });
});

describe('cicle complet amb emmagatzematge', () => {
  it('el perfil actualitzat sobreviu a tancar i reobrir el navegador', async () => {
    const store = new MemoryStore(); // el mateix paper que localStorage al navegador
    const repository = new ProfileRepository(store);
    await repository.save(createProfile('local', 'Anna'));

    // Partida 1: guanyada.
    const abans = await repository.loadOrCreate('local', 'Anna');
    await repository.save(profileAfterGame(abans, finishedWith(0), OPPONENTS));

    // "Es tanca la pestanya": repositori nou sobre el mateix emmagatzematge.
    const desprésDeGuanyar = await new ProfileRepository(store).load('local');
    expect(desprésDeGuanyar!.rating).toBeGreaterThan(STARTING_RATING);
    expect(desprésDeGuanyar!.gamesPlayed).toBe(1);

    // Partida 2: perduda, partint del perfil ja desat.
    await repository.save(profileAfterGame(desprésDeGuanyar!, finishedWith(1), OPPONENTS));

    const final = await new ProfileRepository(store).load('local');
    expect(final!.rating).toBeLessThan(desprésDeGuanyar!.rating);
    expect(final!.gamesPlayed).toBe(2);
    expect(final!.wins).toBe(1);
    expect(final!.history).toHaveLength(2);
    expect(final!.history.map((record) => record.won)).toEqual([true, false]);
    expect(final!.history[0].opponents).toEqual(OPPONENTS);
  });

  it('una partida jugada de debò pel motor també queda registrada', async () => {
    const repository = new ProfileRepository(new MemoryStore());
    let game = newGame();
    while (game.status === 'playing' && game.turn <= 1000) {
      game = applyMove(game, decideAiMove(game, game.currentPlayer));
    }
    expect(game.status).toBe('finished');

    const profile = await repository.loadOrCreate('local', 'Anna');
    const after = profileAfterGame(profile, game, OPPONENTS);
    await repository.save(after);

    const loaded = await repository.load('local');
    expect(loaded!.gamesPlayed).toBe(1);
    expect(loaded!.wins).toBe(humanWon(game) ? 1 : 0);
    // L'habilitat s'ha mogut en la direcció que toca segons el resultat.
    expect(loaded!.rating > STARTING_RATING).toBe(humanWon(game));
  });
});
