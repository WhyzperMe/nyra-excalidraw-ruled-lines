import type { ReactElement } from "react";
import { PAPER_MODE_ORDER, PAPER_MODES } from "../../core/constants";
import type { PaperMode } from "../../core/types";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = PAPER_MODE_ORDER.map((mode) => ({ value: mode, label: PAPER_MODES[mode].label }));

export function PaperModeControl({
  value,
  onChange,
}: {
  value: PaperMode;
  onChange(value: PaperMode): void;
}): ReactElement {
  return (
    <SegmentedControl value={value} options={OPTIONS} label="Paper type" columns={4} onChange={onChange} />
  );
}
