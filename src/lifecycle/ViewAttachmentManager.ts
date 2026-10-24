import type { App, WorkspaceLeaf } from "obsidian";
import type { SettingsStore } from "../core/SettingsStore";
import type { PluginUiActions, ThemeMode } from "../core/types";
import type { ExcalidrawViewLike } from "../excalidraw/types";
import {
  findExcalidrawRoot,
  getViewFilePath,
  getViewTransform,
  getWorkspaceLeafElement,
  isExcalidrawView,
  isRootInViewport,
  isRootRenderable,
  resolveTheme,
} from "../excalidraw/view";
import { GuideOverlayRenderer } from "../rendering/GuideOverlayRenderer";
import { needsSceneAnimation } from "../rendering/guideMath";
import { FloatingControlsHost } from "../ui/FloatingControlsHost";
import { DOCK_EDGE_MARGIN, resolveDockPixelPosition, resolvePanelPixelLeft } from "../ui/dockGeometry";
import { NativeUiGuard } from "./NativeUiGuard";

export type AttachmentState = "attached" | "visible" | "active" | "suspended";

interface ViewAttachment {
  root: HTMLElement;
  view: ExcalidrawViewLike;
  filePath: string | null;
  overlay: HTMLDivElement;
  renderer: GuideOverlayRenderer;
  controls: FloatingControlsHost;
  resizeObserver: ResizeObserver | null;
  removeWindowListeners: () => void;
  hostPositionPatched: boolean;
  lastRenderable: boolean;
  state: AttachmentState;
  theme: ThemeMode;
}

interface DocumentGuardEntry {
  guard: NativeUiGuard;
  refs: number;
  pinned: boolean;
}

export interface AttachmentDiagnostic {
  file: string | null;
  state: AttachmentState;
  rootConnected: boolean;
  renderable: boolean;
  inViewport: boolean;
  active: boolean;
  theme: ThemeMode;
  paperMode: string;
  followCanvas: boolean;
  zoom: number;
  scrollX: number;
  scrollY: number;
  nativeUiObscured: boolean;
}

export class ViewAttachmentManager {
  private readonly attachments = new Map<HTMLElement, ViewAttachment>();
  private readonly documentGuards = new Map<Document, DocumentGuardEntry>();
  private unsubscribeSettings: (() => void) | null = null;
  private rafId: number | null = null;
  private rafWindow: Window | null = null;
  private reconcileRafId: number | null = null;
  private reconcileRafWindow: Window | null = null;
  private reconcileTimer: number | null = null;
  private settleTimer: number | null = null;
  private started = false;
  private lastFrameAt = 0;
  private lastDockGeometryKey = "";

  public constructor(
    private readonly app: App,
    private readonly store: SettingsStore,
    private readonly actions: PluginUiActions,
    private readonly isMobileApp: boolean,
  ) {}

  public start(): void {
    if (this.started) return;
    this.started = true;

    this.acquireDocumentGuard(document, true);
    this.lastDockGeometryKey = this.getDockGeometryKey();
    this.unsubscribeSettings = this.store.subscribe(() => {
      // Most settings only need a cheap renderer/UI refresh. Dock placement and
      // collapse state also affect portal geometry, so reposition only when those
      // values changed. This keeps range-slider updates light while ensuring a
      // dragged/nudged dock immediately propagates to every open drawing.
      const nextDockGeometryKey = this.getDockGeometryKey();
      const reposition = nextDockGeometryKey !== this.lastDockGeometryKey;
      this.lastDockGeometryKey = nextDockGeometryKey;
      this.renderAll(false, reposition);
      this.ensureAnimationLoop();
    });
    this.scheduleReconcile();
  }

  public stop(): void {
    this.started = false;
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;

    if (this.rafId !== null) (this.rafWindow ?? window).cancelAnimationFrame(this.rafId);
    if (this.reconcileRafId !== null) {
      (this.reconcileRafWindow ?? window).cancelAnimationFrame(this.reconcileRafId);
    }
    if (this.reconcileTimer !== null) window.clearTimeout(this.reconcileTimer);
    if (this.settleTimer !== null) window.clearTimeout(this.settleTimer);
    this.rafId = null;
    this.rafWindow = null;
    this.reconcileRafId = null;
    this.reconcileRafWindow = null;
    this.reconcileTimer = null;
    this.settleTimer = null;

    for (const attachment of this.attachments.values()) this.detach(attachment);
    this.attachments.clear();

    for (const [doc, entry] of this.documentGuards) {
      entry.guard.destroy();
      this.removeOrphanedPluginDom(doc);
    }
    this.documentGuards.clear();
  }

  public scheduleReconcile(): void {
    if (!this.started || this.reconcileRafId !== null) return;
    const win = this.getPreferredWindow();
    this.reconcileRafWindow = win;
    this.reconcileRafId = win.requestAnimationFrame(() => {
      this.reconcileRafId = null;
      this.reconcileRafWindow = null;
      this.reconcile();

      if (this.reconcileTimer !== null) window.clearTimeout(this.reconcileTimer);
      this.reconcileTimer = window.setTimeout(() => {
        this.reconcileTimer = null;
        this.reconcile();
      }, 90);

      if (this.settleTimer !== null) window.clearTimeout(this.settleTimer);
      this.settleTimer = window.setTimeout(() => {
        this.settleTimer = null;
        this.reconcile();
      }, 350);
    });
  }

  public closeAllPanels(): void {
    for (const attachment of this.attachments.values()) attachment.controls.closePanel();
  }

  public getActiveAttachment(): ViewAttachment | null {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (!activeLeaf || !isExcalidrawView(activeLeaf.view)) return null;

    for (const attachment of this.attachments.values()) {
      if (this.isAttachmentActive(attachment, activeLeaf) && isRootRenderable(attachment.root)) {
        return attachment;
      }
    }
    return null;
  }

  public getActiveFilePath(): string | null {
    return this.getActiveAttachment()?.filePath ?? null;
  }

  public toggleActivePanel(): boolean {
    const attachment = this.getActiveAttachment();
    if (!attachment) return false;
    attachment.controls.togglePanel();
    return true;
  }

  public getDiagnostics(): AttachmentDiagnostic[] {
    const activeLeaf = this.app.workspace.activeLeaf;
    return [...this.attachments.values()].map((attachment) => {
      const guide = this.store.getGuide(attachment.filePath);
      const transform = getViewTransform(attachment.view, guide.followCanvas);
      const docEntry = this.documentGuards.get(attachment.root.ownerDocument);
      return {
        file: attachment.filePath,
        state: attachment.state,
        rootConnected: attachment.root.isConnected,
        renderable: isRootRenderable(attachment.root),
        inViewport: isRootInViewport(attachment.root),
        active: activeLeaf ? this.isAttachmentActive(attachment, activeLeaf) : false,
        theme: resolveTheme(attachment.view),
        paperMode: guide.paperMode,
        followCanvas: guide.followCanvas,
        zoom: transform.zoom,
        scrollX: transform.scrollX,
        scrollY: transform.scrollY,
        nativeUiObscured: docEntry?.guard.isObscured() ?? false,
      };
    });
  }

  private getExcalidrawLeaves(): WorkspaceLeaf[] {
    return (this.app.workspace.getLeavesOfType("excalidraw") ?? []).filter((leaf) =>
      isExcalidrawView(leaf.view),
    );
  }

  private reconcile(): void {
    if (!this.started) return;
    const liveRoots = new Set<HTMLElement>();

    for (const leaf of this.getExcalidrawLeaves()) {
      if (!isExcalidrawView(leaf.view)) continue;
      const root = findExcalidrawRoot(leaf.view);
      if (!root) continue;
      liveRoots.add(root);

      const existing = this.attachments.get(root);
      if (existing) {
        existing.view = leaf.view;
        const filePath = getViewFilePath(leaf.view);
        if (existing.filePath !== filePath) {
          existing.filePath = filePath;
          existing.controls.setFilePath(filePath);
        }
      } else {
        this.attach(root, leaf.view);
      }
    }

    for (const [root, attachment] of this.attachments) {
      if (!root.isConnected || !liveRoots.has(root)) {
        this.detach(attachment);
        this.attachments.delete(root);
      }
    }

    this.renderAll(true);
    this.ensureAnimationLoop();
  }

  private attach(root: HTMLElement, view: ExcalidrawViewLike): void {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    this.removeOrphanedPluginDomForRoot(root);
    this.acquireDocumentGuard(doc, false);
    root.classList.add("nyra-ruled-lines-host");

    // Excalidraw normally supplies a positioned root. Only patch position when
    // a theme or future Excalidraw build leaves the root static, avoiding an
    // unconditional layout override on the third-party view.
    const hostPositionPatched = win?.getComputedStyle(root).position === "static";
    if (hostPositionPatched) root.classList.add("nyra-ruled-lines-host-positioned");

    const overlay = doc.createElement("div");
    overlay.className = "nyra-ruled-lines-overlay is-suspended";
    overlay.setAttribute("aria-hidden", "true");
    root.appendChild(overlay);

    const filePath = getViewFilePath(view);
    const controls = new FloatingControlsHost(
      doc,
      this.store,
      this.actions,
      filePath,
      root,
      this.isMobileApp,
      (open) => {
        if (open) {
          for (const candidate of this.attachments.values()) {
            if (candidate.root !== root) candidate.controls.closePanel();
          }
        }
        const current = this.attachments.get(root);
        if (current) this.positionAttachment(current);
      },
    );

    const renderer = new GuideOverlayRenderer(overlay);
    let attachment: ViewAttachment | null = null;
    const updatePositionAndVisibility = (): void => {
      if (attachment) this.renderAttachment(attachment, false);
    };
    const handleWindowScroll = (): void => updatePositionAndVisibility();

    win?.addEventListener("resize", updatePositionAndVisibility, { passive: true });
    // Do not capture every descendant scroll. In particular, scrolling Nyra's
    // own settings panel must not cause redundant canvas/layout work.
    win?.addEventListener("scroll", handleWindowScroll, { passive: true });
    win?.visualViewport?.addEventListener("resize", updatePositionAndVisibility, { passive: true });
    win?.visualViewport?.addEventListener("scroll", updatePositionAndVisibility, { passive: true });

    const Observer = win?.ResizeObserver ?? globalThis.ResizeObserver;
    const resizeObserver = Observer ? new Observer(updatePositionAndVisibility) : null;
    resizeObserver?.observe(root);

    attachment = {
      root,
      view,
      filePath,
      overlay,
      renderer,
      controls,
      resizeObserver,
      removeWindowListeners: () => {
        win?.removeEventListener("resize", updatePositionAndVisibility);
        win?.removeEventListener("scroll", handleWindowScroll);
        win?.visualViewport?.removeEventListener("resize", updatePositionAndVisibility);
        win?.visualViewport?.removeEventListener("scroll", updatePositionAndVisibility);
      },
      hostPositionPatched,
      lastRenderable: false,
      state: "attached",
      theme: resolveTheme(view),
    };

    this.attachments.set(root, attachment);
    this.renderAttachment(attachment, true);
  }

  private detach(attachment: ViewAttachment): void {
    attachment.state = "suspended";
    attachment.controls.closePanel();
    attachment.resizeObserver?.disconnect();
    attachment.removeWindowListeners();
    attachment.renderer.destroy();
    attachment.controls.destroy();
    attachment.root.classList.remove("nyra-ruled-lines-host");
    if (attachment.hostPositionPatched) {
      attachment.root.classList.remove("nyra-ruled-lines-host-positioned");
    }
    this.releaseDocumentGuard(attachment.root.ownerDocument);
  }

  private getDockGeometryKey(): string {
    const snapshot = this.store.getSnapshot();
    const { desktop, compact } = snapshot.dockPositions;
    return [snapshot.dockCollapsed ? "1" : "0", desktop.x, desktop.y, compact.x, compact.y].join("|");
  }

  private renderAll(force: boolean, reposition = true): void {
    for (const attachment of this.attachments.values()) {
      this.renderAttachment(attachment, force, reposition);
    }
  }

  private renderAttachment(attachment: ViewAttachment, force: boolean, reposition = true): void {
    if (!attachment.root.isConnected) return;
    const snapshot = this.store.getSnapshot();
    const guide = this.store.getGuide(attachment.filePath);
    const renderable = isRootRenderable(attachment.root);
    const inViewport = renderable && isRootInViewport(attachment.root);
    const theme = resolveTheme(attachment.view);
    const activeLeaf = this.app.workspace.activeLeaf;
    const active = activeLeaf ? this.isAttachmentActive(attachment, activeLeaf) : false;
    const obscured = this.documentGuards.get(attachment.root.ownerDocument)?.guard.isObscured() ?? false;

    attachment.renderer.render(guide, attachment.view, theme, renderable && inViewport, force);
    attachment.theme = theme;
    attachment.controls.setTheme(theme);
    attachment.controls.setFilePath(attachment.filePath);
    attachment.controls.setControlsEnabled(snapshot.showFloatingControls);
    attachment.controls.setVisible(inViewport);
    attachment.controls.setActive(active);
    attachment.controls.setObscured(obscured);

    attachment.state = !renderable || !inViewport ? "suspended" : active ? "active" : "visible";

    if ((!renderable || !inViewport) && attachment.lastRenderable) attachment.controls.closePanel();
    attachment.lastRenderable = renderable && inViewport;
    if (reposition) this.positionAttachment(attachment);
  }

  private positionAttachment(attachment: ViewAttachment): void {
    const { root, controls } = attachment;
    if (!root.isConnected || !controls.element.isConnected) return;

    const rect = root.getBoundingClientRect();
    const win = root.ownerDocument.defaultView;
    if (!win) return;

    const visual = win.visualViewport;
    const viewportLeft = visual?.offsetLeft ?? 0;
    const viewportTop = visual?.offsetTop ?? 0;
    const viewportWidth = visual?.width ?? win.innerWidth;
    const viewportHeight = visual?.height ?? win.innerHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const visible = isRootInViewport(root);

    controls.setVisible(visible);
    if (!visible) return;

    const compact = this.isMobileApp || viewportWidth <= 700 || rect.width <= 620;
    const layout = compact ? "compact" : "desktop";
    const margin = DOCK_EDGE_MARGIN[layout];
    const boundsLeft = Math.max(viewportLeft + margin, rect.left + margin);
    const boundsTop = Math.max(viewportTop + margin, rect.top + margin);
    const boundsRight = Math.min(viewportRight - margin, rect.right - margin);
    const boundsBottom = Math.min(viewportBottom - margin, rect.bottom - margin);
    const boundsWidth = Math.max(1, boundsRight - boundsLeft);

    controls.setLayout(layout);

    const density = compact
      ? boundsWidth <= 285
        ? "micro"
        : boundsWidth <= 340
          ? "tiny"
          : boundsWidth <= 420
            ? "narrow"
            : "regular"
      : "regular";
    controls.setCompactDensity(density);

    const snapshot = this.store.getSnapshot();
    const dockHeight = compact ? (density === "regular" ? 54 : 50) : 48;
    const expandedWidth = compact
      ? density === "micro"
        ? 208
        : density === "tiny"
          ? 236
          : density === "narrow"
            ? 280
            : 300
      : 312;
    // Collapsed geometry deliberately matches the three visible controls
    // (drag grip, paper trigger, expand button) including their gaps/padding.
    // Keeping this in sync with the dedicated collapsed CSS prevents cramped
    // buttons and edge clipping on coarse-pointer/mobile layouts.
    const collapsedWidth = compact ? 146 : 124;
    const dockWidth = Math.min(boundsWidth, snapshot.dockCollapsed ? collapsedWidth : expandedWidth);

    controls.element.style.width = `${Math.round(dockWidth)}px`;

    // During a direct pointer drag React owns the live left/top coordinates.
    // Reconciliation resumes from the persisted normalized position on release.
    if (controls.isDragging()) return;

    const position = snapshot.dockPositions[layout];
    const { left, top } = resolveDockPixelPosition(position, dockWidth, dockHeight, {
      left: boundsLeft,
      top: boundsTop,
      right: boundsRight,
      bottom: boundsBottom,
    });

    controls.element.style.left = `${Math.round(left)}px`;
    controls.element.style.top = `${Math.round(top)}px`;

    const panelGap = compact ? 8 : 10;
    const panelWidth = Math.min(356, boundsWidth);

    // The panel follows the persistent normalized dock position, not the
    // dock's current rendered width. This is important when collapsing or
    // expanding the dock while the panel is open: changing dock width must
    // never make the large settings panel jump horizontally.
    const panelLeft = resolvePanelPixelLeft(position.x, panelWidth, {
      left: boundsLeft,
      right: boundsRight,
    });
    const below = Math.max(0, boundsBottom - (top + dockHeight + panelGap));
    const above = Math.max(0, top - panelGap - boundsTop);
    const direction = below >= 300 || below >= above ? "down" : "up";
    const availableHeight = direction === "down" ? below : above;
    const panelMaxHeight = Math.min(compact ? 620 : 560, Math.max(48, availableHeight));
    const panelAnchorTop = direction === "down" ? top + dockHeight + panelGap : top - panelGap;

    controls.setPanelDirection(direction);
    controls.setPanelGeometry(panelLeft, panelAnchorTop, panelWidth, panelMaxHeight);
  }

  private ensureAnimationLoop(): void {
    if (!this.started || this.rafId !== null) return;
    if (!this.hasAnimatedAttachment()) return;

    const tick = (now: number): void => {
      this.rafId = null;
      if (!this.started || !this.hasAnimatedAttachment()) {
        this.rafWindow = null;
        return;
      }

      const minFrameInterval = this.isMobileApp ? 1000 / 30 : 1000 / 60;
      if (now - this.lastFrameAt >= minFrameInterval - 1) {
        this.lastFrameAt = now;
        for (const attachment of this.attachments.values()) {
          if (!this.shouldAnimateAttachment(attachment)) continue;
          const guide = this.store.getGuide(attachment.filePath);
          attachment.renderer.render(guide, attachment.view, attachment.theme, true, false);
        }
      }

      const nextWindow = this.getAnimationWindow();
      if (!nextWindow) {
        this.rafWindow = null;
        return;
      }
      if (this.rafWindow && this.rafWindow !== nextWindow) this.lastFrameAt = 0;
      this.rafWindow = nextWindow;
      this.rafId = nextWindow.requestAnimationFrame(tick);
    };

    const win = this.getAnimationWindow();
    if (!win) return;
    if (this.rafWindow && this.rafWindow !== win) this.lastFrameAt = 0;
    this.rafWindow = win;
    this.rafId = win.requestAnimationFrame(tick);
  }

  private hasAnimatedAttachment(): boolean {
    for (const attachment of this.attachments.values()) {
      if (this.shouldAnimateAttachment(attachment)) return true;
    }
    return false;
  }

  private shouldAnimateAttachment(attachment: ViewAttachment): boolean {
    if (!attachment.root.isConnected || attachment.root.ownerDocument.visibilityState === "hidden")
      return false;
    if (attachment.state === "suspended") return false;
    return needsSceneAnimation(this.store.getGuide(attachment.filePath));
  }

  private getAnimationWindow(): Window | null {
    const active = this.getActiveAttachment();
    if (active && this.shouldAnimateAttachment(active)) {
      return active.root.ownerDocument.defaultView;
    }

    for (const attachment of this.attachments.values()) {
      if (!this.shouldAnimateAttachment(attachment)) continue;
      const win = attachment.root.ownerDocument.defaultView;
      if (win) return win;
    }
    return null;
  }

  private getPreferredWindow(): Window {
    const activeLeafWindow = this.app.workspace.activeLeaf?.view.containerEl.ownerDocument.defaultView;
    return activeLeafWindow ?? document.defaultView ?? window;
  }

  private isAttachmentActive(attachment: ViewAttachment, activeLeaf: WorkspaceLeaf): boolean {
    if (attachment.view === activeLeaf.view) return true;

    const attachmentLeafElement = getWorkspaceLeafElement(attachment.root);
    const activeLeafElement = getWorkspaceLeafElement(activeLeaf.view.containerEl);
    return Boolean(attachmentLeafElement && attachmentLeafElement === activeLeafElement);
  }

  private acquireDocumentGuard(doc: Document, pinned: boolean): void {
    const existing = this.documentGuards.get(doc);
    if (existing) {
      existing.refs += 1;
      existing.pinned ||= pinned;
      return;
    }

    this.removeOrphanedPluginDom(doc);
    const guard = new NativeUiGuard(
      doc,
      () => this.applyNativeUiState(doc),
      () => this.scheduleReconcile(),
    );
    this.documentGuards.set(doc, { guard, refs: 1, pinned });
    guard.start();
  }

  private releaseDocumentGuard(doc: Document): void {
    const entry = this.documentGuards.get(doc);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.pinned || entry.refs > 0) return;
    entry.guard.destroy();
    this.documentGuards.delete(doc);
  }

  private applyNativeUiState(doc: Document): void {
    const obscured = this.documentGuards.get(doc)?.guard.isObscured() ?? false;
    for (const attachment of this.attachments.values()) {
      if (attachment.root.ownerDocument !== doc) continue;
      attachment.controls.setObscured(obscured);
      if (obscured) attachment.controls.closePanel();
    }
  }

  private removeOrphanedPluginDom(doc: Document): void {
    for (const portal of doc.querySelectorAll<HTMLElement>("[data-nyra-ruled-portal='true']"))
      portal.remove();
    for (const overlay of doc.querySelectorAll<HTMLElement>(".nyra-ruled-lines-overlay")) overlay.remove();
    for (const host of doc.querySelectorAll<HTMLElement>(".nyra-ruled-lines-host")) {
      host.classList.remove("nyra-ruled-lines-host", "nyra-ruled-lines-host-positioned");
    }
  }

  private removeOrphanedPluginDomForRoot(root: HTMLElement): void {
    for (const overlay of root.querySelectorAll<HTMLElement>(":scope > .nyra-ruled-lines-overlay"))
      overlay.remove();
  }
}
