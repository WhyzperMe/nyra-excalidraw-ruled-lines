# Changelog

## 1.4.8

### Design and iPad polish

- Buttons no longer show Obsidian's own input shadow under the plugin's custom controls (it appeared as a doubled bottom edge on segmented controls, the close button and the dock buttons).
- The compact (touch) dock now always uses the short paper summary ("Ruled 34"). On a wide iPad the long text used to be cut to "Ruled …".
- Selects in the floating panel stack under their label so the chosen value (for example a profile name) is no longer truncated.
- Animations respect `prefers-reduced-motion`.

### Quality and project

- Fixed all lint errors (control-character regex, unused imports/variables, a bare ternary statement); `npm run check` and `npm run build` pass with zero warnings.
- Applied Prettier across the project and enforce it in CI.
- Added `npm run ui:preview`, which renders the dock, panel and settings screen with sample data in headless Chrome (desktop, iPad, light and dark) for design review.
- Added a release workflow that builds and publishes `main.js`, `manifest.json` and `styles.css` for a version tag, Dependabot configuration, a licence and screenshots.
- Removed generated audit stubs and status files that described a build environment instead of the project.

## 1.4.7

### Dock polish

- Rebalanced the collapsed dock into three equal visual cells (drag grip, paper trigger, expand button) with deterministic gaps and padding.
- Increased collapsed compact width to match real touch targets instead of squeezing controls into a narrower root.
- Slightly widened the desktop drag affordance for better visual balance without changing drag behavior.
- Added dedicated coarse-pointer collapsed sizing so mobile retains symmetric, reliable touch targets.

### Stability

- Fixed the open notebook panel shifting horizontally when the dock is collapsed or expanded. Panel placement now derives directly from the persisted normalized dock position and panel width, independent of the current dock width.
- Added a geometry unit regression test and static verification guards for stable panel placement and collapsed-dock sizing.
- No settings schema, plugin ID, command IDs, saved profiles, per-drawing overrides, or guide rendering behavior changed.

## 1.4.6

- Added a draggable dock grip on desktop and mobile.
- Persist dock location globally across drawings and restarts using normalized desktop/compact coordinates.
- Moved the compact default away from Excalidraw's bottom toolbar.
- Fixed collapsed-dock label leakage by not rendering hidden trigger text/quick actions.
- Fixed mobile custom dropdown positioning by removing the transformed fixed-position ancestor and using explicit VisualViewport-aware panel geometry.
- Hardened range controls: pointer input is owned by the custom control, vertical touch/pen gestures remain scroll gestures, and only clear horizontal drag intent changes values.
- Added shared/testable dock geometry helpers and dock-position migration/sanitization.
- Reposition all open docks immediately when persistent geometry/collapse state changes without adding layout work to normal guide sliders.
- Settings schema upgraded to 5; migration is additive and backward compatible.

## 1.4.5

### Added

- Added an opt-in **Hide guides under objects** readability setting for global defaults and per-drawing overrides.
- Added scene-element access through the Excalidraw adapter and an object-aware transparent canvas renderer.
- Images, embeds, iframes and opaque filled shapes now occlude guides when the new option is enabled. Rotated rectangles/images, diamonds and ellipses are handled geometrically.
- Added object-occlusion unit coverage and static architecture guards.

### Mobile / responsive

- Added a narrow-phone toolbar density below 420 px with a compact label and reduced chrome.
- The redundant quick spacing action is hidden below 340 px while remaining available in the panel.
- The paper icon is hidden only at extremely narrow widths below 285 px to avoid clipping.
- Compact panels now use tighter cards, visual-viewport-safe height and safe-area-aware sizing.

### Performance / hardening

- Existing CSS backgrounds remain the default fast path; canvas rendering is used only when object-aware masking is enabled and supported.
- Canvas backing resolution is capped at 2x DPR to limit memory and redraw cost on high-density phones and tablets.
- Dot-paper canvas drawing uses a repeated tile pattern instead of thousands of per-dot draw calls.
- Scene signatures use a compact hash rather than a large concatenated string.
- Removed a duplicate scroll-listener cleanup call in the view lifecycle.
- Settings schema advanced to 4 while keeping the new visual behavior opt-in for backward compatibility.

## 1.4.4

### UI / scrollbar polish

- Reworked the notebook-panel scrollbar into a 4 px interaction rail with an approximately 2 px visible rounded thumb.
- Scrollbar color now follows Nyra/Obsidian's purple accent family with dedicated normal, hover and active tokens in both light and dark themes.
- Explicitly suppresses every Chromium/Electron WebKit scrollbar-button variant (single button, vertical/horizontal increment and decrement), removing the top/bottom arrow controls even when a theme tries to restore them.
- Standard `scrollbar-width` / `scrollbar-color` are kept at `auto` inside Nyra scroll regions so recent Chromium builds do not override the exact WebKit geometry with a native `thin` scrollbar.
- The custom dropdown/listbox scrollbar now uses the same compact accent treatment and the same arrow-button hardening.
- Hardened custom-select geometry for extremely narrow split panes and reduced Visual Viewports: menu width now never exceeds the available viewport width, and max-height no longer imposes a 96 px minimum that could overflow tiny viewports.

### Audit / regression protection

- Static verification now requires the 4 px panel geometry, accent-derived scrollbar tokens, active state, standards-property neutralization and explicit arrow suppression.
- Fixed the release versioning hook: `npm version` now treats `package.json` as the new-version source and synchronizes `manifest.json`, `versions.json` and `src/core/constants.ts` instead of accidentally restoring the old manifest version.
- No settings schema, plugin ID, command ID, profile, override or rendering behavior changed in this release.

## 1.4.3

### UI / UX

- Replaced the native HTML select used by the floating panel and settings screen with a custom React listbox/popover. It matches the plugin surface, supports keyboard navigation, escape handling, active/selected states, viewport collision handling, touch targets and popout-document positioning.
- Floating-panel dropdowns portal into the plugin control root so selecting an option cannot be misinterpreted as an outside click that closes the whole paper panel.
- Reduced the panel scrollbar to a 6 px interaction rail with a 2 px visual thumb, rounded ends, transparent track and compact popover scrollbar treatment.
- Replaced the floating-panel **Copy diagnostics** action with **Reset to defaults**. The reset restores paper geometry/appearance (including opacity, line thickness, margin position and margin thickness) plus interface defaults while preserving saved profiles and unrelated drawing overrides.
- Grid mode now uses the broadly compatible `grid-2x2` Lucide/Obsidian icon identifier and includes a deterministic inline SVG fallback if an app version does not expose that icon.

### Reliability / accessibility

- Escape handling now lets nested custom popovers close themselves before the parent paper dialog closes.
- Custom select positioning reacts to panel/document scroll, window resize and Visual Viewport changes and chooses upward/downward placement based on available space.
- Custom selects use labelled button/listbox semantics, `aria-activedescendant`, selected-state announcements and 44 px coarse-pointer options.
- Added reset regression tests covering opacity, thickness, margin position/thickness, dock defaults, profile preservation and local-override preservation.
- Static verification now rejects native-select regressions and checks the custom listbox, safe reset flow, Grid fallback and slim scrollbar invariants.

### Compatibility

- Plugin ID, settings schema and legacy command IDs are unchanged.
- Existing `data.json`, profiles and drawing overrides migrate without conversion.
- Copy diagnostics remains available from the command palette and plugin settings page.

## 1.4.2

### Fixed

- Fixed `TS2339` in `ViewAttachmentManager`: code no longer accesses the undocumented `WorkspaceLeaf.containerEl`; active-leaf matching is based on `WorkspaceLeaf.view.containerEl` and the nearest `.workspace-leaf` element.
- Active/root visibility checks now account for the containing workspace leaf and work across separate DOM realms/popout windows without `instanceof HTMLElement`.
- File/folder override moves now preserve the renamed source override deterministically even if stale data already exists at the target path.
- Vault rename/delete handling always schedules lifecycle reconciliation so open views immediately resolve the correct override path.
- Unload persistence failures are caught and logged instead of surfacing as unhandled promise rejections.

### Performance / lifecycle

- Reconciliation and animation now use the relevant owner window, improving popout-window behavior and requestAnimationFrame cancellation.
- Store updates use renderer caches instead of force-writing every overlay property.
- Scrolling Nyra's own settings sheet no longer triggers redundant portal positioning through a capture-phase window scroll listener.
- The Excalidraw root receives a positioning fallback only when its computed position is actually `static`.
- The floating settings panel is lazy-mounted only while open, reducing idle React/DOM cost when several drawings are open.
- Outside-click/escape document listeners are registered only while a panel is open, and opening one drawing panel closes panels in other split panes.

### UX / mobile / accessibility

- Added two-step confirmation for profile deletion and full plugin-data reset.
- Added profile-limit feedback and guarded profile creation at the configured maximum.
- Blank paper summaries no longer advertise irrelevant spacing; the quick spacing action is disabled in Blank mode.
- Added dedicated margin color presets and corrected the preview margin position/thickness.
- Added panel/dialog ID wiring and labelled dialog semantics.
- Compact/mobile panels keep the close header reachable while scrolling.
- Coarse-pointer editable controls use a 16 px font and larger touch targets to avoid iOS/WebKit focus zoom.
- Added safe CSS fallbacks before `color-mix()` declarations.

### Validation

- Static architecture verifier expanded to reject future `activeLeaf.containerEl` regressions and require conditional host positioning.
- TypeScript/TSX syntax transpilation passes across runtime and tests.
- Full dependency-backed `npm run typecheck`/build still requires a machine with the npm dependencies installed; the artifact environment could not reach the npm registry.

## 1.4.1

### Hardening

- Native Obsidian menus, prompts, suggestions and modals are now tracked even when an existing native UI element changes only through `class`, `style`, `hidden` or `aria-hidden` instead of being inserted/removed.
- Native UI attribute observation is intentionally scoped only to native UI nodes, avoiding expensive subtree-wide attribute observation while Excalidraw is drawing.
- App/document visibility and `pageshow` transitions now trigger lifecycle reconciliation so overlays and controls recover cleanly after mobile backgrounding, iPad app switching and page restoration.
- Coarse-pointer controls use `touch-action: manipulation` and remove tap highlight artifacts while preserving native slider/select gestures.
- Compact panels opt into momentum scrolling on WebKit/iOS.

### Validation

- Static architecture guard remains green.
- TypeScript/TSX syntax transpilation validation passes across runtime and tests.
- Runtime package installation/build could not be executed in the artifact environment because the npm registry was unavailable.

## 1.4.0

### Added

- Ruled, grid, dot-grid and blank paper modes.
- Linked/unlinked horizontal grid spacing.
- Optional independent notebook margin line.
- Per-drawing settings overrides stored in plugin data.
- Named paper profiles.
- Responsive compact/mobile dock and upward settings sheet.
- Dock visibility and collapsed modes.
- Copyable runtime diagnostics.
- Native Obsidian menu/modal guard.
- Tests for settings migration, store behavior and rendering geometry.

### Changed

- Reworked lifecycle into explicit attachment states with event-driven reconciliation.
- Reduced runtime work by eliminating periodic polling and limiting RAF to visible scene-following overlays.
- Mobile paper transform loop is rate-limited to approximately 30 fps.
- Settings persistence is centralized and serialized through `SettingsStore`.
- UI remains React-based while rendering remains imperative DOM/CSS.
- UI design tokens prefer Obsidian theme variables with safe fallbacks for custom-theme integration.

### Fixed

- Preserved the v1.3.x black-surface fix by excluding unsafe compositor blend modes and stacking-context isolation.
- Prevented the plugin dock from blocking native Obsidian menus/dropdowns.
- Added orphan overlay/portal cleanup during lifecycle acquisition.
- Handles file/folder rename and delete events for per-drawing override keys.
- Profile sanitizer skips malformed entries instead of aborting later valid profile migration.
- Hex editing accepts both three- and six-digit CSS hex input.
- Compact dock does not force a minimum width that can overflow an extremely narrow split pane.

### Compatibility

- Plugin ID unchanged.
- Legacy command IDs unchanged.
- Existing v1.3.x flat settings remain accepted.
- New visual features default to legacy ruled-paper behavior.
