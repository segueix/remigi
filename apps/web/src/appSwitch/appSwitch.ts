/**
 * Pas a El Tauler lliscant el dit (2026-10-31).
 *
 * Remigi (eltauler.cat/remigi/) i El Tauler (eltauler.cat) són apps germanes.
 * Al mòbil, lliscar el dit cap a l'esquerra o la dreta pel mig de la pantalla
 * fa entrar un panell «El Tauler» des del costat que segueix el dit; si es deixa
 * anar passat el llindar, s'obre El Tauler (a la mateixa pestanya). És la
 * mateixa animació que el pas de Segueix! a Segueix! Música
 * (js/features/app-switch.js de segueix/segueix); el sentit contrari, d'El
 * Tauler cap a Remigi, és a canviapp.js de segueix/eltauler.
 *
 * El gest no fa res des de les vores (hi ha l'enrere del sistema), damunt de
 * les fitxes i del faristol (allà el dit aixeca i arrossega fitxes), de
 * fileres amb scroll lateral, camps de text, el menú del jugador o altres
 * finestres, ni si el moviment és sobretot vertical (desplaçar la taula). Si
 * una fitxa s'aixeca a mig gest, el gest es deixa córrer.
 *
 * Les tres primeres vegades que s'obre l'app al mòbil, un avís amb una mà que
 * llisca ho explica (uns 3 s). La lògica de decisió és pura i es prova a
 * appSwitch.test.ts; el gest real, a e2e/canvi-app.spec.ts.
 */

export const TARGET_URL = 'https://eltauler.cat/';
export const TARGET_NAME = 'El Tauler';

/** Zona central on ha de començar el gest (fraccions de la pantalla). */
export const START_ZONE = { left: 0.12, right: 0.88, top: 0.15, bottom: 0.88 } as const;
/** Píxels abans de decidir si el gest és horitzontal o vertical. */
const LOCK_DISTANCE = 12;
/** |dx| ha de ser 1,8 vegades |dy| perquè compti com a horitzontal. */
const HORIZONTAL_RATIO = 1.8;
/** Cal arrossegar el 35 % de l'ample de la pantalla, i com a mínim 110 px. */
const COMMIT_FRACTION = 0.35;
const MIN_COMMIT_PX = 110;

/** Damunt d'aquests elements el gest no fa res (tenen gestos propis o s'hi escriu). */
const BLOCKED = [
  'input',
  'textarea',
  'select',
  '[contenteditable]',
  '[data-no-app-swipe]',
  '.tile',
  '.rack-area',
  '.drag-layer',
  '.menu-fons',
  '.menu-usuari',
  '[role="dialog"]',
  'dialog',
].join(',');

export type Axis = 'h' | 'v' | '';

// ---------- Lògica pura ----------

export function startAllowed({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return (
    x >= width * START_ZONE.left &&
    x <= width * START_ZONE.right &&
    y >= height * START_ZONE.top &&
    y <= height * START_ZONE.bottom
  );
}

/** 'h' (horitzontal), 'v' (vertical) o '' (encara no se sap). */
export function lockAxis(dx: number, dy: number): Axis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < LOCK_DISTANCE && ay < LOCK_DISTANCE) return '';
  return ax > ay * HORIZONTAL_RATIO ? 'h' : 'v';
}

export function commitDistance(width: number): number {
  return Math.max(MIN_COMMIT_PX, width * COMMIT_FRACTION);
}

/** Fins on ha entrat el panell (0–1). */
export function progress(dx: number, width: number): number {
  return Math.max(0, Math.min(1, Math.abs(dx) / commitDistance(width)));
}

export function shouldCommit({ dx, dy, width }: { dx: number; dy: number; width: number }): boolean {
  return Math.abs(dx) >= commitDistance(width) && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO;
}

// ---------- Avís de les primeres vegades ----------

/** Remigi i El Tauler comparteixen domini (i localStorage): la clau no ha de topar. */
export const HINT_KEY = 'remigi:avis-canvi-app';
export const HINT_TIMES = 3;
const HINT_MS = 3000;
/** Si en 20 s la taula no és a punt, aquesta vegada no surt. */
const HINT_WAIT_MS = 20000;

export function shouldShowHint(count: unknown): boolean {
  const n = Number(count);
  return !Number.isFinite(n) || n < HINT_TIMES;
}

/** Les icones es pinten des d'aquí: el panell viu fora de React, al `body`. */
const ICON = '<span class="app-switch__mark" aria-hidden="true">♔</span>';

/** Una mà amb el dit índex estirat (traç blanc; forma de la icona «pointer» de Lucide, ISC). */
const HAND =
  '<svg class="app-switch-hint__hand" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>';

// ---------- DOM ----------

/**
 * Comença a escoltar el dit. Retorna `false` si ja s'havia arrencat (o si no
 * hi ha document), perquè cridar-la dues vegades no dupliqui els oients.
 */
export function initAppSwitch(w: Window = window): boolean {
  const doc = w.document;
  if (!doc?.documentElement || doc.documentElement.dataset.appSwitch === 'on') return false;
  doc.documentElement.dataset.appSwitch = 'on';

  const state = {
    tracking: false,
    axis: '' as Axis,
    x0: 0,
    y0: 0,
    dx: 0,
    dy: 0,
    panel: null as HTMLElement | null,
    leaving: false,
  };

  const isMobile = () => Boolean(w.matchMedia?.('(max-width: 768px)').matches);

  /** Un element (o un pare) que ja fa scroll lateral: el dit és per a ell, no per canviar d'app. */
  function insideHorizontalScroller(target: Element): boolean {
    for (let node: Element | null = target; node && node !== doc.body; node = node.parentElement) {
      const overflowX = w.getComputedStyle(node).overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 2) return true;
    }
    return false;
  }

  function blocked(eventTarget: EventTarget | null): boolean {
    const target = eventTarget as Element | null;
    if (!target || typeof target.closest !== 'function') return true;
    if (target.closest(BLOCKED)) return true;
    if (doc.querySelector('dialog[open], [role="dialog"], .menu-fons')) return true;
    return insideHorizontalScroller(target);
  }

  function ensurePanel(): HTMLElement {
    if (state.panel?.isConnected) return state.panel;
    const panel = doc.createElement('div');
    panel.className = 'app-switch';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `<div class="app-switch__card">${ICON}<strong>${TARGET_NAME}</strong><em class="app-switch__go">Deixa anar per anar-hi</em></div>`;
    doc.body.appendChild(panel);
    state.panel = panel;
    return panel;
  }

  function paint(dx: number) {
    const panel = ensurePanel();
    const p = progress(dx, w.innerWidth);
    // Lliscant cap a l'esquerra el panell entra per la dreta, i a l'inrevés
    const from = dx < 0 ? 1 : -1;
    panel.classList.add('is-active');
    panel.classList.toggle('is-ready', p >= 1);
    panel.style.transition = 'none';
    panel.style.transform = `translateX(${from * (1 - p) * 100}%)`;
  }

  function reset({ animate = true } = {}) {
    const panel = state.panel;
    state.tracking = false;
    state.axis = '';
    if (!panel) return;
    const from = state.dx < 0 ? 1 : -1;
    panel.style.transition = animate ? '' : 'none';
    panel.style.transform = `translateX(${from * 100}%)`;
    panel.classList.remove('is-ready');
    w.setTimeout(() => panel.classList.remove('is-active'), animate ? 260 : 0);
  }

  function leave() {
    const panel = ensurePanel();
    state.leaving = true;
    panel.classList.add('is-active', 'is-ready', 'is-leaving');
    panel.style.transition = '';
    panel.style.transform = 'translateX(0)';
    w.setTimeout(() => w.location.assign(TARGET_URL), 180);
  }

  function onStart(event: TouchEvent) {
    if (state.leaving || !isMobile() || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!startAllowed({ x: touch.clientX, y: touch.clientY, width: w.innerWidth, height: w.innerHeight })) return;
    if (blocked(event.target)) return;
    state.tracking = true;
    state.axis = '';
    state.x0 = touch.clientX;
    state.y0 = touch.clientY;
    state.dx = 0;
    state.dy = 0;
  }

  function onMove(event: TouchEvent) {
    if (!state.tracking) return;
    // Una fitxa aixecada a mig gest: el dit és per a ella
    if (event.touches.length !== 1 || doc.querySelector('.drag-layer')) {
      reset();
      return;
    }
    const touch = event.touches[0];
    state.dx = touch.clientX - state.x0;
    state.dy = touch.clientY - state.y0;
    if (!state.axis) state.axis = lockAxis(state.dx, state.dy);
    if (state.axis === 'v') {
      state.tracking = false;
      return;
    }
    if (state.axis === 'h') paint(state.dx);
  }

  function onEnd() {
    if (!state.tracking) return;
    if (
      state.axis === 'h' &&
      !doc.querySelector('.drag-layer') &&
      shouldCommit({ dx: state.dx, dy: state.dy, width: w.innerWidth })
    ) {
      state.tracking = false;
      leave();
      return;
    }
    reset();
  }

  // ---------- Avís de les primeres vegades (mòbil) ----------
  // Les tres primeres vegades que s'obre l'app al mòbil, amb la taula a punt i
  // sense cap finestra ni l'avís de torn d'un bot al damunt, una mà blanca amb
  // el dit estirat llisca cap als costats amb «El Tauler» a sota durant uns 3 s.
  // No bloqueja res (pointer-events: none). Només compta si s'ha mostrat.

  function readHintCount(): number {
    try {
      return Number(w.localStorage.getItem(HINT_KEY)) || 0;
    } catch {
      return HINT_TIMES; // sense emmagatzematge no es pot comptar: millor no repetir-lo a cada obertura
    }
  }

  function saveHintCount(count: number) {
    try {
      w.localStorage.setItem(HINT_KEY, String(count));
    } catch {
      // Sense emmagatzematge.
    }
  }

  function tableReady(): boolean {
    const board = doc.querySelector<HTMLElement>('.app-joc .board');
    if (!board || !board.offsetHeight) return false;
    if (!doc.querySelector('.rack .tile')) return false;
    return !doc.querySelector('dialog[open], [role="dialog"], .menu-fons, .torn-avis, .game-over');
  }

  function showHint() {
    const hint = doc.createElement('div');
    hint.className = 'app-switch-hint';
    hint.setAttribute('role', 'status');
    hint.innerHTML = `<div class="app-switch-hint__stage" aria-hidden="true"><span class="app-switch-hint__arrow app-switch-hint__arrow--left">‹</span>${HAND}<span class="app-switch-hint__arrow app-switch-hint__arrow--right">›</span></div><strong>${TARGET_NAME}</strong><span class="app-switch-hint__sr">Llisca el dit cap a un costat per anar a ${TARGET_NAME}</span>`;
    doc.body.appendChild(hint);
    w.requestAnimationFrame(() => hint.classList.add('is-visible'));
    w.setTimeout(() => hint.classList.remove('is-visible'), HINT_MS - 300);
    w.setTimeout(() => hint.remove(), HINT_MS);
  }

  function scheduleHint() {
    if (!isMobile() || !shouldShowHint(readHintCount())) return;
    const started = Date.now();
    const tick = () => {
      if (state.leaving || !isMobile()) return;
      if (tableReady()) {
        // Mig segon després que la taula sigui a punt, perquè es vegi la pantalla abans
        w.setTimeout(() => {
          if (!tableReady()) {
            if (Date.now() - started < HINT_WAIT_MS) w.setTimeout(tick, 300);
            return;
          }
          showHint();
          saveHintCount(readHintCount() + 1);
        }, 500);
        return;
      }
      if (Date.now() - started < HINT_WAIT_MS) w.setTimeout(tick, 300);
    };
    tick();
  }

  doc.addEventListener('touchstart', onStart, { passive: true });
  doc.addEventListener('touchmove', onMove, { passive: true });
  doc.addEventListener('touchend', onEnd, { passive: true });
  doc.addEventListener('touchcancel', () => reset(), { passive: true });
  // En tornar enrere des d'El Tauler el navegador pot restaurar la pàgina tal com era: sense el panell
  w.addEventListener('pageshow', () => {
    state.leaving = false;
    if (state.panel) {
      state.panel.classList.remove('is-leaving');
      reset({ animate: false });
    }
  });
  scheduleHint();
  return true;
}
