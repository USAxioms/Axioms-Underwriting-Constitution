# Underwriting Fairness Rules

## Purpose
Defines the constitutional fairness requirements that ensure underwriting
decisions are free from bias, discrimination, and arbitrary variability across
all domains and applicant types.

## Deterministic Fairness
Fairness must be enforced through deterministic, transparent rules. Identical
inputs must always produce identical outcomes, regardless of applicant
demographics, identity attributes, or non-financial characteristics.

## Required Inputs
Fairness evaluation uses:
- Eligibility determination
- Risk score
- Exposure determination
- Compliance status
- Domain-specific fairness factors
- Safety-layer validations

## Fairness Principles
Underwriting must adhere to:
- Constitutional neutrality
- Non-discrimination across protected attributes
- Cross-domain consistency
- Threshold integrity
- Regulator-aligned fairness standards

## Fairness Constraints
Underwriting decisions must not:
- Use demographic attributes
- Use behavioral proxies for protected classes
- Introduce discretionary overrides
- Depend on opaque or un-auditable models

## Safety Layer Requirements
Fairness evaluation must pass through the constitutional safety layer to:
- Detect and eliminate bias
- Validate fairness thresholds
- Ensure consistent treatment across domains
- Prevent proxy discrimination

## Auditability
All fairness evaluations must be immutably logged in the cognitive ledger,
including:
- Input set
- Fairness checks performed
- Safety-layer validations
- Ruleset version
- Final fairness determination
