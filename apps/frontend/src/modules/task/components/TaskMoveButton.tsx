import { IconButton } from '@averoui/react';
import { GripVertical } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

/** Marks a column's "move here" button, so focus going to it is not a cancel. */
export const BOARD_DROP_ATTRIBUTE = 'data-board-drop';

type TaskMoveButtonProps = {
  /** Names the card, e.g. "Move “Build login”". */
  label: string;
  /** The id of the element explaining the keys. */
  instructionsId: string;
  isGrabbed: boolean;
  /** Take focus on mount: the card has just landed in a new column. */
  shouldFocus: boolean;
  onFocused: () => void;
  /** Picks the card up, or drops it when it is already held. */
  onToggle: () => void;
  onStep: (delta: 1 | -1) => void;
  onCancel: () => void;
};

/**
 * The handle a card is moved by. Enter or Space picks it up and puts it down;
 * while it is held the arrow keys choose the column and Escape lets go.
 */
export function TaskMoveButton({
  label,
  instructionsId,
  isGrabbed,
  shouldFocus,
  onFocused,
  onToggle,
  onStep,
  onCancel,
}: TaskMoveButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // A moved card is re-created in its new column, which drops focus on the
  // floor; this puts it back on the card the user was just holding.
  useEffect(() => {
    if (!shouldFocus) return;

    ref.current?.focus();
    onFocused();
  }, [shouldFocus, onFocused]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isGrabbed) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      onStep(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      onStep(-1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  function handleBlur(event: FocusEvent<HTMLButtonElement>) {
    if (!isGrabbed) return;

    // Focus moving to a column's "move here" button is the drop itself.
    const next: unknown = event.relatedTarget;
    if (
      next instanceof HTMLElement &&
      next.hasAttribute(BOARD_DROP_ATTRIBUTE)
    ) {
      return;
    }

    // Tabbing away with a card in hand would leave it held with no way to see
    // which one; letting go is the safe reading of losing focus.
    onCancel();
  }

  return (
    <IconButton
      ref={ref}
      variant="ghost"
      size="sm"
      label={label}
      aria-pressed={isGrabbed}
      aria-describedby={instructionsId}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <GripVertical aria-hidden className="size-4" />
    </IconButton>
  );
}
