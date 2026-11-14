import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyKey } from '@remigi/core';
import { useState } from 'react';
import {
  GAME_OPTIONS,
  bestFor,
  challengeTotal,
  challengeWins,
  describeChallenge,
  isDone,
  type ChallengeConfig,
  type ChallengeRivals,
  type ChallengeState,
} from '../repte/challenge';
import { signed } from '../ui/format';

interface Props {
  state: ChallengeState;
  /** Hi ha una partida del repte a mitges (per dir «continua»). */
  hasSavedGame: boolean;
  onStart(config: ChallengeConfig): void;
  onPlay(): void;
  onAbandon(): void;
  onHome(): void;
  /** El perfil, amb la configuració (mode clar o fosc, temps per torn, fitxes). */
  onProfile(): void;
}

/**
 * El repte: tries quantes partides, el nivell dels rivals i quants n'hi ha, i
 * en acabar se sumen els punts de totes. Mentre dura, aquí es veu com va; en
 * acabar, el total i si és un rècord per a aquella configuració.
 */
export function RepteScreen({ state, hasSavedGame, onStart, onPlay, onAbandon, onHome, onProfile }: Props) {
  const current = state.current;
  const [configuring, setConfiguring] = useState(!current);
  const [config, setConfig] = useState<ChallengeConfig>(state.lastConfig);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const record = bestFor(state.history, config);
  const showConfig = configuring || !current;

  return (
    <section className="card pantalla-mode repte">
      <div className="franja-fitxes" aria-hidden="true" />
      <div className="row mode-cap">
        <h2>Repte</h2>
        <div className="row mode-cap-accions">
          <button type="button" className="secondary" onClick={onProfile} aria-label="El teu perfil i la configuració">
            ⚙️ Perfil
          </button>
          <button type="button" className="secondary" onClick={onHome}>
            ← Inici
          </button>
        </div>
      </div>

      {current && !isDone(current) && !showConfig && (
        <div className="repte-en-curs">
          <p className="repte-config">{describeChallenge(current.config)}</p>
          <dl className="rajoles">
            <div className="rajola rajola-a">
              <dt>Partida</dt>
              <dd>
                {current.games.length + 1}
                <small>/{current.config.games}</small>
              </dd>
            </div>
            <div className="rajola rajola-b">
              <dt>Punts</dt>
              <dd>{signed(challengeTotal(current))}</dd>
            </div>
            <div className="rajola rajola-c">
              <dt>Victòries</dt>
              <dd>{challengeWins(current)}</dd>
            </div>
          </dl>
          <GameList games={current.games} />
          <div className="row">
            <button type="button" onClick={onPlay}>
              {hasSavedGame ? 'Continua' : 'Juga'} la partida {current.games.length + 1}
            </button>
            {confirmAbandon ? (
              <>
                <span className="muted small">Es perdrà el que portes fet.</span>
                <button type="button" className="secondary" onClick={onAbandon}>
                  Sí, abandona’l
                </button>
                <button type="button" className="secondary" onClick={() => setConfirmAbandon(false)}>
                  No
                </button>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => setConfirmAbandon(true)}>
                Abandona el repte
              </button>
            )}
          </div>
        </div>
      )}

      {current && isDone(current) && !showConfig && (
        <div className="repte-final">
          <p className="repte-config">{describeChallenge(current.config)}</p>
          <p className="repte-total">
            <span className={challengeTotal(current) >= 0 ? 'points-positive' : 'points-negative'}>
              {signed(challengeTotal(current))}
            </span>
            <small>punts</small>
          </p>
          <p className="muted">
            {challengeWins(current)} {challengeWins(current) === 1 ? 'victòria' : 'victòries'} de{' '}
            {current.config.games} partides.{' '}
            {(() => {
              const best = bestFor(state.history, current.config);
              const runs = state.history.filter((r) => describeChallenge(r.config) === describeChallenge(current.config)).length;
              if (best && runs > 1 && best.total === challengeTotal(current)) return <strong>Nou rècord!</strong>;
              if (best && runs > 1) return <>El teu rècord en aquest repte és {signed(best.total)}.</>;
              return null;
            })()}
          </p>
          <GameList games={current.games} />
          <div className="row">
            <button type="button" onClick={() => onStart(current.config)}>
              Repeteix el repte
            </button>
            <button type="button" className="secondary" onClick={() => setConfiguring(true)}>
              Un altre repte
            </button>
          </div>
        </div>
      )}

      {showConfig && (
        <div className="repte-config-form">
          <p className="muted">
            Juga unes quantes partides seguides contra rivals del nivell que triïs. En acabar se
            sumen els punts de totes: guanyar et dona els punts que els rivals tenen a la mà, i
            perdre et resta els que tens tu.
          </p>
          <fieldset className="tria">
            <legend>Partides</legend>
            {GAME_OPTIONS.map((games) => (
              <button
                key={games}
                type="button"
                className={config.games === games ? '' : 'secondary'}
                aria-pressed={config.games === games}
                onClick={() => setConfig({ ...config, games })}
              >
                {games}
              </button>
            ))}
          </fieldset>
          <fieldset className="tria">
            <legend>Nivell</legend>
            {DIFFICULTY_ORDER.map((level: DifficultyKey) => (
              <button
                key={level}
                type="button"
                className={config.level === level ? '' : 'secondary'}
                aria-pressed={config.level === level}
                onClick={() => setConfig({ ...config, level })}
              >
                {DIFFICULTIES[level].label}
              </button>
            ))}
          </fieldset>
          <fieldset className="tria">
            <legend>Rivals per partida</legend>
            {([1, 2, 3] as ChallengeRivals[]).map((opponents) => (
              <button
                key={opponents}
                type="button"
                className={config.opponents === opponents ? '' : 'secondary'}
                aria-pressed={config.opponents === opponents}
                onClick={() => setConfig({ ...config, opponents })}
              >
                {opponents}
              </button>
            ))}
          </fieldset>
          <p className="muted small">
            {record
              ? `El teu rècord amb aquesta configuració: ${signed(record.total)} punts.`
              : 'Encara no has fet cap repte amb aquesta configuració.'}
          </p>
          <div className="row">
            <button type="button" onClick={() => onStart(config)}>
              Comença el repte
            </button>
            {current && (
              <button type="button" className="secondary" onClick={() => setConfiguring(false)}>
                Torna
              </button>
            )}
          </div>
          {current && !isDone(current) && (
            <p className="muted small">Començar-ne un de nou abandona el que tens en curs.</p>
          )}
        </div>
      )}

      {state.history.length > 0 && (
        <details className="repte-historial">
          <summary>Reptes acabats ({state.history.length})</summary>
          <ul>
            {state.history.slice(0, 15).map((record) => (
              <li key={record.finishedAt}>
                <span>{describeChallenge(record.config)}</span>
                <span className={record.total >= 0 ? 'punts points-positive' : 'punts points-negative'}>
                  {signed(record.total)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function GameList({ games }: { games: readonly { points: number; won: boolean }[] }) {
  if (games.length === 0) return null;
  return (
    <ol className="repte-partides">
      {games.map((game, index) => (
        <li key={index}>
          <span>
            Partida {index + 1} {game.won && <span aria-label="guanyada">👑</span>}
          </span>
          <span className={game.points >= 0 ? 'punts points-positive' : 'punts points-negative'}>
            {signed(game.points)}
          </span>
        </li>
      ))}
    </ol>
  );
}
