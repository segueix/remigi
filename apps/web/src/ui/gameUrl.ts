/** L'adreça del joc (sense paràmetres), per als enllaços que es comparteixen. */
export function gameUrl(): string {
  try {
    return `${window.location.origin}${window.location.pathname}`;
  } catch {
    return 'https://segueix.github.io/remigi/';
  }
}
