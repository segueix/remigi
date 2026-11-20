import { useState } from 'react';
import { MAX_ALIAS, cleanAlias } from '../cloud/ranking';

/**
 * En entrar amb Google per primer cop: amb quin nom vols jugar i sortir als
 * rànquings. Es proposa el nom de pila del compte, però és el jugador qui
 * decideix: el nom complet i el correu de Google no surten mai enlloc.
 */
export function NameDialog({
  suggestion,
  onSave,
  onSkip,
}: {
  suggestion: string;
  onSave(name: string): void;
  onSkip(): void;
}) {
  const [name, setName] = useState(suggestion);
  const save = () => onSave(cleanAlias(name));
  return (
    <>
      <div className="menu-fons importa-nivell-fons" aria-hidden="true" />
      <form
        className="importa-nivell nom-google"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nom-google-titol"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h2 id="nom-google-titol">Ja has entrat amb Google 👋</h2>
        <p>Amb quin nom vols jugar? És el que veuran els altres als rànquings.</p>
        <label className="nom-google-camp">
          <span className="muted small">El teu nom a Remigi</span>
          <input
            value={name}
            maxLength={MAX_ALIAS}
            autoFocus
            autoComplete="nickname"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p className="muted small">El canvies quan vulguis al menú del jugador. El correu del compte no surt mai.</p>
        <div className="row importa-nivell-accions">
          <button type="submit" disabled={name.trim() === ''}>
            Desa el nom
          </button>
          <button type="button" className="secondary" onClick={onSkip}>
            Ara no
          </button>
        </div>
      </form>
    </>
  );
}
