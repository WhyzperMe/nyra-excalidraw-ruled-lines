import { Notice, Platform, Plugin, type App, type EventRef, type TAbstractFile } from "obsidian";
import { DEFAULT_LINE_COLOR, PAPER_MODE_ORDER, PLUGIN_ID, PRESET_ORDER } from "../core/constants";
import { getPaperModeLabel, getPresetLabel, getSpacing } from "../core/settings";
import { SettingsStore } from "../core/SettingsStore";
import type {
  GuideSettingsPatch,
  NyraSettingsPatch,
  PersistMode,
  PluginUiActions,
  PresetId,
} from "../core/types";
import { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import { ViewAttachmentManager } from "../lifecycle/ViewAttachmentManager";
import { NyraSettingTab } from "../settings/NyraSettingTab";

interface AppWithSettings extends App {
  setting?: {
    open?(): void;
    openTabById?(id: string): void;
  };
}

export class NyraRuledLinesPlugin extends Plugin implements PluginUiActions {
  private store!: SettingsStore;
  private viewManager!: ViewAttachmentManager;
  private diagnostics!: DiagnosticsService;
  private statusBar: HTMLElement | null = null;
  private settingsUnsubscribe: (() => void) | null = null;

  public async onload(): Promise<void> {
    this.store = new SettingsStore({
      load: () => this.loadData(),
      save: (settings) => this.saveData(settings),
    });
    await this.store.load();

    const isMobileApp = Platform.isIosApp || Platform.isAndroidApp;
    this.viewManager = new ViewAttachmentManager(this.app, this.store, this, isMobileApp);
    this.diagnostics = new DiagnosticsService(this.store, this.viewManager);

    this.addSettingTab(new NyraSettingTab(this.app, this, this.store, this));
    this.registerCommands();
    this.registerRibbon();
    this.registerWorkspaceEvents();
    this.createStatusBar();

    this.settingsUnsubscribe = this.store.subscribe(() => this.updateStatusBar());
    this.register(() => this.settingsUnsubscribe?.());

    this.app.workspace.onLayoutReady(() => {
      this.registerVaultLifecycleEvents();
      this.viewManager.start();
      this.updateStatusBar();
    });
  }

  public onunload(): void {
    this.viewManager?.stop();
    if (this.store) {
      void this.store.flush().catch((error: unknown) => {
        console.error("Nyra Excalidraw Ruled Lines: failed to flush settings during unload", error);
      });
      this.store.destroy();
    }
  }

  public async toggleEnabled(filePath?: string | null): Promise<void> {
    const guide = this.store.getGuide(filePath);
    await this.store.updateGuide(filePath, { enabled: !guide.enabled });
    new Notice(guide.enabled ? "Paper guides hidden." : "Paper guides enabled.", 1100);
  }

  public async cyclePreset(filePath?: string | null): Promise<void> {
    const guide = this.store.getGuide(filePath);
    if (guide.paperMode === "blank") {
      new Notice("Blank paper has no spacing preset.", 1000);
      return;
    }
    const current = PRESET_ORDER.indexOf(guide.preset);
    const preset = PRESET_ORDER[(current + 1 + PRESET_ORDER.length) % PRESET_ORDER.length] ?? "school";
    await this.setPreset(preset, filePath);
    const next = this.store.getGuide(filePath);
    new Notice(`Paper spacing: ${getPresetLabel(next)} · ${Math.round(getSpacing(next))} px`, 1000);
  }

  public async cyclePaperMode(filePath?: string | null): Promise<void> {
    const guide = this.store.getGuide(filePath);
    const current = PAPER_MODE_ORDER.indexOf(guide.paperMode);
    const paperMode =
      PAPER_MODE_ORDER[(current + 1 + PAPER_MODE_ORDER.length) % PAPER_MODE_ORDER.length] ?? "ruled";
    await this.store.updateGuide(filePath, { paperMode });
    new Notice(`Paper type: ${getPaperModeLabel(this.store.getGuide(filePath))}`, 1000);
  }

  public async setPreset(preset: PresetId, filePath?: string | null): Promise<void> {
    await this.store.updateGuide(filePath, { preset });
  }

  public async patchSettings(patch: NyraSettingsPatch, mode: PersistMode = "immediate"): Promise<void> {
    await this.store.updateGlobal(patch, mode);
  }

  public async patchGuideSettings(
    filePath: string | null | undefined,
    patch: GuideSettingsPatch,
    mode: PersistMode = "immediate",
  ): Promise<void> {
    await this.store.updateGuide(filePath, patch, mode);
  }

  public async setFileOverride(filePath: string, enabled: boolean): Promise<void> {
    await this.store.setFileOverride(filePath, enabled);
    new Notice(enabled ? "Drawing override enabled." : "Drawing now uses global paper defaults.", 1000);
  }

  public async resetFileOverride(filePath: string): Promise<void> {
    await this.store.resetFileOverride(filePath);
    new Notice("Drawing override removed.", 1000);
  }

  public async applyProfileToDrawing(filePath: string, profileId: string): Promise<void> {
    if (await this.store.applyProfileToFile(filePath, profileId)) {
      new Notice("Profile applied to this drawing.", 1000);
    }
  }

  public async applyProfileToGlobal(profileId: string): Promise<void> {
    if (await this.store.applyProfileToGlobal(profileId)) {
      new Notice("Profile applied to global defaults.", 1000);
    }
  }

  public async createProfile(name: string): Promise<string | null> {
    const id = await this.store.createProfile(name);
    new Notice(id ? "Paper profile saved." : "Profile limit reached.", 1100);
    return id;
  }

  public async renameProfile(profileId: string, name: string): Promise<void> {
    await this.store.renameProfile(profileId, name);
  }

  public async deleteProfile(profileId: string): Promise<void> {
    await this.store.deleteProfile(profileId);
    new Notice("Paper profile deleted.", 1000);
  }

  public async resetLineColor(filePath?: string | null): Promise<void> {
    await this.store.updateGuide(filePath, { lineColor: DEFAULT_LINE_COLOR });
  }

  public async resetToDefaults(filePath?: string | null): Promise<void> {
    const local = Boolean(filePath && this.store.hasFileOverride(filePath));
    await this.store.resetToDefaults(filePath);
    new Notice(
      local
        ? "Drawing paper and interface settings reset to defaults."
        : "Global paper and interface settings reset to defaults.",
      1200,
    );
  }

  public async resetAllSettings(): Promise<void> {
    await this.store.reset();
    new Notice("Nyra paper settings reset.", 1100);
  }

  public async copyDiagnostics(): Promise<void> {
    const copied = await this.diagnostics.copy();
    new Notice(copied ? "Diagnostics copied to clipboard." : "Could not copy diagnostics.", 1300);
  }

  public openPluginSettings(): void {
    const setting = (this.app as AppWithSettings).setting;
    if (setting?.open) {
      setting.open();
      setting.openTabById?.(PLUGIN_ID);
      return;
    }
    new Notice("Open Settings → Community plugins → Nyra Excalidraw Ruled Lines.");
  }

  private registerCommands(): void {
    this.addCommand({
      id: "toggle-ruled-lines",
      name: "Toggle paper guides",
      callback: () => void this.toggleEnabled(),
    });

    this.addCommand({
      id: "toggle-ruled-line-controls",
      name: "Open or close paper controls",
      callback: () => {
        if (!this.viewManager.toggleActivePanel()) new Notice("Open an Excalidraw view first.", 1200);
      },
    });

    this.addCommand({
      id: "cycle-ruled-line-spacing",
      name: "Cycle paper spacing",
      callback: () => void this.cyclePreset(),
    });

    this.addCommand({
      id: "reset-ruled-line-color",
      name: "Reset guide color",
      callback: () => void this.resetLineColor(),
    });

    this.addCommand({
      id: "cycle-paper-type",
      name: "Cycle paper type",
      callback: () => void this.cyclePaperMode(),
    });

    this.addCommand({
      id: "toggle-active-drawing-override",
      name: "Toggle override for active drawing",
      callback: () => {
        const filePath = this.viewManager.getActiveFilePath();
        if (!filePath) {
          new Notice("Open an Excalidraw drawing first.", 1200);
          return;
        }
        void this.setFileOverride(filePath, !this.store.hasFileOverride(filePath));
      },
    });

    this.addCommand({
      id: "copy-diagnostics",
      name: "Copy diagnostics",
      callback: () => void this.copyDiagnostics(),
    });
  }

  private registerRibbon(): void {
    const ribbon = this.addRibbonIcon("notebook-tabs", "Toggle Excalidraw paper guides", () => {
      void this.toggleEnabled();
    });
    ribbon.classList.add("nyra-ruled-ribbon");
  }

  private registerWorkspaceEvents(): void {
    const refs: EventRef[] = [
      this.app.workspace.on("layout-change", () => this.viewManager.scheduleReconcile()),
      this.app.workspace.on("active-leaf-change", () => {
        this.viewManager.closeAllPanels();
        this.viewManager.scheduleReconcile();
      }),
      this.app.workspace.on("file-open", () => {
        this.viewManager.closeAllPanels();
        this.viewManager.scheduleReconcile();
      }),
    ];

    for (const ref of refs) this.registerEvent(ref);
  }

  private registerVaultLifecycleEvents(): void {
    this.registerEvent(
      this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        void this.store
          .moveFileOverrides(oldPath, file.path)
          .catch((error: unknown) => {
            console.error("Nyra Excalidraw Ruled Lines: failed to move drawing override", error);
          })
          .finally(() => this.viewManager.scheduleReconcile());
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file: TAbstractFile) => {
        void this.store
          .removeFileOverrides(file.path)
          .catch((error: unknown) => {
            console.error("Nyra Excalidraw Ruled Lines: failed to remove drawing override", error);
          })
          .finally(() => this.viewManager.scheduleReconcile());
      }),
    );
  }

  private createStatusBar(): void {
    if (Platform.isIosApp || Platform.isAndroidApp) return;
    this.statusBar = this.addStatusBarItem();
    this.statusBar.classList.add("nyra-ruled-status");
    this.statusBar.setAttribute("role", "button");
    this.statusBar.setAttribute("tabindex", "0");
    this.statusBar.setAttribute("aria-label", "Cycle Excalidraw paper spacing");

    this.registerDomEvent(this.statusBar, "click", () => void this.cyclePreset());
    this.registerDomEvent(this.statusBar, "keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void this.cyclePreset();
      }
    });
  }

  private updateStatusBar(): void {
    if (!this.statusBar) return;
    const settings = this.store.getSnapshot();
    this.statusBar.style.display = settings.showStatusBar ? "" : "none";
    const state = !settings.enabled
      ? "Off"
      : settings.paperMode === "blank"
        ? settings.marginEnabled
          ? "Blank + margin"
          : "Blank"
        : `${getPaperModeLabel(settings)} ${Math.round(getSpacing(settings))}px`;
    this.statusBar.setText(`Paper: ${state}`);
    const canCycleSpacing = settings.enabled && settings.paperMode !== "blank";
    const spacingActionLabel = canCycleSpacing
      ? "Cycle Excalidraw paper spacing"
      : settings.enabled
        ? "Blank paper has no spacing preset"
        : "Paper guides are off";
    this.statusBar.setAttribute("aria-label", spacingActionLabel);
    this.statusBar.setAttribute("title", spacingActionLabel);
  }
}
