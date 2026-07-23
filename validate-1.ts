// backend/api/validate.ts
//
// Basic structural + bounds validation before any raw applicant data
// reaches normalize/engine code. Intentionally simple (no external
// schema library) to keep the no-dependency posture of the rest of
// the backend — swap in zod/ajv here if the project wants stricter
// schema enforcement later.

type ValidationResult = { valid: boolean; errors: string[] };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function checkRange(
  errors: string[],
  field: string,
  value: unknown,
  min: number,
  max: number
): void {
  if (!isFiniteNumber(value)) {
    errors.push(`${field}: must be a finite number`);
    return;
  }
  if (value < min || value > max) {
    errors.push(`${field}: must be between ${min} and ${max}`);
  }
}

export function validateCreditInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["body must be a JSON object"] };
  }
  checkRange(errors, "onTimePaymentPct", body.onTimePaymentPct, 0, 100);
  checkRange(errors, "utilizationPct", body.utilizationPct, 0, 100);
  checkRange(errors, "historyLengthMonths", body.historyLengthMonths, 0, 1200);
  checkRange(errors, "distinctAccountTypes", body.distinctAccountTypes, 0, 20);
  checkRange(errors, "newAccountsLast12mo", body.newAccountsLast12mo, 0, 50);
  return { valid: errors.length === 0, errors };
}

export function validateMortgageInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["body must be a JSON object"] };
  }
  checkRange(errors, "loanToValuePct", body.loanToValuePct, 0, 200);
  checkRange(errors, "debtToIncomePct", body.debtToIncomePct, 0, 200);
  checkRange(errors, "creditScore", body.creditScore, 300, 850);
  checkRange(errors, "cashReservesMonths", body.cashReservesMonths, 0, 240);
  checkRange(errors, "employmentHistoryMonths", body.employmentHistoryMonths, 0, 600);
  return { valid: errors.length === 0, errors };
}

const VALID_HEALTH_CLASSES = [
  "preferred_plus",
  "preferred",
  "standard_plus",
  "standard",
  "substandard",
];

export function validateLifeInsuranceInput(body: any): ValidationResult {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["body must be a JSON object"] };
  }
  checkRange(errors, "age", body.age, 0, 120);
  if (!VALID_HEALTH_CLASSES.includes(body.healthClass)) {
    errors.push(`healthClass: must be one of ${VALID_HEALTH_CLASSES.join(", ")}`);
  }
  if (typeof body.isTobaccoUser !== "boolean") {
    errors.push("isTobaccoUser: must be a boolean");
  }
  checkRange(errors, "requestedCoverageAmount", body.requestedCoverageAmount, 0, 100_000_000);
  checkRange(errors, "annualIncome", body.annualIncome, 0, 100_000_000);
  checkRange(errors, "familyHistoryRiskFlags", body.familyHistoryRiskFlags, 0, 20);
  return { valid: errors.length === 0, errors };
}
