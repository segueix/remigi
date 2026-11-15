/**
 * L'avatar del jugador: la seva inicial i, sempre, la roda de configuració
 * enganxada a la vora. És el mateix a tota l'app (l'inici, la partida, el
 * repte, la lliga i el perfil): tocar el jugador obre el perfil i la
 * configuració, i la roda ho fa visible.
 */
export function PlayerAvatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={['player-color', 'amb-config', className].filter(Boolean).join(' ')} aria-hidden="true">
      {initial}
    </span>
  );
}
