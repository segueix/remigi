import type { Tile, TileColor } from '@remigi/core';
import { TileView } from './TileView';

/** Fitxa d'exemple, només per ensenyar-la. */
const t = (color: TileColor, value: number): Tile => ({
  id: `exemple-${color}-${value}`,
  kind: 'number',
  color,
  value,
});

function Exemple({ fitxes, nota, malament }: { fitxes: Tile[]; nota: string; malament?: boolean }) {
  return (
    <li className={malament ? 'exemple malament' : 'exemple'}>
      <span className="exemple-fitxes" aria-hidden="true">
        {fitxes.map((fitxa) => (
          <TileView key={fitxa.id} tile={fitxa} />
        ))}
      </span>
      <span className="exemple-nota">{nota}</span>
    </li>
  );
}

/**
 * Explicació de com es juga, amb fitxes de debò.
 *
 * Va a la pantalla d'inici perquè el dubte que la fa falta —què compta per als
 * 30 punts de la sortida— apareix abans de la primera jugada, no durant. Ve
 * desplegada mentre no s'ha jugat cap partida i plegada després.
 */
export function ComEsJuga({ obertPerDefecte }: { obertPerDefecte?: boolean }) {
  return (
    <details className="rules" open={obertPerDefecte}>
      <summary>Com es juga (i com s’obre)</summary>

      <p>Només hi ha dues jugades vàlides, i tota la resta no compta:</p>
      <ul className="exemples">
        <Exemple
          fitxes={[t('red', 10), t('blue', 10), t('black', 10)]}
          nota="Grup: 3 o 4 fitxes del mateix número, cada una d’un color."
        />
        <Exemple
          fitxes={[t('orange', 8), t('orange', 9), t('orange', 10)]}
          nota="Escala: 3 o més fitxes del mateix color, amb números seguits."
        />
      </ul>

      <h4>La primera jugada: 30 punts</h4>
      <p>
        Per obrir has de baixar jugades vàlides que <strong>sumin 30 punts o més</strong>. Els
        punts són la suma dels números de les fitxes que baixes.
      </p>
      <ul className="exemples">
        <Exemple
          fitxes={[t('red', 10), t('blue', 10), t('black', 10)]}
          nota="Un grup de tres 10 fa 30 punts: ja pots obrir."
        />
        <Exemple
          fitxes={[t('red', 6), t('blue', 12), t('black', 12)]}
          malament
          nota="Sumen 30, però no és ni grup ni escala: compta 0 punts."
        />
      </ul>

      <p className="muted small">
        Compte també amb això: les fitxes d’una mateixa jugada han d’anar totes a la{' '}
        <strong>mateixa caixa</strong> de la taula. Si en deixes cada una a la seva, cap no arriba
        a tres fitxes i el joc les rebutja.
      </p>

      <h4>Un cop obert</h4>
      <p className="muted small">
        Ja pots allargar les jugades que hi ha a la taula i remenar-les com vulguis, sempre que en
        acabar el torn tot siguin grups i escales vàlids i hi hagis posat almenys una fitxa teva.
      </p>
    </details>
  );
}
