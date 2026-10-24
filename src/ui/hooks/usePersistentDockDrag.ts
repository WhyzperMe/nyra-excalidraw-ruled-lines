import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DEFAULT_DOCK_POSITIONS } from "../../core/constants";
import { clamp } from "../../core/number";
import type { SettingsStore } from "../../core/SettingsStore";
import type { DockLayout, DockPosition, PluginUiActions } from "../../core/types";
import { DOCK_EDGE_MARGIN, normalizeDockPosition, type DockBounds } from "../dockGeometry";

interface DragSession {
  pointerId: number;
  layout: DockLayout;
  offsetX: number;
  offsetY: number;
  toolbarWidth: number;
  toolbarHeight: number;
  bounds: DockBounds;
}

interface PersistentDockDragOptions {
  store: SettingsStore;
  actions: PluginUiActions;
  portalElement: HTMLElement;
  boundsElement: HTMLElement;
  closePanel(): void;
}

const KEYBOARD_STEP = 0.04;
const KEYBOARD_STEP_LARGE = 0.12;

function getLayout(portalElement: HTMLElement): DockLayout {
  return portalElement.dataset.layout === "compact" ? "compact" : "desktop";
}

function getVisibleBounds(element: HTMLElement, layout: DockLayout): DockBounds | null {
  const rect = element.getBoundingClientRect();
  const win = element.ownerDocument.defaultView;
  if (!win) return null;

  const viewport = win.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportRight = viewportLeft + (viewport?.width ?? win.innerWidth);
  const viewportBottom = viewportTop + (viewport?.height ?? win.innerHeight);

  const margin = DOCK_EDGE_MARGIN[layout];
  const left = Math.max(rect.left + margin, viewportLeft + margin);
  const top = Math.max(rect.top + margin, viewportTop + margin);
  const right = Math.min(rect.right - margin, viewportRight - margin);
  const bottom = Math.min(rect.bottom - margin, viewportBottom - margin);

  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

function nearlyEqual(a: DockPosition, b: DockPosition): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}

export function usePersistentDockDrag({
  store,
  actions,
  portalElement,
  boundsElement,
  closePanel,
}: PersistentDockDragOptions) {
  const dragRef = useRef<DragSession | null>(null);

  const persistPosition = useCallback(
    (layout: DockLayout, position: DockPosition): void => {
      const snapshot = store.getSnapshot();
      if (nearlyEqual(snapshot.dockPositions[layout], position)) return;
      void actions.patchSettings({
        dockPositions: {
          ...snapshot.dockPositions,
          [layout]: position,
        },
      });
    },
    [actions, store],
  );

  const finishDrag = useCallback(
    (target: HTMLButtonElement, persist: boolean): void => {
      const session = dragRef.current;
      if (!session) return;
      dragRef.current = null;
      portalElement.dataset.dockDragging = "false";
      portalElement.classList.remove("is-dragging");

      if (target.hasPointerCapture(session.pointerId)) {
        target.releasePointerCapture(session.pointerId);
      }

      if (!persist) return;
      const toolbar = portalElement.querySelector<HTMLElement>(".nyra-ruled-lines-toolbar");
      if (!toolbar) return;
      const rect = toolbar.getBoundingClientRect();
      persistPosition(
        session.layout,
        normalizeDockPosition(
          rect.left,
          rect.top,
          rect.width,
          rect.height,
          getVisibleBounds(boundsElement, session.layout) ?? session.bounds,
        ),
      );
    },
    [boundsElement, persistPosition, portalElement],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      const toolbar = portalElement.querySelector<HTMLElement>(".nyra-ruled-lines-toolbar");
      const layout = getLayout(portalElement);
      const bounds = getVisibleBounds(boundsElement, layout);
      if (!toolbar || !bounds) return;

      const rect = toolbar.getBoundingClientRect();
      closePanel();
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        layout,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        toolbarWidth: rect.width,
        toolbarHeight: rect.height,
        bounds,
      };
      portalElement.dataset.dockDragging = "true";
      portalElement.classList.add("is-dragging");
    },
    [boundsElement, closePanel, portalElement],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      const session = dragRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();

      const bounds = getVisibleBounds(boundsElement, session.layout) ?? session.bounds;
      const maxLeft = Math.max(bounds.left, bounds.right - session.toolbarWidth);
      const maxTop = Math.max(bounds.top, bounds.bottom - session.toolbarHeight);
      const left = clamp(event.clientX - session.offsetX, bounds.left, maxLeft);
      const top = clamp(event.clientY - session.offsetY, bounds.top, maxTop);

      portalElement.style.left = `${Math.round(left)}px`;
      portalElement.style.top = `${Math.round(top)}px`;
    },
    [boundsElement, portalElement],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      event.preventDefault();
      finishDrag(event.currentTarget, true);
    },
    [finishDrag],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      finishDrag(event.currentTarget, true);
    },
    [finishDrag],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
      const layout = getLayout(portalElement);
      const current = store.getSnapshot().dockPositions[layout];
      const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
      let next = current;

      if (event.key === "ArrowLeft") next = { ...current, x: clamp(current.x - step, 0, 1) };
      else if (event.key === "ArrowRight") next = { ...current, x: clamp(current.x + step, 0, 1) };
      else if (event.key === "ArrowUp") next = { ...current, y: clamp(current.y - step, 0, 1) };
      else if (event.key === "ArrowDown") next = { ...current, y: clamp(current.y + step, 0, 1) };
      else if (event.key === "Home") next = DEFAULT_DOCK_POSITIONS[layout];
      else return;

      event.preventDefault();
      event.stopPropagation();
      closePanel();
      persistPosition(layout, next);
    },
    [closePanel, persistPosition, portalElement, store],
  );

  const onDoubleClick = useCallback((): void => {
    const layout = getLayout(portalElement);
    closePanel();
    persistPosition(layout, DEFAULT_DOCK_POSITIONS[layout]);
  }, [closePanel, persistPosition, portalElement]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    onDoubleClick,
  };
}
