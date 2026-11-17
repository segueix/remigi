import { Avatar } from '../components/ResultBars';
import type { TableScoreRow } from '../lliga/league';
import { leaguePoints, ordinal, signed } from '../ui/format';

const pointsClass = (points: number) => (points >= 0 ? 'points-positive' : 'points-negative');

/**
 * El marcador de la teva taula en acabar una jornada de lliga, com el del
 * repte: qui ha guanyat (👑) i els punts de la partida de cadascú, del primer a
 * l'últim. A partir de la segona jornada, també l'acumulat de la temporada:
 * el total de punts de partida (la «Dif» de la classificació) i els punts de
 * lliga, amb la posició. Així, abans de la jornada següent, saps qui va
 * davant i quant et cal per atrapar-lo.
 */
export function LeagueScoreboard({ rows, round }: { rows: TableScoreRow[]; round: number }) {
  if (rows.length === 0) return null;
  const showTotal = round > 1;
  return (
    <div className="lliga-marcador">
      <table className="repte-taula">
        <caption>Jornada {round}: la teva partida</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Jugador</th>
            <th scope="col" title="Punts d’aquesta partida">
              {showTotal ? 'Partida' : 'Punts'}
            </th>
            {showTotal && (
              <th scope="col" title="Suma dels punts de totes les partides de la temporada">
                Total
              </th>
            )}
            <th scope="col" title="Punts de lliga acumulats i posició a la classificació">
              Lliga
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.you ? 'jo' : undefined}>
              <td className="repte-pos">{row.place}</td>
              <th scope="row" className="repte-cel-jugador">
                <span className="repte-jugador">
                  <Avatar name={row.name} you={row.you} />
                  <span className="repte-nom">{row.you ? 'Tu' : row.name}</span>
                  {row.winner && (
                    <span className="repte-corona" title="Ha guanyat la partida" aria-label="ha guanyat la partida">
                      👑
                    </span>
                  )}
                </span>
              </th>
              <td className={pointsClass(row.score)}>
                <strong>{signed(row.score)}</strong>
              </td>
              {showTotal && <td className={pointsClass(row.total)}>{signed(row.total)}</td>}
              <td className="lliga-marcador-punts">
                {leaguePoints(row.points)} pts
                <small>{ordinal(row.rank)}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
