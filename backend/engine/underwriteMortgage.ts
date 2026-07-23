//
// Deterministic mortgage underwriting decision. Pure WAD math.
// Inputs are pre-normalized to 0..1 WAD "favorability" scores upstream
// (e.g. lower LTV -> higher favorability score) so this engine only
// ever does WAD arithmetic, never raw ratio math.

import {
  FactorResult,
  UnderwritingResult,
  RulesetManifest,
  Wad,
} from "../wad/wadTypes";
import { weightedComposite, wadToPctString, toWad, wdiv } from "../wad/wadMath";

export interface MortgageApplicantInput {
  loanToValueScoreWad: Wad;      // favorability score, higher = lower LTV = better
  debtToIncomeScoreWad: Wad;
  creditScoreScoreWad: Wad;
  cashReservesScoreWad: Wad;
  employmentHistoryScoreWad: Wad;
}

export function underwriteMortgage(
  input: MortgageApplicantInput,
  manifest: RulesetManifest
): UnderwritingResult {
  const factorOrder = [
    "loan_to_value",
    "debt_to_income",
    "credit_score",
    "cash_reserves",
    "employment_history",
  ] as const;

  const scores: Wad[] = [
    input.loanToValueScoreWad,
    input.debtToIncomeScoreWad,
    input.creditScoreScoreWad,
    input.cashReservesScoreWad,
    input.employmentHistoryScoreWad,
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
    `=== MORTGAGE UNDERWRITING DECISION ===`,
    `Composite: ${wadToPctString(compositeFractionWad)}`,
    `Threshold: ${wadToPctString(manifest.minThresholdWad)}`,
    `Decision: ${approved ? "APPROVED" : "DECLINED"}`,
    ``,
    ...factors.map((f) => `- ${f.explanation}`),
  ].join("\n");

  return {
    domain: "mortgage",
    rulesetVersion: manifest.version,
    compositeScoreWad: compositeFractionWad,
    minThresholdWad: manifest.minThresholdWad,
    approved,
    factors,
    explanationText,
  };
}
