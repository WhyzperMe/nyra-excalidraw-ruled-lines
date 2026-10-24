import { createRoot } from "react-dom/client";
import { SettingsStore } from "../../src/core/SettingsStore";
import { FloatingControlsHost } from "../../src/ui/FloatingControlsHost";
import { SettingsScreen } from "../../src/settings/SettingsScreen";
import { DOCK_EDGE_MARGIN, resolveDockPixelPosition, resolvePanelPixelLeft } from "../../src/ui/dockGeometry";
import type { PluginUiActions } from "../../src/core/types";

const query = new URLSearchParams(location.search);
const scenario = query.get("scenario") ?? "dock";
const theme = query.get("theme") === "light" ? "light" : "dark";
const width = Number(query.get("w") ?? 1000);
const height = Number(query.get("h") ?? 700);
const touch = query.get("touch") === "1";
document.body.className = `theme-${theme}${touch ? " is-mobile is-tablet" : ""}`;

let saved: unknown = {
  schemaVersion: 5,
  paperMode: "ruled",
  preset: "school",
  dockCollapsed: scenario === "collapsed",
  fileOverrides: {},
  profiles: [
    {
      id: "p1",
      name: "Maths · 5 mm grid",
      guide: { paperMode: "grid", preset: "custom", customSpacing: 28 },
    },
    { id: "p2", name: "Cornell notes", guide: { paperMode: "ruled", preset: "wide", marginEnabled: true } },
  ],
};
const store = new SettingsStore({
  load: async () => saved,
  save: async (next) => {
    saved = next;
  },
});
void store.load().then(() => {
  const actions = new Proxy({} as PluginUiActions, {
    get: (_target, key) => {
      if (key === "patchSettings") return (patch: never) => store.updateGlobal(patch);
      if (key === "patchGuideSettings")
        return (path: string | null, patch: never) => store.updateGuide(path, patch);
      return async () => undefined;
    },
  });

  if (scenario === "settings") {
    const mount = document.createElement("div");
    mount.className = "vertical-tab-content nyra-settings-root";
    mount.style.setProperty("--preview-width", `${width}px`);
    document.body.appendChild(mount);
    createRoot(mount).render(<SettingsScreen store={store} actions={actions} />);
  } else {
    const pane = document.createElement("div");
    const line = theme === "dark" ? "rgba(127,159,189,.25)" : "rgba(127,159,189,.45)";
    Object.assign(pane.style, {
      position: "relative",
      width: `${width}px`,
      height: `${height}px`,
      overflow: "hidden",
      background: theme === "dark" ? "#14151a" : "#ffffff",
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 33px, ${line} 33px 34px)`,
    });
    document.body.appendChild(pane);
    const compact = touch || width <= 700;
    const layout = compact ? "compact" : "desktop";
    const place = (): void => {
      const margin = DOCK_EDGE_MARGIN[layout];
      const b = { left: margin, top: margin, right: width - margin, bottom: height - margin };
      const boundsWidth = b.right - b.left;
      const density = compact
        ? boundsWidth <= 285
          ? "micro"
          : boundsWidth <= 340
            ? "tiny"
            : boundsWidth <= 420
              ? "narrow"
              : "regular"
        : "regular";
      host.setCompactDensity(density);
      const snap = store.getSnapshot();
      const dockHeight = compact ? (density === "regular" ? 54 : 50) : 48;
      const expanded = compact
        ? density === "micro"
          ? 208
          : density === "tiny"
            ? 236
            : density === "narrow"
              ? 280
              : 300
        : 312;
      const dockWidth = Math.min(boundsWidth, snap.dockCollapsed ? (compact ? 146 : 124) : expanded);
      host.element.style.width = `${Math.round(dockWidth)}px`;
      const position = snap.dockPositions[layout];
      const { left, top } = resolveDockPixelPosition(position, dockWidth, dockHeight, b);
      host.element.style.left = `${Math.round(left)}px`;
      host.element.style.top = `${Math.round(top)}px`;
      const gap = compact ? 8 : 10;
      const panelWidth = Math.min(356, boundsWidth);
      const panelLeft = resolvePanelPixelLeft(position.x, panelWidth, { left: b.left, right: b.right });
      const below = Math.max(0, b.bottom - (top + dockHeight + gap));
      const above = Math.max(0, top - gap - b.top);
      const direction = below >= 300 || below >= above ? "down" : "up";
      host.setPanelDirection(direction);
      host.setPanelGeometry(
        panelLeft,
        direction === "down" ? top + dockHeight + gap : top - gap,
        panelWidth,
        Math.min(compact ? 620 : 560, Math.max(48, direction === "down" ? below : above)),
      );
    };
    const host = new FloatingControlsHost(
      document,
      store,
      actions,
      "Drawings/Maths.excalidraw.md",
      pane,
      touch,
      place,
    );
    host.setActive(true);
    host.setVisible(true);
    host.setLayout(layout);
    host.setTheme(theme);
    place();
    if (scenario === "panel") {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          host.togglePanel();
          setTimeout(place, 50);
        }),
      );
    }
  }
});
