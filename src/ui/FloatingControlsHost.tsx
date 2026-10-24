import { StrictMode, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { SettingsStore } from "../core/SettingsStore";
import type { PluginUiActions, ThemeMode } from "../core/types";
import { FloatingControls, type FloatingControlsHandle } from "./FloatingControls";

export class FloatingControlsHost {
  public readonly element: HTMLDivElement;
  private readonly reactRoot: Root;
  private readonly handle = createRef<FloatingControlsHandle>();
  private theme: ThemeMode = "light";
  private filePath: string | null;
  private panelOpen = false;

  public constructor(
    private readonly ownerDocument: Document,
    private readonly store: SettingsStore,
    private readonly actions: PluginUiActions,
    filePath: string | null,
    private readonly boundsElement: HTMLElement,
    isMobileApp: boolean,
    private readonly onPanelStateChange: (open: boolean) => void,
  ) {
    this.filePath = filePath;
    this.element = ownerDocument.createElement("div");
    this.element.className = "nyra-ruled-controls";
    this.element.dataset.nyraRuledPortal = "true";
    this.element.dataset.mobileApp = isMobileApp ? "true" : "false";
    ownerDocument.body.appendChild(this.element);

    this.reactRoot = createRoot(this.element);
    this.render();
  }

  public setTheme(theme: ThemeMode): void {
    if (this.theme === theme) return;
    this.theme = theme;
    this.element.dataset.uiTheme = theme;
    this.render();
  }

  public setFilePath(filePath: string | null): void {
    if (this.filePath === filePath) return;
    this.filePath = filePath;
    this.render();
  }

  public setVisible(visible: boolean): void {
    this.element.classList.toggle("is-offscreen", !visible);
    if (!visible) this.closePanel();
  }

  public setControlsEnabled(enabled: boolean): void {
    this.element.classList.toggle("is-hidden", !enabled);
    if (!enabled) this.closePanel();
  }

  public setActive(active: boolean): void {
    this.element.classList.toggle("is-active-view", active);
  }

  public setObscured(obscured: boolean): void {
    this.element.classList.toggle("is-obscured", obscured);
    if (obscured) this.closePanel();
  }

  public setLayout(layout: "desktop" | "compact"): void {
    this.element.dataset.layout = layout;
  }

  public setCompactDensity(density: "regular" | "narrow" | "tiny" | "micro"): void {
    this.element.dataset.compactDensity = density;
  }

  public setPanelDirection(direction: "up" | "down"): void {
    this.element.dataset.panelDirection = direction;
  }

  public setPanelMaxHeight(px: number): void {
    this.element.style.setProperty("--nyra-panel-max-height", `${Math.max(48, Math.floor(px))}px`);
  }

  public isDragging(): boolean {
    return this.element.dataset.dockDragging === "true";
  }

  public setPanelGeometry(left: number, anchorTop: number, width: number, maxHeight: number): void {
    this.element.style.setProperty("--nyra-panel-left", `${Math.round(left)}px`);
    this.element.style.setProperty("--nyra-panel-anchor-top", `${Math.round(anchorTop)}px`);
    this.element.style.setProperty("--nyra-panel-width", `${Math.max(1, Math.floor(width))}px`);
    this.setPanelMaxHeight(maxHeight);
  }

  public togglePanel(): void {
    this.handle.current?.toggle();
  }

  public closePanel(): void {
    this.handle.current?.close();
  }

  public isPanelOpen(): boolean {
    return this.handle.current?.isOpen() ?? this.panelOpen;
  }

  public destroy(): void {
    this.reactRoot.unmount();
    this.element.remove();
  }

  private render(): void {
    this.element.dataset.uiTheme = this.theme;
    this.reactRoot.render(
      <StrictMode>
        <FloatingControls
          ref={this.handle}
          store={this.store}
          actions={this.actions}
          ownerDocument={this.ownerDocument}
          portalElement={this.element}
          boundsElement={this.boundsElement}
          theme={this.theme}
          filePath={this.filePath}
          onPanelStateChange={(open: boolean) => {
            this.panelOpen = open;
            this.element.classList.toggle("is-open", open);
            this.onPanelStateChange(open);
          }}
        />
      </StrictMode>,
    );
  }
}
