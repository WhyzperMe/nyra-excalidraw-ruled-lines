import {
  forwardRef,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { COLOR_SWATCHES, MARGIN_COLOR_SWATCHES, PAPER_MODES } from "../core/constants";
import { hexToRgba, normalizeHex } from "../core/color";
import { getPaperModeLabel, getSpacing, hasFileOverride, resolveGuideSettings } from "../core/settings";
import type { GuideSettings, PluginUiActions, ThemeMode } from "../core/types";
import type { SettingsStore } from "../core/SettingsStore";
import { useNyraSettings } from "./hooks/useNyraSettings";
import { usePersistentDockDrag } from "./hooks/usePersistentDockDrag";
import { DockDragHandle } from "./components/DockDragHandle";
import { IconButton } from "./components/IconButton";
import { ObsidianIcon } from "./components/ObsidianIcon";
import { PaperModeControl } from "./components/PaperModeControl";
import { PresetControl } from "./components/PresetControl";
import { RangeField } from "./components/RangeField";
import { SectionLabel } from "./components/SectionLabel";
import { SelectField } from "./components/SelectField";
import { ToggleField } from "./components/ToggleField";

export interface FloatingControlsHandle {
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

interface FloatingControlsProps {
  store: SettingsStore;
  actions: PluginUiActions;
  ownerDocument: Document;
  portalElement: HTMLElement;
  boundsElement: HTMLElement;
  theme: ThemeMode;
  filePath: string | null;
  onPanelStateChange(open: boolean): void;
}

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function getToolbarSummary(guide: GuideSettings): string {
  if (!guide.enabled) return "Paper off";
  if (guide.paperMode === "blank") return guide.marginEnabled ? "Blank · margin" : "Blank";
  return `${getPaperModeLabel(guide)} · ${Math.round(getSpacing(guide))} px`;
}

export const FloatingControls = forwardRef<FloatingControlsHandle, FloatingControlsProps>(
  function FloatingControls(
    { store, actions, ownerDocument, portalElement, boundsElement, theme, filePath, onPanelStateChange },
    ref,
  ) {
    const settings = useNyraSettings(store);
    const guide = resolveGuideSettings(settings, filePath);
    const panelId = useId();
    const panelTitleId = useId();
    const overridden = hasFileOverride(settings, filePath);
    const [open, setOpen] = useState(false);
    const [hexDraft, setHexDraft] = useState(guide.lineColor);
    const [profileChoice, setProfileChoice] = useState("");
    const dockDrag = usePersistentDockDrag({
      store,
      actions,
      portalElement,
      boundsElement,
      closePanel: () => setOpen(false),
    });

    useImperativeHandle(
      ref,
      () => ({
        close: () => setOpen(false),
        toggle: () => setOpen((value) => !value),
        isOpen: () => open,
      }),
      [open],
    );

    useEffect(() => {
      setHexDraft(guide.lineColor);
    }, [guide.lineColor]);

    useEffect(() => {
      onPanelStateChange(open);
    }, [onPanelStateChange, open]);

    useEffect(() => {
      portalElement.dataset.dockVisibility = settings.dockVisibility;
      portalElement.dataset.dockCollapsed = settings.dockCollapsed ? "true" : "false";
    }, [portalElement, settings.dockCollapsed, settings.dockVisibility]);

    useEffect(() => {
      if (!open) return undefined;

      const handlePointerDown = (event: PointerEvent): void => {
        const target = event.target;
        if (
          target &&
          typeof (target as Node).nodeType === "number" &&
          !portalElement.contains(target as Node)
        ) {
          setOpen(false);
        }
      };
      const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") setOpen(false);
      };

      ownerDocument.addEventListener("pointerdown", handlePointerDown, true);
      ownerDocument.addEventListener("keydown", handleKeyDown);
      return () => {
        ownerDocument.removeEventListener("pointerdown", handlePointerDown, true);
        ownerDocument.removeEventListener("keydown", handleKeyDown);
      };
    }, [open, ownerDocument, portalElement]);

    const previewColor = useMemo(
      () =>
        hexToRgba(
          guide.lineColor,
          Math.min(guide.opacity, guide.protectInk ? (theme === "dark" ? 0.28 : 0.24) : 1),
        ),
      [guide.lineColor, guide.opacity, guide.protectInk, theme],
    );
    const marginPreviewColor = useMemo(
      () =>
        hexToRgba(
          guide.marginColor,
          Math.min(guide.opacity, guide.protectInk ? (theme === "dark" ? 0.28 : 0.24) : 1),
        ),
      [guide.marginColor, guide.opacity, guide.protectInk, theme],
    );
    const hexValid = HEX_PATTERN.test(hexDraft.trim());

    const patchGuide = (
      patch: Parameters<PluginUiActions["patchGuideSettings"]>[1],
      mode?: Parameters<PluginUiActions["patchGuideSettings"]>[2],
    ): void => {
      void actions.patchGuideSettings(filePath, patch, mode);
    };

    const commitHex = (): void => {
      const normalized = normalizeHex(hexDraft, guide.lineColor);
      setHexDraft(normalized);
      patchGuide({ lineColor: normalized });
    };

    const profileOptions = [
      { value: "", label: settings.profiles.length ? "Apply a saved profile…" : "No saved profiles" },
      ...settings.profiles.map((profile) => ({ value: profile.id, label: profile.name })),
    ];

    return (
      <>
        <div className="nyra-ruled-lines-toolbar" role="toolbar" aria-label="Notebook paper controls">
          <DockDragHandle {...dockDrag} />

          <button
            type="button"
            className="nyra-ruled-trigger"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-label={`${getPaperModeLabel(guide)} paper controls`}
            onClick={() => setOpen((value) => !value)}
          >
            <ObsidianIcon name={PAPER_MODES[guide.paperMode].icon} className="nyra-ruled-trigger-icon" />
            {!settings.dockCollapsed ? (
              <>
                <span className="nyra-ruled-trigger-text nyra-summary-full">{getToolbarSummary(guide)}</span>
                <span className="nyra-ruled-trigger-text nyra-summary-compact">
                  {guide.enabled
                    ? guide.paperMode === "blank"
                      ? "Blank"
                      : `${getPaperModeLabel(guide)} ${Math.round(getSpacing(guide))}`
                    : "Off"}
                </span>
                <ObsidianIcon name="chevron-down" className="nyra-ruled-trigger-chevron" />
              </>
            ) : null}
          </button>

          {!settings.dockCollapsed ? (
            <span className="nyra-toolbar-quick-actions">
              <IconButton
                icon={guide.enabled ? "eye" : "eye-off"}
                label="Toggle paper guides"
                className="nyra-quick-toggle"
                active={guide.enabled}
                aria-pressed={guide.enabled}
                onClick={() => void actions.toggleEnabled(filePath)}
              />
              <IconButton
                icon="rotate-cw"
                className="nyra-quick-cycle"
                label={
                  guide.paperMode === "blank"
                    ? "Spacing is unavailable for blank paper"
                    : "Cycle spacing preset"
                }
                disabled={guide.paperMode === "blank"}
                onClick={() => void actions.cyclePreset(filePath)}
              />
            </span>
          ) : null}

          <IconButton
            icon={settings.dockCollapsed ? "maximize-2" : "minimize-2"}
            label={settings.dockCollapsed ? "Expand control dock" : "Collapse control dock"}
            className="nyra-dock-collapse-button"
            onClick={() => void actions.patchSettings({ dockCollapsed: !settings.dockCollapsed })}
          />
        </div>

        {open ? (
          <div id={panelId} className="nyra-ruled-panel is-open" role="dialog" aria-labelledby={panelTitleId}>
            <div className="nyra-ruled-panel-header">
              <div className="nyra-ruled-panel-heading">
                <div id={panelTitleId} className="nyra-ruled-panel-title">
                  Notebook paper
                </div>
                <div className="nyra-ruled-panel-subtitle">
                  Non-destructive visual guides. The Excalidraw file stays untouched.
                </div>
              </div>
              <IconButton icon="x" label="Close notebook paper controls" onClick={() => setOpen(false)} />
            </div>

            <div className={`nyra-scope-card${overridden ? " is-local" : ""}`}>
              <div className="nyra-scope-copy">
                <span className="nyra-ruled-field-title">
                  {overridden ? "Drawing override" : "Global defaults"}
                </span>
                <span className="nyra-ruled-field-hint">
                  {overridden
                    ? "Changes in this panel apply only to this drawing."
                    : "Changes in this panel update the defaults used by drawings without an override."}
                </span>
              </div>
              <span className="nyra-scope-badge">{overridden ? "Local" : "Global"}</span>
            </div>

            <ToggleField
              label="Override this drawing"
              hint={
                filePath
                  ? "Keep this drawing independent from global paper defaults."
                  : "No drawing file is available."
              }
              checked={overridden}
              disabled={!filePath}
              onChange={(enabled) => {
                if (filePath) void actions.setFileOverride(filePath, enabled);
              }}
            />

            {settings.profiles.length > 0 ? (
              <SelectField
                portalRoot={portalElement}
                label="Saved profile"
                hint="Applying a profile creates or replaces this drawing's local override."
                value={profileChoice}
                options={profileOptions}
                disabled={!filePath}
                onChange={(profileId) => {
                  setProfileChoice("");
                  if (filePath && profileId) void actions.applyProfileToDrawing(filePath, profileId);
                }}
              />
            ) : null}

            <SectionLabel>Paper</SectionLabel>
            <ToggleField
              label="Show paper guides"
              hint="Turn all notebook guides on or off without changing their configuration."
              checked={guide.enabled}
              onChange={(enabled) => patchGuide({ enabled })}
            />
            <PaperModeControl value={guide.paperMode} onChange={(paperMode) => patchGuide({ paperMode })} />

            {guide.paperMode !== "blank" ? (
              <>
                <SectionLabel>Spacing</SectionLabel>
                <PresetControl
                  value={guide.preset}
                  onChange={(preset) => void actions.setPreset(preset, filePath)}
                />
                <RangeField
                  label="Vertical spacing"
                  hint={
                    guide.preset === "custom"
                      ? "Exact vertical spacing at 100% zoom."
                      : "Select Custom to edit this value."
                  }
                  value={guide.customSpacing}
                  min={12}
                  max={96}
                  step={1}
                  suffix="px"
                  disabled={guide.preset !== "custom"}
                  onChange={(customSpacing) => patchGuide({ customSpacing }, "debounced")}
                />

                {guide.paperMode === "grid" || guide.paperMode === "dots" ? (
                  <>
                    <ToggleField
                      label="Link horizontal and vertical spacing"
                      hint="Use the vertical spacing for both axes."
                      checked={guide.linkGridSpacing}
                      onChange={(linkGridSpacing) => patchGuide({ linkGridSpacing })}
                    />
                    <RangeField
                      label="Horizontal spacing"
                      hint="Independent horizontal spacing at 100% zoom."
                      value={guide.gridSpacingX}
                      min={12}
                      max={96}
                      step={1}
                      suffix="px"
                      disabled={guide.linkGridSpacing}
                      onChange={(gridSpacingX) => patchGuide({ gridSpacingX }, "debounced")}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            {guide.paperMode !== "blank" ? (
              <>
                <SectionLabel>Appearance</SectionLabel>
                <div className="nyra-ruled-appearance-card">
                  <div className="nyra-ruled-color-row">
                    <div className="nyra-ruled-field-copy">
                      <span className="nyra-ruled-field-title">Guide color</span>
                      <span className="nyra-ruled-field-hint">
                        One stable color in light and dark themes.
                      </span>
                    </div>
                    <label className="nyra-ruled-native-color" title="Pick guide color">
                      <span className="nyra-ruled-color-preview" style={{ background: guide.lineColor }} />
                      <input
                        type="color"
                        value={guide.lineColor}
                        aria-label="Guide color"
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          patchGuide({ lineColor: event.currentTarget.value }, "debounced")
                        }
                      />
                    </label>
                  </div>

                  <div className="nyra-ruled-color-editor">
                    <input
                      type="text"
                      inputMode="text"
                      maxLength={7}
                      className={`nyra-ruled-hex-input${hexDraft && !hexValid ? " is-invalid" : ""}`}
                      value={hexDraft}
                      aria-label="Hex guide color"
                      spellCheck={false}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setHexDraft(event.currentTarget.value)
                      }
                      onBlur={commitHex}
                      onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitHex();
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <IconButton
                      icon="rotate-ccw"
                      label="Reset guide color"
                      className="nyra-ruled-reset-color"
                      onClick={() => void actions.resetLineColor(filePath)}
                    />
                  </div>

                  <div className="nyra-ruled-swatches" aria-label="Guide color presets">
                    {COLOR_SWATCHES.map((swatch) => (
                      <button
                        type="button"
                        key={swatch.value}
                        className={`nyra-ruled-swatch${guide.lineColor === swatch.value ? " is-selected" : ""}`}
                        style={{ "--swatch-color": swatch.value } as CSSProperties}
                        title={swatch.label}
                        aria-label={`${swatch.label} guide color`}
                        aria-pressed={guide.lineColor === swatch.value}
                        onClick={() => patchGuide({ lineColor: swatch.value })}
                      />
                    ))}
                  </div>

                  <div
                    className="nyra-ruled-preview"
                    data-theme={theme}
                    data-paper-mode={guide.paperMode}
                    data-margin-enabled={guide.marginEnabled ? "true" : "false"}
                    aria-hidden="true"
                    style={
                      {
                        "--preview-color": previewColor,
                        "--preview-margin-color": marginPreviewColor,
                        "--preview-thickness": `${guide.lineThickness}px`,
                        "--preview-dot-size": `${guide.dotSize}px`,
                        "--preview-margin-x": `${Math.max(0, Math.min(100, guide.marginOffset / 3.2))}%`,
                        "--preview-margin-thickness": `${guide.marginThickness}px`,
                      } as CSSProperties
                    }
                  >
                    <span>Preview</span>
                  </div>
                </div>

                <div className="nyra-ruled-slider-grid">
                  <RangeField
                    compact
                    label="Opacity"
                    value={Math.round(guide.opacity * 100)}
                    min={5}
                    max={100}
                    step={5}
                    suffix="%"
                    onChange={(value) => patchGuide({ opacity: value / 100 }, "debounced")}
                  />
                  {guide.paperMode === "dots" ? (
                    <RangeField
                      compact
                      label="Dot size"
                      value={guide.dotSize}
                      min={0.75}
                      max={5}
                      step={0.25}
                      suffix="px"
                      onChange={(dotSize) => patchGuide({ dotSize }, "debounced")}
                    />
                  ) : (
                    <RangeField
                      compact
                      label="Thickness"
                      value={guide.lineThickness}
                      min={0.5}
                      max={4}
                      step={0.25}
                      suffix="px"
                      onChange={(lineThickness) => patchGuide({ lineThickness }, "debounced")}
                    />
                  )}
                </div>
              </>
            ) : null}

            <SectionLabel>Margin</SectionLabel>
            <ToggleField
              label="Show left margin"
              hint="Add a single notebook margin line without modifying the drawing."
              checked={guide.marginEnabled}
              onChange={(marginEnabled) => patchGuide({ marginEnabled })}
            />
            {guide.marginEnabled ? (
              <>
                <RangeField
                  label="Margin position"
                  hint="Distance from the paper origin at 100% zoom."
                  value={guide.marginOffset}
                  min={0}
                  max={320}
                  step={2}
                  suffix="px"
                  onChange={(marginOffset) => patchGuide({ marginOffset }, "debounced")}
                />
                <div className="nyra-margin-inline-grid">
                  <label className="nyra-inline-color-field">
                    <span className="nyra-ruled-field-title">Margin color</span>
                    <input
                      type="color"
                      value={guide.marginColor}
                      aria-label="Margin color"
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        patchGuide({ marginColor: event.currentTarget.value }, "debounced")
                      }
                    />
                  </label>
                  <RangeField
                    compact
                    label="Margin thickness"
                    value={guide.marginThickness}
                    min={0.5}
                    max={4}
                    step={0.25}
                    suffix="px"
                    onChange={(marginThickness) => patchGuide({ marginThickness }, "debounced")}
                  />
                </div>
                <div className="nyra-ruled-swatches nyra-margin-swatches" aria-label="Margin color presets">
                  {MARGIN_COLOR_SWATCHES.map((swatch) => (
                    <button
                      type="button"
                      key={swatch.value}
                      className={`nyra-ruled-swatch${guide.marginColor === swatch.value ? " is-selected" : ""}`}
                      style={{ "--swatch-color": swatch.value } as CSSProperties}
                      title={swatch.label}
                      aria-label={`${swatch.label} margin color`}
                      aria-pressed={guide.marginColor === swatch.value}
                      onClick={() => patchGuide({ marginColor: swatch.value })}
                    />
                  ))}
                </div>
              </>
            ) : null}

            <SectionLabel>Readability</SectionLabel>
            <ToggleField
              label="Protect handwriting & shapes"
              hint="Caps guide opacity instead of using blend modes, avoiding compositor black-screen failures."
              checked={guide.protectInk}
              onChange={(protectInk) => patchGuide({ protectInk })}
            />
            <ToggleField
              label="Hide guides under objects"
              hint="Masks guides beneath images and filled shapes so paper lines remain visible only on uncovered canvas areas."
              checked={guide.hideUnderObjects}
              onChange={(hideUnderObjects) => patchGuide({ hideUnderObjects })}
            />

            <SectionLabel>Behavior</SectionLabel>
            <ToggleField
              label="Follow canvas pan & zoom"
              hint="Anchor paper coordinates to the Excalidraw scene. Turn off for viewport-fixed guides."
              checked={guide.followCanvas}
              onChange={(followCanvas) => patchGuide({ followCanvas })}
            />

            <SelectField
              portalRoot={portalElement}
              label="Control dock visibility"
              hint="Choose when the dock is shown. Drag its grip to place it; the position persists across drawings and restarts."
              value={settings.dockVisibility}
              options={[
                { value: "always", label: "Always visible" },
                { value: "auto", label: "Auto fade" },
                { value: "active", label: "Active drawing only" },
              ]}
              onChange={(dockVisibility) =>
                void actions.patchSettings({ dockVisibility: dockVisibility as "always" | "auto" | "active" })
              }
            />
            <ToggleField
              label="Collapse control dock"
              hint="Keep only the paper trigger and expand button visible."
              checked={settings.dockCollapsed}
              onChange={(dockCollapsed) => void actions.patchSettings({ dockCollapsed })}
            />

            <div className="nyra-ruled-panel-footer">
              <button
                type="button"
                className="nyra-ruled-text-button"
                title={
                  overridden
                    ? "Reset this drawing's paper settings and shared interface behavior to factory defaults. The drawing override remains enabled."
                    : "Reset global paper and interface settings to factory defaults. Saved profiles and drawing overrides are preserved."
                }
                onClick={() => void actions.resetToDefaults(filePath)}
              >
                <ObsidianIcon name="rotate-ccw" className="nyra-button-icon" />
                Reset to defaults
              </button>
              <button
                type="button"
                className="nyra-ruled-text-button is-primary"
                onClick={() => actions.openPluginSettings()}
              >
                Plugin settings
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  },
);
