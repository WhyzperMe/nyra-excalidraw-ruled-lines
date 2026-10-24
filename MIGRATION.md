# Migration guide — existing installations to v1.4.8

The plugin ID is unchanged. Keep the existing vault plugin folder's `data.json` and replace only the generated runtime files after building v1.4.8.

## Data compatibility

v1.4.8 uses settings schema **5**. Older v1.3.x/v1.4.x settings are accepted and sanitized automatically.

New field:

```json
{
  "dockPositions": {
    "desktop": { "x": 1, "y": 0 },
    "compact": { "x": 1, "y": 0.12 }
  }
}
```

The field is additive. Existing users therefore receive a desktop top-right default and a compact/mobile position intentionally moved away from Excalidraw's bottom toolbar.

The coordinates are normalized instead of pixels so they survive:

- phone rotation;
- iPad Split View / Stage Manager;
- desktop pane resizing;
- Obsidian restart;
- switching between drawings.

Desktop and compact layouts store independent global positions. This prevents a phone placement from producing an unusable desktop placement while preserving the user's position across every drawing within that layout.

## Behavioral changes from 1.4.5

- Collapsed dock text/quick-action nodes are no longer rendered, eliminating clipped single-character leakage on narrow phones.
- A dedicated drag grip moves the dock. Arrow keys nudge it on desktop; Shift+Arrow uses a larger step; Home or double-click resets the active layout position.
- Floating panel geometry is fixed and VisualViewport-clamped so free dock placement does not break the panel.
- The compact root no longer uses `transform`, fixing fixed-position custom dropdowns on mobile browsers/WebViews.
- Range sliders no longer let the transparent native input own pointer gestures. Vertical touch/pen swipes scroll; intentional horizontal drag changes the value.

## No breaking changes

- existing command IDs remain;
- existing presets and guide defaults remain;
- per-drawing overrides/profiles remain compatible;
- `hideUnderObjects` remains opt-in;
- no drawing file content is modified.

## Update procedure

```bash
npm install
npm run check
npm run build
```

Copy `release/main.js`, `release/styles.css`, `release/manifest.json` and optionally `release/versions.json` into the existing plugin directory. Do not overwrite `data.json`.
