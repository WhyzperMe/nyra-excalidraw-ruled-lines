const NATIVE_UI_SELECTOR = ".menu, .modal-container, .suggestion-container, .prompt";
const WORKSPACE_SELECTOR = ".workspace-leaf, .excalidraw";
const NATIVE_ATTRIBUTE_FILTER = ["class", "style", "hidden", "aria-hidden"];

function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected || element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 1 || rect.height <= 1) return false;
  const win = element.ownerDocument.defaultView;
  if (!win) return false;
  const style = win.getComputedStyle(element);
  return (
    style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity || "1") > 0
  );
}

function elementTouchesSelector(node: Node, selector: string): boolean {
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  return element.matches(selector) || Boolean(element.querySelector(selector));
}

function mutationsTouchSelector(mutations: MutationRecord[], selector: string): boolean {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") continue;
    for (const node of mutation.addedNodes) {
      if (elementTouchesSelector(node, selector)) return true;
    }
    for (const node of mutation.removedNodes) {
      if (elementTouchesSelector(node, selector)) return true;
    }
  }
  return false;
}

export class NativeUiGuard {
  private structureObserver: MutationObserver | null = null;
  private nativeAttributeObserver: MutationObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private rafId: number | null = null;
  private obscured = false;
  private readonly onVisibilityChange = (): void => {
    this.scheduleCheck();
    this.onWorkspaceMutation();
  };
  private readonly onPageShow = (): void => {
    this.scheduleCheck();
    this.onWorkspaceMutation();
  };

  public constructor(
    private readonly doc: Document,
    private readonly onChange: (obscured: boolean) => void,
    private readonly onWorkspaceMutation: () => void,
  ) {}

  public start(): void {
    if (this.structureObserver || !this.doc.body) return;
    const win = this.doc.defaultView;
    const Observer = win?.MutationObserver ?? globalThis.MutationObserver;

    this.structureObserver = new Observer((mutations) => {
      const workspaceChanged = mutationsTouchSelector(mutations, WORKSPACE_SELECTOR);
      const nativeChanged = mutationsTouchSelector(mutations, NATIVE_UI_SELECTOR);

      if (workspaceChanged) this.onWorkspaceMutation();
      if (nativeChanged) {
        this.refreshNativeAttributeTargets();
        this.scheduleCheck();
      }
    });
    this.structureObserver.observe(this.doc.body, {
      childList: true,
      subtree: true,
    });

    // Native menus are usually inserted/removed, but some Obsidian/theme builds
    // keep the same menu element and only flip class/style/hidden state. Observe
    // just those native UI nodes instead of all subtree attributes so Excalidraw
    // class churn cannot create an expensive mutation stream.
    this.nativeAttributeObserver = new Observer(() => this.scheduleCheck());
    this.refreshNativeAttributeTargets();

    this.themeObserver = new Observer(() => this.onWorkspaceMutation());
    this.themeObserver.observe(this.doc.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    this.doc.addEventListener("visibilitychange", this.onVisibilityChange, { passive: true });
    win?.addEventListener("pageshow", this.onPageShow, { passive: true });

    this.checkNow();
  }

  public isObscured(): boolean {
    return this.obscured;
  }

  public destroy(): void {
    this.structureObserver?.disconnect();
    this.nativeAttributeObserver?.disconnect();
    this.themeObserver?.disconnect();
    this.structureObserver = null;
    this.nativeAttributeObserver = null;
    this.themeObserver = null;

    this.doc.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.doc.defaultView?.removeEventListener("pageshow", this.onPageShow);

    const win = this.doc.defaultView;
    if (this.rafId !== null) (win ?? window).cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private refreshNativeAttributeTargets(): void {
    const observer = this.nativeAttributeObserver;
    if (!observer) return;
    observer.disconnect();
    for (const element of this.doc.querySelectorAll<HTMLElement>(NATIVE_UI_SELECTOR)) {
      if (element.closest("[data-nyra-ruled-portal='true']")) continue;
      observer.observe(element, {
        attributes: true,
        attributeFilter: NATIVE_ATTRIBUTE_FILTER,
      });
    }
  }

  private scheduleCheck(): void {
    if (this.rafId !== null) return;
    const win = this.doc.defaultView ?? window;
    this.rafId = win.requestAnimationFrame(() => {
      this.rafId = null;
      this.checkNow();
    });
  }

  private checkNow(): void {
    let next = false;
    for (const element of this.doc.querySelectorAll<HTMLElement>(NATIVE_UI_SELECTOR)) {
      if (element.closest("[data-nyra-ruled-portal='true']")) continue;
      if (isVisible(element)) {
        next = true;
        break;
      }
    }

    if (next === this.obscured) return;
    this.obscured = next;
    this.onChange(next);
  }
}
