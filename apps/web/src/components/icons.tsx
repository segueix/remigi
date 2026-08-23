/**
 * Icones de traç per als botons del torn, estil aplicació. Dibuixades aquí
 * mateix (SVG en línia) per no dependre de cap llibreria: hereten el color del
 * botó amb `currentColor` i són decoratives (el nom accessible el posa el
 * botó), per això van amb `aria-hidden`.
 */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="icona"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Acabar jugada: la confirmació de tota la vida. */
export const CheckIcon = () => (
  <Icon>
    <polyline points="4.5 12.5 9.5 17.5 19.5 6.5" />
  </Icon>
);

/** Robar fitxa: una fitxa nova que s'afegeix. */
export const DrawIcon = () => (
  <Icon>
    <rect x="7" y="3.5" width="10" height="17" rx="2" />
    <line x1="12" y1="9.5" x2="12" y2="14.5" />
    <line x1="9.5" y1="12" x2="14.5" y2="12" />
  </Icon>
);

/** Passar torn: endavant, que jugui el següent. */
export const PassIcon = () => (
  <Icon>
    <polyline points="6 5.5 14.5 12 6 18.5" />
    <line x1="18.5" y1="5.5" x2="18.5" y2="18.5" />
  </Icon>
);

/** Desfer canvis: enrere. */
export const UndoIcon = () => (
  <Icon>
    <polyline points="9 14 4 9 9 4" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

/** Deixar la partida: la porta de sortida. */
export const ExitIcon = () => (
  <Icon>
    <path d="M13.5 4H18a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-4.5" />
    <line x1="14" y1="12" x2="4.5" y2="12" />
    <polyline points="8.5 8 4.5 12 8.5 16" />
  </Icon>
);
