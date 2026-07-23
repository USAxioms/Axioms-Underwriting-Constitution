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
///
/// STATUS: reference implementation, NOT audited. Single-governor
/// access control is a known centralization risk — see GOVERNANCE_MODEL.md.
/// Do not deploy to mainnet with real funds/decisions without a security
/// audit and a multisig/timelock governor.
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
