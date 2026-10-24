export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function positiveModulo(value: number, modulus: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(modulus) || modulus <= 0) return 0;
  return ((value % modulus) + modulus) % modulus;
}

export function formatNumber(value: number, decimals = 2): string {
  const rounded = Number(value).toFixed(decimals);
  return rounded.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}
