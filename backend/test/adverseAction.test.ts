// backend/test/adverseAction.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeMortgage } from "../normalize/normalizeMortgage";
import { underwriteMortgage } from "../engine/underwriteMortgage";
import { normalizeCredit } from "../normalize/normalizeCredit";
import { underwriteCredit } from "../engine/underwriteCredit";
import {
  generateAdverseActionNotice,
  renderNoticeText,
} from "../adverse-action/adverseActionNotice";

import mortgageManifest from "../ruleset/mortgage/manifest.json";
import creditManifest from "../ruleset/credit/manifest.json";

function withBigIntThreshold(manifest: any) {
  return { ...manifest, minThresholdWad: BigInt(manifest.minThresholdWad) };
}

test("generateAdverseActionNotice: returns null when approved", () => {
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
  assert.equal(generateAdverseActionNotice(result), null);
});

test("generateAdverseActionNotice: returns reasons when declined", () => {
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

  const notice = generateAdverseActionNotice(result);
  assert.ok(notice !== null);
  assert.ok(notice!.primaryReasons.length > 0);
  assert.ok(notice!.primaryReasons.length <= 4);
});

test("generateAdverseActionNotice: reasons are ranked by weighted shortfall", () => {
  // DTI (30% weight) and LTV (30% weight) are both maxed out bad, credit
  // score (20% weight) moderately bad — DTI/LTV should rank above credit score.
  const raw = {
    loanToValuePct: 97, // worst possible -> weight 3000bps
    debtToIncomePct: 50, // worst possible -> weight 3000bps
    creditScore: 650, // mid-range, not fully derogatory
    cashReservesMonths: 8, // good
    employmentHistoryMonths: 36, // good
  };
  const result = underwriteMortgage(
    normalizeMortgage(raw),
    withBigIntThreshold(mortgageManifest)
  );
  const notice = generateAdverseActionNotice(result);
  assert.ok(notice !== null);
  // top reason should reference loan-to-value or debt-to-income, not
  // cash reserves or employment history (which were strong).
  const topReason = notice!.primaryReasons[0].toLowerCase();
  assert.ok(
    topReason.includes("loan-to-value") || topReason.includes("debt-to-income"),
    `expected top reason to be LTV or DTI, got: ${topReason}`
  );
});

test("renderNoticeText: includes required ECOA disclosure language", () => {
  const raw = {
    onTimePaymentPct: 60,
    utilizationPct: 95,
    historyLengthMonths: 3,
    distinctAccountTypes: 1,
    newAccountsLast12mo: 8,
  };
  const result = underwriteCredit(normalizeCredit(raw), withBigIntThreshold(creditManifest));
  const notice = generateAdverseActionNotice(result);
  assert.ok(notice !== null);
  const text = renderNoticeText(notice!);
  assert.ok(text.includes("Equal Credit Opportunity Act"));
  assert.ok(text.includes("specific reasons"));
  assert.ok(text.includes("Ruleset Version"));
});

test("generateAdverseActionNotice: falls back to lowest-scoring factors if none flagged derogatory", () => {
  // Construct a result manually where nothing crosses the 50% derogatory
  // flag but composite still misses threshold, to exercise the fallback path.
  const fakeResult = {
    domain: "mortgage" as const,
    rulesetVersion: 1,
    compositeScoreWad: 500000000000000000n, // 0.5, below 0.7 threshold
    minThresholdWad: 700000000000000000n,
    approved: false,
    factors: [
      {
        factorName: "loan_to_value",
        componentScoreWad: 600000000000000000n, // 0.6, not derogatory (>=0.5)
        maxPossibleWad: 1000000000000000000n,
        weightBps: 3000,
        derogatory: false,
        explanation: "loan to value: 60.00% of max",
      },
    ],
    explanationText: "test",
  };
  const notice = generateAdverseActionNotice(fakeResult);
  assert.ok(notice !== null);
  assert.ok(notice!.primaryReasons.length > 0);
});
