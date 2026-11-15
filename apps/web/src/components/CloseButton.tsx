import { useEffect } from 'react';

/**
 * El botó de tancar de les finestres de configuració i del perfil: sempre al
 * mateix lloc (a dalt a la dreta, i no se'n va en desplaçar-se), amb la creu i
 * la paraula «Tanca», perquè no calgui buscar com sortir-ne. `label` és el nom
 * complet (per als lectors de pantalla i el rètol d'ajuda).
 */
export function CloseButton({ onClose, label }: { onClose(): void; label: string }) {
  return (
    <button type="button" className="tanca" onClick={onClose} aria-label={label} title={label}>
      <span className="tanca-creu" aria-hidden="true">
        ✕
      </span>
      <span className="tanca-text" aria-hidden="true">
        Tanca
      </span>
    </button>
  );
}

/** La tecla Esc també tanca (com a qualsevol finestra). */
export function useEscapeToClose(onClose: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
