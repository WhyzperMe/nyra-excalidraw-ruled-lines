export const PLUGIN_ID = "nyra-excalidraw-ruled-lines";
export const PLUGIN_VERSION = "1.4.8";
export const SETTINGS_SCHEMA_VERSION = 5;
export const DEFAULT_LINE_COLOR = "#7f9fbd";
export const DEFAULT_MARGIN_COLOR = "#c88484";

export const DEFAULT_DOCK_POSITIONS = Object.freeze({
  desktop: Object.freeze({ x: 1, y: 0 }),
  // Keep the default mobile dock away from Excalidraw's bottom tool row.
  // Coordinates are normalized inside the visible drawing viewport.
  compact: Object.freeze({ x: 1, y: 0.12 }),
});

export const PRESETS = {
  compact: { label: "Compact", spacing: 28 },
  school: { label: "School", spacing: 34 },
  wide: { label: "Wide", spacing: 40 },
  custom: { label: "Custom", spacing: null },
} as const;

export const PRESET_ORDER = ["compact", "school", "wide", "custom"] as const;

export const PAPER_MODES = {
  ruled: { label: "Ruled", icon: "rows-3" },
  grid: { label: "Grid", icon: "grid-2x2" },
  dots: { label: "Dots", icon: "grip" },
  blank: { label: "Blank", icon: "square" },
} as const;

export const PAPER_MODE_ORDER = ["ruled", "grid", "dots", "blank"] as const;

export const COLOR_SWATCHES = [
  { label: "Notebook blue", value: "#7f9fbd" },
  { label: "Sky", value: "#6096c7" },
  { label: "Teal", value: "#5f9f9a" },
  { label: "Purple", value: "#8b78b8" },
  { label: "Rose", value: "#b97982" },
  { label: "Graphite", value: "#8a8f98" },
] as const;

export const MARGIN_COLOR_SWATCHES = [
  { label: "Soft red", value: "#c88484" },
  { label: "Coral", value: "#d28b76" },
  { label: "Purple", value: "#9a82bd" },
  { label: "Blue", value: "#7598b8" },
  { label: "Graphite", value: "#8a8f98" },
] as const;

export const PROFILE_NAME_MAX_LENGTH = 48;
export const MAX_PROFILES = 40;
