# Axioms-Underwriting-Constitution

A deterministic, versioned, on-chain-governed underwriting engine for credit, mortgage, and life insurance decisions. Extends the transparency model of [Axioms-Credit-Constitution](../Axioms-Credit-Constitution) from scoring into full underwriting decisions (approve/decline), across three domains.

## Status

Reference architecture. Math, engines, and the encrypted storage layer are unit-tested (40 passing tests). Solidity contracts are unaudited and untested. Not reviewed by counsel. **Do not use for real underwriting decisions without legal, actuarial, and security review.**

## Why

Black-box underwriting models produce adverse-action reasons via post-hoc approximation (e.g. feature importance), not the literal decision mechanism. This project makes the explanation and the decision logic the same artifact — see [`WHITE_PAPER.md`](./WHITE_PAPER.md) for the full argument.

## Structure

```
backend/
  wad/            deterministic WAD (18-decimal fixed point) math + shared types
  normalize/      raw applicant data -> 0..1 WAD favorability scores
  engine/         credit / mortgage / life insurance decision engines
  ruleset/        published, versioned weights + thresholds per domain
  adverse-action/ ECOA/Reg B-aligned adverse action notice generator
  chain/          backend <-> smart contract client (ethers.js)
  storage/        encrypted (AES-256-GCM) raw applicant data store
  api/            Express HTTP layer wiring the above together
  test/           unit tests (node:test) — 40 passing

contracts/
  RulesetRegistry.sol   governs which ruleset version is authoritative, per domain
  DecisionAnchor.sol    tamper-evident hash trail of every decision

docs/
  EXECUTIVE_SUMMARY.md
  WHITE_PAPER.md
  ARCHITECTURE.md
  RULESET_SPEC.md
  GOVERNANCE_MODEL.md
```

## How a decision is made

1. Raw applicant data (`POST /v1/underwrite/{credit|mortgage|life-insurance}`) is validated.
2. Backend pulls the active ruleset hash from `RulesetRegistry` on-chain and verifies it matches the local ruleset file — refuses to proceed on mismatch.
3. Raw data is normalized into 0..1 WAD favorability scores per factor.
4. The domain engine computes a weighted composite (pure WAD arithmetic) and compares it to the published threshold.
5. If declined, an adverse action notice is generated from the same factor data used to decide.
6. The decision (hashes only — no raw data) is anchored on-chain via `DecisionAnchor`.
7. Raw applicant data is stored encrypted, off-chain, keyed to the same decision ID.

## Running tests

```
npx tsx --test backend/test/*.test.ts
```

## License

See `LICENSE`.
