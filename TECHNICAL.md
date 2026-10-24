# Technical notes — v1.4.7

## Settings schema

`SETTINGS_SCHEMA_VERSION = 3`.

The global guide model contains:

- `enabled`
- `paperMode`: `ruled | grid | dots | blank`
- `preset`: legacy `compact | school | wide | custom`
- `customSpacing`
- `gridSpacingX`
- `linkGridSpacing`
- `lineThickness`
- `dotSize`
- `opacity`
- `lineColor`
- `protectInk`
- `followCanvas`
- `marginEnabled`
- `marginOffset`
- `marginThickness`
- `marginColor`

UI settings add `showFloatingControls`, `showStatusBar`, `dockVisibility`, and `dockCollapsed`. `profiles` and `fileOverrides` are separate collections.

Every loaded number/color/enum is sanitized. Invalid profile entries are skipped, duplicate profile IDs are rejected, profile count is bounded, and file override paths are normalized to non-empty vault-relative strings.

## Backward compatibility

The v1.3.x top-level shape remains a valid input. Historic `darkColor`/`lightColor` are still accepted when `lineColor` is missing. New visual features use conservative defaults, so loading old data produces the same ruled-paper behavior unless the user opts into them.

Existing command IDs are preserved:

- `toggle-ruled-lines`
- `toggle-ruled-line-controls`
- `cycle-ruled-line-spacing`
- `reset-ruled-line-color`

v1.4.x adds commands for cycling paper type, toggling the active drawing override, and copying diagnostics. Diagnostics remains available even though the floating footer now prioritizes Reset to defaults.

## Black-surface regression prevention

The overlay no longer relies on compositor blending or a new stacking context. The live CSS path contains no `isolation: isolate`, `mix-blend-mode: multiply`, or `mix-blend-mode: screen`.

On detach/suspension:

1. the overlay is hidden;
2. controls close;
3. observers/listeners are disconnected;
4. React is unmounted;
5. overlay and portal DOM are removed.

Orphan cleanup also runs when a document guard is first acquired, covering stale DOM left behind by a previous reload/crash.

## Native menu stacking

The portal uses:

```css
z-index: var(--layer-popover, 30);
```

`NativeUiGuard` observes structural additions/removals for native menu/modal/suggestion surfaces. While one is visibly open, plugin portals in that document become non-interactive and hidden, then restore after the native surface closes. This is deliberately conservative: the plugin never wins a stacking fight against Obsidian menus.

## Rendering math

Scene-anchored spacing is calculated from Excalidraw app state:

```text
screen spacing = configured spacing × zoom
screen offset  = positiveModulo(scene scroll × zoom, screen spacing)
```

When `followCanvas` is disabled, offsets are zero and configured sizes behave as viewport paper.

Line/dot/margin visual weights scale within bounded limits rather than becoming unusably thin or thick at extreme zoom levels.

## Performance policy

There is no periodic runtime polling interval.

Workspace/file/layout mutations schedule immediate reconciliation plus short 90 ms and 350 ms settling passes to absorb asynchronous Excalidraw/Obsidian view swaps.

The animation loop starts only if a connected, non-suspended attachment has visible paper and `followCanvas=true`. It stops naturally when that condition disappears. Per-frame work is restricted to cached overlay geometry updates; visibility/theme/layout checks are not repeated every frame.

Mobile app rendering is capped to approximately 30 fps for the paper transform path; desktop is allowed approximately 60 fps.

## Persistence policy

Slider/color edits may use a 220 ms debounced persistence path. Writes are serialized through a promise queue, preventing overlapping `saveData()` calls from racing each other. Immediate actions flush pending debounce state first.

The source distribution contains no production `data.json`, which prevents an update copy from replacing vault-specific user data.

## Theme integration

Plugin UI tokens prefer Obsidian variables such as `--background-primary`, `--text-normal`, `--background-modifier-border`, and `--interactive-accent`, with explicit fallbacks. This keeps the interface consistent with custom themes without coupling the paper overlay itself to theme-specific compositor behavior.

## Mobile and iPad policy

Runtime `src/` contains no `fs`, `path`, `electron`, `node:*`, or other desktop-only imports. Platform detection uses Obsidian `Platform`.

Compact mode provides:

- Visual Viewport-aware location and available-height calculations;
- safe-area bottom inset support;
- 42–44 px touch-oriented controls;
- a bounded panel that opens upward or downward according to the available VisualViewport space;
- no hover dependency for core actions;
- no backdrop filter in compact mode;
- reduced-motion compliance.

## Diagnostics

Diagnostics intentionally report only plugin state, vault-relative drawing paths, attachment state, theme, paper mode and Excalidraw transform values. They do not intentionally include an absolute vault path.

## Custom select / dropdown model

`SelectField` renders a button-triggered ARIA listbox instead of a native `<select>`. Position is fixed and recomputed from the trigger rectangle on open, scroll, resize and Visual Viewport changes. The menu chooses an upward or downward direction based on available space. Floating-control selects portal into the owning plugin control root, while settings-tab selects can portal to the document body.

Keyboard contract: Arrow Up/Down changes the active option, Home/End jumps, Enter/Space commits, Escape closes only the listbox first, and Tab dismisses without trapping focus. Coarse-pointer options are at least 44 px high.

## Defaults reset semantics

`SettingsStore.resetToDefaults(filePath?)` is intentionally non-destructive:

- with an active drawing override, the complete local `GuideSettings` snapshot is restored from `DEFAULT_GUIDE_SETTINGS` and the override stays enabled;
- without a local override, global paper/interface defaults are restored;
- saved profiles and unrelated drawing overrides are preserved;
- opacity, line thickness, margin position and margin thickness are therefore guaranteed to reset with the rest of guide geometry.

`SettingsStore.reset()` remains the separate destructive full-data reset used by the confirmation-gated settings action.

## Icon compatibility

Grid mode requests Obsidian/Lucide `grid-2x2`. `ObsidianIcon` verifies that the host actually inserted an SVG; if not, it renders a local current-color SVG fallback. Missing optional icons therefore cannot leave an empty toolbar slot.

## v1.4.4 scrollbar implementation

The panel and custom listbox deliberately do not use `scrollbar-width: thin`. Chromium/Electron versions that honor the standardized property can let it override `::-webkit-scrollbar` geometry and reintroduce platform/theme arrow controls. Nyra therefore leaves the standardized properties at `auto`, defines a 4 px WebKit rail, creates the visible 2 px thumb with a 1 px transparent border, and explicitly removes every known scrollbar-button direction/state. Thumb colors are derived from `--interactive-accent` with light/dark purple fallbacks and separate hover/active opacity.

## v1.4.5 object-aware rendering

`GuideOverlayRenderer` keeps two rendering paths:

1. **CSS fast path** — ruled/grid/dot backgrounds and margin rendered by CSS.
2. **Object-aware canvas path** — activated only when `hideUnderObjects` is enabled and `getSceneElements()` is available.

The canvas draws the same paper geometry, then removes covered guide pixels with `destination-out` for image/embed rectangles and filled Excalidraw shapes. Scene coordinates are transformed with Excalidraw zoom/scroll and local viewport offsets. The backing bitmap is capped at 2x device pixel ratio.

The new setting defaults to `false`, so existing drawings keep the v1.4.4 rendering behavior until users opt in.

## v1.4.7 persistent dock and mobile input hardening

### Persistent dock geometry

`NyraSettings.dockPositions` stores normalized `{x,y}` coordinates for desktop and compact layouts. `src/ui/dockGeometry.ts` is the single pure conversion layer between normalized coordinates and pixel geometry. The lifecycle manager and drag hook share the same layout edge margins, avoiding release-time position jumps.

The drag hook updates portal `left/top` directly during an active pointer capture for low-latency movement and persists one normalized coordinate at the end of the drag. `ViewAttachmentManager` skips positioning while `data-dock-dragging=true`, then resumes from persisted state. A compact default of `x=1, y=0.12` avoids the native Excalidraw bottom toolbar on first migration.

The settings subscription tracks a small dock-geometry signature (`dockCollapsed` plus both stored positions). Only changes to that signature trigger portal repositioning; ordinary opacity/thickness/color changes keep the cheaper render-only path.

### Mobile fixed-surface model

The compact control root intentionally has no CSS transform. The notebook panel and custom listbox are `position: fixed` surfaces with explicit VisualViewport-aware coordinates. This prevents WebKit/Chromium from treating a transformed plugin ancestor as the containing block for fixed descendants.

The panel is independently clamped to the visible Excalidraw/VisualViewport intersection, so a freely dragged dock can sit anywhere while the settings sheet still opens in the direction with more usable space.

### Touch-safe range controls

The native `<input type="range">` remains in the focus/accessibility tree and continues to provide keyboard value semantics, but it is pointer-transparent. The visible wrapper owns pointer input:

- mouse: immediate click/drag and programmatic focus of the native range;
- touch/pen: no value change until horizontal displacement exceeds the intent threshold and dominates vertical movement;
- vertical gesture: abandoned by the slider so native panel scrolling proceeds;
- active horizontal drag: pointer capture prevents gesture loss.

This deliberately favors accidental-change prevention over touch tap-to-jump behavior.

### Collapsed dock rendering

React does not create trigger text, chevron or quick-action nodes when `dockCollapsed` is true. CSS still contains defensive collapsed selectors, but correctness no longer depends on clipping or selector precedence.
