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
 * les lligues (Lliga de Vic, Lliga Comarcal d'Osona…) i origen als rivals. El
 * municipi es tria d'una llista (Catalunya, el País Valencià, les Balears, la
 * Catalunya Nord, la Franja, Andorra i l'Alguer) i en surten la comarca i la
 * província. Fora de Catalunya, si no hi és, s'escriu i es tria la comarca.
 */
export function LocationDialog({ initial, fromElTauler, onSave, onSkip }: Props) {
  const ids = useId();
  const [territory, setTerritory] = useState<TerritoryId>(initial?.territory ?? 'cat');
  const [municipi, setMunicipi] = useState(initial?.municipi ?? '');
  const [comarca, setComarca] = useState(initial?.comarca ?? '');
  const [pais, setPais] = useState(initial?.pais ?? '');

  const comarcaList = useMemo(() => (territory === 'cat' || territory === 'fora' ? [] : comarques(territory)), [territory]);
  const suggestions = useMemo(
    () => (territory === 'fora' ? [] : searchMunicipalities(municipi, { territory, limit: 8 })),
    [territory, municipi],
  );
  // El municipi de la llista: en surten la comarca i la província.
  const hit = territory === 'fora' ? null : findMunicipality(municipi, territory);
  const home = normalizeHome({ territory, municipi, comarca, provincia: '', pais });
  const valid = home !== null && (territory !== 'cat' || hit !== null) && (territory !== 'fora' || pais.trim() !== '');

  return (
    <>
      <div className="menu-fons" aria-hidden="true" />
      <section className="dialeg-lloc" role="dialog" aria-modal="true" aria-labelledby={`${ids}-titol`}>
        <h2 id={`${ids}-titol`}>On jugues?</h2>
        <p className="muted small">
          {fromElTauler
            ? 'És el lloc que tens a la lliga d’escacs d’El Tauler. Les lligues de Remigi porten els mateixos noms.'
            : 'Les lligues porten el nom del teu lloc, com les d’escacs d’El Tauler. Comences, com a mínim, a la del teu territori.'}
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
        {comarcaList.length > 0 && !hit && (
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
            list={territory === 'fora' ? undefined : `${ids}-municipis`}
            maxLength={60}
            autoComplete="off"
            aria-label="Municipi"
          />
        </label>
        {territory !== 'fora' && (
          <datalist id={`${ids}-municipis`}>
            {suggestions.map((m) => (
              <option key={m.name} value={m.name} />
            ))}
          </datalist>
        )}
        {hit && (
          <p className="small dialeg-lloc-comarca">
            {hit.comarca === hit.province ? hit.comarca : `${hit.comarca} · ${hit.province}`}
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
