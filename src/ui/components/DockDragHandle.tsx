import type { KeyboardEventHandler, PointerEventHandler, ReactElement, MouseEventHandler } from "react";
import { ObsidianIcon } from "./ObsidianIcon";

interface DockDragHandleProps {
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  onDoubleClick: MouseEventHandler<HTMLButtonElement>;
}

export function DockDragHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  onDoubleClick,
}: DockDragHandleProps): ReactElement {
  return (
    <button
      type="button"
      className="nyra-dock-drag-handle"
      aria-label="Move control dock"
      title="Drag to move · Arrow keys to nudge · Home or double-click to reset position"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
    >
      <ObsidianIcon name="grip-vertical" />
    </button>
  );
}
