import type { CSSProperties, ReactElement } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentOption<T>[];
  label: string;
  columns?: number;
  onChange(value: T): void;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  label,
  columns = options.length,
  onChange,
}: SegmentedControlProps<T>): ReactElement {
  return (
    <div
      className="nyra-ruled-segmented"
      role="group"
      aria-label={label}
      style={{ "--nyra-segment-columns": String(columns) } as CSSProperties}
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`nyra-ruled-segment${value === option.value ? " is-selected" : ""}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
