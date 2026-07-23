// backend/chain/chainClient.ts
//
// Backend-side interface to the on-chain governance layer.
// Two responsibilities, matching the contracts:
//   1. Pull the currently active ruleset for a domain BEFORE running
//      any underwriting decision (RulesetRegistry).
//   2. Push a hash-only record of the decision AFTER it's computed
//      (DecisionAnchor).
//
// No raw applicant data ever leaves this layer — only hashes.

import { ethers } from "ethers";
import { keccak256, toUtf8Bytes } from "ethers";

// ---- ABIs (trimmed to the functions/events this client uses) ----

const RULESET_REGISTRY_ABI = [
  "function getActiveRuleset(uint8 domain) view returns (bytes32 rulesetHash, string uri, uint256 minThresholdWad, uint256 version)",
  "event RulesetActivated(uint8 indexed domain, uint256 indexed version)",
];

const DECISION_ANCHOR_ABI = [
  "function anchorDecision(bytes32 decisionId, uint8 domain, bytes32 inputHash, bytes32 explanationHash, uint256 scoreWad, bool approved)",
  "function getDecision(bytes32 decisionId) view returns (tuple(uint8 domain, uint256 rulesetVersion, bytes32 rulesetHashAtDecision, bytes32 inputHash, bytes32 explanationHash, uint256 scoreWad, bool approved, uint64 timestamp))",
  "event DecisionAnchored(bytes32 indexed decisionId, uint8 indexed domain, uint256 indexed rulesetVersion, bytes32 inputHash, bytes32 explanationHash, uint256 scoreWad, bool approved)",
];

// Must match Solidity: enum Domain { Credit, Mortgage, LifeInsurance }
export enum Domain {
  Credit = 0,
  Mortgage = 1,
  LifeInsurance = 2,
}

export interface ActiveRuleset {
  rulesetHash: string;
  uri: string;
  minThresholdWad: bigint;
  version: bigint;
}

export interface DecisionInput {
  decisionId: string; // bytes32 hex, e.g. derived from applicant ref + timestamp
  domain: Domain;
  inputHash: string; // bytes32 hex — hash of applicant input, computed off-chain
  explanationHash: string; // bytes32 hex — hash of generated explanation text
  scoreWad: bigint; // WAD-denominated composite score
  approved: boolean;
}

export class ChainClient {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private registry: ethers.Contract;
  private anchor: ethers.Contract;

  constructor(opts: {
    rpcUrl: string;
    privateKey: string; // key for the backend's anchoring account (not the governor key)
    registryAddress: string;
    anchorAddress: string;
  }) {
    this.provider = new ethers.JsonRpcProvider(opts.rpcUrl);
    this.signer = new ethers.Wallet(opts.privateKey, this.provider);
    this.registry = new ethers.Contract(
      opts.registryAddress,
      RULESET_REGISTRY_ABI,
      this.signer
    );
    this.anchor = new ethers.Contract(
      opts.anchorAddress,
      DECISION_ANCHOR_ABI,
      this.signer
    );
  }

  /// Step 1 (must run before scoring): pull the active ruleset for a domain.
  /// The engine should refuse to run if this call reverts (no active ruleset)
  /// or if the returned hash doesn't match the local ruleset file's hash.
  async getActiveRuleset(domain: Domain): Promise<ActiveRuleset> {
    const [rulesetHash, uri, minThresholdWad, version] =
      await this.registry.getActiveRuleset(domain);
    return { rulesetHash, uri, minThresholdWad, version };
  }

  /// Verify the local ruleset files (manifest.json, weights.json, etc.)
  /// match what's active on-chain, before trusting them for a decision.
  verifyRulesetHash(localHash: string, onChainHash: string): void {
    if (localHash.toLowerCase() !== onChainHash.toLowerCase()) {
      throw new Error(
        `ChainClient: local ruleset hash ${localHash} does not match ` +
          `active on-chain hash ${onChainHash}. Refusing to run decision ` +
          `against a stale or unapproved ruleset.`
      );
    }
  }

  /// Step 2 (after scoring): anchor the decision on-chain.
  async anchorDecision(input: DecisionInput): Promise<string> {
    const tx = await this.anchor.anchorDecision(
      input.decisionId,
      input.domain,
      input.inputHash,
      input.explanationHash,
      input.scoreWad,
      input.approved
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /// Read back a previously anchored decision (for audit/verification).
  async getDecision(decisionId: string) {
    return this.anchor.getDecision(decisionId);
  }

  /// Helper: deterministic hash of applicant input, so raw data never
  /// leaves the backend — only this hash is sent on-chain.
  static hashInput(payload: unknown): string {
    return keccak256(toUtf8Bytes(JSON.stringify(payload)));
  }

  static hashExplanation(explanationText: string): string {
    return keccak256(toUtf8Bytes(explanationText));
  }
}

// ---------------------------------------------------------------------
// Example usage inside an underwriting engine (e.g. underwriteMortgage.ts)
// ---------------------------------------------------------------------
//
// const chain = new ChainClient({ rpcUrl, privateKey, registryAddress, anchorAddress });
//
// // 1. Pull + verify active ruleset before running any math
// const active = await chain.getActiveRuleset(Domain.Mortgage);
// const localHash = hashLocalRulesetFiles(); // your existing manifest/weights hashing
// chain.verifyRulesetHash(localHash, active.rulesetHash);
//
// // 2. Run the deterministic engine against the verified ruleset
// const result = runMortgageUnderwriting(applicantInput, active);
//
// // 3. Anchor the decision (hashes only — never raw applicant data)
// await chain.anchorDecision({
//   decisionId: ethers.id(`${applicantRef}-${Date.now()}`),
//   domain: Domain.Mortgage,
//   inputHash: ChainClient.hashInput(applicantInput),
//   explanationHash: ChainClient.hashExplanation(result.explanationText),
//   scoreWad: result.scoreWad,
//   approved: result.approved,
// });
