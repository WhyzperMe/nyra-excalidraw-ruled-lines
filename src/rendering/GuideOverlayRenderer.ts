import { hexToRgba } from "../core/color";
import type { GuideSettings, ThemeMode } from "../core/types";
import type { ExcalidrawViewLike } from "../excalidraw/types";
import { calculateGuideGeometry, hasVisiblePaper } from "./guideMath";
import { ObjectOcclusionCanvas } from "./ObjectOcclusionCanvas";

interface RenderCache {
  renderable?: boolean;
  enabled?: boolean;
  theme?: ThemeMode;
  paperMode?: GuideSettings["paperMode"];
  spacingX?: number;
  spacingY?: number;
  offsetX?: number;
  offsetY?: number;
  lineThickness?: number;
  dotSize?: number;
  lineColor?: string;
  opacity?: number;
  marginEnabled?: boolean;
  marginX?: number;
  marginThickness?: number;
  marginColor?: string;
  marginOpacity?: number;
  objectAware?: boolean;
}

export class GuideOverlayRenderer {
  private readonly cache: RenderCache = {};
  private readonly pattern: HTMLDivElement;
  private readonly margin: HTMLDivElement;
  private readonly occlusionCanvasElement: HTMLCanvasElement;
  private readonly occlusionCanvas: ObjectOcclusionCanvas;

  public constructor(private readonly overlay: HTMLDivElement) {
    const doc = overlay.ownerDocument;
    this.pattern = doc.createElement("div");
    this.pattern.className = "nyra-paper-pattern";
    this.pattern.setAttribute("aria-hidden", "true");

    this.margin = doc.createElement("div");
    this.margin.className = "nyra-paper-margin-line";
    this.margin.setAttribute("aria-hidden", "true");

    this.occlusionCanvasElement = doc.createElement("canvas");
    this.occlusionCanvasElement.className = "nyra-paper-occlusion-canvas";
    this.occlusionCanvasElement.setAttribute("aria-hidden", "true");
    this.occlusionCanvas = new ObjectOcclusionCanvas(this.occlusionCanvasElement);

    overlay.replaceChildren(this.pattern, this.margin, this.occlusionCanvasElement);
  }

  public render(
    settings: GuideSettings,
    view: ExcalidrawViewLike,
    theme: ThemeMode,
    renderable: boolean,
    force = false,
  ): void {
    const geometry = calculateGuideGeometry(settings, view, theme);
    const enabled = hasVisiblePaper(settings);
    const objectAware = Boolean(
      enabled && settings.hideUnderObjects && this.occlusionCanvas.isSupported(view),
    );

    if (force || this.cache.renderable !== renderable) {
      this.overlay.classList.toggle("is-suspended", !renderable);
      this.cache.renderable = renderable;
    }

    if (force || this.cache.enabled !== enabled) {
      this.overlay.classList.toggle("is-enabled", enabled);
      this.cache.enabled = enabled;
    }

    if (force || this.cache.theme !== theme) {
      this.overlay.dataset.theme = theme;
      this.cache.theme = theme;
    }

    if (force || this.cache.objectAware !== objectAware) {
      this.overlay.classList.toggle("is-object-aware", objectAware);
      this.cache.objectAware = objectAware;
      if (!objectAware) this.occlusionCanvas.clear();
    }

    if (force || this.cache.paperMode !== settings.paperMode) {
      this.pattern.dataset.paperMode = settings.paperMode;
      this.cache.paperMode = settings.paperMode;
    }

    if (force || this.cache.spacingX !== geometry.spacingX) {
      this.pattern.style.setProperty("--nyra-paper-spacing-x", `${geometry.spacingX.toFixed(3)}px`);
      this.cache.spacingX = geometry.spacingX;
    }

    if (force || this.cache.spacingY !== geometry.spacingY) {
      this.pattern.style.setProperty("--nyra-paper-spacing-y", `${geometry.spacingY.toFixed(3)}px`);
      this.cache.spacingY = geometry.spacingY;
    }

    if (force || this.cache.offsetX !== geometry.offsetX) {
      this.pattern.style.setProperty("--nyra-paper-offset-x", `${geometry.offsetX.toFixed(3)}px`);
      this.cache.offsetX = geometry.offsetX;
    }

    if (force || this.cache.offsetY !== geometry.offsetY) {
      this.pattern.style.setProperty("--nyra-paper-offset-y", `${geometry.offsetY.toFixed(3)}px`);
      this.cache.offsetY = geometry.offsetY;
    }

    if (force || this.cache.lineThickness !== geometry.lineThickness) {
      this.pattern.style.setProperty("--nyra-paper-line-thickness", `${geometry.lineThickness.toFixed(3)}px`);
      this.cache.lineThickness = geometry.lineThickness;
    }

    if (force || this.cache.dotSize !== geometry.dotSize) {
      this.pattern.style.setProperty("--nyra-paper-dot-size", `${geometry.dotSize.toFixed(3)}px`);
      this.cache.dotSize = geometry.dotSize;
    }

    const lineColor = hexToRgba(settings.lineColor, geometry.opacity);
    if (force || this.cache.lineColor !== settings.lineColor || this.cache.opacity !== geometry.opacity) {
      this.pattern.style.setProperty("--nyra-paper-color", lineColor);
      this.cache.lineColor = settings.lineColor;
      this.cache.opacity = geometry.opacity;
    }

    if (force || this.cache.marginEnabled !== settings.marginEnabled) {
      this.margin.classList.toggle("is-enabled", settings.marginEnabled);
      this.cache.marginEnabled = settings.marginEnabled;
    }

    if (force || this.cache.marginX !== geometry.marginX) {
      this.margin.style.setProperty("--nyra-margin-x", `${geometry.marginX.toFixed(3)}px`);
      this.cache.marginX = geometry.marginX;
    }

    if (force || this.cache.marginThickness !== geometry.marginThickness) {
      this.margin.style.setProperty("--nyra-margin-thickness", `${geometry.marginThickness.toFixed(3)}px`);
      this.cache.marginThickness = geometry.marginThickness;
    }

    const marginColor = hexToRgba(settings.marginColor, geometry.opacity);
    if (
      force ||
      this.cache.marginColor !== settings.marginColor ||
      this.cache.marginOpacity !== geometry.opacity
    ) {
      this.margin.style.setProperty("--nyra-margin-color", marginColor);
      this.cache.marginColor = settings.marginColor;
      this.cache.marginOpacity = geometry.opacity;
    }

    if (objectAware && renderable) {
      this.occlusionCanvas.render(
        {
          settings,
          geometry,
          view,
          lineColor,
          marginColor,
        },
        force,
      );
    }
  }

  public suspend(): void {
    this.overlay.classList.remove("is-enabled");
    this.overlay.classList.add("is-suspended");
  }

  public destroy(): void {
    this.suspend();
    this.occlusionCanvas.clear();
    this.overlay.style.removeProperty("mix-blend-mode");
    this.overlay.replaceChildren();
    this.overlay.remove();
  }
}
