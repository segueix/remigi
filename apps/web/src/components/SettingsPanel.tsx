import { THEME_OPTIONS, useTheme, type ThemeChoice } from '../state/theme';
import type { TileStyle } from '../state/useTileStyle';
import { TURN_OPTIONS, useTurnSeconds } from '../state/useTurnSeconds';
import { ColorShape } from './TileView';

const THEME_LABELS: Record<ThemeChoice, string> = { auto: 'Automàtic', light: 'Clar', dark: 'Fosc' };

interface Props {
  tileStyle: TileStyle;
  onTileStyle(style: TileStyle): void;
}

/**
 * La configuració del dispositiu, igual a totes les modalitats (joc lliure,
 * repte i lliga): el mode clar o fosc, el temps de cada torn i l'aspecte de
 * les fitxes. Surt al menú del jugador de la partida i al perfil. Tot
 * s'aplica de seguida, també a la partida que jugues ara.
 */
export function SettingsPanel({ tileStyle, onTileStyle }: Props) {
  const [theme, setTheme] = useTheme();
  const [turnSeconds, setTurnSeconds] = useTurnSeconds();
  return (
    <section className="menu-seccio configuracio" aria-label="Configuració">
      <div className="menu-seccio-cap">
        <span className="menu-seccio-icona" aria-hidden="true">
          ⚙️
        </span>
        <div>
          <strong>Configuració</strong>
          <span className="muted small">La mateixa al joc lliure, al repte i a la lliga.</span>
        </div>
      </div>

      <div className="tria-tema" role="group" aria-label="Mode clar o fosc">
        <span className="muted">Aspecte:</span>
        {THEME_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={theme === option ? '' : 'secondary'}
            aria-pressed={theme === option}
            onClick={() => setTheme(option)}
          >
            {THEME_LABELS[option]}
          </button>
        ))}
      </div>

      {/*
        * El temps de cada torn. Es canvia en calent (no espera cap partida
        * nova) perquè es vegi de seguida al rellotge de la taula. Quan
        * s'acaba, el que tinguessis a mig col·locar es desfà i robes.
        */}
      <div className="temps-torn" role="group" aria-label="Temps per torn">
        <span className="muted">Temps per torn:</span>
        {TURN_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={turnSeconds === option ? '' : 'secondary'}
            aria-pressed={turnSeconds === option}
            onClick={() => setTurnSeconds(option)}
          >
            {option} s
          </button>
        ))}
        <button
          type="button"
          className={turnSeconds === null ? '' : 'secondary'}
          aria-pressed={turnSeconds === null}
          onClick={() => setTurnSeconds(null)}
        >
          sense límit
        </button>
      </div>

      {/*
        * L'aspecte de les fitxes: es tria mirant, amb una mostra de cada.
        * El predeterminat (color amb número blanc) va primer.
        */}
      <div className="tria-fitxes" role="group" aria-label="Aspecte de les fitxes">
        <span className="muted">Fitxes:</span>
        <button
          type="button"
          className="mostra-fitxa fitxes-inverses"
          aria-pressed={tileStyle === 'invers'}
          aria-label="Fitxes de color amb el número i la forma en blanc"
          onClick={() => onTileStyle('invers')}
        >
          <span className="tile tile-red mostra" aria-hidden="true">
            7
            <ColorShape color="red" />
          </span>
        </button>
        <button
          type="button"
          className="mostra-fitxa classica"
          aria-pressed={tileStyle === 'classic'}
          aria-label="Fitxes de crema amb el número i la forma de color"
          onClick={() => onTileStyle('classic')}
        >
          <span className="tile tile-red mostra" aria-hidden="true">
            7
            <ColorShape color="red" />
          </span>
        </button>
      </div>
    </section>
  );
}
