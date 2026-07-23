// backend/normalize/scoreCurves.ts
//
// Generic WAD-based curve helpers used by every domain's normalization
// layer to turn a raw applicant value (a ratio, an age, a count) into a
// 0..1 WAD "favorability" score that the engines consume. All math here
// is bigint WAD arithmetic — raw inputs are converted to WAD immediately
// and never touched as floats again.

import { Wad, WAD_ONE, WAD_ZERO } from "../wad/wadTypes";
import { wdiv, wsub, clampWad } from "../wad/wadMath";

/// Convert a decimal number (e.g. a ratio like 0.42, or a raw count like
/// 720) into a WAD value. This is the single point where non-WAD input
/// enters the system; every value is scaled to 18 decimals immediately.
export function numberToWad(n: number): Wad {
  // Scale via string to avoid floating point drift on the conversion itself.
  const [whole, frac = ""] = n.toString().split(".");
  const paddedFrac = (frac + "0".repeat(18)).slice(0, 18);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const wholeAbs = BigInt(whole.replace("-", ""));
  return sign * (wholeAbs * WAD_ONE + BigInt(paddedFrac || "0"));
}

/// Linear "lower is better" curve: raw value at or below `bestAt` scores
/// 1.0 WAD; at or above `worstAt` scores 0.0 WAD; linear in between.
/// Use for things like LTV, DTI, utilization — where a smaller ratio
/// is more favorable.
export function scoreLowerIsBetter(rawWad: Wad, bestAtWad: Wad, worstAtWad: Wad): Wad {
  if (rawWad <= bestAtWad) return WAD_ONE;
  if (rawWad >= worstAtWad) return WAD_ZERO;
  const range = wsub(worstAtWad, bestAtWad);
  const distanceFromBest = wsub(rawWad, bestAtWad);
  const penalty = wdiv(distanceFromBest, range);
  return clampWad(wsub(WAD_ONE, penalty), WAD_ZERO, WAD_ONE);
}

/// Linear "higher is better" curve: raw value at or above `bestAt` scores
/// 1.0 WAD; at or below `worstAt` scores 0.0 WAD; linear in between.
/// Use for things like credit score, cash reserves (months), coverage ratio.
export function scoreHigherIsBetter(rawWad: Wad, worstAtWad: Wad, bestAtWad: Wad): Wad {
  if (rawWad >= bestAtWad) return WAD_ONE;
  if (rawWad <= worstAtWad) return WAD_ZERO;
  const range = wsub(bestAtWad, worstAtWad);
  const distanceFromWorst = wsub(rawWad, worstAtWad);
  return clampWad(wdiv(distanceFromWorst, range), WAD_ZERO, WAD_ONE);
}

/// Discrete tier lookup: map a raw category (e.g. health class,
/// employment status) to a fixed WAD score via a lookup table. Falls
/// back to a provided default if the category is unrecognized.
export function scoreTier(
  category: string,
  table: Record<string, Wad>,
  defaultWad: Wad = WAD_ZERO
): Wad {
  return table[category] ?? defaultWad;
}

/// Boolean flag curve: true maps to `whenTrueWad`, false to `whenFalseWad`.
/// Use for things like tobacco use, derogatory-mark presence.
export function scoreBoolean(flag: boolean, whenTrueWad: Wad, whenFalseWad: Wad): Wad {
  return flag ? whenTrueWad : whenFalseWad;
}
