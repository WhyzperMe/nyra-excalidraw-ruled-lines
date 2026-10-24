import {
  useCallback,
  useRef,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import { formatNumber } from "../../core/number";

interface RangeFieldProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  disabled?: boolean;
  compact?: boolean;
  onChange(value: number): void;
}

interface TouchGesture {
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
}

const TOUCH_INTENT_THRESHOLD = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, min: number, max: number, step: number): number {
  const safeStep = step > 0 ? step : 1;
  const snapped = min + Math.round((value - min) / safeStep) * safeStep;
  const precision = Math.max(0, (String(safeStep).split(".")[1] ?? "").length);
  return Number(clamp(snapped, min, max).toFixed(Math.min(8, precision + 1)));
}

export function RangeField({
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix = "",
  disabled = false,
  compact = false,
  onChange,
}: RangeFieldProps): ReactElement {
  const gestureRef = useRef<TouchGesture | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const denominator = max - min;
  const progress = denominator > 0 ? clamp(((value - min) / denominator) * 100, 0, 100) : 0;
  const classes = ["nyra-ruled-range-field", disabled ? "is-disabled" : "", compact ? "is-compact-range" : ""]
    .filter(Boolean)
    .join(" ");

  const updateFromClientX = useCallback(
    (element: HTMLDivElement, clientX: number): void => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || max <= min) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const next = snapToStep(min + ratio * (max - min), min, max, step);
      if (next !== value) onChange(next);
    },
    [max, min, onChange, step, value],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (disabled || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;

    const directPointer = event.pointerType === "mouse";
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: directPointer,
    };

    if (!directPointer) return;

    // The transparent native range never owns pointer input. This avoids
    // Chromium/WebKit changing the value before our touch-intent gate can decide
    // whether a gesture is a vertical panel scroll or an intentional slider drag.
    event.preventDefault();
    event.stopPropagation();
    inputRef.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientX(event.currentTarget, event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || disabled) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.active) {
      // A vertical gesture belongs to the scrolling panel. Do not let a casual
      // swipe over a slider mutate opacity/thickness/margin values.
      if (Math.abs(dy) > TOUCH_INTENT_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        gestureRef.current = null;
        return;
      }
      if (Math.abs(dx) < TOUCH_INTENT_THRESHOLD || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
      gesture.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    event.stopPropagation();
    updateFromClientX(event.currentTarget, event.clientX);
  };

  const finishTouch = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.active) {
      event.preventDefault();
      event.stopPropagation();
      updateFromClientX(event.currentTarget, event.clientX);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
    gestureRef.current = null;
  };

  return (
    <div className={classes} aria-disabled={disabled ? "true" : "false"}>
      <div className="nyra-ruled-range-header">
        <div className="nyra-ruled-field-copy">
          <span className="nyra-ruled-field-title">{label}</span>
          {hint ? <span className="nyra-ruled-field-hint">{hint}</span> : null}
        </div>
        <output className="nyra-ruled-range-value">
          {formatNumber(value)} {suffix}
        </output>
      </div>
      <div
        className="nyra-ruled-range-control"
        style={{ "--nr-range-progress": `${progress}%` } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishTouch}
        onPointerCancel={finishTouch}
      >
        <span className="nyra-ruled-range-visual-track" aria-hidden="true">
          <span className="nyra-ruled-range-visual-fill" />
        </span>
        <span className="nyra-ruled-range-visual-thumb" aria-hidden="true" />
        <input
          ref={inputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.currentTarget.value))}
        />
      </div>
    </div>
  );
}
