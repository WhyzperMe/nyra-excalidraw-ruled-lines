import type { ChangeEvent, ReactElement } from "react";

interface ToggleFieldProps {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}

export function ToggleField({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: ToggleFieldProps): ReactElement {
  return (
    <label className={`nyra-ruled-toggle-row${disabled ? " is-disabled" : ""}`} aria-disabled={disabled}>
      <span className="nyra-ruled-toggle-copy">
        <span className="nyra-ruled-field-title">{label}</span>
        {hint ? <span className="nyra-ruled-field-hint">{hint}</span> : null}
      </span>
      <span className="nyra-ruled-switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.checked)}
          aria-label={label}
        />
        <span className="nyra-ruled-switch-track" aria-hidden="true" />
      </span>
    </label>
  );
}
