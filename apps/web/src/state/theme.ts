import { useSyncExternalStore } from 'react';

/**
 * Mode clar o fosc. «Automàtic» segueix el sistema (i canvia quan canvia el
 * sistema); «clar» i «fosc» el fixen. És una preferència del dispositiu, com
 * l'aspecte de les fitxes: viu a localStorage. El CSS llegeix
 * `<html data-theme="light|dark">`, que ja posa un petit script a index.html
 * abans de pintar res (sense parpelleig en obrir l'app).
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'remigi:tema';
export const THEME_OPTIONS: readonly ThemeChoice[] = ['auto', 'light', 'dark'];

export function readTheme(raw: string | null): ThemeChoice {
  return raw === 'light' || raw === 'dark' ? raw : 'auto';
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === 'auto') return prefersDark ? 'dark' : 'light';
  return choice;
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function load(): ThemeChoice {
  try {
    return readTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return 'auto';
  }
}

let current: ThemeChoice = typeof window === 'undefined' ? 'auto' : load();
const listeners = new Set<() => void>();

/** Posa el tema a `<html>` (i el color de la barra del navegador). */
export function applyTheme(choice: ThemeChoice = current): ResolvedTheme {
  const resolved = resolveTheme(choice, prefersDark());
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#1c1917' : '#0f766e');
  }
  return resolved;
}

export function getTheme(): ThemeChoice {
  return current;
}

export function setTheme(choice: ThemeChoice): void {
  current = readTheme(choice);
  try {
    if (current === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, current);
  } catch {
    // Sense emmagatzematge, la tria dura mentre duri la pestanya.
  }
  applyTheme(current);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Aplica el tema desat i, en automàtic, el segueix si el sistema canvia. */
export function initTheme(): void {
  applyTheme(current);
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (current === 'auto') applyTheme(current);
    });
  } catch {
    // Navegadors antics: el tema es queda com era en obrir l'app.
  }
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, getTheme, () => 'auto' as ThemeChoice);
  return [choice, setTheme];
}
