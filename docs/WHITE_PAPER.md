# White Paper: Axioms-Underwriting-Constitution

## Abstract

Underwriting decisions that determine access to credit, housing finance, and life insurance are, in most of the industry today, produced by models whose internal logic is not disclosed to the people affected by them. This paper describes a deterministic, versioned, on-chain-governed alternative: a published ruleset architecture in which the explanation given to an applicant is structurally identical to the mechanism that produced the decision, and in which the specific ruleset version used for any decision is provable after the fact.

## 1. The Black-Box Problem

Regulations including the Equal Credit Opportunity Act (ECOA) and the Fair Credit Reporting Act (FCRA) require lenders to provide "specific reasons" when denying credit. In practice, when the underlying model is a black box (a gradient-boosted tree ensemble, a neural network, or similar), the reasons given are typically derived from a secondary explainability technique — feature importance scores, SHAP values, or similar — applied *after* the decision has already been made. This creates a structural gap: the stated reasons are a plausible approximation of what drove the decision, not a guaranteed account of it. Two applicants with different underlying model behavior could receive similar generic reason codes; the explanation and the decision are not provably the same object.

This gap is not necessarily due to bad faith — approximated explanations are often the best available option once an opaque model is chosen. The problem is upstream, in the choice of an opaque model for a decision that regulation says must be explicable.

## 2. Design Principle: The Explanation Is the Logic

This project's central design choice is to make the explanation and the decision mechanism the same artifact. A decision is produced by:

```
composite_score = Σ (factor_score_i × weight_i)
approved = composite_score >= threshold
```

where every `factor_score_i`, every `weight_i`, and `threshold` are values drawn directly from a published ruleset file. The explanation generated for any decision lists exactly these factors, scores, and weights — because there is nothing else the decision could have been made from. There is no separate approximation step because there is no black box to approximate.

## 3. Deterministic Arithmetic (WAD)

All scoring math uses WAD (18-decimal fixed-point) arithmetic implemented over native integers (bigint), rather than IEEE 754 floating point. This has two consequences relevant to a compliance context:

- **Reproducibility**: the same inputs produce bit-identical outputs regardless of platform, language runtime, or hardware — a property floating point does not guarantee.
- **Auditability**: a regulator or applicant re-running the published math against the published ruleset and their own input data will get the exact same result, not an approximately-equal one.

## 4. On-Chain Governance and Audit Trail

Two smart contracts anchor the system's provability claims:

- **`RulesetRegistry`** governs which ruleset version is authoritative, per domain (credit, mortgage, life insurance). A ruleset must be explicitly published and then explicitly activated by the governing party before the backend will use it.
- **`DecisionAnchor`** records a hash-only audit entry for every decision: the ruleset version and hash in effect, a hash of the (private, off-chain) applicant input, a hash of the generated explanation, the composite score, and the approve/decline outcome.

This produces a distinction worth stating precisely: **publishing a policy is a claim; anchoring a versioned hash trail is proof.** A company can publish underwriting criteria today without any on-chain component — but nothing prevents them from quietly using different criteria in practice. An immutable, timestamped version history closes that gap.

No raw applicant data is ever written on-chain. Only hashes are. Raw data is stored off-chain in an encrypted store (AES-256-GCM), keyed to the same decision identifier, so an authorized party can still retrieve the underlying record without any of it having touched a public ledger.

## 5. Scope: Credit, Mortgage, Life Insurance

The architecture is domain-agnostic by construction: a shared WAD math library and shared on-chain governance layer, with independent, domain-specific ruleset files and factor sets per vertical. This repository implements three domains as a proof of the pattern's generality, not because these three domains share underwriting logic — they do not, and their rulesets, factors, and thresholds are entirely independent.

## 6. Regulatory Alignment

This architecture is designed to align with, not circumvent, existing frameworks:

- **ECOA / Regulation B** specific-reasons requirements are satisfied structurally, since reasons are derived from the same factor data used to decide.
- **FCRA** adverse action notice requirements are supported by the notice-generation module, which ranks reasons by weighted contribution to the decision.
- Fair-lending and disparate-impact analysis is *not* automated by this system — a deterministic ruleset can still produce disparate impact if its factors or weights correlate with protected classes. Determinism makes such analysis easier to perform (the ruleset is fully specified and inspectable) but does not perform it automatically. This remains a required compliance step, not something this architecture claims to solve on its own.

## 7. Limitations and Open Problems

- **Gameability**: a fully public ruleset can, in principle, be reverse-engineered by applicants to structure applications toward approval, in ways an opaque model's obscurity would have prevented. This is an inherent tradeoff of transparency, not a flaw unique to this design, and is a standard-setting question the project has not fully resolved.
- **Rigidity**: deterministic rules cannot exercise discretion for legitimate edge cases the way a human underwriter can. Where this matters, an appeals or manual-override process is a necessary complement, outside the scope of the deterministic engine itself.
- **Governance centralization**: as implemented, `RulesetRegistry` is controlled by a single governor address. Production use requires a multisig or DAO-style governance structure to avoid a single point of failure or unilateral rule changes.
- **Calibration**: the default weights and thresholds shipped in this repository are illustrative defaults, not the product of actuarial or credit-risk calibration, and must not be used for real decisions without that work.

## 8. Conclusion

Transparency in underwriting is achievable as a structural property of a system's design, not merely as a disclosure practice layered on top of an opaque model. This project demonstrates a working, tested reference implementation of that structural approach across three regulated financial domains, while being explicit about what remains — legal review, actuarial calibration, governance decentralization, and fair-lending analysis — before such a system could respons­ibly make real decisions about real people.
