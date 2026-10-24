import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  useEffect,
  useState,
} from "react";
import { COLOR_SWATCHES, MARGIN_COLOR_SWATCHES, MAX_PROFILES, PLUGIN_VERSION } from "../core/constants";
import { getPaperModeLabel, getSpacing } from "../core/settings";
import type { GuideProfile, GuideSettings, PluginUiActions } from "../core/types";
import type { SettingsStore } from "../core/SettingsStore";
import { useNyraSettings } from "../ui/hooks/useNyraSettings";
import { PaperModeControl } from "../ui/components/PaperModeControl";
import { PresetControl } from "../ui/components/PresetControl";
import { RangeField } from "../ui/components/RangeField";
import { SelectField } from "../ui/components/SelectField";
import { ToggleField } from "../ui/components/ToggleField";
import { ConfirmActionButton } from "../ui/components/ConfirmActionButton";

interface SettingsScreenProps {
  store: SettingsStore;
  actions: PluginUiActions;
}

function getGuideSummary(guide: GuideSettings): string {
  if (guide.paperMode === "blank") return guide.marginEnabled ? "Blank · margin" : "Blank";
  return `${getPaperModeLabel(guide)} · ${Math.round(getSpacing(guide))} px${guide.marginEnabled ? " · margin" : ""}`;
}

function ProfileRow({ profile, actions }: { profile: GuideProfile; actions: PluginUiActions }): ReactElement {
  const [name, setName] = useState(profile.name);
  useEffect(() => setName(profile.name), [profile.name]);

  const commit = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(profile.name);
      return;
    }
    if (trimmed !== profile.name) void actions.renameProfile(profile.id, trimmed);
  };

  return (
    <div className="nyra-profile-row">
      <div className="nyra-profile-copy">
        <input
          type="text"
          maxLength={48}
          value={name}
          aria-label="Profile name"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
              event.currentTarget.blur();
            }
          }}
        />
        <span>{getGuideSummary(profile.guide)}</span>
      </div>
      <div className="nyra-profile-actions">
        <button type="button" onClick={() => void actions.applyProfileToGlobal(profile.id)}>
          Apply globally
        </button>
        <ConfirmActionButton
          className="mod-warning"
          label="Delete"
          confirmLabel="Confirm delete"
          onConfirm={() => actions.deleteProfile(profile.id)}
        />
      </div>
    </div>
  );
}

export function SettingsScreen({ store, actions }: SettingsScreenProps): ReactElement {
  const settings = useNyraSettings(store);
  const [profileName, setProfileName] = useState("");
  const overrideCount = Object.keys(settings.fileOverrides).length;
  const profileLimitReached = settings.profiles.length >= MAX_PROFILES;

  const saveProfile = async (): Promise<void> => {
    const name = profileName.trim();
    if (!name || profileLimitReached) return;
    const created = await actions.createProfile(name);
    if (created) setProfileName("");
  };

  return (
    <div className="nyra-settings-screen">
      <header className="nyra-settings-hero">
        <div>
          <div className="nyra-settings-title" role="heading" aria-level={2}>
            Nyra Excalidraw Ruled Lines
          </div>
          <p>
            Non-destructive ruled, grid and dot paper for Excalidraw. Rendering stays outside the drawing
            data, with per-drawing overrides stored only in plugin settings.
          </p>
        </div>
        <span className="nyra-settings-version">v{PLUGIN_VERSION}</span>
      </header>

      <section className="nyra-settings-card">
        <h3>Paper</h3>
        <ToggleField
          label="Enable paper guides"
          hint="Show the paper overlay in drawings that use global defaults."
          checked={settings.enabled}
          onChange={(enabled) => void actions.patchSettings({ enabled })}
        />

        <div className="nyra-settings-field nyra-settings-field-stacked">
          <div className="nyra-settings-copy">
            <strong>Paper type</strong>
            <span>Ruled, graph paper, dot grid or blank.</span>
          </div>
          <PaperModeControl
            value={settings.paperMode}
            onChange={(paperMode) => void actions.patchSettings({ paperMode })}
          />
        </div>

        {settings.paperMode !== "blank" ? (
          <>
            <div className="nyra-settings-field nyra-settings-field-stacked">
              <div className="nyra-settings-copy">
                <strong>Vertical spacing preset</strong>
                <span>Preserves the existing Compact, School, Wide and Custom workflow.</span>
              </div>
              <PresetControl value={settings.preset} onChange={(preset) => void actions.setPreset(preset)} />
            </div>

            <RangeField
              label="Custom vertical spacing"
              hint={settings.preset === "custom" ? "Exact spacing at 100% zoom." : "Select Custom to edit."}
              value={settings.customSpacing}
              min={12}
              max={96}
              step={1}
              suffix="px"
              disabled={settings.preset !== "custom"}
              onChange={(customSpacing) => void actions.patchSettings({ customSpacing }, "debounced")}
            />

            {settings.paperMode === "grid" || settings.paperMode === "dots" ? (
              <>
                <ToggleField
                  label="Link horizontal and vertical spacing"
                  hint="Keep both paper axes at the same spacing."
                  checked={settings.linkGridSpacing}
                  onChange={(linkGridSpacing) => void actions.patchSettings({ linkGridSpacing })}
                />
                <RangeField
                  label="Horizontal spacing"
                  hint="Used only when axis spacing is unlinked."
                  value={settings.gridSpacingX}
                  min={12}
                  max={96}
                  step={1}
                  suffix="px"
                  disabled={settings.linkGridSpacing}
                  onChange={(gridSpacingX) => void actions.patchSettings({ gridSpacingX }, "debounced")}
                />
              </>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="nyra-settings-card">
        <h3>Appearance</h3>
        {settings.paperMode !== "blank" ? (
          <>
            <div className="nyra-settings-field nyra-settings-color-field">
              <div className="nyra-settings-copy">
                <strong>Guide color</strong>
                <span>One stable color is used in light and dark Excalidraw themes.</span>
              </div>
              <input
                className="nyra-settings-color-picker"
                type="color"
                value={settings.lineColor}
                aria-label="Guide color"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  void actions.patchSettings({ lineColor: event.currentTarget.value }, "debounced")
                }
              />
            </div>

            <div className="nyra-settings-swatches" aria-label="Guide color presets">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  type="button"
                  key={swatch.value}
                  className={settings.lineColor === swatch.value ? "is-selected" : ""}
                  style={{ background: swatch.value }}
                  title={swatch.label}
                  aria-label={swatch.label}
                  aria-pressed={settings.lineColor === swatch.value}
                  onClick={() => void actions.patchSettings({ lineColor: swatch.value })}
                />
              ))}
            </div>

            <div className="nyra-settings-grid">
              <RangeField
                label="Opacity"
                value={Math.round(settings.opacity * 100)}
                min={5}
                max={100}
                step={5}
                suffix="%"
                onChange={(value) => void actions.patchSettings({ opacity: value / 100 }, "debounced")}
              />
              {settings.paperMode === "dots" ? (
                <RangeField
                  label="Dot size"
                  value={settings.dotSize}
                  min={0.75}
                  max={5}
                  step={0.25}
                  suffix="px"
                  onChange={(dotSize) => void actions.patchSettings({ dotSize }, "debounced")}
                />
              ) : (
                <RangeField
                  label="Line thickness"
                  value={settings.lineThickness}
                  min={0.5}
                  max={4}
                  step={0.25}
                  suffix="px"
                  onChange={(lineThickness) => void actions.patchSettings({ lineThickness }, "debounced")}
                />
              )}
            </div>
          </>
        ) : null}

        <ToggleField
          label="Protect handwriting & shapes"
          hint="Caps guide opacity instead of using GPU blend modes. This is the safe rendering path."
          checked={settings.protectInk}
          onChange={(protectInk) => void actions.patchSettings({ protectInk })}
        />
        <ToggleField
          label="Hide guides under objects"
          hint="Hide paper guides beneath images and filled shapes. This uses Excalidraw scene geometry and keeps the drawing file untouched."
          checked={settings.hideUnderObjects}
          onChange={(hideUnderObjects) => void actions.patchSettings({ hideUnderObjects })}
        />
      </section>

      <section className="nyra-settings-card">
        <h3>Margin</h3>
        <ToggleField
          label="Show left margin"
          hint="Draw a single notebook margin line over the paper layer."
          checked={settings.marginEnabled}
          onChange={(marginEnabled) => void actions.patchSettings({ marginEnabled })}
        />
        {settings.marginEnabled ? (
          <>
            <div className="nyra-settings-grid">
              <RangeField
                label="Margin position"
                value={settings.marginOffset}
                min={0}
                max={320}
                step={2}
                suffix="px"
                onChange={(marginOffset) => void actions.patchSettings({ marginOffset }, "debounced")}
              />
              <RangeField
                label="Margin thickness"
                value={settings.marginThickness}
                min={0.5}
                max={4}
                step={0.25}
                suffix="px"
                onChange={(marginThickness) => void actions.patchSettings({ marginThickness }, "debounced")}
              />
            </div>
            <div className="nyra-settings-field nyra-settings-color-field">
              <div className="nyra-settings-copy">
                <strong>Margin color</strong>
                <span>Stored independently from the guide color.</span>
              </div>
              <input
                className="nyra-settings-color-picker"
                type="color"
                value={settings.marginColor}
                aria-label="Margin color"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  void actions.patchSettings({ marginColor: event.currentTarget.value }, "debounced")
                }
              />
            </div>
            <div className="nyra-settings-swatches" aria-label="Margin color presets">
              {MARGIN_COLOR_SWATCHES.map((swatch) => (
                <button
                  type="button"
                  key={swatch.value}
                  className={settings.marginColor === swatch.value ? "is-selected" : ""}
                  style={{ background: swatch.value }}
                  title={swatch.label}
                  aria-label={`${swatch.label} margin color`}
                  aria-pressed={settings.marginColor === swatch.value}
                  onClick={() => void actions.patchSettings({ marginColor: swatch.value })}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="nyra-settings-card">
        <h3>Profiles and drawing overrides</h3>
        <p className="nyra-settings-help">
          Profiles are snapshots of the current global paper configuration. Applying a profile from a drawing
          creates a local override; drawing files themselves are never modified.
        </p>

        <div className="nyra-profile-create">
          <input
            type="text"
            maxLength={48}
            value={profileName}
            placeholder="Profile name"
            aria-label="New profile name"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setProfileName(event.currentTarget.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter" && profileName.trim()) {
                event.preventDefault();
                void saveProfile();
              }
            }}
          />
          <button
            type="button"
            disabled={!profileName.trim() || profileLimitReached}
            title={profileLimitReached ? `Profile limit reached (${MAX_PROFILES}).` : undefined}
            onClick={() => void saveProfile()}
          >
            {profileLimitReached ? `Profile limit reached (${MAX_PROFILES})` : "Save current as profile"}
          </button>
        </div>

        <div className="nyra-profile-list">
          {settings.profiles.length ? (
            settings.profiles.map((profile) => (
              <ProfileRow key={profile.id} profile={profile} actions={actions} />
            ))
          ) : (
            <div className="nyra-empty-state">No saved profiles yet.</div>
          )}
        </div>

        <div className="nyra-override-summary">
          <strong>{overrideCount}</strong>
          <span>
            {overrideCount === 1
              ? "drawing currently has a local override."
              : "drawings currently have local overrides."}
          </span>
        </div>
      </section>

      <section className="nyra-settings-card">
        <h3>Behavior and interface</h3>
        <ToggleField
          label="Follow canvas pan & zoom"
          hint="Keep paper coordinates anchored to the Excalidraw scene."
          checked={settings.followCanvas}
          onChange={(followCanvas) => void actions.patchSettings({ followCanvas })}
        />
        <ToggleField
          label="Show floating controls"
          hint="Show the responsive paper controls over Excalidraw."
          checked={settings.showFloatingControls}
          onChange={(showFloatingControls) => void actions.patchSettings({ showFloatingControls })}
        />
        <SelectField
          label="Control dock visibility"
          hint="Choose when the dock is shown. Drag the dock grip in Excalidraw to set a persistent position for desktop or compact layouts."
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
          hint="Reduce the floating dock to the paper trigger and expand button."
          checked={settings.dockCollapsed}
          onChange={(dockCollapsed) => void actions.patchSettings({ dockCollapsed })}
        />
        <ToggleField
          label="Show desktop status bar item"
          hint="Status bar items are intentionally omitted on the iOS and Android apps."
          checked={settings.showStatusBar}
          onChange={(showStatusBar) => void actions.patchSettings({ showStatusBar })}
        />
        <div className="nyra-settings-actions-row">
          <button type="button" onClick={() => void actions.copyDiagnostics()}>
            Copy diagnostics
          </button>
        </div>
      </section>

      <section className="nyra-settings-card nyra-settings-danger-zone">
        <h3>Reset</h3>
        <p>
          Restore plugin defaults and remove saved profiles and per-drawing overrides. Existing Excalidraw
          drawings are unaffected because this plugin never writes paper guides into drawing content.
        </p>
        <ConfirmActionButton
          className="mod-warning"
          label="Reset all plugin data"
          confirmLabel="Confirm reset all data"
          onConfirm={() => actions.resetAllSettings()}
        />
      </section>
    </div>
  );
}
