import type { PAPER_MODE_ORDER, PRESET_ORDER } from "./constants";

export type PresetId = (typeof PRESET_ORDER)[number];
export type PaperMode = (typeof PAPER_MODE_ORDER)[number];
export type ThemeMode = "light" | "dark";
export type PersistMode = "immediate" | "debounced" | "none";
export type DockVisibility = "always" | "auto" | "active";
export type DockLayout = "desktop" | "compact";

export interface DockPosition {
  x: number;
  y: number;
}

export interface DockPositions {
  desktop: DockPosition;
  compact: DockPosition;
}

export interface GuideSettings {
  enabled: boolean;
  paperMode: PaperMode;
  preset: PresetId;
  customSpacing: number;
  gridSpacingX: number;
  linkGridSpacing: boolean;
  lineThickness: number;
  dotSize: number;
  opacity: number;
  lineColor: string;
  protectInk: boolean;
  hideUnderObjects: boolean;
  followCanvas: boolean;
  marginEnabled: boolean;
  marginOffset: number;
  marginThickness: number;
  marginColor: string;
}

export interface FileGuideOverride {
  guide: GuideSettings;
  updatedAt: number;
}

export interface GuideProfile {
  id: string;
  name: string;
  guide: GuideSettings;
  createdAt: number;
  updatedAt: number;
}

export interface NyraSettings extends GuideSettings {
  schemaVersion: number;
  showFloatingControls: boolean;
  showStatusBar: boolean;
  dockVisibility: DockVisibility;
  dockCollapsed: boolean;
  dockPositions: DockPositions;
  profiles: GuideProfile[];
  fileOverrides: Record<string, FileGuideOverride>;
}

export type GuideSettingsPatch = Partial<GuideSettings>;
export type NyraSettingsPatch = Partial<Omit<NyraSettings, "schemaVersion" | "profiles" | "fileOverrides">>;

export interface PluginUiActions {
  toggleEnabled(filePath?: string | null): Promise<void>;
  cyclePreset(filePath?: string | null): Promise<void>;
  cyclePaperMode(filePath?: string | null): Promise<void>;
  setPreset(preset: PresetId, filePath?: string | null): Promise<void>;
  patchSettings(patch: NyraSettingsPatch, mode?: PersistMode): Promise<void>;
  patchGuideSettings(
    filePath: string | null | undefined,
    patch: GuideSettingsPatch,
    mode?: PersistMode,
  ): Promise<void>;
  setFileOverride(filePath: string, enabled: boolean): Promise<void>;
  resetFileOverride(filePath: string): Promise<void>;
  applyProfileToDrawing(filePath: string, profileId: string): Promise<void>;
  applyProfileToGlobal(profileId: string): Promise<void>;
  createProfile(name: string): Promise<string | null>;
  renameProfile(profileId: string, name: string): Promise<void>;
  deleteProfile(profileId: string): Promise<void>;
  resetLineColor(filePath?: string | null): Promise<void>;
  resetToDefaults(filePath?: string | null): Promise<void>;
  resetAllSettings(): Promise<void>;
  copyDiagnostics(): Promise<void>;
  openPluginSettings(): void;
}
