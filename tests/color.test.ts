import { describe, expect, it } from "vitest";
import { normalizeHex } from "../src/core/color";

describe("color normalization", () => {
  it("expands three-digit CSS hex values", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });

  it("uses the fallback for invalid values", () => {
    expect(normalizeHex("not-a-color", "#123456")).toBe("#123456");
  });
});
