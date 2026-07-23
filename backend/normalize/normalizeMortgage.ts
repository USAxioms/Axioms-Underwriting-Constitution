//
// Converts raw mortgage applicant data into the 0..1 WAD favorability
// scores that underwriteMortgage.ts consumes.

import { MortgageApplicantInput } from "../engine/underwriteMortgage";
import { numberToWad, scoreLowerIsBetter, scoreHigherIsBetter } from "./scoreCurves";

export interface RawMortgageInput {
  loanToValuePct: number;        // 0-100+, loan amount / property value
  debtToIncomePct: number;       // 0-100+, total monthly debt / gross monthly income
  creditScore: number;           // e.g. 300-850 (FICO-style scale)
  cashReservesMonths: number;    // months of mortgage payment covered by liquid reserves
  employmentHistoryMonths: number; // months at current employer/self-employment
}

export function normalizeMortgage(raw: RawMortgageInput): MortgageApplicantInput {
  return {
    // Lower LTV is better. 60% or below -> 1.0 WAD, 97%+ -> 0.0 WAD.
    loanToValueScoreWad: scoreLowerIsBetter(
      numberToWad(raw.loanToValuePct),
      numberToWad(60),
      numberToWad(97)
    ),

    // Lower DTI is better. 20% or below -> 1.0 WAD, 50%+ -> 0.0 WAD.
    debtToIncomeScoreWad: scoreLowerIsBetter(
      numberToWad(raw.debtToIncomePct),
      numberToWad(20),
      numberToWad(50)
    ),

    // Higher credit score is better. 580 or below -> 0.0 WAD, 760+ -> 1.0 WAD.
    creditScoreScoreWad: scoreHigherIsBetter(
      numberToWad(raw.creditScore),
      numberToWad(580),
      numberToWad(760)
    ),

    // More reserve months is better. 0 -> 0.0 WAD, 6+ months -> 1.0 WAD.
    cashReservesScoreWad: scoreHigherIsBetter(
      numberToWad(raw.cashReservesMonths),
      numberToWad(0),
      numberToWad(6)
    ),

    // Longer, more stable employment is better. 0 months -> 0.0 WAD,
    // 24+ months -> 1.0 WAD.
    employmentHistoryScoreWad: scoreHigherIsBetter(
      numberToWad(raw.employmentHistoryMonths),
      numberToWad(0),
      numberToWad(24)
    ),
  };
}
