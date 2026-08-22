import {
  createGame,
  currentPlayer,
  difficultyByKey,
  type GameState,
} from '@rummikub/core';
import { useState } from 'react';
import type { ProfileHandle } from '../state/useProfile';

interface Props {
  handle: ProfileHandle;
  onExit(): void;
}

/**
 * Prova de fum de la integració amb el motor: crea una partida de debò i en
 * mostra l'estat. La taula jugable (fitxes, torns, validació) és la Fase 3; per
 * això els oponents encara són fixos i no es pot fer cap moviment.
 */
export function GameScreen({ handle, onExit }: Props) {
  const playerName = handle.profile?.name ?? 'Tu';
  const [game, setGame] = useState<GameState>(() => newGame(playerName));

  return (
    <section className="card">
      <h2>Partida</h2>
      <p className="muted">
        Torn {game.turn} · juga <strong>{currentPlayer(game).name}</strong> · queden{' '}
        {game.bag.length} fitxes al sac
      </p>

      <ul className="players">
        {game.players.map((player, index) => (
          <li key={player.id} className={index === game.currentPlayer ? 'player active' : 'player'}>
            <span className="player-name">
              {player.name}
              {player.kind === 'ai' && (
                <span className="tag">{difficultyByKey(player.aiLevel).label}</span>
              )}
            </span>
            <span className="muted">{player.rack.length} fitxes</span>
          </li>
        ))}
      </ul>

      <p className="notice">
        Encara no es pot jugar: aquesta pantalla només comprova que el motor
        funciona dins de l’aplicació. La taula jugable arriba a la Fase 3.
      </p>

      <div className="row">
        <button onClick={() => setGame(newGame(playerName))}>Reparteix una altra vegada</button>
        <button className="secondary" onClick={onExit}>
          Torna a l’inici
        </button>
      </div>
    </section>
  );
}

function newGame(playerName: string): GameState {
  return createGame({
    players: [
      { name: playerName, kind: 'human' },
      { name: 'Bot 1', kind: 'ai', aiLevel: 'easy' },
      { name: 'Bot 2', kind: 'ai', aiLevel: 'medium' },
    ],
  });
}
