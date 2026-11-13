/** Punts amb signe: «+25», «−10», «0» (amb el signe menys de debò). */
export function signed(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return '0';
}

/** Ordinal català abreujat: 1r, 2n, 3r, 4t, 5è… */
export function ordinal(n: number): string {
  if (n === 1) return '1r';
  if (n === 2) return '2n';
  if (n === 3) return '3r';
  if (n === 4) return '4t';
  return `${n}è`;
}

/** Punts de lliga, amb el mig punt d'un empat: «3», «2,5». */
export function leaguePoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1).replace('.', ',');
}
