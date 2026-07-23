//
// Shared type definitions for WAD (18-decimal fixed point) values used
// across every domain engine (credit, mortgage, life insurance). Keeping
// these in one place is what makes the "shared math, independent rules"
// separation in the repo diagram actually hold.

// A WAD is a bigint scaled by 1e18. Example: 0.75 (75%) is stored as
// 750000000000000000n. All scores, weights, and thresholds in the
// engines are WAD values — never raw floats — so results are
// deterministic and reproducible across machines/languages.
export type Wad = bigint;

export const WAD_DECIMALS = 18;
export const WAD_ONE: Wad = 1_000_000_000_000_000_000n;
export const WAD_ZERO: Wad = 0n;

// A single scored factor within a domain (e.g. "LTV" for mortgage,
// "Payment History" for credit, "Health Class" for life insurance).
export interface FactorResult {
  factorName: string;
  componentScoreWad: Wad;   // this factor's contribution, in WAD
  maxPossibleWad: Wad;      // max this factor could contribute, in WAD
  weightBps: number;        // weight in basis points (1/10000), e.g. 3500 = 35%
  derogatory: boolean;      // whether this factor triggered a negative flag
  explanation: string;
}

// The full result of running a domain engine against one applicant.
export interface UnderwritingResult {
  domain: "credit" | "mortgage" | "life_insurance";
  rulesetVersion: number;
  compositeScoreWad: Wad;      // final weighted composite, in WAD
  minThresholdWad: Wad;        // pulled from on-chain ruleset at decision time
  approved: boolean;
  factors: FactorResult[];
  explanationText: string;
}

export interface RulesetManifest {
  version: number;
  domain: "credit" | "mortgage" | "life_insurance";
  weights: Record<string, number>; // factor name -> basis points
  minThresholdWad: Wad;
  statutoryRefs: string[];
}
