//
// Converts raw credit applicant data into the 0..1 WAD favorability
// scores that underwriteCredit.ts consumes. All boundary values below
// are WAD-encoded via numberToWad so every comparison downstream is
// bigint WAD math, never a float.

import { CreditApplicantInput } from "../engine/underwriteCredit";
import { numberToWad, scoreLowerIsBetter, scoreHigherIsBetter } from "./scoreCurves";

export interface RawCreditInput {
  onTimePaymentPct: number;      // 0-100, % of payments made on time
  utilizationPct: number;        // 0-100, revolving utilization ratio
  historyLengthMonths: number;   // total months of credit history
  distinctAccountTypes: number;  // count of account types (cards, auto, mortgage, etc.)
  newAccountsLast12mo: number;   // count of newly opened accounts
}

export function normalizeCredit(raw: RawCreditInput): CreditApplicantInput {
  return {
    // Higher on-time % is better. 100% -> 1.0 WAD, 70% or below -> 0.0 WAD.
    paymentHistoryScoreWad: scoreHigherIsBetter(
      numberToWad(raw.onTimePaymentPct),
      numberToWad(70),
      numberToWad(100)
    ),

    // Lower utilization is better. 0% -> 1.0 WAD, 90%+ -> 0.0 WAD.
    utilizationScoreWad: scoreLowerIsBetter(
      numberToWad(raw.utilizationPct),
      numberToWad(0),
      numberToWad(90)
    ),

    // Longer history is better. 0 months -> 0.0 WAD, 120+ months -> 1.0 WAD.
    historyLengthScoreWad: scoreHigherIsBetter(
      numberToWad(raw.historyLengthMonths),
      numberToWad(0),
      numberToWad(120)
    ),

    // More distinct account types is better, up to a point. 1 type -> 0.0
    // WAD, 5+ types -> 1.0 WAD.
    creditMixScoreWad: scoreHigherIsBetter(
      numberToWad(raw.distinctAccountTypes),
      numberToWad(1),
      numberToWad(5)
    ),

    // Fewer new accounts is better (inquiry/thin-file risk). 0 -> 1.0 WAD,
    // 6+ new accounts in 12mo -> 0.0 WAD.
    newCreditScoreWad: scoreLowerIsBetter(
      numberToWad(raw.newAccountsLast12mo),
      numberToWad(0),
      numberToWad(6)
    ),
  };
}
