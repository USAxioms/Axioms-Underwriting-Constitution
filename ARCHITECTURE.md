# Architecture

## Layered design

```
┌─────────────────────────────────────────────────────────┐
│  API layer (Express)                                     │
│  validates input, orchestrates the pipeline below         │
└───────────────┬─────────────────────────────────────────┘
                │
   ┌────────────┼────────────────────┬─────────────────────┐
   ▼            ▼                    ▼                      ▼
normalize/   engine/            adverse-action/          storage/
raw -> WAD   WAD math ->        decline -> ranked         encrypted raw
scores       decision           reasons                   applicant data
                │
                ▼
              chain/ (ChainClient)
                │
   ┌────────────┴────────────┐
   ▼                          ▼
RulesetRegistry.sol      DecisionAnchor.sol
(governs active           (append-only decision
 ruleset per domain)       hash trail)
```

## Data flow and trust boundaries

**Before scoring:** the backend must fetch the active ruleset hash from `RulesetRegistry` and confirm it matches the local ruleset file (`ChainClient.verifyRulesetHash`). This is a hard dependency, not an optional check — the engine should not run against an unverified ruleset. This is the concrete meaning of "the blockchain governs the backend": the backend cannot silently use a stale or unapproved ruleset, because it's required to check on-chain before every decision.

**During scoring:** everything is deterministic WAD arithmetic. No network calls, no randomness, no floating point. Given the same normalized input and the same ruleset, the output is always identical (verified in `engines.test.ts`).

**After scoring:** two things happen, to two different places:
- A **hash-only** record goes on-chain via `DecisionAnchor` — provable, public, immutable.
- The **raw applicant data** goes into `ApplicantStore`, encrypted at rest (AES-256-GCM), off-chain, keyed by the same decision ID. This is deletable (right-to-erasure); the on-chain hash is not, and doesn't need to be, since a hash alone reveals nothing once its source is deleted.

## Why compute stays off-chain

Smart contracts are appropriate for governance (which ruleset is active) and for append-only audit records (what was decided, against what ruleset), because those benefit from immutability and public verifiability. They are not appropriate for the scoring computation itself — on-chain compute is slow and expensive, and applicant data must never be public. The split in this architecture is deliberate: **governance and proof on-chain, computation and private data off-chain.**

## Shared vs. domain-specific code

`wad/` (math + types) and `chain/` (contract client) are shared across all three domains unchanged. `normalize/`, `engine/`, and `ruleset/` are one set per domain (credit, mortgage, life insurance) — independent factor lists, weights, and thresholds, but built on the same underlying math and governance primitives. Adding a fourth domain means adding a new `normalize/normalizeX.ts`, `engine/underwriteX.ts`, and `ruleset/x/manifest.json` — no changes to the shared layers.

## Known architectural gaps

- Single-governor access control on `RulesetRegistry` — no multisig/timelock yet.
- No formal schema validation library in `api/validate.ts` (hand-rolled bounds checks).
- `InMemoryBackend` in `storage/` is dev-only; production needs a real encrypted datastore.
- No rate limiting, authn/authz, or request signing on the API layer yet.
