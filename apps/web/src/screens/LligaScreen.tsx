import { DIFFICULTIES } from '@remigi/core';
import { useState } from 'react';
import { PinIcon } from '../components/icons';
import { botPersona } from '../game/bots';
import {
  GROUPS,
  LEAGUE_LEVELS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  PLAYER_OPTIONS,
  RIVAL_SPREAD,
  TOP_TIER,
  YOU,
  difficultyForRating,
  isFinished,
  levelName,
  movementText,
  normalizeConfig,
  rivalById,
  roundsToMeetAll,
  standings,
  tablePoints,
  tierGroup,
  tierLevel,
  tierName,
  tierRating,
  yourTable,
  zoneOf,
  zoneSize,
  type LeagueConfig,
  type LeagueSeason,
  type LeagueState,
  type Movement,
  type TableRivals,
} from '../lliga/league';
import { LocationDialog } from '../lliga/LocationDialog';
import type { LeagueHome } from '../lliga/localitats';
import { leaguePoints, ordinal, signed } from '../ui/format';

interface Props {
  state: LeagueState;
  playerName: string;
  /** Hi ha la jornada a mitges (per dir «continua»). */
  hasSavedGame: boolean;
  /** La localitat que el jugador té a la lliga d'escacs d'El Tauler, si n'hi ha. */
  elTaulerHome: LeagueHome | null;
  onStartSeason(config: LeagueConfig): void;
  onPlayRound(): void;
  onAbandonSeason(): void;
  /** Desa on jugues (`null`: «Ara no»). */
  onSetHome(home: LeagueHome | null): void;
  onHome(): void;
}

/** Rival (força) en paraules: «Fàcil · 1010». */
function strengthLabel(rating: number): string {
  return `${DIFFICULTIES[difficultyForRating(rating)].label} · ${rating}`;
}

export function LligaScreen({
  state,
  playerName,
  hasSavedGame,
  elTaulerHome,
  onStartSeason,
  onPlayRound,
  onAbandonSeason,
  onSetHome,
  onHome,
}: Props) {
  const { career, season } = state;
  const [config, setConfig] = useState<LeagueConfig>(career.config);
  const [locationOpen, setLocationOpen] = useState(!career.home && !career.homeAsked);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const running = season !== null && !isFinished(season);
  const finished = season !== null && isFinished(season);
  const tier = running && season ? season.tier : career.tier;
  const title = running && season ? season.name : tierName(career.tier, career.home);

  return (
    <section className="card pantalla-mode lliga">
      <div className="franja-fitxes" aria-hidden="true" />
      <div className="row mode-cap">
        <h2>{title}</h2>
        <button type="button" className="secondary" onClick={onHome}>
          ← Inici
        </button>
      </div>

      <Ladder tier={tier} best={career.bestTier} home={career.home} />
      <p className="muted small escala-nota">
        Es puja d’un en un: de la <strong>C</strong> a la <strong>B</strong>, de la B a la{' '}
        <strong>A</strong>, i de la A a la C de la lliga següent. Pugen els primers i baixen els
        últims (una quarta part de la lliga).
      </p>

      <div className="row lliga-lloc">
        <button type="button" className="link" onClick={() => setLocationOpen(true)}>
          <PinIcon />
          {career.home
            ? [career.home.municipi, career.home.comarca].filter(Boolean).join(' · ')
            : 'Tria on jugues'}
        </button>
        <span className="muted small">
          Rivals d’aquesta lliga: <strong>{strengthLabel(tierRating(tier))}</strong> (±{RIVAL_SPREAD})
        </span>
      </div>

      {finished && season && <SeasonReview season={season} state={state} playerName={playerName} />}

      {running && season && (
        <>
          <RoundCard season={season} hasSavedGame={hasSavedGame} onPlay={onPlayRound} />
          <StandingsTable season={season} playerName={playerName} />
          <YourRounds season={season} />
          <div className="row">
            {confirmAbandon ? (
              <>
                <span className="muted small">La temporada no comptarà per a res.</span>
                <button type="button" className="secondary" onClick={onAbandonSeason}>
                  Sí, abandona-la
                </button>
                <button type="button" className="secondary" onClick={() => setConfirmAbandon(false)}>
                  No
                </button>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => setConfirmAbandon(true)}>
                Abandona la temporada
              </button>
            )}
          </div>
        </>
      )}

      {!running && (
        <SeasonSetup
          config={config}
          onChange={setConfig}
          nextName={tierName(career.tier, career.home)}
          onStart={() => onStartSeason(config)}
          finished={finished}
        />
      )}

      {career.seasons.length > 0 && (
        <details className="lliga-palmares">
          <summary>Palmarès ({career.seasons.length} {career.seasons.length === 1 ? 'temporada' : 'temporades'})</summary>
          <ul>
            {career.seasons.slice(0, 10).map((record) => (
              <li key={record.finishedAt} className={`moviment-${record.movement}`}>
                <span>{record.name}</span>
                <span className="lliga-palmares-pos">
                  {ordinal(record.rank)} de {record.players}{' '}
                  <span aria-hidden="true">
                    {record.movement === 'up' ? '↑' : record.movement === 'down' ? '↓' : record.movement === 'champion' ? '🏆' : '='}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}


      {locationOpen && (
        <LocationDialog
          initial={career.home ?? elTaulerHome}
          fromElTauler={!career.home && elTaulerHome !== null}
          onSave={(home) => {
            onSetHome(home);
            setLocationOpen(false);
          }}
          onSkip={() => {
            if (!career.home) onSetHome(null);
            setLocationOpen(false);
          }}
        />
      )}
    </section>
  );
}

/**
 * L'escalada, en vertical i com una escala de debò: la mundial a dalt de tot i
 * la local a baix, d'on es comença. Cada fila porta el nom sencer de la lliga
 * i els seus tres grups en l'ordre en què es juguen, C → B → A, cadascun amb
 * la força dels rivals. Els graons fets en verd, l'actual en el color de la
 * lliga i el millor que s'ha arribat amb vora daurada.
 */
function Ladder({ tier, best, home }: { tier: number; best: number; home: LeagueHome | null }) {
  return (
    <ol
      className="escala"
      aria-label={`L’escalada de lligues: ets a la ${tierName(tier, home)}. Es puja de la C a la B, de la B a la A i de la A a la C de la lliga següent.`}
    >
      {LEAGUE_LEVELS.map((level, index) => ({ level, index }))
        .reverse()
        .map(({ level, index }) => (
        <li key={level.id} className={tierLevel(tier) === index ? 'escala-nivell actual' : 'escala-nivell'}>
          <span className="escala-num" aria-hidden="true">
            {index + 1}
          </span>
          <span className="escala-nom">{levelName(index, home)}</span>
          <span className="escala-graons">
            {GROUPS.map((group, g) => {
              const step = index * 3 + g;
              const classes = ['escala-grao'];
              if (step < tier) classes.push('fet');
              if (step === tier) classes.push('actual');
              if (step === best && best > tier) classes.push('millor');
              return (
                <span
                  key={group}
                  className={classes.join(' ')}
                  aria-current={step === tier ? 'step' : undefined}
                  title={`Grup ${group}: rivals de ${tierRating(step)}`}
                >
                  <strong>{group}</strong>
                  <small>{tierRating(step)}</small>
                </span>
              );
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SeasonSetup({
  config,
  onChange,
  nextName,
  onStart,
  finished,
}: {
  config: LeagueConfig;
  onChange(config: LeagueConfig): void;
  nextName: string;
  onStart(): void;
  finished: boolean;
}) {
  const meetAll = roundsToMeetAll(config);
  return (
    <div className="lliga-config">
      <h3>{finished ? 'La temporada següent' : 'Nova temporada'}</h3>
      <p className="muted small">
        Jugaràs a la <strong>{nextName}</strong>. A cada jornada jugues una partida amb els rivals que et
        toquen; la resta de taules es juguen alhora. Cada partida és un enfrontament contra cada rival de
        la taula: 1 punt per cada un que acabi per sota teu.
      </p>
      <fieldset className="tria">
        <legend>Rivals per partida</legend>
        {([2, 3] as TableRivals[]).map((opponents) => (
          <button
            key={opponents}
            type="button"
            className={config.opponents === opponents ? '' : 'secondary'}
            aria-pressed={config.opponents === opponents}
            onClick={() => onChange(normalizeConfig({ ...config, opponents }))}
          >
            {opponents}
          </button>
        ))}
      </fieldset>
      <fieldset className="tria">
        <legend>Jugadors a la lliga</legend>
        {PLAYER_OPTIONS[config.opponents].map((players) => (
          <button
            key={players}
            type="button"
            className={config.players === players ? '' : 'secondary'}
            aria-pressed={config.players === players}
            onClick={() => onChange(normalizeConfig({ ...config, players }))}
          >
            {players}
          </button>
        ))}
      </fieldset>
      <fieldset className="tria tria-jornades">
        <legend>Jornades</legend>
        <button
          type="button"
          className="secondary"
          aria-label="Una jornada menys"
          disabled={config.rounds <= MIN_ROUNDS}
          onClick={() => onChange(normalizeConfig({ ...config, rounds: config.rounds - 1 }))}
        >
          −
        </button>
        <output aria-live="polite">{config.rounds}</output>
        <button
          type="button"
          className="secondary"
          aria-label="Una jornada més"
          disabled={config.rounds >= MAX_ROUNDS}
          onClick={() => onChange(normalizeConfig({ ...config, rounds: config.rounds + 1 }))}
        >
          +
        </button>
      </fieldset>
      <p className="muted small">
        {config.rounds >= meetAll
          ? `Amb ${config.rounds} jornades et trobes amb tots els rivals.`
          : `Amb ${config.rounds} jornades no et trobaràs amb tothom: en calen ${meetAll}.`}{' '}
        Pugen els {zoneSize(config.players)} primers i baixen els {zoneSize(config.players)} últims.
      </p>
      <div className="row">
        <button type="button" onClick={onStart}>
          Comença la temporada
        </button>
      </div>
    </div>
  );
}

function Avatar({ name, you }: { name: string; you?: boolean }) {
  const persona = you ? null : botPersona(name);
  return (
    <span
      className="player-color lliga-avatar"
      aria-hidden="true"
      style={persona ? { background: `linear-gradient(135deg, ${persona.colors[0]}, ${persona.colors[1]})` } : undefined}
    >
      {persona ? persona.emoji : name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function RoundCard({ season, hasSavedGame, onPlay }: { season: LeagueSeason; hasSavedGame: boolean; onPlay(): void }) {
  const rivals = yourTable(season);
  const round = season.played + 1;
  return (
    <div className="lliga-jornada">
      <p className="lliga-jornada-cap">
        <span className="lliga-jornada-num">
          Jornada {round}
          <small>/{season.config.rounds}</small>
        </span>
        <span className="muted small">Els teus rivals</span>
      </p>
      <ul className="lliga-rivals">
        {rivals.map((rival) => (
          <li key={rival.id}>
            <Avatar name={rival.name} />
            <span>
              <strong>{rival.name}</strong>
              <span className="muted small">
                {rival.origin ? `${rival.origin} · ` : ''}
                {strengthLabel(rival.rating)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onPlay}>
        {hasSavedGame ? 'Continua' : 'Juga'} la jornada {round}
      </button>
    </div>
  );
}

function StandingsTable({ season, playerName }: { season: LeagueSeason; playerName: string }) {
  const rows = standings(season, playerName);
  const players = season.config.players;
  return (
    <div className="lliga-taula-embolcall">
      <table className="lliga-taula">
        <caption>Classificació</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Jugador</th>
            <th scope="col" title="Partides jugades" className="col-pj">
              PJ
            </th>
            <th scope="col" title="Punts de lliga">
              Pts
            </th>
            <th scope="col" title="Diferència de punts de partida">
              Dif
            </th>
            <th scope="col" title="Victòries">
              V
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const zone = zoneOf(season.tier, index + 1, players);
            const classes = [row.id === YOU ? 'tu' : '', zone === 'up' || zone === 'champion' ? 'zona-puja' : zone === 'down' ? 'zona-baixa' : '']
              .filter(Boolean)
              .join(' ');
            const rival = rivalById(season, row.id);
            return (
              <tr key={row.id} className={classes || undefined}>
                <td className="pos">{index + 1}</td>
                <td className="jugador">
                  <Avatar name={row.name} you={row.id === YOU} />
                  <span>
                    {row.name}
                    {rival && <span className="muted small"> · {rival.rating}</span>}
                  </span>
                </td>
                <td className="col-pj">{row.played}</td>
                <td className="pts">{leaguePoints(row.points)}</td>
                <td className={row.diff >= 0 ? 'points-positive' : 'points-negative'}>{signed(row.diff)}</td>
                <td>{row.wins}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small lliga-llegenda">
        {season.tier < TOP_TIER && <span className="llegenda-puja">pugen</span>}
        {season.tier > 0 && <span className="llegenda-baixa">baixen</span>}
        Pts: 1 per cada rival que acaba per sota teu a la taula · Dif: punts de les partides · V: victòries.
      </p>
    </div>
  );
}

function YourRounds({ season }: { season: LeagueSeason }) {
  const mine = season.results.filter((result) => result.ids.includes(YOU));
  if (mine.length === 0) return null;
  return (
    <details className="lliga-jornades">
      <summary>Les teves jornades ({mine.length})</summary>
      <ol>
        {mine.map((result) => {
          const me = result.ids.indexOf(YOU);
          const points = tablePoints(result.scores)[me];
          const place = [...result.scores].sort((a, b) => b - a).indexOf(result.scores[me]) + 1;
          return (
            <li key={result.round}>
              <span>
                <strong>Jornada {result.round + 1}</strong> · {ordinal(place)} de {result.ids.length} ·{' '}
                {result.ids
                  .filter((id) => id !== YOU)
                  .map((id) => rivalById(season, id)?.name ?? id)
                  .join(', ')}
              </span>
              <span className="lliga-jornades-punts">
                +{leaguePoints(points)} pts ·{' '}
                <span className={result.scores[me] >= 0 ? 'points-positive' : 'points-negative'}>
                  {signed(result.scores[me])}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function SeasonReview({ season, state, playerName }: { season: LeagueSeason; state: LeagueState; playerName: string }) {
  const rows = standings(season, playerName);
  const rank = rows.findIndex((row) => row.id === YOU) + 1;
  const me = rows[rank - 1];
  const record = state.career.seasons[0];
  const movement: Movement = record?.movement ?? zoneOf(season.tier, rank, season.config.players);
  const next = record?.nextTier ?? season.tier;
  const medal = rank === 1 ? 'or' : rank === 2 ? 'plata' : rank === 3 ? 'bronze' : movement === 'down' ? 'descens' : 'mig';
  return (
    <div className={`lliga-final moviment-${movement}`}>
      <div className={`lliga-final-pos ${medal}`}>
        <span className="lliga-final-num">{ordinal(rank)}</span>
        <span className="small">de {season.config.players}</span>
      </div>
      <div>
        <h3>{rank === 1 ? 'Campió de la lliga!' : 'Temporada acabada'}</h3>
        <p>
          {leaguePoints(me?.points ?? 0)} punts · {signed(me?.diff ?? 0)} · {me?.wins ?? 0}{' '}
          {me?.wins === 1 ? 'victòria' : 'victòries'}
        </p>
        <p className="lliga-final-moviment">
          <strong>{movementText(season.tier, next, movement, state.career.home)}</strong>
        </p>
      </div>
      <StandingsTable season={season} playerName={playerName} />
    </div>
  );
}
