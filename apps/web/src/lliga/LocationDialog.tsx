import { useId, useMemo, useState } from 'react';
import { LEAGUE_LEVELS, levelName } from './league';
import {
  TERRITORIES,
  comarques,
  findMunicipality,
  normalizeHome,
  searchMunicipalities,
  type LeagueHome,
  type TerritoryId,
} from './localitats';

interface Props {
  /** Localitat actual, o la que es fa servir a El Tauler (per proposar-la). */
  initial: LeagueHome | null;
  /** La proposta ve d'El Tauler (es diu, perquè no sembli màgia). */
  fromElTauler: boolean;
  onSave(home: LeagueHome): void;
  onSkip(): void;
}

/**
 * «On jugues?», com a la lliga d'escacs d'El Tauler: la localitat dona nom a
 * les lligues (Lliga de Vic, Lliga Comarcal d'Osona…) i origen als rivals. A
 * Catalunya el municipi es tria d'una llista i en surten la comarca i la
 * província; als altres territoris es tria la comarca i el municipi s'escriu.
 */
export function LocationDialog({ initial, fromElTauler, onSave, onSkip }: Props) {
  const ids = useId();
  const [territory, setTerritory] = useState<TerritoryId>(initial?.territory ?? 'cat');
  const [municipi, setMunicipi] = useState(initial?.municipi ?? '');
  const [comarca, setComarca] = useState(initial?.comarca ?? '');
  const [pais, setPais] = useState(initial?.pais ?? '');

  const comarcaList = useMemo(() => (territory === 'cat' || territory === 'fora' ? [] : comarques(territory)), [territory]);
  const suggestions = useMemo(
    () => (territory === 'cat' ? searchMunicipalities(municipi, { territory: 'cat', limit: 8 }) : []),
    [territory, municipi],
  );
  const catHit = territory === 'cat' ? findMunicipality(municipi, 'cat') : null;
  const home = normalizeHome({ territory, municipi, comarca, provincia: '', pais });
  const valid = home !== null && (territory !== 'cat' || catHit !== null) && (territory !== 'fora' || pais.trim() !== '');

  return (
    <>
      <div className="menu-fons" aria-hidden="true" />
      <section className="dialeg-lloc" role="dialog" aria-modal="true" aria-labelledby={`${ids}-titol`}>
        <h2 id={`${ids}-titol`}>On jugues?</h2>
        <p className="muted small">
          {fromElTauler
            ? 'És el lloc que tens a la lliga d’escacs d’El Tauler. Les lligues de Remigi porten els mateixos noms.'
            : 'La lliga comença al teu municipi i puja per la comarca, la província i el país fins al món, amb els mateixos noms que les lligues d’escacs d’El Tauler.'}
        </p>
        <label>
          Territori
          <select
            value={territory}
            onChange={(event) => {
              setTerritory(event.target.value as TerritoryId);
              setComarca('');
            }}
          >
            {TERRITORIES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {territory === 'fora' && (
          <label>
            País
            <input value={pais} onChange={(event) => setPais(event.target.value)} maxLength={60} />
          </label>
        )}
        {comarcaList.length > 0 && (
          <label>
            {territory === 'bal' ? 'Illa o comarca' : 'Comarca'}
            <select value={comarca} onChange={(event) => setComarca(event.target.value)}>
              <option value="">—</option>
              {comarcaList.map((c) => (
                <option key={`${c.name}|${c.province}`} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Municipi
          <input
            value={municipi}
            onChange={(event) => setMunicipi(event.target.value)}
            list={territory === 'cat' ? `${ids}-municipis` : undefined}
            maxLength={60}
            autoComplete="off"
            aria-label="Municipi"
          />
        </label>
        {territory === 'cat' && (
          <datalist id={`${ids}-municipis`}>
            {suggestions.map((m) => (
              <option key={m.name} value={m.name} />
            ))}
          </datalist>
        )}
        {catHit && (
          <p className="small dialeg-lloc-comarca">
            {catHit.comarca} · {catHit.province}
          </p>
        )}
        {valid && home && (
          <ol className="dialeg-lloc-lligues small">
            {LEAGUE_LEVELS.map((level, index) => (
              <li key={level.id}>{levelName(index, home)}</li>
            ))}
          </ol>
        )}
        <div className="row">
          <button type="button" disabled={!valid} onClick={() => home && onSave(home)}>
            Desa
          </button>
          <button type="button" className="secondary" onClick={onSkip}>
            Ara no
          </button>
        </div>
      </section>
    </>
  );
}
