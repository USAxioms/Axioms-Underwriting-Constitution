//
// Deterministic life insurance underwriting decision. Pure WAD math.
// As with the other engines, inputs are pre-normalized 0..1 WAD
// favorability scores; this file only ever does WAD arithmetic.

import {
  FactorResult,
  UnderwritingResult,
  RulesetManifest,
  Wad,
} from "../wad/wadTypes";
import { weightedComposite, wadToPctString, toWad, wdiv } from "../wad/wadMath";

export interface LifeInsuranceApplicantInput {
  ageBandScoreWad: Wad;
  healthClassScoreWad: Wad;
  tobaccoUseScoreWad: Wad;
  coverageToIncomeRatioScoreWad: Wad;
  familyHistoryScoreWad: Wad;
}

export function underwriteLifeInsurance(
  input: LifeInsuranceApplicantInput,
  manifest: RulesetManifest
): UnderwritingResult {
  const factorOrder = [
    "age_band",
    "health_class",
    "tobacco_use",
    "coverage_to_income_ratio",
    "family_history",
  ] as const;

  const scores: Wad[] = [
    input.ageBandScoreWad,
    input.healthClassScoreWad,
    input.tobaccoUseScoreWad,
    input.coverageToIncomeRatioScoreWad,
    input.familyHistoryScoreWad,
  ];

  const weightsBps = factorOrder.map((name) => manifest.weights[name]);
  const compositeFractionWad = weightedComposite(scores, weightsBps);

  const factors: FactorResult[] = factorOrder.map((name, i) => ({
    factorName: name,
    componentScoreWad: scores[i],
    maxPossibleWad: toWad(1),
    weightBps: weightsBps[i],
    derogatory: scores[i] < wdiv(toWad(1), toWad(2)),
    explanation: `${name.replace(/_/g, " ")}: ${wadToPctString(scores[i])} of max, weighted ${
      weightsBps[i] / 100
    }%`,
  }));

  const approved = compositeFractionWad >= manifest.minThresholdWad;

  const explanationText = [
    `=== LIFE INSURANCE UNDERWRITING DECISION ===`,
    `Composite: ${wadToPctString(compositeFractionWad)}`,
    `Threshold: ${wadToPctString(manifest.minThresholdWad)}`,
    `Decision: ${approved ? "APPROVED" : "DECLINED"}`,
    ``,
    ...factors.map((f) => `- ${f.explanation}`),
  ].join("\n");

  return {
    domain: "life_insurance",
    rulesetVersion: manifest.version,
    compositeScoreWad: compositeFractionWad,
    minThresholdWad: manifest.minThresholdWad,
    approved,
    factors,
    explanationText,
  };
}
