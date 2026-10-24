import type { ReactElement } from "react";
import { PRESET_ORDER, PRESETS } from "../../core/constants";
import type { PresetId } from "../../core/types";
import { SegmentedControl } from "./SegmentedControl";

interface PresetControlProps {
  value: PresetId;
  onChange(value: PresetId): void;
}

const OPTIONS = PRESET_ORDER.map((preset) => ({ value: preset, label: PRESETS[preset].label }));

export function PresetControl({ value, onChange }: PresetControlProps): ReactElement {
  return (
    <SegmentedControl
      value={value}
      options={OPTIONS}
      label="Line spacing preset"
      columns={4}
      onChange={onChange}
    />
  );
}
