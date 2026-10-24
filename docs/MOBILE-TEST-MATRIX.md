# Mobile / tablet validation matrix

This checklist is the runtime gate for changes touching layout, lifecycle, touch input or rendering.

## Required devices / form factors

| Target                          | Minimum smoke coverage                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- |
| iPhone / narrow iOS             | portrait + landscape, software keyboard, context menu                         |
| iPad / iPadOS                   | portrait + landscape, split view, software keyboard, pencil/touch interaction |
| Android phone                   | portrait + landscape, system keyboard, context menu                           |
| Android tablet (when available) | split/narrow pane, touch controls                                             |
| Desktop                         | normal window, narrow split pane, popout window if supported                  |

## Rendering

- Open an Excalidraw drawing: ruled paper appears without changing drawing elements.
- Cycle Ruled → Grid → Dots → Blank.
- Enable the margin in every paper mode, including Blank.
- Pan and zoom: scene-following paper remains stable and aligned.
- Disable `Follow canvas pan & zoom`: paper becomes viewport anchored.
- Switch Excalidraw → Markdown → Excalidraw repeatedly: no black surface or stale overlay.
- Change light/dark theme while a drawing is open: overlay remains visible and safe.
- Minimize/background the app and return: guides resume without duplicate portals.

## Touch / compact UI

- All primary buttons are reachable with touch without hover.
- Compact dock stays within the visible Excalidraw pane.
- Panel opens in the usable direction (up or down) and stays within the Visual Viewport.
- Software keyboard does not permanently strand the panel offscreen.
- iOS home-indicator safe area does not overlap the dock.
- Scroll the long settings panel with one finger; canvas does not move underneath it.
- Open a native Obsidian menu/dropdown: Nyra controls yield and do not cover it.

## Profiles / per-drawing overrides

- Enable override for drawing A and change paper type.
- Open drawing B: global settings remain unchanged.
- Rename drawing A: override follows the new path.
- Rename its parent folder: override follows the folder move.
- Delete drawing/folder: matching override data is removed.
- Save a profile, apply globally, then apply a different profile to one drawing.

## Lifecycle / performance

- Open multiple drawings in split panes: one overlay/portal per live Excalidraw root.
- Close panes: stale overlay/portal disappears.
- Inactive/offscreen views do not continue visible control interaction.
- Blank paper + margin off stops scene-animation work.
- Disabling guides stops scene-animation work.

## Accessibility

- Keyboard focus is visible on desktop.
- Escape closes an open panel.
- Reduced-motion OS preference removes nonessential UI transitions.
- Labels/ARIA states reflect toggles, selected paper mode and selected swatches.

## v1.4.4 UI regression checks

- Open **Control dock visibility** on iPhone/iPad/Android and verify the custom listbox stays within the visual viewport and uses large touch rows.
- Scroll the paper panel while the dropdown is open; the dropdown must track its trigger without clipping through the panel.
- Press Escape with a dropdown open on desktop: first Escape closes the dropdown only; second Escape closes the paper panel.
- Switch to Grid and verify the toolbar trigger always shows a grid icon.
- Change opacity, thickness, margin position/thickness and dock behavior, then press **Reset to defaults** and verify each value returns to its factory default.
- With a drawing override enabled, Reset to defaults must retain the override while resetting its guide values. Saved profiles and other drawing overrides must remain intact.
- Verify the panel scrollbar is visually slim but normal touch/wheel scrolling remains effortless.

## v1.4.2 regression checks

- Focus every text/select control on iPhone/iPad: the page should not jump into a persistent focus zoom.
- Open the compact panel, scroll to the bottom, and verify the close/header control remains reachable.
- Delete a profile: the first tap only arms the action; deletion occurs only after the second confirmation tap.
- Reset plugin data: the first tap only arms the action; reset occurs only after the second confirmation tap.
- In Blank mode, verify the quick spacing-cycle control is disabled and the summary does not show an irrelevant spacing value.
- In an Obsidian popout window (where available), open a drawing and verify the dock, panel and scene-following overlay continue updating in that window.

### Scrollbar note

On desktop Chromium/Electron, verify that the paper panel shows only the slim purple thumb and no increment/decrement arrows. Mobile WebViews may use OS overlay scroll indicators instead; that is acceptable as long as scrolling stays native, smooth and unobstructed.

## v1.4.5 narrow-screen and object-aware checks

- 320–420 px viewport: dock stays completely inside the visible viewport, compact summary remains readable, no horizontal clipping.
- Below 340 px: spacing quick action disappears without removing spacing controls from the panel.
- Software keyboard / split view: panel remains within VisualViewport and scrollable; sticky close button remains reachable.
- Enable **Hide guides under objects** and verify guides disappear beneath images, solid rectangles, ellipses and diamonds.
- Rotate an image/filled shape and verify the mask rotates with it while panning/zooming.
- Disable object-aware mode and verify the renderer returns to the normal CSS guide path immediately.

## v1.4.6 persistent-dock / touch-input regression checks

- Collapse the dock on a narrow phone: no `R`, `Rows`, clipped label, chevron or quick-action text may leak beside the icons.
- Open **Control dock visibility** from the floating panel: its custom listbox must appear fully above the drawing/panel, accept touch, and stay inside VisualViewport.
- Put the phone in portrait and landscape; open the software keyboard; repeat the dropdown test.
- Fresh/migrated install: compact dock must not cover Excalidraw's bottom tool row by default.
- Drag the dock grip to top-left in drawing A. Open drawing B/C: the dock remains top-left. Restart Obsidian and reopen a drawing: placement persists.
- Resize a desktop split pane or rotate the phone after moving the dock: normalized placement should remain proportionally stable and clamped inside the drawing pane.
- Move the compact dock, then open desktop layout: desktop placement remains independently preserved; move desktop placement and return to compact: compact placement remains preserved.
- During drag, the dock must track the pointer without snapping/jitter from lifecycle reconciliation.
- With the settings panel open, begin a vertical scroll directly over **Opacity**, **Thickness**, **Margin position** and **Margin thickness**. None may change from vertical navigation.
- Intentionally drag those sliders horizontally on touch/pen; values must change smoothly.
- Desktop mouse click/drag and Tab + arrow-key range interaction must still work.
- Open a custom dropdown, then press Escape on desktop: first Escape closes the listbox; the panel remains until the next Escape.
