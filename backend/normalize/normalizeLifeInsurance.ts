//
// Converts raw life insurance applicant data into the 0..1 WAD
// favorability scores that underwriteLifeInsurance.ts consumes.
// Health class and age band use tier lookups (discrete categories);
// tobacco use is a boolean flag; the rest are linear curves.

import { LifeInsuranceApplicantInput } from "../engine/underwriteLifeInsurance";
import {
  numberToWad,
  scoreLowerIsBetter,
  scoreHigherIsBetter,
  scoreTier,
  scoreBoolean,
} from "./scoreCurves";

export interface RawLifeInsuranceInput {
  age: number;
  healthClass: "preferred_plus" | "preferred" | "standard_plus" | "standard" | "substandard";
  isTobaccoUser: boolean;
  requestedCoverageAmount: number; // face amount requested
  annualIncome: number;
  familyHistoryRiskFlags: number;  // count of first-degree relatives with qualifying conditions
}

const HEALTH_CLASS_TABLE = {
  preferred_plus: numberToWad(1.0),
  preferred: numberToWad(0.85),
  standard_plus: numberToWad(0.65),
  standard: numberToWad(0.45),
  substandard: numberToWad(0.15),
};

export function normalizeLifeInsurance(
  raw: RawLifeInsuranceInput
): LifeInsuranceApplicantInput {
  const coverageToIncomeRatio =
    raw.annualIncome > 0 ? raw.requestedCoverageAmount / raw.annualIncome : Infinity;

  return {
    // Age band: younger is generally more favorable up to a floor, using
    // a lower-is-better curve. 25 or below -> 1.0 WAD, 70+ -> 0.0 WAD.
    ageBandScoreWad: scoreLowerIsBetter(
      numberToWad(raw.age),
      numberToWad(25),
      numberToWad(70)
    ),

    // Health class: discrete tier lookup.
    healthClassScoreWad: scoreTier(raw.healthClass, HEALTH_CLASS_TABLE, numberToWad(0)),

    // Tobacco use: boolean flag, non-user favored.
    tobaccoUseScoreWad: scoreBoolean(
      raw.isTobaccoUser,
      numberToWad(0.2),
      numberToWad(1.0)
    ),

    // Coverage-to-income ratio: lower is more favorable (less
    // over-insurance risk relative to income). 5x income or below ->
    // 1.0 WAD, 20x+ -> 0.0 WAD.
    coverageToIncomeRatioScoreWad: scoreLowerIsBetter(
      numberToWad(Number.isFinite(coverageToIncomeRatio) ? coverageToIncomeRatio : 20),
      numberToWad(5),
      numberToWad(20)
    ),

    // Family history: fewer risk flags is better. 0 -> 1.0 WAD, 3+ -> 0.0 WAD.
    familyHistoryScoreWad: scoreLowerIsBetter(
      numberToWad(raw.familyHistoryRiskFlags),
      numberToWad(0),
      numberToWad(3)
    ),
  };
}
