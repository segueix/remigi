import { botPersona, isPersonName } from "../game/bots";
import {
  challengeInsights,
  challengeStandings,
  isDone,
  type Challenge,
} from "../repte/challenge";
import { ordinal, signed } from "../ui/format";

interface Props {
  challenge: Challenge;
  playerName: string;
  /** Amb les frases de tàctica (entre partides i al final). */
  insights?: boolean;
}

const pointsClass = (points: number | null) =>
  points === null
    ? undefined
    : points >= 0
      ? "points-positive"
      : "points-negative";

/**
 * La classificació del repte: els punts de cadascú a l'última partida (amb la
 * corona per a qui l'ha guanyada) i, a partir de la segona, el total acumulat
 * i les victòries, ordenats pel total. A sota, informació per jugar amb
 * tàctica (`challengeInsights`). Els reptes d'abans, sense els punts dels
 * rivals, només hi porten els teus.
 */
export function RepteStandings({
  challenge,
  playerName,
  insights = true,
}: Props) {
  const played = challenge.games.length;
  const last = challenge.games[played - 1];
  if (!last) return null;
  const known =
    challenge.rivals.length > 0 && challenge.games.some((game) => game.scores);
  const standings = challengeStandings(challenge, playerName);
  const rows = known ? standings : standings.filter((row) => row.you);
  const showTotal = played > 1;
  // A la primera partida, l'ordre és el de la partida.
  const ordered = showTotal
    ? rows
    : [...rows].sort((a, b) => (b.last ?? -Infinity) - (a.last ?? -Infinity));
  const done = isDone(challenge);
  const leader = standings[0];
  const lines = insights ? challengeInsights(challenge, standings) : [];

  return (
    <div className="repte-classificacio">
      {done && known && (
        <p className={leader.you ? "repte-guanyador jo" : "repte-guanyador"}>
          {leader.you
            ? `🏆 Has guanyat el repte, amb ${signed(leader.total)} punts!`
            : `🏆 Guanya el repte ${leader.name}, amb ${signed(leader.total)}. Tu quedes ${ordinal(
                standings.find((row) => row.you)?.place ?? standings.length,
              )}.`}
        </p>
      )}
      <table className="repte-taula">
        <caption>
          {done
            ? "Classificació final del repte"
            : showTotal
              ? `Classificació després de ${played} partides`
              : "Resultat de la partida"}
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Jugador</th>
            <th scope="col">{showTotal ? `Partida ${played}` : "Punts"}</th>
            {showTotal && (
              <>
                <th scope="col">Total</th>
                <th scope="col" title="Partides guanyades">
                  Vict.
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, i) => {
            const persona = row.you ? null : botPersona(row.name);
            return (
              <tr key={row.seat} className={row.you ? "jo" : undefined}>
                <td className="repte-pos">{showTotal ? row.place : i + 1}</td>
                <th scope="row" className="repte-cel-jugador">
                  <span className="repte-jugador">
                    <span
                      className={
                        persona && isPersonName(row.name)
                          ? "player-color repte-avatar inicials"
                          : "player-color repte-avatar"
                      }
                      aria-hidden="true"
                      style={
                        persona
                          ? {
                              background: `linear-gradient(135deg, ${persona.colors[0]}, ${persona.colors[1]})`,
                            }
                          : undefined
                      }
                    >
                      {persona
                        ? persona.emoji
                        : (row.name.trim().charAt(0) || "T").toUpperCase()}
                    </span>
                    <span className="repte-nom">
                      {row.you ? `${row.name} (tu)` : row.name}
                    </span>
                    {last.winner === row.seat && (
                      <span
                        className="repte-corona"
                        title="Ha guanyat la partida"
                        aria-label="ha guanyat la partida"
                      >
                        👑
                      </span>
                    )}
                  </span>
                </th>
                <td className={pointsClass(row.last)}>
                  {row.last === null ? "—" : signed(row.last)}
                </td>
                {showTotal && (
                  <>
                    <td className={pointsClass(row.total)}>
                      <strong>{signed(row.total)}</strong>
                    </td>
                    <td>{row.wins}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!known && (
        <p className="muted small">
          Aquest repte va començar abans que s’apuntessin els punts dels rivals:
          només hi ha els teus.
        </p>
      )}
      {lines.length > 0 && (
        <ul className="repte-info">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
