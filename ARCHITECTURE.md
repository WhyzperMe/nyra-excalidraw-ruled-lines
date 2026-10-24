# Architecture — v1.4.7

## Design goals

Nyra keeps Excalidraw content untouched. Paper is a visual overlay, plugin configuration lives in Obsidian plugin data, and the React UI is isolated from the high-frequency canvas transform path.

## Layers

```text
Obsidian plugin lifecycle / commands
              │
              ▼
      SettingsStore (schema 5)
        │              │
        │              └─────────────┐
        ▼                            ▼
ViewAttachmentManager          React UI hosts
        │                       /         \
        │             FloatingControls  SettingsScreen
        │                       │
        │                 dock drag/select/ranges
        ▼
GuideOverlayRenderer
  ├─ CSS fast path
  └─ ObjectOcclusionCanvas (opt-in)
```

### `core/`

Owns domain types, sanitization/migration, defaults, profiles/overrides and serialized settings. `dockPositions` stores normalized coordinates for `desktop` and `compact` layouts so the position remains meaningful across pane sizes and restarts.

### `excalidraw/`

Contains the narrow integration surface for Excalidraw view detection, app state, scene elements and theme/file metadata. Third-party assumptions stay out of UI and persistence code.

### `lifecycle/`

`ViewAttachmentManager` owns one attachment per live Excalidraw root. It attaches/detaches overlays, React portals and observers; computes the visible drawing/VisualViewport intersection; positions the dock/panel; and starts requestAnimationFrame only while a visible guide layer needs scene-following updates.

Dock geometry is only recomputed on settings changes when `dockCollapsed` or a persisted dock coordinate changes. Normal guide changes therefore avoid unnecessary portal layout work.

### `ui/`

React owns user interaction only. `dockGeometry.ts` contains pure normalized/pixel conversion helpers shared by the lifecycle manager and drag hook. `usePersistentDockDrag` owns the direct manipulation session and persists one normalized position on release. During a drag the manager deliberately yields live `left/top` ownership to the hook.

`SelectField` portals its custom listbox outside the scrollable panel. Floating controls portal the listbox into the plugin's body-level root; settings-tab selects can portal to the document body. Neither depends on a transformed ancestor.

`RangeField` separates pointer safety from keyboard semantics: the transparent native range remains in the accessibility/focus tree, but pointer events are handled by the custom wrapper. Touch/pen uses a horizontal-intent threshold so vertical panel navigation cannot accidentally mutate values.

### `rendering/`

The default renderer uses CSS gradients for minimal work. Optional object-aware mode renders to a transparent canvas and removes guide pixels under opaque scene objects with `destination-out`. Rendering does not modify Excalidraw elements.

## Mobile geometry invariants

- use `VisualViewport` when available;
- intersect the viewport with the actual Excalidraw root, not only the OS window;
- preserve an edge margin (`8px` compact, `12px` desktop);
- normalize stored dock coordinates into `[0,1]`;
- default compact dock away from the native bottom toolbar;
- panel/listbox use fixed viewport coordinates and are independently clamped;
- no transform on `.nyra-ruled-controls[data-layout="compact"]`, because transformed ancestors change fixed-descendant positioning semantics.

## Persistence invariants

- plugin ID remains stable;
- schema migration is sanitizing and additive;
- existing `data.json` is never shipped in the source distribution;
- debounced writes are serialized and revision-aware;
- dock position is global plugin UI state, not part of a drawing override or profile;
- desktop and compact placements are persisted separately.

## Safety / regression invariants

The static verifier rejects regressions including unsafe blend modes, extreme z-index, desktop-only runtime imports, interval polling, missing scrollbar guards, missing object-aware fallback, missing persistent dock state, compact-root transforms and touch sliders that expose native pointer handling.
