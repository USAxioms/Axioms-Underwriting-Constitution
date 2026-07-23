// backend/api/server.ts
//
// Thin HTTP layer over the existing pipeline:
//   raw JSON -> normalize* -> underwrite* -> ChainClient.anchorDecision
// No business logic lives here — this file only wires requests through
// to the pure functions already built, plus basic input validation.

import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { ethers } from "ethers";

import { normalizeCredit, RawCreditInput } from "../normalize/normalizeCredit";
import { normalizeMortgage, RawMortgageInput } from "../normalize/normalizeMortgage";
import {
  normalizeLifeInsurance,
  RawLifeInsuranceInput,
} from "../normalize/normalizeLifeInsurance";
import { underwriteCredit } from "../engine/underwriteCredit";
import { underwriteMortgage } from "../engine/underwriteMortgage";
import { underwriteLifeInsurance } from "../engine/underwriteLifeInsurance";
import { ChainClient, Domain } from "../chain/chainClient";
import { RulesetManifest } from "../wad/wadTypes";
import { validateCreditInput, validateMortgageInput, validateLifeInsuranceInput } from "./validate";
import { generateAdverseActionNotice, renderNoticeText } from "../adverse-action/adverseActionNotice";

// ---- Chain client setup (env-driven; see .env.example) ----
const chain = new ChainClient({
  rpcUrl: process.env.RPC_URL ?? "",
  privateKey: process.env.BACKEND_PRIVATE_KEY ?? "",
  registryAddress: process.env.REGISTRY_ADDRESS ?? "",
  anchorAddress: process.env.ANCHOR_ADDRESS ?? "",
});

// In-memory ruleset cache; in production this reads the actual local
// manifest.json files per domain and their content hash.
const LOCAL_MANIFESTS: Record<Domain, RulesetManifest> = {
  [Domain.Credit]: require("../ruleset/credit/manifest.json"),
  [Domain.Mortgage]: require("../ruleset/mortgage/manifest.json"),
  [Domain.LifeInsurance]: require("../ruleset/life_insurance/manifest.json"),
};

function localRulesetHash(domain: Domain): string {
  return ethers.id(JSON.stringify(LOCAL_MANIFESTS[domain]));
}

const app = express();
app.use(express.json());

// ---- Request logging (no applicant PII logged — ids only) ----
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/// Shared handler shape for all three domains.
async function handleDecision<TRaw>(opts: {
  domain: Domain;
  domainName: "credit" | "mortgage" | "life_insurance";
  validate: (raw: unknown) => { valid: boolean; errors: string[] };
  normalize: (raw: TRaw) => unknown;
  underwrite: (input: any, manifest: RulesetManifest) => any;
  req: Request;
  res: Response;
}) {
  const { domain, domainName, validate, normalize, underwrite, req, res } = opts;

  const validation = validate(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: "invalid_input", details: validation.errors });
  }

  try {
    // 1. Verify local ruleset matches on-chain active version.
    const active = await chain.getActiveRuleset(domain);
    chain.verifyRulesetHash(localRulesetHash(domain), active.rulesetHash);

    // 2. Normalize + run the deterministic engine.
    const normalized = normalize(req.body as TRaw);
    const result = underwrite(normalized, LOCAL_MANIFESTS[domain]);

    // 3. Anchor the decision (hashes only).
    const decisionId = ethers.id(`${domainName}-${randomUUID()}`);
    const txHash = await chain.anchorDecision({
      decisionId,
      domain,
      inputHash: ChainClient.hashInput(req.body),
      explanationHash: ChainClient.hashExplanation(result.explanationText),
      scoreWad: result.compositeScoreWad,
      approved: result.approved,
    });

    const notice = generateAdverseActionNotice(result, { rulesetUri: active.uri });

    return res.status(200).json({
      decisionId,
      approved: result.approved,
      rulesetVersion: result.rulesetVersion,
      explanation: result.explanationText,
      factors: result.factors,
      adverseActionNotice: notice
        ? { ...notice, noticeText: renderNoticeText(notice) }
        : null,
      onChain: { txHash },
    });
  } catch (err: any) {
    console.error("Decision error:", err.message);
    return res.status(502).json({ error: "decision_failed", message: err.message });
  }
}

app.post("/v1/underwrite/credit", (req, res) =>
  handleDecision<RawCreditInput>({
    domain: Domain.Credit,
    domainName: "credit",
    validate: validateCreditInput,
    normalize: normalizeCredit,
    underwrite: underwriteCredit,
    req,
    res,
  })
);

app.post("/v1/underwrite/mortgage", (req, res) =>
  handleDecision<RawMortgageInput>({
    domain: Domain.Mortgage,
    domainName: "mortgage",
    validate: validateMortgageInput,
    normalize: normalizeMortgage,
    underwrite: underwriteMortgage,
    req,
    res,
  })
);

app.post("/v1/underwrite/life-insurance", (req, res) =>
  handleDecision<RawLifeInsuranceInput>({
    domain: Domain.LifeInsurance,
    domainName: "life_insurance",
    validate: validateLifeInsuranceInput,
    normalize: normalizeLifeInsurance,
    underwrite: underwriteLifeInsurance,
    req,
    res,
  })
);

app.get("/v1/decision/:id", async (req: Request, res: Response) => {
  try {
    const decision = await chain.getDecision(req.params.id);
    return res.status(200).json(decision);
  } catch (err: any) {
    return res.status(404).json({ error: "not_found", message: err.message });
  }
});

app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));

const PORT = process.env.PORT ?? 8080;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Underwriting API listening on :${PORT}`));
}

export { app };
