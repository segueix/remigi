import { useEffect, useMemo, useRef, useState } from 'react';
import { gameUrl } from '../ui/gameUrl';
import { CloseButton, useEscapeToClose } from '../components/CloseButton';
import { Confetti } from '../components/Confetti';
import {
  diplomaContent,
  diplomaFileName,
  shareMessage,
  whatsappUrl,
} from '../lliga/champion';
import { diplomaBlob } from '../lliga/diplomaCanvas';
import type { SeasonRecord } from '../lliga/league';
import type { LeagueHome } from '../lliga/localitats';

interface Props {
  /** La temporada guanyada a la Mundial A. */
  record: SeasonRecord;
  playerName: string;
  home: LeagueHome | null;
  onClose(): void;
}

/** L'adreça del joc, per al missatge: la d'ara, sense paràmetres ni ancoratge. */

function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * La celebració del títol més alt: guanyar la Lliga Mundial, Divisió A.
 * Confeti a pantalla completa, el trofeu, el diploma amb el nom del jugador
 * —que es pot descarregar com a imatge— i un botó per explicar-ho per WhatsApp.
 *
 * El diploma es dibuixa en obrir-se (no en tocar el botó): així la imatge ja és
 * a punt quan es comparteix, i els navegadors no tallen el menú de compartir
 * per haver trigat massa després del toc.
 */
export function ChampionCelebration({ record, playerName, home, onClose }: Props) {
  const content = useMemo(() => diplomaContent(record, playerName, home), [record, playerName, home]);
  const fileName = diplomaFileName(content.playerName);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(onClose);

  // Focus a la finestra en obrir-se, i de tornada al botó que l'ha obert en tancar-se.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    diplomaBlob(content)
      .then((made) => {
        if (!alive) return;
        url = URL.createObjectURL(made);
        setBlob(made);
        setPreviewUrl(url);
      })
      .catch(() => alive && setNote('No s’ha pogut preparar el diploma en aquest navegador.'));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [content]);

  const download = () => {
    if (!blob) return;
    saveFile(blob, fileName);
    setNote('Diploma descarregat. Ja el pots penjar o enviar a qui vulguis!');
  };

  const share = async () => {
    const text = shareMessage(record, gameUrl());
    if (blob) {
      const file = new File([blob], fileName, { type: 'image/png' });
      // Mòbil: el menú de compartir del sistema, amb el diploma i el missatge (WhatsApp hi surt).
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, title: 'Millor jugador del món · Remigi' });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
      // Ordinador: WhatsApp s'obre amb el missatge a punt i el diploma es descarrega per adjuntar-lo.
      saveFile(blob, fileName);
    }
    window.open(whatsappUrl(text), '_blank', 'noopener,noreferrer');
    setNote('S’ha obert WhatsApp amb el missatge. El diploma s’ha descarregat: adjunta’l a la conversa.');
  };

  return (
    <>
      <div className="campio-fons" aria-hidden="true" />
      <div
        ref={dialogRef}
        className="campio"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campio-titol"
        tabIndex={-1}
      >
        <div className="campio-cap">
          <CloseButton onClose={onClose} label="Tanca la celebració" />
        </div>

        <div className="campio-trofeu" aria-hidden="true">
          <span className="campio-raigs" />
          <span className="campio-copa">🏆</span>
        </div>

        <p className="campio-dalt">Lliga Mundial · Divisió A</p>
        <h2 id="campio-titol" className="campio-titol">
          Ets el millor jugador del món!
        </h2>
        <p className="campio-nom">{content.playerName}</p>
        <p className="campio-stats">{content.stats}</p>

        <div className="campio-diploma">
          {previewUrl ? (
            <img src={previewUrl} alt={`Diploma de Millor jugador del món per a ${content.playerName}`} />
          ) : (
            <span className="muted small">Preparant el diploma…</span>
          )}
        </div>

        <div className="campio-accions">
          <button type="button" className="campio-whatsapp" onClick={() => void share()} disabled={!blob}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4" />
            </svg>
            Comparteix per WhatsApp
          </button>
          <button type="button" className="secondary" onClick={download} disabled={!blob}>
            Descarrega el diploma
          </button>
        </div>
        <p className="campio-nota muted small" role="status" aria-live="polite">
          {note}
        </p>
      </div>
      <Confetti />
    </>
  );
}
