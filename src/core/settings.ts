import {
  DEFAULT_DOCK_POSITIONS,
  DEFAULT_LINE_COLOR,
  DEFAULT_MARGIN_COLOR,
  MAX_PROFILES,
  PAPER_MODES,
  PRESETS,
  PROFILE_NAME_MAX_LENGTH,
  SETTINGS_SCHEMA_VERSION,
} from "./constants";
import { normalizeHex } from "./color";
import { clamp } from "./number";
import type {
  DockPosition,
  DockPositions,
  DockVisibility,
  FileGuideOverride,
  GuideProfile,
  GuideSettings,
  NyraSettings,
  PaperMode,
  PresetId,
} from "./types";

export const DEFAULT_GUIDE_SETTINGS: GuideSettings = Object.freeze({
  enabled: true,
  paperMode: "ruled",
  preset: "school",
  customSpacing: 34,
  gridSpacingX: 34,
  linkGridSpacing: true,
  lineThickness: 1,
  dotSize: 1.5,
  opacity: 0.3,
  lineColor: DEFAULT_LINE_COLOR,
  protectInk: true,
  hideUnderObjects: false,
  followCanvas: true,
  marginEnabled: false,
  marginOffset: 64,
  marginThickness: 1,
  marginColor: DEFAULT_MARGIN_COLOR,
});

export const DEFAULT_SETTINGS: NyraSettings = Object.freeze({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  ...DEFAULT_GUIDE_SETTINGS,
  showFloatingControls: true,
  showStatusBar: true,
  dockVisibility: "always",
  dockCollapsed: false,
  dockPositions: DEFAULT_DOCK_POSITIONS,
  profiles: [],
  fileOverrides: {},
});

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isPreset(value: unknown): value is PresetId {
  return typeof value === "string" && value in PRESETS;
}

function isPaperMode(value: unknown): value is PaperMode {
  return typeof value === "string" && value in PAPER_MODES;
}

function isDockVisibility(value: unknown): value is DockVisibility {
  return value === "always" || value === "auto" || value === "active";
}

function sanitizeDockPosition(value: unknown, fallback: DockPosition): DockPosition {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    x: clamp(finiteNumber(raw.x, fallback.x), 0, 1),
    y: clamp(finiteNumber(raw.y, fallback.y), 0, 1),
  };
}

function sanitizeDockPositions(value: unknown): DockPositions {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    desktop: sanitizeDockPosition(raw.desktop, DEFAULT_DOCK_POSITIONS.desktop),
    compact: sanitizeDockPosition(raw.compact, DEFAULT_DOCK_POSITIONS.compact),
  };
}

function sanitizeProfileName(value: unknown, fallback = "Profile"): string {
  const normalized = String(value ?? "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PROFILE_NAME_MAX_LENGTH);
  return normalized || fallback;
}

export function sanitizeGuideSettings(
  input: unknown,
  fallback: GuideSettings = DEFAULT_GUIDE_SETTINGS,
): GuideSettings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const migratedLineColor = raw.lineColor ?? raw.darkColor ?? raw.lightColor ?? fallback.lineColor;

  return {
    enabled: raw.enabled === undefined ? fallback.enabled : Boolean(raw.enabled),
    paperMode: isPaperMode(raw.paperMode) ? raw.paperMode : fallback.paperMode,
    preset: isPreset(raw.preset) ? raw.preset : fallback.preset,
    customSpacing: clamp(finiteNumber(raw.customSpacing, fallback.customSpacing), 12, 96),
    gridSpacingX: clamp(finiteNumber(raw.gridSpacingX, fallback.gridSpacingX), 12, 96),
    linkGridSpacing:
      raw.linkGridSpacing === undefined ? fallback.linkGridSpacing : raw.linkGridSpacing !== false,
    lineThickness: clamp(finiteNumber(raw.lineThickness, fallback.lineThickness), 0.5, 4),
    dotSize: clamp(finiteNumber(raw.dotSize, fallback.dotSize), 0.75, 5),
    opacity: clamp(finiteNumber(raw.opacity, fallback.opacity), 0.05, 1),
    lineColor: normalizeHex(migratedLineColor, fallback.lineColor),
    protectInk: raw.protectInk === undefined ? fallback.protectInk : raw.protectInk !== false,
    hideUnderObjects:
      raw.hideUnderObjects === undefined ? fallback.hideUnderObjects : Boolean(raw.hideUnderObjects),
    followCanvas: raw.followCanvas === undefined ? fallback.followCanvas : raw.followCanvas !== false,
    marginEnabled: raw.marginEnabled === undefined ? fallback.marginEnabled : Boolean(raw.marginEnabled),
    marginOffset: clamp(finiteNumber(raw.marginOffset, fallback.marginOffset), 0, 320),
    marginThickness: clamp(finiteNumber(raw.marginThickness, fallback.marginThickness), 0.5, 4),
    marginColor: normalizeHex(raw.marginColor, fallback.marginColor),
  };
}

function sanitizeProfiles(value: unknown): GuideProfile[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const result: GuideProfile[] = [];

  for (const item of value) {
    if (result.length >= MAX_PROFILES) break;
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = String(raw.id ?? "").trim();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const createdAt = Math.max(0, finiteNumber(raw.createdAt, Date.now()));
    const updatedAt = Math.max(createdAt, finiteNumber(raw.updatedAt, createdAt));
    result.push({
      id,
      name: sanitizeProfileName(raw.name, `Profile ${result.length + 1}`),
      guide: sanitizeGuideSettings(raw.guide),
      createdAt,
      updatedAt,
    });
  }
  return result;
}

function sanitizeFileOverrides(value: unknown): Record<string, FileGuideOverride> {
  if (!value || typeof value !== "object") return {};
  const entries: Array<[string, FileGuideOverride]> = [];

  for (const [path, item] of Object.entries(value as Record<string, unknown>)) {
    const cleanPath = path.trim();
    if (!cleanPath || !item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    entries.push([
      cleanPath,
      {
        guide: sanitizeGuideSettings(raw.guide),
        updatedAt: Math.max(0, finiteNumber(raw.updatedAt, Date.now())),
      },
    ]);
  }
  return Object.fromEntries(entries);
}

export function sanitizeSettings(input: unknown): NyraSettings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const guide = sanitizeGuideSettings(raw, DEFAULT_GUIDE_SETTINGS);

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    ...guide,
    showFloatingControls:
      raw.showFloatingControls === undefined
        ? DEFAULT_SETTINGS.showFloatingControls
        : raw.showFloatingControls !== false,
    showStatusBar:
      raw.showStatusBar === undefined ? DEFAULT_SETTINGS.showStatusBar : raw.showStatusBar !== false,
    dockVisibility: isDockVisibility(raw.dockVisibility)
      ? raw.dockVisibility
      : DEFAULT_SETTINGS.dockVisibility,
    dockCollapsed:
      raw.dockCollapsed === undefined ? DEFAULT_SETTINGS.dockCollapsed : Boolean(raw.dockCollapsed),
    dockPositions: sanitizeDockPositions(raw.dockPositions),
    profiles: sanitizeProfiles(raw.profiles),
    fileOverrides: sanitizeFileOverrides(raw.fileOverrides),
  };
}

export function getGlobalGuideSettings(settings: NyraSettings): GuideSettings {
  return {
    enabled: settings.enabled,
    paperMode: settings.paperMode,
    preset: settings.preset,
    customSpacing: settings.customSpacing,
    gridSpacingX: settings.gridSpacingX,
    linkGridSpacing: settings.linkGridSpacing,
    lineThickness: settings.lineThickness,
    dotSize: settings.dotSize,
    opacity: settings.opacity,
    lineColor: settings.lineColor,
    protectInk: settings.protectInk,
    hideUnderObjects: settings.hideUnderObjects,
    followCanvas: settings.followCanvas,
    marginEnabled: settings.marginEnabled,
    marginOffset: settings.marginOffset,
    marginThickness: settings.marginThickness,
    marginColor: settings.marginColor,
  };
}

export function resolveGuideSettings(settings: NyraSettings, filePath?: string | null): GuideSettings {
  if (filePath) {
    const override = settings.fileOverrides[filePath];
    if (override) return override.guide;
  }
  return getGlobalGuideSettings(settings);
}

export function hasFileOverride(settings: NyraSettings, filePath?: string | null): boolean {
  return Boolean(filePath && settings.fileOverrides[filePath]);
}

export function getSpacing(settings: GuideSettings): number {
  if (settings.preset === "custom") return clamp(settings.customSpacing, 12, 96);
  return PRESETS[settings.preset].spacing ?? PRESETS.school.spacing;
}

export function getGridSpacingX(settings: GuideSettings): number {
  return settings.linkGridSpacing ? getSpacing(settings) : clamp(settings.gridSpacingX, 12, 96);
}

export function getPresetLabel(settings: GuideSettings): string {
  return PRESETS[settings.preset].label;
}

export function getPaperModeLabel(settings: GuideSettings): string {
  return PAPER_MODES[settings.paperMode].label;
}

export function normalizeProfileName(value: string): string {
  return sanitizeProfileName(value, "Profile");
}
