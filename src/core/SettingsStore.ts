import { MAX_PROFILES } from "./constants";
import { createStableId } from "./id";
import {
  DEFAULT_GUIDE_SETTINGS,
  DEFAULT_SETTINGS,
  getGlobalGuideSettings,
  normalizeProfileName,
  resolveGuideSettings,
  sanitizeGuideSettings,
  sanitizeSettings,
} from "./settings";
import type {
  GuideProfile,
  GuideSettings,
  GuideSettingsPatch,
  NyraSettings,
  NyraSettingsPatch,
  PersistMode,
} from "./types";

export interface SettingsPersistence {
  load(): Promise<unknown>;
  save(settings: NyraSettings): Promise<void>;
}

type Listener = () => void;

export class SettingsStore {
  private settings: NyraSettings = DEFAULT_SETTINGS;
  private readonly listeners = new Set<Listener>();
  private persistTimer: number | null = null;
  private pendingSave: Promise<void> = Promise.resolve();
  private dirty = false;
  private revision = 0;

  public constructor(private readonly persistence: SettingsPersistence) {}

  public readonly getSnapshot = (): NyraSettings => this.settings;

  public readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public async load(): Promise<NyraSettings> {
    this.settings = sanitizeSettings(await this.persistence.load());
    this.dirty = false;
    this.revision = 0;
    this.emit();
    return this.settings;
  }

  public getGuide(filePath?: string | null): GuideSettings {
    return resolveGuideSettings(this.settings, filePath);
  }

  public hasFileOverride(filePath?: string | null): boolean {
    return Boolean(filePath && this.settings.fileOverrides[filePath]);
  }

  public async updateGlobal(patch: NyraSettingsPatch, mode: PersistMode = "immediate"): Promise<void> {
    this.commit(sanitizeSettings({ ...this.settings, ...patch }), mode);
    await this.finishMode(mode);
  }

  public async updateGuide(
    filePath: string | null | undefined,
    patch: GuideSettingsPatch,
    mode: PersistMode = "immediate",
  ): Promise<void> {
    if (filePath && this.settings.fileOverrides[filePath]) {
      const current = this.settings.fileOverrides[filePath];
      const nextGuide = sanitizeGuideSettings({ ...current.guide, ...patch }, current.guide);
      this.commit(
        sanitizeSettings({
          ...this.settings,
          fileOverrides: {
            ...this.settings.fileOverrides,
            [filePath]: { guide: nextGuide, updatedAt: Date.now() },
          },
        }),
        mode,
      );
    } else {
      await this.updateGlobal(patch, mode);
      return;
    }
    await this.finishMode(mode);
  }

  public async setFileOverride(filePath: string, enabled: boolean): Promise<void> {
    const path = filePath.trim();
    if (!path) return;
    const entries = Object.entries(this.settings.fileOverrides).filter(([entryPath]) => entryPath !== path);

    if (enabled) {
      const existing = this.settings.fileOverrides[path];
      entries.push([
        path,
        existing ?? {
          guide: sanitizeGuideSettings(resolveGuideSettings(this.settings, path)),
          updatedAt: Date.now(),
        },
      ]);
    }

    const fileOverrides = Object.fromEntries(entries);
    this.commit(sanitizeSettings({ ...this.settings, fileOverrides }), "immediate");
    await this.persist();
  }

  public async resetFileOverride(filePath: string): Promise<void> {
    await this.setFileOverride(filePath, false);
  }

  public async moveFileOverrides(oldPath: string, newPath: string): Promise<void> {
    const from = oldPath.trim();
    const to = newPath.trim();
    if (!from || !to || from === to) return;

    const oldPrefix = `${from}/`;
    const moved: Array<[string, (typeof this.settings.fileOverrides)[string]]> = [];
    const retained: Array<[string, (typeof this.settings.fileOverrides)[string]]> = [];

    for (const [path, override] of Object.entries(this.settings.fileOverrides)) {
      if (path === from || path.startsWith(oldPrefix)) {
        const suffix = path.slice(from.length);
        moved.push([`${to}${suffix}`, override]);
      } else {
        retained.push([path, override]);
      }
    }

    if (!moved.length) return;

    // Apply moved entries last so a real file/folder rename deterministically
    // preserves the source override if stale data already exists at the target.
    const fileOverrides = Object.fromEntries([...retained, ...moved]);
    this.commit(sanitizeSettings({ ...this.settings, fileOverrides }), "immediate");
    await this.persist();
  }

  public async removeFileOverrides(path: string): Promise<void> {
    const normalized = path.trim();
    if (!normalized) return;
    const prefix = `${normalized}/`;
    const next = Object.fromEntries(
      Object.entries(this.settings.fileOverrides).filter(
        ([entryPath]) => entryPath !== normalized && !entryPath.startsWith(prefix),
      ),
    );
    if (Object.keys(next).length === Object.keys(this.settings.fileOverrides).length) return;
    this.commit(sanitizeSettings({ ...this.settings, fileOverrides: next }), "immediate");
    await this.persist();
  }

  public async createProfile(
    name: string,
    guide = getGlobalGuideSettings(this.settings),
  ): Promise<string | null> {
    if (this.settings.profiles.length >= MAX_PROFILES) return null;
    const now = Date.now();
    const id = createStableId("profile");
    const profile: GuideProfile = {
      id,
      name: normalizeProfileName(name),
      guide: sanitizeGuideSettings(guide),
      createdAt: now,
      updatedAt: now,
    };
    this.commit(
      sanitizeSettings({ ...this.settings, profiles: [...this.settings.profiles, profile] }),
      "immediate",
    );
    await this.persist();
    return id;
  }

  public async renameProfile(profileId: string, name: string): Promise<void> {
    const current = this.settings.profiles.find((profile) => profile.id === profileId);
    if (!current) return;
    const normalized = normalizeProfileName(name);
    if (current.name === normalized) return;
    const profiles = this.settings.profiles.map((profile) =>
      profile.id === profileId ? { ...profile, name: normalized, updatedAt: Date.now() } : profile,
    );
    this.commit(sanitizeSettings({ ...this.settings, profiles }), "immediate");
    await this.persist();
  }

  public async deleteProfile(profileId: string): Promise<void> {
    const profiles = this.settings.profiles.filter((profile) => profile.id !== profileId);
    if (profiles.length === this.settings.profiles.length) return;
    this.commit(sanitizeSettings({ ...this.settings, profiles }), "immediate");
    await this.persist();
  }

  public async applyProfileToGlobal(profileId: string): Promise<boolean> {
    const profile = this.settings.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) return false;
    const guide = profile.guide;
    this.commit(sanitizeSettings({ ...this.settings, ...guide }), "immediate");
    await this.persist();
    return true;
  }

  public async applyProfileToFile(filePath: string, profileId: string): Promise<boolean> {
    const profile = this.settings.profiles.find((candidate) => candidate.id === profileId);
    const path = filePath.trim();
    if (!profile || !path) return false;
    const fileOverrides = Object.fromEntries([
      ...Object.entries(this.settings.fileOverrides).filter(([entryPath]) => entryPath !== path),
      [path, { guide: sanitizeGuideSettings(profile.guide), updatedAt: Date.now() }],
    ]);
    this.commit(sanitizeSettings({ ...this.settings, fileOverrides }), "immediate");
    await this.persist();
    return true;
  }

  public async resetToDefaults(filePath?: string | null): Promise<void> {
    const path = filePath?.trim() ?? "";
    const existingOverride = path ? this.settings.fileOverrides[path] : undefined;

    if (path && existingOverride) {
      this.commit(
        sanitizeSettings({
          ...this.settings,
          showFloatingControls: DEFAULT_SETTINGS.showFloatingControls,
          showStatusBar: DEFAULT_SETTINGS.showStatusBar,
          dockVisibility: DEFAULT_SETTINGS.dockVisibility,
          dockCollapsed: DEFAULT_SETTINGS.dockCollapsed,
          dockPositions: DEFAULT_SETTINGS.dockPositions,
          fileOverrides: {
            ...this.settings.fileOverrides,
            [path]: {
              guide: sanitizeGuideSettings(DEFAULT_GUIDE_SETTINGS),
              updatedAt: Date.now(),
            },
          },
        }),
        "immediate",
      );
      await this.persist();
      return;
    }

    // Reset all global user-facing paper/interface preferences while preserving
    // user-created profiles and drawing overrides. The destructive full-data
    // reset remains a separate, confirmed action in the plugin settings page.
    this.commit(
      sanitizeSettings({
        ...DEFAULT_SETTINGS,
        profiles: this.settings.profiles,
        fileOverrides: this.settings.fileOverrides,
      }),
      "immediate",
    );
    await this.persist();
  }

  public async reset(): Promise<void> {
    this.commit(sanitizeSettings(DEFAULT_SETTINGS), "immediate");
    await this.persist();
  }

  public async flush(): Promise<void> {
    if (this.persistTimer !== null) {
      window.clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.dirty) await this.persist();
    await this.pendingSave;
  }

  public destroy(): void {
    if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
    this.persistTimer = null;
    this.listeners.clear();
  }

  private commit(next: NyraSettings, mode: PersistMode): void {
    this.settings = next;
    this.revision += 1;
    this.dirty = true;
    this.emit();
    if (mode === "debounced") this.schedulePersist();
    else if (mode === "immediate" && this.persistTimer !== null) {
      window.clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }

  private async finishMode(mode: PersistMode): Promise<void> {
    if (mode === "immediate") await this.persist();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private schedulePersist(): void {
    if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      void this.persist().catch((error: unknown) => {
        console.error("Nyra Excalidraw Ruled Lines: failed to persist settings", error);
      });
    }, 220);
  }

  private async persist(): Promise<void> {
    if (!this.dirty) {
      await this.pendingSave;
      return;
    }

    const snapshot = this.settings;
    const snapshotRevision = this.revision;
    this.dirty = false;

    const save = this.pendingSave.catch(() => undefined).then(() => this.persistence.save(snapshot));

    this.pendingSave = save.catch((error: unknown) => {
      // Only mark the store dirty again when the failed save represented the
      // newest committed revision. A newer queued revision will persist itself.
      if (this.revision <= snapshotRevision) this.dirty = true;
      throw error;
    });

    await this.pendingSave;
  }
}
