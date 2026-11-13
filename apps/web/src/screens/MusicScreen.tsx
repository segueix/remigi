import { useCallback, useEffect, useState } from 'react';
import {
  composeNew,
  jinglePlayer,
  loadLame,
  loadRadio,
  mp3FileName,
  pieceKey,
  registerPiece,
  registryGroups,
  registryList,
  stopMusic,
  toggleFavourite,
  type Piece,
} from '../musica/musica';
import type { RadioAmbient } from '../musica/radioambient';
import { safeStorage, useMusicPrefs } from '../musica/useMusicPrefs';

interface Props {
  onHome(): void;
}

const STYLE_NAMES: Record<Piece['style'], string> = {
  fanfarria: 'Passeig de jornada',
  galop: 'Tic-tac del rellotge',
  rumba: 'Rumba de la classificació',
  funk: 'Groove de la jugada',
  himne: 'Himne de la lliga',
};

/**
 * La música composta per l'app, com al registre d'El Tauler: totes les peces
 * que han sonat entre jornades de la lliga (cadascuna composta en aquell
 * moment i diferent de totes les anteriors). Se'n desa només la recepta,
 * així que es poden tornar a escoltar en bucle, marcar com a preferides o
 * baixar en MP3. També es pot compondre'n una de nova quan es vulgui.
 */
export function MusicScreen({ onHome }: Props) {
  const store = safeStorage();
  const [prefs, setPrefs] = useMusicPrefs();
  const [list, setList] = useState<Piece[]>(() => registryList(store));
  const [R, setR] = useState<RadioAmbient | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let alive = true;
    void loadRadio()
      .then((radio) => alive && setR(radio))
      .catch(() => alive && setStatus('No s’ha pogut carregar el compositor de música.'));
    return () => {
      alive = false;
      stopMusic(true);
    };
  }, []);

  const titleOf = useCallback(
    (piece: Piece) =>
      R ? R.jingleTitle(R.composeJingle(piece.style, piece.seed, { loop: true })) : STYLE_NAMES[piece.style],
    [R],
  );

  async function play(piece: Piece) {
    const key = pieceKey(piece);
    if (playing === key) {
      stopMusic(true);
      setPlaying(null);
      return;
    }
    const { R: radio, player } = await jinglePlayer();
    setPlaying(key);
    const ok = await player.play(radio.composeJingle(piece.style, piece.seed, { loop: true }), {
      volume: prefs.volume > 0 ? prefs.volume : 60,
    });
    if (!ok) {
      setPlaying(null);
      setStatus('Aquest aparell no pot fer sonar la música ara mateix.');
    }
  }

  async function composeFresh() {
    const { R: radio, player } = await jinglePlayer();
    const spec = composeNew(radio, store);
    const piece: Piece = { style: spec.style, seed: spec.seed, at: Date.now(), fav: false };
    setPlaying(pieceKey(piece));
    const ok = await player.play(spec, { volume: prefs.volume > 0 ? prefs.volume : 60 });
    if (ok) setList(registerPiece(store, piece));
    else setPlaying(null);
  }

  async function download(piece: Piece) {
    try {
      setStatus('Preparant l’MP3…');
      const radio = await loadRadio();
      const spec = radio.composeJingle(piece.style, piece.seed, { loop: true });
      const [samples, lame] = await Promise.all([radio.exportSamples(spec), loadLame()]);
      if (!samples) throw new Error('sense mostres');
      const parts = await radio.encodeMp3(samples, lame, {
        onProgress: (f) => setStatus(`Preparant l’MP3… ${Math.round(f * 100)} %`),
      });
      const url = URL.createObjectURL(new Blob(parts as BlobPart[], { type: 'audio/mpeg' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = mp3FileName(radio.jingleTitle(spec));
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus('MP3 baixat.');
    } catch {
      setStatus('No s’ha pogut fer l’MP3 (cal connexió el primer cop, per baixar el codificador).');
    }
  }

  const groups = registryGroups(list);

  const item = (piece: Piece) => {
    const key = pieceKey(piece);
    return (
      <li key={key} className="musica-peca">
        <span className="musica-peca-titol">
          <strong>{titleOf(piece)}</strong>
          <span className="muted small">
            {new Date(piece.at).toLocaleString('ca', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
        <span className="musica-peca-accions">
          <button type="button" className="secondary" onClick={() => void play(piece)} aria-pressed={playing === key}>
            {playing === key ? '■ Atura' : '▶ Escolta'}
          </button>
          <button
            type="button"
            className="secondary"
            aria-pressed={piece.fav}
            aria-label={piece.fav ? 'Treu de les preferides' : 'Marca com a preferida'}
            onClick={() => setList(toggleFavourite(store, key))}
          >
            {piece.fav ? '★' : '☆'}
          </button>
          <button type="button" className="secondary" aria-label="Baixa en MP3" onClick={() => void download(piece)}>
            MP3
          </button>
        </span>
      </li>
    );
  };

  return (
    <section className="card pantalla-mode musica lliga">
      <div className="franja-fitxes" aria-hidden="true" />
      <div className="row mode-cap">
        <h2>Música composta</h2>
        <button type="button" className="secondary" onClick={onHome}>
          ← Inici
        </button>
      </div>
      <p className="muted">
        Entre jornada i jornada de la lliga, l’app compon una peça nova i diferent de totes les
        anteriors —tonalitat, tempo, acords, melodia i solista— i la fa sonar en bucle durant els 30
        segons de relax. Totes queden aquí: les pots tornar a escoltar, guardar o baixar.
      </p>

      <fieldset className="tria">
        <legend>Música entre jornades</legend>
        <button
          type="button"
          className={prefs.on ? '' : 'secondary'}
          aria-pressed={prefs.on}
          onClick={() => setPrefs({ ...prefs, on: true })}
        >
          Sí
        </button>
        <button
          type="button"
          className={prefs.on ? 'secondary' : ''}
          aria-pressed={!prefs.on}
          onClick={() => {
            setPrefs({ ...prefs, on: false });
            stopMusic(true);
            setPlaying(null);
          }}
        >
          No
        </button>
      </fieldset>
      <label className="musica-volum">
        Volum <strong>{prefs.volume} %</strong>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={prefs.volume}
          onChange={(event) => setPrefs({ ...prefs, volume: Number(event.target.value) })}
        />
      </label>

      <div className="row">
        <button type="button" onClick={() => void composeFresh()} disabled={!R}>
          Compon-ne una de nova
        </button>
        {playing && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              stopMusic(true);
              setPlaying(null);
            }}
          >
            Atura la música
          </button>
        )}
      </div>
      {status && (
        <p className="small musica-estat" role="status">
          {status}
        </p>
      )}

      {list.length === 0 ? (
        <p className="muted">Encara no ha sonat cap peça: la primera serà entre la jornada 1 i la 2 de la lliga.</p>
      ) : (
        <>
          <h3>Les darreres</h3>
          <ul className="musica-llista">{groups.latest.map(item)}</ul>
          {groups.favs.length > 0 && (
            <>
              <h3>Preferides</h3>
              <ul className="musica-llista">{groups.favs.map(item)}</ul>
            </>
          )}
          {groups.days.length > 0 && (
            <details className="musica-arxiu">
              <summary>Arxiu ({groups.days.reduce((n, d) => n + d.items.length, 0)})</summary>
              {groups.days.map((day) => (
                <div key={day.day}>
                  <h4>{day.label ?? new Date(`${day.day}T12:00`).toLocaleDateString('ca', { weekday: 'short', day: 'numeric', month: 'short' })}</h4>
                  <ul className="musica-llista">{day.items.map(item)}</ul>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
