import type { Meld } from '@rummikub/core';
import { MeldView } from './MeldView';

interface Props {
  board: Meld[];
  invalidIndexes?: ReadonlySet<number>;
  selectedTileId?: string | null;
  highlighted?: ReadonlySet<string>;
  /** Actiu només durant el torn del jugador. */
  interactive?: boolean;
  onTileClick?(tileId: string, meldIndex: number): void;
  onMeldClick?(index: number): void;
  onNewMeldClick?(): void;
}

export function BoardView({
  board,
  invalidIndexes,
  selectedTileId,
  highlighted,
  interactive,
  onTileClick,
  onMeldClick,
  onNewMeldClick,
}: Props) {
  const hasSelection = Boolean(selectedTileId);

  return (
    <div className="board">
      {board.length === 0 && !hasSelection && (
        <p className="muted board-empty">La taula és buida.</p>
      )}

      {board.map((meld, index) => (
        <MeldView
          key={meld.map((tile) => tile.id).join('-')}
          meld={meld}
          invalid={invalidIndexes?.has(index)}
          isTarget={interactive && hasSelection}
          selectedTileId={selectedTileId}
          highlighted={highlighted}
          onTileClick={interactive ? (tileId) => onTileClick?.(tileId, index) : undefined}
          onMeldClick={interactive && hasSelection ? () => onMeldClick?.(index) : undefined}
        />
      ))}

      {interactive && hasSelection && (
        <button type="button" className="new-meld" onClick={onNewMeldClick}>
          + Jugada nova
        </button>
      )}
    </div>
  );
}
