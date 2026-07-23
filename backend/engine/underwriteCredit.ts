//
// Deterministic credit underwriting decision. Pure WAD math — no
// floating point, no ML. Factor scores in, weighted composite out,
// compared against the on-chain-governed minThresholdWad.

import {
  FactorResult,
  UnderwritingResult,
  RulesetManifest,
  Wad,
} from "../wad/wadTypes";
import { weightedComposite, wadToPctString, toWad, wdiv } from "../wad/wadMath";

export interface CreditApplicantInput {
  paymentHistoryScoreWad: Wad; // 0..1 WAD, pre-normalized upstream
  utilizationScoreWad: Wad;
  historyLengthScoreWad: Wad;
  creditMixScoreWad: Wad;
  newCreditScoreWad: Wad;
}

export function underwriteCredit(
  input: CreditApplicantInput,
  manifest: RulesetManifest
): UnderwritingResult {
  const factorOrder = [
    "payment_history",
    "utilization",
    "history_length",
    "credit_mix",
    "new_credit",
  ] as const;

  const scores: Wad[] = [
    input.paymentHistoryScoreWad,
    input.utilizationScoreWad,
    input.historyLengthScoreWad,
    input.creditMixScoreWad,
    input.newCreditScoreWad,
  ];

  const weightsBps = factorOrder.map((name) => manifest.weights[name]);

  // Composite is expressed on the credit-score-like scale (e.g. 300-850)
  // by scaling the 0..1 WAD composite. Kept simple here: composite is a
  // 0..1 WAD fraction; conversion to score-scale happens at the edge
  // (explain/report layer) if needed.
  const compositeFractionWad = weightedComposite(scores, weightsBps);

  const factors: FactorResult[] = factorOrder.map((name, i) => ({
    factorName: name,
    componentScoreWad: scores[i],
    maxPossibleWad: toWad(1),
    weightBps: weightsBps[i],
    derogatory: scores[i] < wdiv(toWad(1), toWad(2)), // below 50% flagged
    explanation: `${name.replace("_", " ")}: ${wadToPctString(scores[i])} of max, weighted ${
      weightsBps[i] / 100
    }%`,
  }));

  const approved = compositeFractionWad >= manifest.minThresholdWad;

  const explanationText = [
    `=== CREDIT UNDERWRITING DECISION ===`,
    `Composite: ${wadToPctString(compositeFractionWad)}`,
    `Threshold: ${wadToPctString(manifest.minThresholdWad)}`,
    `Decision: ${approved ? "APPROVED" : "DECLINED"}`,
    ``,
    ...factors.map((f) => `- ${f.explanation}`),
  ].join("\n");

  return {
    domain: "credit",
    rulesetVersion: manifest.version,
    compositeScoreWad: compositeFractionWad,
    minThresholdWad: manifest.minThresholdWad,
    approved,
    factors,
    explanationText,
  };
}
