import { describe, expect, it } from "vitest";
import {
  getSceneElementOcclusionStrength,
  isSceneElementOccluder,
} from "../src/rendering/ObjectOcclusionCanvas";

describe("object-aware paper occlusion", () => {
  it("treats images as occupied even without a background color", () => {
    const image = { type: "image", width: 320, height: 180, opacity: 100 };
    expect(isSceneElementOccluder(image)).toBe(true);
    expect(getSceneElementOcclusionStrength(image)).toBe(1);
  });

  it("ignores transparent rectangles and line-like elements", () => {
    expect(
      isSceneElementOccluder({
        type: "rectangle",
        width: 120,
        height: 80,
        backgroundColor: "transparent",
      }),
    ).toBe(false);
    expect(
      isSceneElementOccluder({
        type: "arrow",
        width: 120,
        height: 20,
        backgroundColor: "#ffffff",
      }),
    ).toBe(false);
  });

  it("respects scene opacity for filled objects", () => {
    const strength = getSceneElementOcclusionStrength({
      type: "ellipse",
      width: 100,
      height: 100,
      backgroundColor: "#ffffff",
      fillStyle: "solid",
      opacity: 45,
    });
    expect(strength).toBeCloseTo(0.45);
  });
});
