import { describe, expect, it } from "vitest";
import { SettingsStore } from "../src/core/SettingsStore";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import type { NyraSettings } from "../src/core/types";

function createStore(initial: unknown = DEFAULT_SETTINGS): {
  store: SettingsStore;
  saves: NyraSettings[];
} {
  const saves: NyraSettings[] = [];
  const store = new SettingsStore({
    load: async () => initial,
    save: async (settings) => {
      saves.push(settings);
    },
  });
  return { store, saves };
}

describe("SettingsStore", () => {
  it("creates an isolated drawing override and preserves global settings", async () => {
    const { store } = createStore();
    await store.load();
    await store.setFileOverride("A.excalidraw.md", true);
    await store.updateGuide("A.excalidraw.md", { paperMode: "grid" });

    expect(store.getGuide("A.excalidraw.md").paperMode).toBe("grid");
    expect(store.getGuide(null).paperMode).toBe("ruled");
  });

  it("moves overrides when files or folders are renamed", async () => {
    const { store } = createStore();
    await store.load();
    await store.setFileOverride("School/Math/A.excalidraw.md", true);
    await store.moveFileOverrides("School/Math", "School/Mathematics");

    expect(store.hasFileOverride("School/Math/A.excalidraw.md")).toBe(false);
    expect(store.hasFileOverride("School/Mathematics/A.excalidraw.md")).toBe(true);
  });

  it("prefers the moved source override over stale target data", async () => {
    const { store } = createStore();
    await store.load();
    await store.setFileOverride("Old.excalidraw.md", true);
    await store.updateGuide("Old.excalidraw.md", { paperMode: "grid" });
    await store.setFileOverride("New.excalidraw.md", true);
    await store.updateGuide("New.excalidraw.md", { paperMode: "dots" });

    await store.moveFileOverrides("Old.excalidraw.md", "New.excalidraw.md");

    expect(store.hasFileOverride("Old.excalidraw.md")).toBe(false);
    expect(store.getGuide("New.excalidraw.md").paperMode).toBe("grid");
  });

  it("stores and applies named paper profiles", async () => {
    const { store } = createStore();
    await store.load();
    await store.updateGlobal({ paperMode: "dots", dotSize: 2 });
    const id = await store.createProfile("Dots");
    expect(id).not.toBeNull();

    await store.updateGlobal({ paperMode: "ruled" });
    expect(await store.applyProfileToGlobal(id!)).toBe(true);
    expect(store.getGuide(null).paperMode).toBe("dots");
  });

  it("resets global paper and interface defaults without deleting user data", async () => {
    const { store } = createStore();
    await store.load();
    await store.setFileOverride("Keep.excalidraw.md", true);
    const profileId = await store.createProfile("Keep me");
    expect(profileId).not.toBeNull();

    await store.updateGlobal({
      paperMode: "grid",
      lineThickness: 3.5,
      opacity: 0.85,
      marginEnabled: true,
      marginOffset: 222,
      marginThickness: 2.5,
      hideUnderObjects: true,
      dockVisibility: "auto",
      dockCollapsed: true,
      dockPositions: { desktop: { x: 0.2, y: 0.6 }, compact: { x: 0.4, y: 0.8 } },
      showStatusBar: false,
    });

    await store.resetToDefaults();

    const settings = store.getSnapshot();
    expect(settings.paperMode).toBe(DEFAULT_SETTINGS.paperMode);
    expect(settings.lineThickness).toBe(DEFAULT_SETTINGS.lineThickness);
    expect(settings.opacity).toBe(DEFAULT_SETTINGS.opacity);
    expect(settings.marginOffset).toBe(DEFAULT_SETTINGS.marginOffset);
    expect(settings.marginThickness).toBe(DEFAULT_SETTINGS.marginThickness);
    expect(settings.hideUnderObjects).toBe(DEFAULT_SETTINGS.hideUnderObjects);
    expect(settings.dockVisibility).toBe(DEFAULT_SETTINGS.dockVisibility);
    expect(settings.dockCollapsed).toBe(DEFAULT_SETTINGS.dockCollapsed);
    expect(settings.dockPositions).toEqual(DEFAULT_SETTINGS.dockPositions);
    expect(settings.showStatusBar).toBe(DEFAULT_SETTINGS.showStatusBar);
    expect(settings.profiles).toHaveLength(1);
    expect(store.hasFileOverride("Keep.excalidraw.md")).toBe(true);
  });

  it("resets a drawing override to guide defaults without removing the override", async () => {
    const { store } = createStore();
    await store.load();
    await store.updateGlobal({
      opacity: 0.75,
      lineThickness: 2.75,
      dockVisibility: "auto",
      dockCollapsed: true,
      dockPositions: { desktop: { x: 0.1, y: 0.4 }, compact: { x: 0.3, y: 0.7 } },
    });
    await store.setFileOverride("Local.excalidraw.md", true);
    await store.updateGuide("Local.excalidraw.md", {
      paperMode: "dots",
      opacity: 0.9,
      lineThickness: 4,
      marginEnabled: true,
      marginOffset: 300,
      marginThickness: 3.5,
      hideUnderObjects: true,
    });

    await store.resetToDefaults("Local.excalidraw.md");

    const local = store.getGuide("Local.excalidraw.md");
    expect(store.hasFileOverride("Local.excalidraw.md")).toBe(true);
    expect(local.paperMode).toBe(DEFAULT_SETTINGS.paperMode);
    expect(local.opacity).toBe(DEFAULT_SETTINGS.opacity);
    expect(local.lineThickness).toBe(DEFAULT_SETTINGS.lineThickness);
    expect(local.marginOffset).toBe(DEFAULT_SETTINGS.marginOffset);
    expect(local.marginThickness).toBe(DEFAULT_SETTINGS.marginThickness);
    expect(local.hideUnderObjects).toBe(DEFAULT_SETTINGS.hideUnderObjects);
    expect(store.getGuide(null).opacity).toBe(0.75);
    expect(store.getGuide(null).lineThickness).toBe(2.75);
    expect(store.getSnapshot().dockVisibility).toBe(DEFAULT_SETTINGS.dockVisibility);
    expect(store.getSnapshot().dockCollapsed).toBe(DEFAULT_SETTINGS.dockCollapsed);
    expect(store.getSnapshot().dockPositions).toEqual(DEFAULT_SETTINGS.dockPositions);
  });
});
