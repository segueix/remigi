import type { GameMode } from '../game/useGame';
import { ChallengeIcon, FreePlayIcon, LeagueIcon } from './icons';

const MODES: { mode: GameMode; label: string; className: string; Icon: () => React.JSX.Element }[] = [
  { mode: 'lliure', label: 'Joc lliure', className: 'mode-lliure', Icon: FreePlayIcon },
  { mode: 'repte', label: 'Repte', className: 'mode-repte', Icon: ChallengeIcon },
  { mode: 'lliga', label: 'Lliga', className: 'mode-lliga', Icon: LeagueIcon },
];

/**
 * A la configuració, les altres maneres de jugar: des del joc lliure, el repte
 * i la lliga; des del repte, el joc lliure i la lliga; des de la lliga, el joc
 * lliure i el repte. La partida que deixes es queda desada i la reprens quan
 * hi tornes. Sense mode (des de l'inici), totes tres.
 */
export function ModeSwitch({ current, onSwitch }: { current?: GameMode | null; onSwitch(mode: GameMode): void }) {
  const others = MODES.filter(({ mode }) => mode !== current);
  return (
    <section className="menu-seccio canvia-mode" aria-label="Canvia de mode">
      <div className="menu-seccio-cap">
        <div>
          <strong>{current ? 'Juga a un altre mode' : 'Tria com vols jugar'}</strong>
          {current && <span className="muted small">El que jugaves es queda desat: el reprens quan hi tornis.</span>}
        </div>
      </div>
      <div className="canvia-mode-botons">
        {others.map(({ mode, label, className, Icon }) => (
          <button key={mode} type="button" className={`canvia-mode-boto ${className}`} onClick={() => onSwitch(mode)}>
            <span className="canvia-mode-icona" aria-hidden="true">
              <Icon />
            </span>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
