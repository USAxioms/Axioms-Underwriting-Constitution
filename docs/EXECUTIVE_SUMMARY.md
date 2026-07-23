# Executive Summary

## Axioms-Underwriting-Constitution

### The Problem

Underwriting decisions in credit, mortgage, and life insurance are made today mostly by proprietary, opaque scoring models. Applicants who are denied receive reasons that are frequently *post-hoc approximations* — a feature-importance calculation run after a black-box model produces a decision — rather than the literal logic that produced the decision. Regulation (ECOA, FCRA, state insurance codes) requires "specific reasons" for adverse action, but does not require that those reasons be the actual mechanism of the decision. That gap is the core problem this project addresses.

### The Approach

Axioms-Underwriting-Constitution is a deterministic, versioned, publicly auditable ruleset for underwriting decisions across three domains: credit, mortgage, and life insurance. Three properties define it:

1. **Deterministic math** — every decision is produced by explicit, published weights applied to explicit, published factors, using fixed-point (WAD, 18-decimal) arithmetic. No machine learning, no black box, no floating-point drift.
2. **Published, versioned rulesets** — the weights and thresholds that govern a decision are public before any decision is made, and every ruleset change is versioned.
3. **On-chain governance and audit trail** — a smart contract layer (`RulesetRegistry`, `DecisionAnchor`) governs which ruleset version is authoritative and anchors a tamper-evident hash record of every decision against that version. This proves *which rules were actually in effect* for any given decision — a guarantee that a merely-published policy document cannot make on its own.

### What "Transparent" Means Here, Precisely

- The explanation attached to any decision **is** the decision logic — not a summary generated after the fact.
- Anyone can inspect the ruleset, the weights, and the math, before or after applying.
- Anyone can verify, via the on-chain record, that the ruleset used for a specific decision matches what was published and active at that time.

### What Is Not Yet True

This is a working reference architecture with unit-tested math, engines, an API layer, adverse-action-notice generation, and an encrypted applicant-data store — not a production-audited financial system. Specifically outstanding:

- No Solidity contract test suite or security audit
- Single-governor key on the on-chain contracts (centralization risk; needs multisig)
- Default rulesets are illustrative, not calibrated against real underwriting/actuarial standards
- No legal or compliance review of adverse-action notice language or fair-lending/disparate-impact behavior
- No production-grade storage backend wired in (reference implementation only)

### Intended Audience

Lenders, insurers, and regulators evaluating an alternative to black-box underwriting; engineering teams building compliant decision infrastructure; researchers studying algorithmic transparency in financial services.
