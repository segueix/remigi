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


/** Mostrar la solució: un ull que la mira. */
export const EyeIcon = () => (
  <Icon>
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </Icon>
);

/** Següent: endavant, cap a la pròxima oportunitat. */
export const NextIcon = () => (
  <Icon>
    <line x1="4" y1="12" x2="19" y2="12" />
    <polyline points="13 5.5 19.5 12 13 18.5" />
  </Icon>
);

/** Girar la pantalla: un mòbil dret i la fletxa que el tomba. */
export const RotateIcon = () => (
  <Icon>
    <rect x="4" y="3" width="9.5" height="15" rx="2" />
    <path d="M17 6a5.5 5.5 0 0 1 4 5.5V15" />
    <polyline points="18.5 13 21 16 23.5 13" />
  </Icon>
);
