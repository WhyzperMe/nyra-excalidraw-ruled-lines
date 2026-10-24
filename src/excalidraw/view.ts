import type { View } from "obsidian";
import { clamp } from "../core/number";
import type { ThemeMode } from "../core/types";
import type { ExcalidrawElementLike, ExcalidrawViewLike, ViewTransform } from "./types";

export function isExcalidrawView(
  view: View | ExcalidrawViewLike | null | undefined,
): view is View & ExcalidrawViewLike {
  try {
    return String(view?.getViewType?.() ?? "").toLowerCase() === "excalidraw";
  } catch {
    return false;
  }
}

export function findExcalidrawRoot(view: ExcalidrawViewLike): HTMLElement | null {
  const container = view.containerEl;
  if (!container?.isConnected) return null;
  return container.querySelector<HTMLElement>(".excalidraw");
}

export function getWorkspaceLeafElement(
  source: HTMLElement | ExcalidrawViewLike | null | undefined,
): HTMLElement | null {
  if (!source) return null;
  const element = "containerEl" in source ? source.containerEl : source;
  return element.closest<HTMLElement>(".workspace-leaf");
}

export function isRootRenderable(root: HTMLElement): boolean {
  if (!root.isConnected || root.getClientRects().length === 0) return false;

  const leaf = root.closest<HTMLElement>(".workspace-leaf");
  if (!leaf?.isConnected) return false;
  if (leaf.getAttribute("aria-hidden") === "true" || leaf.classList.contains("is-hidden")) return false;

  try {
    const win = root.ownerDocument.defaultView;
    const style = win?.getComputedStyle(root);
    const leafStyle = win?.getComputedStyle(leaf);
    if (!style || !leafStyle) return false;
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (leafStyle.display === "none" || leafStyle.visibility === "hidden") return false;
    if (Number.parseFloat(style.opacity || "1") === 0) return false;
    if (Number.parseFloat(leafStyle.opacity || "1") === 0) return false;
  } catch {
    return false;
  }

  const rect = root.getBoundingClientRect();
  return rect.width > 80 && rect.height > 80;
}

export function isRootInViewport(root: HTMLElement): boolean {
  if (!isRootRenderable(root)) return false;
  const rect = root.getBoundingClientRect();
  const win = root.ownerDocument.defaultView;
  if (!win) return false;
  const visual = win.visualViewport;
  const left = visual?.offsetLeft ?? 0;
  const top = visual?.offsetTop ?? 0;
  const right = left + (visual?.width ?? win.innerWidth);
  const bottom = top + (visual?.height ?? win.innerHeight);
  return rect.bottom > top && rect.right > left && rect.top < bottom && rect.left < right;
}

export function resolveTheme(view: ExcalidrawViewLike): ThemeMode {
  try {
    const theme = view.excalidrawAPI?.getAppState?.()?.theme;
    if (theme === "dark" || theme === "light") return theme;
  } catch {
    // Fall through to DOM theme detection.
  }

  if (view.containerEl.closest(".theme-dark")) return "dark";
  if (view.containerEl.closest(".theme-light")) return "light";
  return view.containerEl.ownerDocument.body.classList.contains("theme-dark") ? "dark" : "light";
}

export function getViewTransform(view: ExcalidrawViewLike, followCanvas: boolean): ViewTransform {
  if (!followCanvas) return { zoom: 1, scrollX: 0, scrollY: 0 };

  try {
    const state = view.excalidrawAPI?.getAppState?.();
    const rawZoom = typeof state?.zoom === "number" ? state.zoom : state?.zoom?.value;
    return {
      zoom: clamp(Number(rawZoom) || 1, 0.05, 30),
      scrollX: Number(state?.scrollX) || 0,
      scrollY: Number(state?.scrollY) || 0,
    };
  } catch {
    return { zoom: 1, scrollX: 0, scrollY: 0 };
  }
}

export function getViewFilePath(view: ExcalidrawViewLike): string | null {
  const path = view.file?.path?.trim();
  return path || null;
}

export function getViewportOffset(view: ExcalidrawViewLike): { left: number; top: number } {
  try {
    const state = view.excalidrawAPI?.getAppState?.();
    const rawLeft = Number(state?.offsetLeft);
    const rawTop = Number(state?.offsetTop);
    const root = findExcalidrawRoot(view);
    const rect = root?.getBoundingClientRect();

    return {
      left: Number.isFinite(rawLeft) ? rawLeft - (rect?.left ?? 0) : 0,
      top: Number.isFinite(rawTop) ? rawTop - (rect?.top ?? 0) : 0,
    };
  } catch {
    return { left: 0, top: 0 };
  }
}

export function getSceneElements(view: ExcalidrawViewLike): readonly ExcalidrawElementLike[] {
  try {
    const elements = view.excalidrawAPI?.getSceneElements?.();
    return Array.isArray(elements) ? elements : [];
  } catch {
    return [];
  }
}
