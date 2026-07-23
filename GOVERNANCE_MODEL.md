# Governance Model

## Who can change what

| Action | Controlled by | Contract |
|---|---|---|
| Publish a new ruleset version | `governor` address | `RulesetRegistry.publishRuleset` |
| Activate a ruleset version | `governor` address | `RulesetRegistry.activateRuleset` |
| Transfer governor role | current `governor` | `RulesetRegistry.transferGovernor` |
| Anchor a decision | any address holding the backend's signing key | `DecisionAnchor.anchorDecision` |

## Current state: single governor (not production-ready)

As implemented, `governor` is a single Ethereum address with unilateral authority to publish and activate rulesets for all three domains. This is a deliberate simplification for the reference implementation and is called out explicitly as a gap in `ARCHITECTURE.md` and the white paper: a single key is a single point of failure, and unilateral rule-changing authority undermines the "governed, not just published" claim this project makes about itself.

## Required before production use

1. **Multisig governance** — replace the single `governor` address with a multisig (e.g. Gnosis Safe) requiring M-of-N signatures to publish or activate a ruleset.
2. **Timelock on activation** — a mandatory delay between `publishRuleset` and `activateRuleset` (e.g. 48–72 hours), giving affected parties (regulators, auditors, the public) a window to review a pending ruleset change before it takes effect.
3. **Separate governance per domain** — consider whether credit, mortgage, and life insurance rulesets should be governed by different bodies (e.g. different regulatory or actuarial review committees), rather than one governor across all three.
4. **On-chain proposal/voting mechanism**, if the intent is genuinely decentralized governance rather than a single controlling organization with a multisig — a DAO-style structure with token- or reputation-weighted voting, or a simpler committee-of-record model, depending on the intended trust model.
5. **Emergency pause mechanism** — a way to halt new decisions (not alter history) if a ruleset is found to be flawed or discriminatory, without requiring a full governance cycle.

## What governance does NOT control

- Historical `DecisionAnchor` records are immutable regardless of any future governance change — this is intentional. Governance controls what rules apply *going forward*; it cannot and should not be able to alter the record of what was decided in the past.
- Raw applicant data, stored off-chain and encrypted, is outside the on-chain governance system entirely and is subject to separate data-governance policy (retention, access control, deletion) not described in this document.

## Relationship to legal/regulatory authority

This governance model is a technical mechanism for provable rule-versioning — it is not a substitute for regulatory oversight, and activating a ruleset on-chain does not constitute legal compliance certification. Any production deployment requires a separate compliance governance process (e.g. fair-lending review, actuarial sign-off) gating what gets published in the first place, upstream of the on-chain mechanism described here.
