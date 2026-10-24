import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  getGridSpacingX,
  getSpacing,
  resolveGuideSettings,
  sanitizeSettings,
} from "../src/core/settings";

const legacySettings = {
  enabled: true,
  preset: "school",
  customSpacing: 34,
  lineThickness: 1.25,
  opacity: 0.2,
  lineColor: "#7f9fbd",
  protectInk: true,
  followCanvas: true,
  showFloatingControls: true,
  showStatusBar: true,
};

describe("settings migration", () => {
  it("preserves the v1.3.x behavior without enabling new visuals", () => {
    const settings = sanitizeSettings(legacySettings);
    expect(settings.lineThickness).toBe(1.25);
    expect(settings.opacity).toBe(0.2);
    expect(settings.lineColor).toBe("#7f9fbd");
    expect(settings.preset).toBe("school");
    expect(settings.paperMode).toBe("ruled");
    expect(settings.marginEnabled).toBe(false);
    expect(settings.hideUnderObjects).toBe(false);
    expect(settings.dockVisibility).toBe("always");
    expect(settings.dockPositions.desktop).toEqual({ x: 1, y: 0 });
    expect(settings.dockPositions.compact).toEqual({ x: 1, y: 0.12 });
    expect(settings.fileOverrides).toEqual({});
  });

  it("sanitizes persisted dock coordinates into normalized viewport space", () => {
    const settings = sanitizeSettings({
      dockPositions: {
        desktop: { x: 2, y: -1 },
        compact: { x: 0.42, y: 0.73 },
      },
    });
    expect(settings.dockPositions.desktop).toEqual({ x: 1, y: 0 });
    expect(settings.dockPositions.compact).toEqual({ x: 0.42, y: 0.73 });
  });

  it("migrates old theme-specific colors", () => {
    const settings = sanitizeSettings({ darkColor: "#123456" });
    expect(settings.lineColor).toBe("#123456");
  });

  it("clamps invalid numeric values", () => {
    const settings = sanitizeSettings({
      customSpacing: 999,
      gridSpacingX: 1,
      lineThickness: -10,
      dotSize: 99,
      opacity: 9,
      marginOffset: -4,
    });
    expect(settings.customSpacing).toBe(96);
    expect(settings.gridSpacingX).toBe(12);
    expect(settings.lineThickness).toBe(0.5);
    expect(settings.dotSize).toBe(5);
    expect(settings.opacity).toBe(1);
    expect(settings.marginOffset).toBe(0);
  });

  it("keeps the school preset at 34 px and links grid axes by default", () => {
    expect(getSpacing(DEFAULT_SETTINGS)).toBe(34);
    expect(getGridSpacingX(DEFAULT_SETTINGS)).toBe(34);
  });

  it("resolves a per-drawing override without mutating global defaults", () => {
    const settings = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      paperMode: "ruled",
      fileOverrides: {
        "School/Math.excalidraw.md": {
          updatedAt: 1,
          guide: { ...DEFAULT_SETTINGS, paperMode: "grid", customSpacing: 28 },
        },
      },
    });
    expect(resolveGuideSettings(settings, "School/Math.excalidraw.md").paperMode).toBe("grid");
    expect(resolveGuideSettings(settings, null).paperMode).toBe("ruled");
  });
});

describe("profile migration hardening", () => {
  it("skips malformed profile entries and preserves later valid entries", () => {
    const settings = sanitizeSettings({
      profiles: [null, { id: "valid", name: "Valid", guide: { paperMode: "dots" } }],
    });
    expect(settings.profiles).toHaveLength(1);
    expect(settings.profiles[0]?.id).toBe("valid");
    expect(settings.profiles[0]?.guide.paperMode).toBe("dots");
  });
});
