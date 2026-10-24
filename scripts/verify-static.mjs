import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));
const overlay = await readFile("src/styles/overlay.css", "utf8");
const controls = await readFile("src/styles/controls.css", "utf8");
const plugin = await readFile("src/plugin/NyraRuledLinesPlugin.ts", "utf8");
const settings = await readFile("src/core/settings.ts", "utf8");
const store = await readFile("src/core/SettingsStore.ts", "utf8");
const floatingControls = await readFile("src/ui/FloatingControls.tsx", "utf8");
const selectField = await readFile("src/ui/components/SelectField.tsx", "utf8");
const iconComponent = await readFile("src/ui/components/ObsidianIcon.tsx", "utf8");
const constants = await readFile("src/core/constants.ts", "utf8");
const components = await readFile("src/styles/components.css", "utf8");
const tokens = await readFile("src/styles/tokens.css", "utf8");
const renderer = await readFile("src/rendering/GuideOverlayRenderer.ts", "utf8");
const occlusionCanvas = await readFile("src/rendering/ObjectOcclusionCanvas.ts", "utf8");
const excalidrawTypes = await readFile("src/excalidraw/types.ts", "utf8");

const nativeGuard = await readFile("src/lifecycle/NativeUiGuard.ts", "utf8");
const responsive = await readFile("src/styles/responsive.css", "utf8");
const rangeField = await readFile("src/ui/components/RangeField.tsx", "utf8");
const dockDrag = await readFile("src/ui/hooks/usePersistentDockDrag.ts", "utf8");
const attachmentManager = await readFile("src/lifecycle/ViewAttachmentManager.ts", "utf8");
const dockGeometry = await readFile("src/ui/dockGeometry.ts", "utf8");
const allSourceFiles = [];

async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) allSourceFiles.push(file);
  }
}
await collect("src");
const source = (await Promise.all(allSourceFiles.map((file) => readFile(file, "utf8")))).join("\n");

assert(manifest.version === pkg.version, "manifest.json and package.json versions differ");
assert(
  constants.includes(`PLUGIN_VERSION = "${manifest.version}"`),
  "src/core/constants.ts PLUGIN_VERSION differs from manifest.json",
);
assert(
  String(pkg.scripts?.version ?? "").includes("src/core/constants.ts"),
  "npm version hook must stage the runtime version constant",
);
assert(versions[manifest.version] === manifest.minAppVersion, "versions.json is missing the current version");
assert(manifest.isDesktopOnly === false, "mobile support requires isDesktopOnly=false");
assert(!/214748\d+/.test(source), "extreme z-index regression detected");
assert(!/mix-blend-mode\s*:\s*(multiply|screen)/i.test(source), "unsafe blend-mode regression detected");
assert(!/isolation\s*:\s*isolate/i.test(source), "unsafe isolation stacking-context regression detected");
assert(
  !/from\s+[\"'](?:fs|path|electron|node:)/.test(source),
  "runtime Node/Electron import detected in src/",
);
assert(!/setInterval\s*\(/.test(source), "polling interval detected in runtime source");
assert(!/activeLeaf\.containerEl/.test(source), "unsupported WorkspaceLeaf.containerEl access detected");
assert(/data-paper-mode=\"grid\"/.test(overlay), "grid paper CSS is missing");
assert(/data-paper-mode=\"dots\"/.test(overlay), "dot paper CSS is missing");
assert(/var\(--layer-popover, 30\)/.test(controls), "Obsidian-compatible popover z-index token is missing");
assert(
  /Platform\.isIosApp/.test(plugin) && /Platform\.isAndroidApp/.test(plugin),
  "mobile platform guards are missing",
);
for (const commandId of [
  "toggle-ruled-lines",
  "toggle-ruled-line-controls",
  "cycle-ruled-line-spacing",
  "reset-ruled-line-color",
]) {
  assert(plugin.includes(`id: "${commandId}"`), `legacy command ID missing: ${commandId}`);
}
assert(/paperMode:\s*"ruled"/.test(settings), "legacy-compatible ruled default is missing");
assert(/marginEnabled:\s*false/.test(settings), "margin must remain opt-in for migration compatibility");
assert(
  /nativeAttributeObserver/.test(nativeGuard) && /attributeFilter: NATIVE_ATTRIBUTE_FILTER/.test(nativeGuard),
  "persistent native-menu attribute guard is missing",
);
assert(
  /visibilitychange/.test(nativeGuard) && /pageshow/.test(nativeGuard),
  "mobile/background lifecycle recovery hooks are missing",
);
assert(/nyra-ruled-lines-host-positioned/.test(overlay), "conditional host positioning fallback is missing");
assert(/touch-action:\s*manipulation/.test(responsive), "coarse-pointer touch hardening is missing");

assert(
  /hideUnderObjects:\s*false/.test(settings),
  "object-aware masking must remain opt-in for migration compatibility",
);
assert(
  /Hide guides under objects/.test(floatingControls),
  "object-aware masking toggle is missing from floating controls",
);
assert(/getSceneElements\?\(\)/.test(excalidrawTypes), "Excalidraw scene-element adapter is missing");
assert(
  /ObjectOcclusionCanvas/.test(renderer) && /is-object-aware/.test(renderer),
  "object-aware renderer integration is missing",
);
assert(
  /destination-out/.test(occlusionCanvas),
  "object occlusion must use transparent destination-out compositing",
);
assert(/MAX_CANVAS_DPR\s*=\s*2/.test(occlusionCanvas), "object-aware canvas DPR cap is missing");
assert(
  /max-width:\s*420px/.test(responsive) && /nyra-summary-compact/.test(responsive),
  "narrow-phone compact dock rules are missing",
);
assert(
  /max-width:\s*340px/.test(responsive) && /nyra-quick-cycle/.test(responsive),
  "ultra-narrow dock fallback is missing",
);
assert(
  /data-compact-density/.test(responsive) && /setCompactDensity/.test(source),
  "pane-width responsive density fallback is missing",
);

assert(!/<select\b/i.test(source), "native select regression detected; custom listbox must remain in use");
assert(
  /createPortal/.test(selectField) && /role="listbox"/.test(selectField),
  "custom portal listbox is missing",
);
assert(
  /availableWidth = Math\.max\(1, viewportWidth - VIEWPORT_MARGIN \* 2\)/.test(selectField),
  "custom select viewport-width clamp is missing",
);
assert(/availableHeight = Math\.max\(1,/.test(selectField), "custom select viewport-height clamp is missing");
assert(
  /portalRoot=\{portalElement\}/.test(floatingControls),
  "floating dropdowns must portal into the plugin control root",
);
assert(
  /Reset to defaults/.test(floatingControls) && /resetToDefaults/.test(store),
  "safe reset-to-defaults flow is missing",
);
assert(
  /DEFAULT_GUIDE_SETTINGS/.test(store) && /marginOffset/.test(settings),
  "guide default reset coverage is missing",
);
assert(
  /grid:\s*\{\s*label:\s*"Grid",\s*icon:\s*"grid-2x2"/.test(constants),
  "compatible Grid icon ID is missing",
);
assert(/renderGridFallback/.test(iconComponent), "Grid icon fallback renderer is missing");
assert(/nyra-select-popover/.test(components), "custom select styling is missing");
assert(
  /nyra-select-popover[\s\S]*pointer-events:\s*auto/.test(components),
  "custom select popover must opt back into pointer events",
);
assert(
  /nyra-ruled-panel[\s\S]*scrollbar-width:\s*auto\s*!important/.test(controls),
  "panel scrollbar must keep standardized rendering disabled so WebKit geometry wins",
);
assert(
  /::-webkit-scrollbar\s*\{[\s\S]*?width:\s*4px\s*!important/.test(controls),
  "ultra-slim 4 px panel scrollbar regression detected",
);
assert(
  /scrollbar-button:single-button/.test(controls) &&
    /scrollbar-button:vertical:decrement/.test(controls) &&
    /scrollbar-button:vertical:increment/.test(controls),
  "panel scrollbar arrow suppression is incomplete",
);
assert(
  /--nr-scrollbar-thumb:[^;]*interactive-accent/.test(tokens),
  "accent-colored scrollbar token regression detected",
);
assert(/--nr-scrollbar-thumb-active/.test(tokens), "active scrollbar accent token is missing");
assert(
  /nyra-select-popover[\s\S]*scrollbar-button:single-button/.test(components),
  "custom-select scrollbar arrow suppression is missing",
);

assert(
  /dockPositions:\s*DEFAULT_DOCK_POSITIONS/.test(settings),
  "persistent dock-position defaults are missing",
);
assert(
  /compact:\s*Object\.freeze\(\{\s*x:\s*1,\s*y:\s*0\.12\s*\}\)/.test(constants),
  "mobile dock default must avoid Excalidraw's bottom toolbar",
);
assert(
  /usePersistentDockDrag/.test(floatingControls) && /nyra-dock-drag-handle/.test(controls),
  "persistent draggable dock integration is missing",
);
assert(
  /dockPositions/.test(dockDrag) &&
    /normalizeDockPosition/.test(dockDrag) &&
    /resolveDockPixelPosition/.test(dockGeometry),
  "normalized persistent dock coordinates are missing",
);
assert(
  /controls\.isDragging\(\)/.test(attachmentManager),
  "layout reconciliation must not fight an active dock drag",
);
assert(
  /lastDockGeometryKey/.test(attachmentManager) && /renderAll\(false, reposition\)/.test(attachmentManager),
  "dock geometry changes must reposition open controls without making every settings update expensive",
);
assert(
  /position:\s*fixed\s*!important[\s\S]*--nyra-panel-left/.test(controls),
  "panel must use viewport-fixed geometry for freely positioned docks",
);
const compactRootBlock =
  responsive.match(/\.nyra-ruled-controls\[data-layout="compact"\]\s*\{([^}]*)\}/)?.[1] ?? "";
assert(
  !/transform:/.test(compactRootBlock),
  "compact root transform would break fixed custom dropdown positioning",
);
assert(/touch-action:\s*pan-y/.test(responsive), "touch sliders must preserve vertical panel scrolling");
assert(
  /nyra-ruled-range-control input\[type="range"\][\s\S]*pointer-events:\s*none\s*!important/.test(
    components,
  ) && /TOUCH_INTENT_THRESHOLD/.test(rangeField),
  "touch-safe slider intent gating is missing",
);
assert(
  /!settings\.dockCollapsed/.test(floatingControls),
  "collapsed dock must render icon-only trigger content without leaked text",
);

assert(
  /resolvePanelPixelLeft/.test(dockGeometry) && /resolvePanelPixelLeft\(position\.x/.test(attachmentManager),
  "open panel must be positioned independently of collapsed/expanded dock width",
);
assert(
  /const collapsedWidth = compact \? 146 : 124/.test(attachmentManager),
  "collapsed dock width must match balanced control geometry",
);
assert(
  /data-dock-collapsed="true"[\s\S]*nyra-dock-collapse-button/.test(controls),
  "collapsed dock equal-cell styling is missing",
);
assert(
  /data-dock-collapsed="true"[\s\S]*gap:\s*3px\s*!important[\s\S]*padding:\s*4px\s*!important/.test(controls),
  "desktop collapsed dock spacing geometry regressed",
);
assert(
  /data-layout="compact"\]\[data-dock-collapsed="true"[\s\S]*padding:\s*3px\s*!important[\s\S]*44px/.test(
    responsive,
  ),
  "compact collapsed dock spacing geometry regressed",
);

if (failures.length) {
  console.error("Static verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Static verification passed (${allSourceFiles.length} source files checked).`);
}
