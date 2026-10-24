import { DEFAULT_LINE_COLOR } from "./constants";
import { clamp } from "./number";

export function normalizeHex(hex: unknown, fallback = DEFAULT_LINE_COLOR): string {
  const value = String(hex ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return fallback;
}

export function hexToRgba(hex: string, alpha: number): string {
  const safe = normalizeHex(hex).slice(1);
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}
