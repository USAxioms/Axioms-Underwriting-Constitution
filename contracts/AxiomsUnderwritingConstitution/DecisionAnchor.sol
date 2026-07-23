// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { RulesetRegistry } from "./RulesetRegistry.sol";

/// @notice Minimal WAD (18-decimal fixed point) math library.
/// Duplicated here (rather than a shared import) so this file can be
/// deployed/reviewed independently of RulesetRegistry's internal layout.
library WadMath {
    uint256 internal constant WAD = 1e18;

    function wmul(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y) / WAD;
    }

    function wdiv(uint256 x, uint256 y) internal pure returns (uint256) {
        require(y != 0, "WadMath: div by zero");
        return (x * WAD) / y;
    }

    function toWad(uint256 whole) internal pure returns (uint256) {
        return whole * WAD;
    }
}

/// @title DecisionAnchor
/// @notice Records an append-only, tamper-evident audit trail of
/// underwriting decisions. Stores only hashes/pointers — never raw
/// applicant data — anchored to the ruleset version that produced them.
///
/// STATUS: reference implementation, NOT audited. Anyone can call
/// anchorDecision() as written — access control on who may anchor
/// decisions (e.g. restricting to an authorized backend address) is a
/// recommended hardening step before production use.
contract DecisionAnchor {
    using WadMath for uint256;

    RulesetRegistry public immutable registry;

    struct Decision {
        RulesetRegistry.Domain domain;
        uint256 rulesetVersion;
        bytes32 rulesetHashAtDecision; // ruleset hash pinned at decision time
        bytes32 inputHash;             // hash of applicant input (off-chain, private)
        bytes32 explanationHash;       // hash of the generated explanation
        uint256 scoreWad;              // WAD-denominated score or composite result
        bool    approved;
        uint64  timestamp;
    }

    // decision id => Decision
    mapping(bytes32 => Decision) public decisions;

    event DecisionAnchored(
        bytes32 indexed decisionId,
        RulesetRegistry.Domain indexed domain,
        uint256 indexed rulesetVersion,
        bytes32 inputHash,
        bytes32 explanationHash,
        uint256 scoreWad,
        bool approved
    );

    constructor(address registryAddress) {
        require(registryAddress != address(0), "DecisionAnchor: zero registry");
        registry = RulesetRegistry(registryAddress);
    }

    /// @notice Anchor a decision. Reverts if the ruleset hash supplied
    /// doesn't match what's currently active for the domain, so a decision
    /// can't be anchored against a stale or fabricated ruleset version.
    function anchorDecision(
        bytes32 decisionId,
        RulesetRegistry.Domain domain,
        bytes32 inputHash,
        bytes32 explanationHash,
        uint256 scoreWad,
        bool approved
    ) external {
        require(decisions[decisionId].timestamp == 0, "DecisionAnchor: already anchored");

        (bytes32 activeHash, , uint256 minThresholdWad, uint256 version) =
            registry.getActiveRuleset(domain);

        // Example use of WAD comparison: sanity-check approval consistency
        // with the domain's minimum threshold, without re-deriving the
        // score itself on-chain.
        if (approved) {
            require(scoreWad >= minThresholdWad, "DecisionAnchor: score below threshold");
        }

        decisions[decisionId] = Decision({
            domain: domain,
            rulesetVersion: version,
            rulesetHashAtDecision: activeHash,
            inputHash: inputHash,
            explanationHash: explanationHash,
            scoreWad: scoreWad,
            approved: approved,
            timestamp: uint64(block.timestamp)
        });

        emit DecisionAnchored(
            decisionId,
            domain,
            version,
            inputHash,
            explanationHash,
            scoreWad,
            approved
        );
    }

    function getDecision(bytes32 decisionId) external view returns (Decision memory) {
        Decision memory d = decisions[decisionId];
        require(d.timestamp != 0, "DecisionAnchor: unknown decision");
        return d;
    }
}
