//
// Deterministic fixed-point (WAD, 18-decimal) math. No floating point
// arithmetic anywhere in this file — every operation is integer bigint
// math, so results are bit-for-bit reproducible regardless of platform.
// This is the same convention used in backend/env/explainScore.ts's
// wadToPctString, extended here with the operations the engines need.

import { Wad, WAD_ONE, WAD_ZERO } from "./wadTypes";

/// Multiply two WAD values: (x * y) / 1e18
export function wmul(x: Wad, y: Wad): Wad {
  return (x * y) / WAD_ONE;
}

/// Divide two WAD values: (x * 1e18) / y
export function wdiv(x: Wad, y: Wad): Wad {
  if (y === WAD_ZERO) throw new Error("wadMath: division by zero");
  return (x * WAD_ONE) / y;
}

/// Add two WAD values.
export function wadd(x: Wad, y: Wad): Wad {
  return x + y;
}

/// Subtract two WAD values, floored at zero (scores don't go negative).
export function wsub(x: Wad, y: Wad): Wad {
  return x > y ? x - y : WAD_ZERO;
}

/// Convert a whole number to WAD.
export function toWad(whole: number | bigint): Wad {
  return BigInt(whole) * WAD_ONE;
}

/// Convert a basis-points integer (0-10000) to WAD, e.g. 3500 bps -> 0.35 WAD.
export function bpsToWad(bps: number): Wad {
  return (BigInt(bps) * WAD_ONE) / 10_000n;
}

/// Apply a basis-points weight to a WAD value: value * (bps / 10000)
export function applyWeightBps(value: Wad, bps: number): Wad {
  return wmul(value, bpsToWad(bps));
}

/// Clamp a WAD value between a min and max WAD.
export function clampWad(value: Wad, min: Wad, max: Wad): Wad {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/// Render a WAD value as a human-readable percentage string, e.g.
/// "73.42%". Matches the convention already used by explainScore.ts.
export function wadToPctString(value: Wad, precision: number = 2): string {
  const pct = (value * 10_000n) / WAD_ONE; // value * 100 * 100, for 2dp precision
  const whole = pct / 100n;
  const frac = (pct % 100n).toString().padStart(2, "0");
  const str = `${whole}.${frac}`;
  return precision === 2 ? `${str}%` : `${Number(str).toFixed(precision)}%`;
}

/// Sum a list of WAD values.
export function sumWad(values: Wad[]): Wad {
  return values.reduce((acc, v) => wadd(acc, v), WAD_ZERO);
}

/// Compute a weighted composite from factor scores and their basis-point
/// weights. Used identically by credit, mortgage, and life insurance
/// engines — only the factor list and weights differ per domain.
export function weightedComposite(
  factorScoresWad: Wad[],
  weightsBps: number[]
): Wad {
  if (factorScoresWad.length !== weightsBps.length) {
    throw new Error("wadMath: factor/weight length mismatch");
  }
  let total = WAD_ZERO;
  for (let i = 0; i < factorScoresWad.length; i++) {
    total = wadd(total, applyWeightBps(factorScoresWad[i], weightsBps[i]));
  }
  return total;
}
