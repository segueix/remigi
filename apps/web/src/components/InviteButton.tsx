import { useState } from 'react';
import { inviteText } from '../dia/daily';
import { whatsappUrl } from '../lliga/champion';

export function gameUrl(): string {
  try {
    return `${window.location.origin}${window.location.pathname}`;
  } catch {
    return 'https://segueix.github.io/remigi/';
  }
}

/**
 * Convidar a la partida del dia: el menú de compartir del mòbil (WhatsApp,
 * Telegram…) o, a l'ordinador, WhatsApp; i copiar l'enllaç. L'enllaç obre
 * directament la partida del dia.
 */
export function InviteButton({
  day,
  streak,
  className = 'secondary',
  compact = false,
}: {
  day: string;
  streak: number;
  className?: string;
  /** Només el botó de compartir (sense el de copiar). */
  compact?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);
  const text = inviteText(day, gameUrl(), streak);

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, title: 'Partida del dia · Remigi' });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    window.open(whatsappUrl(text), '_blank', 'noopener,noreferrer');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Invitació copiada. Enganxa-la on vulguis!');
    } catch {
      setNote('No s’ha pogut copiar la invitació.');
    }
  };

  return (
    <div className="convida">
      <div className="row">
        <button type="button" className={className} onClick={() => void share()}>
          📣 Convida amics
        </button>
        {!compact && (
          <button type="button" className="secondary" onClick={() => void copy()}>
            Copia l’enllaç
          </button>
        )}
      </div>
      {note && (
        <p className="muted small" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
