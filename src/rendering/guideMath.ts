import { clamp, positiveModulo } from "../core/number";
import { getGridSpacingX, getSpacing } from "../core/settings";
import type { GuideSettings, ThemeMode } from "../core/types";
import type { ExcalidrawViewLike } from "../excalidraw/types";
import { getViewTransform } from "../excalidraw/view";

export interface GuideGeometry {
  baseSpacingX: number;
  baseSpacingY: number;
  spacingX: number;
  spacingY: number;
  offsetX: number;
  offsetY: number;
  lineThickness: number;
  dotSize: number;
  opacity: number;
  zoom: number;
  marginX: number;
  marginThickness: number;
}

export function getEffectiveOpacity(settings: GuideSettings, theme: ThemeMode): number {
  if (!settings.protectInk) return settings.opacity;
  return Math.min(settings.opacity, theme === "dark" ? 0.28 : 0.24);
}

export function calculateGuideGeometry(
  settings: GuideSettings,
  view: ExcalidrawViewLike,
  theme: ThemeMode,
): GuideGeometry {
  const { zoom, scrollX, scrollY } = getViewTransform(view, settings.followCanvas);
  const baseSpacingY = getSpacing(settings);
  const baseSpacingX = getGridSpacingX(settings);
  const spacingY = Math.max(6, baseSpacingY * zoom);
  const spacingX = Math.max(6, baseSpacingX * zoom);
  const visualScale = clamp(zoom, 0.75, 1.75);
  const lineThickness = clamp(settings.lineThickness * visualScale, 0.5, 6);
  const dotSize = clamp(settings.dotSize * visualScale, 0.75, 8);
  const marginThickness = clamp(settings.marginThickness * visualScale, 0.5, 6);

  return {
    baseSpacingX,
    baseSpacingY,
    spacingX,
    spacingY,
    offsetX: settings.followCanvas ? positiveModulo(scrollX * zoom, spacingX) : 0,
    offsetY: settings.followCanvas ? positiveModulo(scrollY * zoom, spacingY) : 0,
    lineThickness,
    dotSize,
    opacity: getEffectiveOpacity(settings, theme),
    zoom,
    marginX: settings.followCanvas ? scrollX * zoom + settings.marginOffset * zoom : settings.marginOffset,
    marginThickness,
  };
}

export function hasVisiblePaper(settings: GuideSettings): boolean {
  return settings.enabled && (settings.paperMode !== "blank" || settings.marginEnabled);
}

export function needsSceneAnimation(settings: GuideSettings): boolean {
  return hasVisiblePaper(settings) && (settings.followCanvas || settings.hideUnderObjects);
}
