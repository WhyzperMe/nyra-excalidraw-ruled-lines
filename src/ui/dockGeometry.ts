import { clamp } from "../core/number";
import type { DockLayout, DockPosition } from "../core/types";

export interface DockBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DockPixelPosition {
  left: number;
  top: number;
}

export const DOCK_EDGE_MARGIN: Readonly<Record<DockLayout, number>> = Object.freeze({
  desktop: 12,
  compact: 8,
});

export function normalizeDockPosition(
  left: number,
  top: number,
  dockWidth: number,
  dockHeight: number,
  bounds: DockBounds,
): DockPosition {
  const travelX = Math.max(0, bounds.right - bounds.left - dockWidth);
  const travelY = Math.max(0, bounds.bottom - bounds.top - dockHeight);
  return {
    x: travelX > 0 ? clamp((left - bounds.left) / travelX, 0, 1) : 0,
    y: travelY > 0 ? clamp((top - bounds.top) / travelY, 0, 1) : 0,
  };
}

export function resolveDockPixelPosition(
  position: DockPosition,
  dockWidth: number,
  dockHeight: number,
  bounds: DockBounds,
): DockPixelPosition {
  const boundsWidth = Math.max(0, bounds.right - bounds.left);
  const boundsHeight = Math.max(0, bounds.bottom - bounds.top);
  const travelX = Math.max(0, boundsWidth - dockWidth);
  const travelY = Math.max(0, boundsHeight - dockHeight);
  return {
    left: clamp(bounds.left + travelX * position.x, bounds.left, bounds.left + travelX),
    top: clamp(bounds.top + travelY * position.y, bounds.top, bounds.top + travelY),
  };
}

export function resolvePanelPixelLeft(
  positionX: number,
  panelWidth: number,
  bounds: Pick<DockBounds, "left" | "right">,
): number {
  const width = Math.max(0, bounds.right - bounds.left);
  const travelX = Math.max(0, width - panelWidth);
  const normalizedX = clamp(positionX, 0, 1);
  return clamp(bounds.left + travelX * normalizedX, bounds.left, bounds.left + travelX);
}
