import { clamp, positiveModulo } from "../core/number";
import type { GuideSettings } from "../core/types";
import type { ExcalidrawElementLike, ExcalidrawViewLike, ViewTransform } from "../excalidraw/types";
import { getSceneElements, getViewTransform, getViewportOffset } from "../excalidraw/view";
import type { GuideGeometry } from "./guideMath";

interface Occluder {
  element: ExcalidrawElementLike;
  strength: number;
}

interface CanvasRenderInput {
  settings: GuideSettings;
  geometry: GuideGeometry;
  view: ExcalidrawViewLike;
  lineColor: string;
  marginColor: string;
}

interface CanvasCache {
  width?: number;
  height?: number;
  dpr?: number;
  guideKey?: string;
  sceneKey?: string;
  sceneTransformKey?: string;
}

const MAX_CANVAS_DPR = 2;
const OCCLUSION_PADDING = 1.25;
const NON_OCCLUDING_TYPES = new Set(["arrow", "line", "freedraw", "text", "frame", "magicframe"]);
const ALWAYS_OCCLUDING_TYPES = new Set(["image", "embeddable", "iframe"]);

function isTransparentColor(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized === "transparent" || normalized === "none") return true;
  if (/^#[0-9a-f]{4}$/.test(normalized) && normalized.endsWith("0")) return true;
  if (/^#[0-9a-f]{8}$/.test(normalized) && normalized.endsWith("00")) return true;
  if (/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized)) return true;
  if (/^hsla\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized)) return true;
  return false;
}

export function getSceneElementOcclusionStrength(element: ExcalidrawElementLike): number {
  const opacity = clamp(Number(element.opacity ?? 100) / 100, 0, 1);
  if (opacity <= 0) return 0;
  if (ALWAYS_OCCLUDING_TYPES.has(String(element.type ?? "").toLowerCase())) return opacity;
  if (isTransparentColor(element.backgroundColor)) return 0;

  const fillStyle = String(element.fillStyle ?? "solid").toLowerCase();
  if (fillStyle === "solid") return opacity;
  if (fillStyle === "cross-hatch") return opacity * 0.86;
  if (fillStyle === "hachure" || fillStyle === "zigzag") return opacity * 0.72;
  return opacity * 0.8;
}

export function isSceneElementOccluder(element: ExcalidrawElementLike): boolean {
  if (element.isDeleted) return false;
  const type = String(element.type ?? "").toLowerCase();
  if (NON_OCCLUDING_TYPES.has(type)) return false;
  if (Number(element.width ?? 0) <= 0 || Number(element.height ?? 0) <= 0) return false;
  return getSceneElementOcclusionStrength(element) > 0.01;
}

function collectOccluders(view: ExcalidrawViewLike): Occluder[] {
  return getSceneElements(view)
    .filter(isSceneElementOccluder)
    .map((element) => ({ element, strength: getSceneElementOcclusionStrength(element) }));
}

function hashString(seed: number, value: string): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildSceneKey(occluders: readonly Occluder[]): string {
  let hash = 2166136261;
  for (const { element, strength } of occluders) {
    hash = hashString(hash, String(element.id ?? "?"));
    hash = hashString(hash, String(element.version ?? element.updated ?? 0));
    hash = hashString(hash, String(element.type ?? "?"));
    hash = hashString(hash, Number(element.x ?? 0).toFixed(2));
    hash = hashString(hash, Number(element.y ?? 0).toFixed(2));
    hash = hashString(hash, Number(element.width ?? 0).toFixed(2));
    hash = hashString(hash, Number(element.height ?? 0).toFixed(2));
    hash = hashString(hash, Number(element.angle ?? 0).toFixed(4));
    hash = hashString(hash, strength.toFixed(3));
  }
  return `${occluders.length}:${hash >>> 0}`;
}

function buildGuideKey(input: CanvasRenderInput): string {
  const { settings, geometry, lineColor, marginColor } = input;
  return [
    settings.enabled,
    settings.paperMode,
    geometry.spacingX.toFixed(3),
    geometry.spacingY.toFixed(3),
    geometry.offsetX.toFixed(3),
    geometry.offsetY.toFixed(3),
    geometry.lineThickness.toFixed(3),
    geometry.dotSize.toFixed(3),
    geometry.opacity.toFixed(3),
    lineColor,
    settings.marginEnabled,
    geometry.marginX.toFixed(3),
    geometry.marginThickness.toFixed(3),
    marginColor,
  ].join("|");
}

function getSceneTransformKey(view: ExcalidrawViewLike): string {
  const transform = getViewTransform(view, true);
  const offset = getViewportOffset(view);
  return [
    transform.zoom.toFixed(5),
    transform.scrollX.toFixed(3),
    transform.scrollY.toFixed(3),
    offset.left.toFixed(2),
    offset.top.toFixed(2),
  ].join("|");
}

function drawGuides(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  input: CanvasRenderInput,
): void {
  const { settings, geometry, lineColor, marginColor } = input;
  if (!settings.enabled) return;

  context.save();
  context.fillStyle = lineColor;

  const spacingX = Math.max(1, geometry.spacingX);
  const spacingY = Math.max(1, geometry.spacingY);
  const firstX = positiveModulo(geometry.offsetX, spacingX);
  const firstY = positiveModulo(geometry.offsetY, spacingY);

  if (settings.paperMode === "ruled" || settings.paperMode === "grid") {
    for (let y = firstY; y <= height + spacingY; y += spacingY) {
      context.fillRect(0, y - geometry.lineThickness, width, geometry.lineThickness);
    }
  }

  if (settings.paperMode === "grid") {
    for (let x = firstX; x <= width + spacingX; x += spacingX) {
      context.fillRect(x - geometry.lineThickness, 0, geometry.lineThickness, height);
    }
  }

  if (settings.paperMode === "dots") {
    const radius = Math.max(0.375, geometry.dotSize / 2);
    const tileWidth = Math.max(1, Math.round(spacingX));
    const tileHeight = Math.max(1, Math.round(spacingY));
    const tile = context.canvas.ownerDocument.createElement("canvas");
    tile.width = tileWidth;
    tile.height = tileHeight;
    const tileContext = tile.getContext("2d", { alpha: true });

    if (tileContext) {
      tileContext.fillStyle = lineColor;
      tileContext.beginPath();
      tileContext.arc(0, 0, radius, 0, Math.PI * 2);
      tileContext.fill();
      tileContext.beginPath();
      tileContext.arc(tileWidth, 0, radius, 0, Math.PI * 2);
      tileContext.fill();
      tileContext.beginPath();
      tileContext.arc(0, tileHeight, radius, 0, Math.PI * 2);
      tileContext.fill();
      tileContext.beginPath();
      tileContext.arc(tileWidth, tileHeight, radius, 0, Math.PI * 2);
      tileContext.fill();

      const pattern = context.createPattern(tile, "repeat");
      if (pattern) {
        context.save();
        context.translate(firstX, firstY);
        context.fillStyle = pattern;
        context.fillRect(
          -firstX - tileWidth,
          -firstY - tileHeight,
          width + tileWidth * 2,
          height + tileHeight * 2,
        );
        context.restore();
      }
    }
  }

  if (settings.marginEnabled) {
    context.fillStyle = marginColor;
    context.fillRect(geometry.marginX - geometry.marginThickness / 2, 0, geometry.marginThickness, height);
  }

  context.restore();
}

function isOutsideViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  const radius = Math.hypot(width, height) / 2 + OCCLUSION_PADDING;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return (
    centerX + radius < 0 ||
    centerY + radius < 0 ||
    centerX - radius > viewportWidth ||
    centerY - radius > viewportHeight
  );
}

function eraseElement(
  context: CanvasRenderingContext2D,
  element: ExcalidrawElementLike,
  strength: number,
  sceneTransform: ViewTransform,
  viewportOffset: { left: number; top: number },
  viewportWidth: number,
  viewportHeight: number,
): void {
  const zoom = sceneTransform.zoom;
  const width = Math.abs(Number(element.width ?? 0) * zoom);
  const height = Math.abs(Number(element.height ?? 0) * zoom);
  if (width < 0.5 || height < 0.5) return;

  const x = (Number(element.x ?? 0) + sceneTransform.scrollX) * zoom + viewportOffset.left;
  const y = (Number(element.y ?? 0) + sceneTransform.scrollY) * zoom + viewportOffset.top;
  if (isOutsideViewport(x, y, width, height, viewportWidth, viewportHeight)) return;

  const angle = Number(element.angle ?? 0);
  const paddedWidth = width + OCCLUSION_PADDING * 2;
  const paddedHeight = height + OCCLUSION_PADDING * 2;
  const type = String(element.type ?? "rectangle").toLowerCase();

  context.save();
  context.globalCompositeOperation = "destination-out";
  context.globalAlpha = clamp(strength, 0, 1);
  context.fillStyle = "#000";
  context.translate(x + width / 2, y + height / 2);
  if (Number.isFinite(angle) && angle !== 0) context.rotate(angle);

  if (type === "ellipse") {
    context.beginPath();
    context.ellipse(0, 0, paddedWidth / 2, paddedHeight / 2, 0, 0, Math.PI * 2);
    context.fill();
  } else if (type === "diamond") {
    context.beginPath();
    context.moveTo(0, -paddedHeight / 2);
    context.lineTo(paddedWidth / 2, 0);
    context.lineTo(0, paddedHeight / 2);
    context.lineTo(-paddedWidth / 2, 0);
    context.closePath();
    context.fill();
  } else {
    context.fillRect(-paddedWidth / 2, -paddedHeight / 2, paddedWidth, paddedHeight);
  }

  context.restore();
}

export class ObjectOcclusionCanvas {
  private readonly cache: CanvasCache = {};

  public constructor(private readonly canvas: HTMLCanvasElement) {}

  public isSupported(view: ExcalidrawViewLike): boolean {
    return typeof view.excalidrawAPI?.getSceneElements === "function";
  }

  public render(input: CanvasRenderInput, force = false): void {
    const { view } = input;
    const width = Math.max(1, this.canvas.parentElement?.clientWidth ?? this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.parentElement?.clientHeight ?? this.canvas.clientHeight);
    const win = this.canvas.ownerDocument.defaultView;
    const dpr = clamp(Number(win?.devicePixelRatio ?? 1), 1, MAX_CANVAS_DPR);
    const occluders = collectOccluders(view);
    const guideKey = buildGuideKey(input);
    const sceneKey = buildSceneKey(occluders);
    const sceneTransformKey = getSceneTransformKey(view);

    if (
      !force &&
      this.cache.width === width &&
      this.cache.height === height &&
      this.cache.dpr === dpr &&
      this.cache.guideKey === guideKey &&
      this.cache.sceneKey === sceneKey &&
      this.cache.sceneTransformKey === sceneTransformKey
    ) {
      return;
    }

    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const context = this.canvas.getContext("2d", { alpha: true });
    if (!context) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.clearRect(0, 0, width, height);
    drawGuides(context, width, height, input);

    const sceneTransform = getViewTransform(view, true);
    const viewportOffset = getViewportOffset(view);
    for (const { element, strength } of occluders) {
      eraseElement(context, element, strength, sceneTransform, viewportOffset, width, height);
    }

    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;

    this.cache.width = width;
    this.cache.height = height;
    this.cache.dpr = dpr;
    this.cache.guideKey = guideKey;
    this.cache.sceneKey = sceneKey;
    this.cache.sceneTransformKey = sceneTransformKey;
  }

  public clear(): void {
    const context = this.canvas.getContext("2d");
    if (context) context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    delete this.cache.width;
    delete this.cache.height;
    delete this.cache.dpr;
    delete this.cache.guideKey;
    delete this.cache.sceneKey;
    delete this.cache.sceneTransformKey;
  }
}
