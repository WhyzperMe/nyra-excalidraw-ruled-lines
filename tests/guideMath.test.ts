import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import {
  calculateGuideGeometry,
  getEffectiveOpacity,
  hasVisiblePaper,
  needsSceneAnimation,
} from "../src/rendering/guideMath";
import type { ExcalidrawViewLike } from "../src/excalidraw/types";

function fakeView(): ExcalidrawViewLike {
  return {
    containerEl: {} as HTMLElement,
    excalidrawAPI: {
      getAppState: () => ({ zoom: { value: 2 }, scrollX: 3, scrollY: 17 }),
    },
  };
}

describe("paper geometry", () => {
  it("tracks linked grid spacing, zoom and pan deterministically", () => {
    const settings = { ...DEFAULT_SETTINGS, paperMode: "grid" as const };
    const geometry = calculateGuideGeometry(settings, fakeView(), "light");
    expect(geometry.spacingX).toBe(68);
    expect(geometry.spacingY).toBe(68);
    expect(geometry.offsetX).toBe(6);
    expect(geometry.offsetY).toBe(34);
  });

  it("supports independent horizontal spacing", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      paperMode: "grid" as const,
      linkGridSpacing: false,
      gridSpacingX: 28,
    };
    const geometry = calculateGuideGeometry(settings, fakeView(), "light");
    expect(geometry.spacingX).toBe(56);
    expect(geometry.spacingY).toBe(68);
  });

  it("keeps the margin anchored to scene coordinates", () => {
    const settings = { ...DEFAULT_SETTINGS, marginEnabled: true, marginOffset: 64 };
    const geometry = calculateGuideGeometry(settings, fakeView(), "light");
    expect(geometry.marginX).toBe(134);
  });

  it("caps protected opacity without blend modes", () => {
    const settings = { ...DEFAULT_SETTINGS, opacity: 0.8, protectInk: true };
    expect(getEffectiveOpacity(settings, "light")).toBe(0.24);
    expect(getEffectiveOpacity(settings, "dark")).toBe(0.28);
  });

  it("keeps scene animation active when object-aware masking is enabled", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      followCanvas: false,
      hideUnderObjects: true,
    };
    expect(needsSceneAnimation(settings)).toBe(true);
  });

  it("does not animate blank paper with no margin", () => {
    const blank = { ...DEFAULT_SETTINGS, paperMode: "blank" as const, marginEnabled: false };
    expect(hasVisiblePaper(blank)).toBe(false);
    expect(needsSceneAnimation(blank)).toBe(false);
  });
});
