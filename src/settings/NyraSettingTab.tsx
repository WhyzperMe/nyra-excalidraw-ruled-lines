import { PluginSettingTab, type App, type Plugin } from "obsidian";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { SettingsStore } from "../core/SettingsStore";
import type { PluginUiActions } from "../core/types";
import { SettingsScreen } from "./SettingsScreen";

export class NyraSettingTab extends PluginSettingTab {
  private reactRoot: Root | null = null;

  public constructor(
    app: App,
    plugin: Plugin,
    private readonly store: SettingsStore,
    private readonly actions: PluginUiActions,
  ) {
    super(app, plugin);
  }

  public display(): void {
    this.reactRoot?.unmount();
    this.containerEl.empty();
    this.containerEl.addClass("nyra-settings-root");
    this.reactRoot = createRoot(this.containerEl);
    this.reactRoot.render(
      <StrictMode>
        <SettingsScreen store={this.store} actions={this.actions} />
      </StrictMode>,
    );
  }

  public hide(): void {
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.containerEl.removeClass("nyra-settings-root");
  }
}
