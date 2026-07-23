// backend/test/engines.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeCredit } from "../normalize/normalizeCredit";
import { underwriteCredit } from "../engine/underwriteCredit";
import { normalizeMortgage } from "../normalize/normalizeMortgage";
import { underwriteMortgage } from "../engine/underwriteMortgage";
import {
  normalizeLifeInsurance,
} from "../normalize/normalizeLifeInsurance";
import { underwriteLifeInsurance } from "../engine/underwriteLifeInsurance";

import creditManifest from "../ruleset/credit/manifest.json";
import mortgageManifest from "../ruleset/mortgage/manifest.json";
import lifeManifest from "../ruleset/life_insurance/manifest.json";

function withBigIntThreshold(manifest: any) {
  return { ...manifest, minThresholdWad: BigInt(manifest.minThresholdWad) };
}

test("underwriteCredit: strong applicant is approved", () => {
  const raw = {
    onTimePaymentPct: 99,
    utilizationPct: 10,
    historyLengthMonths: 180,
    distinctAccountTypes: 5,
    newAccountsLast12mo: 0,
  };
  const result = underwriteCredit(normalizeCredit(raw), withBigIntThreshold(creditManifest));
  assert.equal(result.approved, true);
  assert.equal(result.domain, "credit");
});

test("underwriteCredit: weak applicant is declined", () => {
  const raw = {
    onTimePaymentPct: 60,
    utilizationPct: 95,
    historyLengthMonths: 3,
    distinctAccountTypes: 1,
    newAccountsLast12mo: 8,
  };
  const result = underwriteCredit(normalizeCredit(raw), withBigIntThreshold(creditManifest));
  assert.equal(result.approved, false);
});

test("underwriteCredit: is deterministic across repeated runs", () => {
  const raw = {
    onTimePaymentPct: 88,
    utilizationPct: 40,
    historyLengthMonths: 60,
    distinctAccountTypes: 3,
    newAccountsLast12mo: 2,
  };
  const manifest = withBigIntThreshold(creditManifest);
  const r1 = underwriteCredit(normalizeCredit(raw), manifest);
  const r2 = underwriteCredit(normalizeCredit(raw), manifest);
  assert.equal(r1.compositeScoreWad, r2.compositeScoreWad);
  assert.equal(r1.approved, r2.approved);
});

test("underwriteMortgage: strong applicant is approved", () => {
  const raw = {
    loanToValuePct: 55,
    debtToIncomePct: 15,
    creditScore: 780,
    cashReservesMonths: 8,
    employmentHistoryMonths: 36,
  };
  const result = underwriteMortgage(
    normalizeMortgage(raw),
    withBigIntThreshold(mortgageManifest)
  );
  assert.equal(result.approved, true);
});

test("underwriteMortgage: weak applicant is declined", () => {
  const raw = {
    loanToValuePct: 97,
    debtToIncomePct: 55,
    creditScore: 560,
    cashReservesMonths: 0,
    employmentHistoryMonths: 1,
  };
  const result = underwriteMortgage(
    normalizeMortgage(raw),
    withBigIntThreshold(mortgageManifest)
  );
  assert.equal(result.approved, false);
});

test("underwriteLifeInsurance: strong applicant is approved", () => {
  const raw = {
    age: 28,
    healthClass: "preferred_plus" as const,
    isTobaccoUser: false,
    requestedCoverageAmount: 250_000,
    annualIncome: 80_000,
    familyHistoryRiskFlags: 0,
  };
  const result = underwriteLifeInsurance(
    normalizeLifeInsurance(raw),
    withBigIntThreshold(lifeManifest)
  );
  assert.equal(result.approved, true);
});

test("underwriteLifeInsurance: high-risk applicant is declined", () => {
  const raw = {
    age: 68,
    healthClass: "substandard" as const,
    isTobaccoUser: true,
    requestedCoverageAmount: 2_000_000,
    annualIncome: 40_000,
    familyHistoryRiskFlags: 3,
  };
  const result = underwriteLifeInsurance(
    normalizeLifeInsurance(raw),
    withBigIntThreshold(lifeManifest)
  );
  assert.equal(result.approved, false);
});

test("all engines: explanationText is non-empty and includes decision", () => {
  const raw = {
    age: 40,
    healthClass: "standard" as const,
    isTobaccoUser: false,
    requestedCoverageAmount: 300_000,
    annualIncome: 90_000,
    familyHistoryRiskFlags: 1,
  };
  const result = underwriteLifeInsurance(
    normalizeLifeInsurance(raw),
    withBigIntThreshold(lifeManifest)
  );
  assert.ok(result.explanationText.includes("Decision:"));
  assert.ok(result.explanationText.length > 0);
});
