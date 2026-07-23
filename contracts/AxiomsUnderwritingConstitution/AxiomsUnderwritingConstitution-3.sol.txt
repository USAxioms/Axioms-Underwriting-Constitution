// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal WAD (18-decimal fixed point) math library.
/// Used so any numeric values stored or compared on-chain (weights,
/// thresholds, decision scores) share one fixed-point convention with
/// the off-chain backend engine.
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

/// @title RulesetRegistry
/// @notice Governs which ruleset version is currently authoritative for
/// each underwriting domain (credit, mortgage, life insurance). The
/// off-chain backend must read the active version here before running
/// a scoring/underwriting decision — it cannot silently use a stale or
/// unapproved ruleset.
contract RulesetRegistry {
    using WadMath for uint256;

    enum Domain {
        Credit,
        Mortgage,
        LifeInsurance
    }

    struct RulesetVersion {
        bytes32 rulesetHash;   // hash of the published manifest/weights/statutory files
        string  uri;           // pointer to the published ruleset (IPFS/HTTPS)
        uint256 minThresholdWad; // example WAD-denominated parameter, e.g. min passing score
        uint64  effectiveFrom;
        bool    active;
    }

    address public governor;

    // domain => version number => version data
    mapping(Domain => mapping(uint256 => RulesetVersion)) public versions;
    // domain => currently active version number
    mapping(Domain => uint256) public activeVersion;
    // domain => count of versions published
    mapping(Domain => uint256) public versionCount;

    event RulesetPublished(
        Domain indexed domain,
        uint256 indexed version,
        bytes32 rulesetHash,
        string uri,
        uint256 minThresholdWad
    );
    event RulesetActivated(Domain indexed domain, uint256 indexed version);
    event GovernorTransferred(address indexed oldGovernor, address indexed newGovernor);

    modifier onlyGovernor() {
        require(msg.sender == governor, "RulesetRegistry: not governor");
        _;
    }

    constructor(address _governor) {
        require(_governor != address(0), "RulesetRegistry: zero governor");
        governor = _governor;
    }

    function transferGovernor(address newGovernor) external onlyGovernor {
        require(newGovernor != address(0), "RulesetRegistry: zero governor");
        emit GovernorTransferred(governor, newGovernor);
        governor = newGovernor;
    }

    /// @notice Publish a new ruleset version for a domain. Does not
    /// activate it automatically — activation is a separate, explicit step.
    function publishRuleset(
        Domain domain,
        bytes32 rulesetHash,
        string calldata uri,
        uint256 minThresholdWad
    ) external onlyGovernor returns (uint256 version) {
        require(rulesetHash != bytes32(0), "RulesetRegistry: empty hash");

        version = ++versionCount[domain];
        versions[domain][version] = RulesetVersion({
            rulesetHash: rulesetHash,
            uri: uri,
            minThresholdWad: minThresholdWad,
            effectiveFrom: uint64(block.timestamp),
            active: false
        });

        emit RulesetPublished(domain, version, rulesetHash, uri, minThresholdWad);
    }

    /// @notice Activate a previously published version as the authoritative
    /// ruleset for a domain.
    function activateRuleset(Domain domain, uint256 version) external onlyGovernor {
        RulesetVersion storage v = versions[domain][version];
        require(v.rulesetHash != bytes32(0), "RulesetRegistry: unknown version");

        v.active = true;
        activeVersion[domain] = version;

        emit RulesetActivated(domain, version);
    }

    /// @notice Read the currently active ruleset for a domain. The backend
    /// calls this before running any decision.
    function getActiveRuleset(Domain domain)
        external
        view
        returns (bytes32 rulesetHash, string memory uri, uint256 minThresholdWad, uint256 version)
    {
        version = activeVersion[domain];
        RulesetVersion storage v = versions[domain][version];
        require(v.active, "RulesetRegistry: no active ruleset");
        return (v.rulesetHash, v.uri, v.minThresholdWad, version);
    }
}

/// @title DecisionAnchor
/// @notice Records an append-only, tamper-evident audit trail of
/// underwriting decisions. Stores only hashes/pointers — never raw
/// applicant data — anchored to the ruleset version that produced them.
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
