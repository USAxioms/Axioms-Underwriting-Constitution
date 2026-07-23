//
// Generates the specific-reasons adverse action notice required by:
//   - ECOA / Regulation B (12 CFR 1002.9) for credit and mortgage denials
//   - FCRA (15 U.S.C. 1681m) when a consumer report was used
//   - State insurance codes' equivalent notice requirements for life
//     insurance declinations
//
// The key compliance property this file exists to guarantee: the
// reasons listed are derived directly from the SAME factor results the
// engine used to make the decision — not a separate post-hoc
// approximation. This is the "compliance by construction" property
// discussed earlier: the explanation IS the decision logic, not a
// summary of it.

import { FactorResult, UnderwritingResult } from "../wad/wadTypes";
import { wadToPctString } from "../wad/wadMath";

const MAX_REASONS = 4; // Reg B commentary: 4 is generally sufficient; more can dilute clarity

export interface AdverseActionNotice {
  domain: string;
  decisionDate: string;
  rulesetVersion: number;
  primaryReasons: string[];      // ordered, most impactful first
  fullFactorBreakdown: FactorResult[];
  rulesetUri?: string;
  statutoryBasisText: string;
  consumerRightsText: string;
}

// Human-readable reason templates per factor name. Extend this table
// as new factors are added to any domain's ruleset.
const REASON_TEMPLATES: Record<string, (f: FactorResult) => string> = {
  payment_history: (f) => `Insufficient history of on-time payments (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  utilization: (f) => `Revolving credit utilization too high (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  history_length: (f) => `Length of credit history too short (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  credit_mix: (f) => `Insufficient mix of credit account types (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  new_credit: (f) => `Too many recently opened accounts or inquiries (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  loan_to_value: (f) => `Loan-to-value ratio too high relative to program limits (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  debt_to_income: (f) => `Debt-to-income ratio too high relative to program limits (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  credit_score: (f) => `Credit score below program minimum (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  cash_reserves: (f) => `Insufficient cash reserves relative to program requirements (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  employment_history: (f) => `Employment history too short or unstable (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  age_band: (f) => `Age outside preferred underwriting band (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  health_class: (f) => `Health classification below program requirements (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  tobacco_use: (f) => `Tobacco use classification (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  coverage_to_income_ratio: (f) => `Requested coverage high relative to income (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
  family_history: (f) => `Family medical history risk factors (scored ${wadToPctString(f.componentScoreWad)} of maximum)`,
};

function reasonFor(f: FactorResult): string {
  const template = REASON_TEMPLATES[f.factorName];
  return template ? template(f) : `${f.factorName.replace(/_/g, " ")}: below required threshold`;
}

/// Rank factors by how much each one's shortfall contributed to the
/// decline, using the same WAD component scores and bps weights the
/// engine already computed — no re-derivation, no separate approximation.
function rankAdverseFactors(factors: FactorResult[]): FactorResult[] {
  return [...factors]
    .filter((f) => f.derogatory)
    .sort((a, b) => {
      // Weight the shortfall (1 - score) by the factor's bps weight to
      // rank by actual impact on the composite, not raw score alone.
      const shortfallA = (Number(f_maxWad(a)) - Number(a.componentScoreWad)) * a.weightBps;
      const shortfallB = (Number(f_maxWad(b)) - Number(b.componentScoreWad)) * b.weightBps;
      return shortfallB - shortfallA;
    });
}

function f_maxWad(f: FactorResult): bigint {
  return f.maxPossibleWad;
}

export function generateAdverseActionNotice(
  result: UnderwritingResult,
  opts: { rulesetUri?: string } = {}
): AdverseActionNotice | null {
  if (result.approved) return null; // no notice needed on approval

  const ranked = rankAdverseFactors(result.factors);
  const primaryReasons = ranked.slice(0, MAX_REASONS).map(reasonFor);

  // Fallback: if nothing was individually flagged derogatory but the
  // composite still missed threshold, cite the lowest-scoring factors.
  if (primaryReasons.length === 0) {
    const lowest = [...result.factors]
      .sort((a, b) => Number(a.componentScoreWad) - Number(b.componentScoreWad))
      .slice(0, MAX_REASONS);
    primaryReasons.push(...lowest.map(reasonFor));
  }

  const statutoryBasisText = [
    "This decision was made using a published, versioned ruleset.",
    `Ruleset version: ${result.rulesetVersion} (domain: ${result.domain}).`,
    "You have the right to request the specific ruleset and weights used.",
  ].join(" ");

  const consumerRightsText = [
    "Under the Equal Credit Opportunity Act, the Federal Trade Commission",
    "enforces compliance with this regulation. You have the right to a",
    "written statement of specific reasons within 30 days of any adverse",
    "action, the right to know the specific reasons for this decision",
    "(provided above), and the right to dispute the accuracy of any",
    "information used, if a consumer report was involved.",
  ].join(" ");

  return {
    domain: result.domain,
    decisionDate: new Date().toISOString(),
    rulesetVersion: result.rulesetVersion,
    primaryReasons,
    fullFactorBreakdown: result.factors,
    rulesetUri: opts.rulesetUri,
    statutoryBasisText,
    consumerRightsText,
  };
}

/// Render the notice as plain text suitable for a letter/email body.
export function renderNoticeText(notice: AdverseActionNotice): string {
  return [
    `=== ADVERSE ACTION NOTICE ===`,
    `Date: ${notice.decisionDate}`,
    `Domain: ${notice.domain}`,
    `Ruleset Version: ${notice.rulesetVersion}`,
    ``,
    `Principal reason(s) for this decision:`,
    ...notice.primaryReasons.map((r, i) => `  ${i + 1}. ${r}`),
    ``,
    notice.statutoryBasisText,
    ``,
    notice.consumerRightsText,
    notice.rulesetUri ? `\nFull ruleset: ${notice.rulesetUri}` : "",
  ].join("\n");
}
