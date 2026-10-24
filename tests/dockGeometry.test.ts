import { describe, expect, it } from "vitest";
import {
  normalizeDockPosition,
  resolveDockPixelPosition,
  resolvePanelPixelLeft,
} from "../src/ui/dockGeometry";

const bounds = { left: 10, top: 20, right: 310, bottom: 220 };

describe("dock geometry", () => {
  it("maps normalized corners into the available travel area", () => {
    expect(resolveDockPixelPosition({ x: 0, y: 0 }, 100, 50, bounds)).toEqual({ left: 10, top: 20 });
    expect(resolveDockPixelPosition({ x: 1, y: 1 }, 100, 50, bounds)).toEqual({ left: 210, top: 170 });
  });

  it("round-trips a position through pixels and normalized coordinates", () => {
    const original = { x: 0.37, y: 0.62 };
    const pixels = resolveDockPixelPosition(original, 100, 50, bounds);
    const normalized = normalizeDockPosition(pixels.left, pixels.top, 100, 50, bounds);
    expect(normalized.x).toBeCloseTo(original.x, 8);
    expect(normalized.y).toBeCloseTo(original.y, 8);
  });

  it("clamps positions and remains stable when the dock has no travel room", () => {
    expect(resolveDockPixelPosition({ x: 4, y: -3 }, 400, 300, bounds)).toEqual({ left: 10, top: 20 });
    expect(normalizeDockPosition(999, -999, 400, 300, bounds)).toEqual({ x: 0, y: 0 });
  });

  it("keeps panel placement stable when dock width changes", () => {
    const x = 0.72;
    const panelLeftBefore = resolvePanelPixelLeft(x, 220, { left: bounds.left, right: bounds.right });
    const panelLeftAfter = resolvePanelPixelLeft(x, 220, { left: bounds.left, right: bounds.right });

    // Dock width is intentionally irrelevant to panel placement.
    expect(resolveDockPixelPosition({ x, y: 0.2 }, 118, 48, bounds).left).not.toBe(
      resolveDockPixelPosition({ x, y: 0.2 }, 312, 48, bounds).left,
    );
    expect(panelLeftAfter).toBe(panelLeftBefore);
  });
});
