# Ruleset Specification

Defines the structure every domain's `ruleset/<domain>/manifest.json` must follow.

## Schema

```json
{
  "version": 1,
  "domain": "credit" | "mortgage" | "life_insurance",
  "weights": {
    "<factor_name>": <basis_points_integer>
  },
  "minThresholdWad": "<WAD-encoded string, 18 decimals>",
  "statutoryRefs": ["<citation>", ...]
}
```

### Field rules

- **`version`**: monotonically increasing integer. Every change to `weights`, `minThresholdWad`, or the factor set is a new version — never edited in place.
- **`weights`**: basis points (1/10000ths) per factor. Must sum to exactly `10000` (100%). Enforced by convention today; a validation step against this invariant is a recommended addition (see open items).
- **`minThresholdWad`**: the minimum composite score (0..1 WAD scale — a string-encoded bigint, e.g. `"700000000000000000"` for 0.70) required for approval.
- **`statutoryRefs`**: citations to the regulatory basis for the ruleset's design (informational; not a substitute for legal review).

## Current default rulesets

| Domain | Factors | Threshold |
|---|---|---|
| Credit | payment_history (35%), utilization (30%), history_length (15%), credit_mix (10%), new_credit (10%) | 0.62 |
| Mortgage | loan_to_value (30%), debt_to_income (30%), credit_score (20%), cash_reserves (10%), employment_history (10%) | 0.70 |
| Life Insurance | health_class (35%), age_band (25%), tobacco_use (15%), coverage_to_income_ratio (15%), family_history (10%) | 0.65 |

These are illustrative defaults, not actuarially or statistically calibrated. They must be replaced with figures derived from real underwriting/risk data, reviewed by qualified actuaries/underwriters, before use on real applicants.

## Publishing and activating a new version

1. Governor calls `RulesetRegistry.publishRuleset(domain, rulesetHash, uri, minThresholdWad)`. This does **not** make it active.
2. Governor calls `RulesetRegistry.activateRuleset(domain, version)` once the new version is ready to take effect.
3. `rulesetHash` must be `keccak256` of the canonical JSON serialization of the manifest — the same hashing the backend uses in `localRulesetHash()` (see `api/server.ts`), so the two can be compared for equality.

## Adding a new factor to an existing domain

1. Add the factor to `weights` in a new manifest version; re-normalize all weights so they still sum to 10000 bps.
2. Add a corresponding entry to `REASON_TEMPLATES` in `adverse-action/adverseActionNotice.ts` so decline reasons render correctly for the new factor.
3. Update the domain's `normalize*` function to produce a WAD score for the new factor from raw input.
4. Update the domain's `underwrite*` engine's `factorOrder` array to include the new factor name, matching the manifest key.
5. Add test coverage exercising the new factor's boundary behavior.

## Open items

- Automated validation that `weights` sums to exactly 10000 bps (not currently enforced in code).
- A machine-readable schema (JSON Schema) for `manifest.json`, referenced by the API layer's local-hash computation.
