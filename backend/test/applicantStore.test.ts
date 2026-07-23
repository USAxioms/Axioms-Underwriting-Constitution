import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ApplicantStore, InMemoryBackend } from "../storage/applicantStore";

function makeStore() {
  const key = randomBytes(32).toString("hex");
  return new ApplicantStore({ backend: new InMemoryBackend(), encryptionKeyHex: key });
}

test("ApplicantStore: rejects encryption keys that are not 32 bytes", () => {
  assert.throws(() => {
    new ApplicantStore({ backend: new InMemoryBackend(), encryptionKeyHex: "tooshort" });
  });
});

test("ApplicantStore: stores and retrieves data correctly (round trip)", async () => {
  const store = makeStore();
  const input = { name: "test applicant", income: 85000, ssn: "000-00-0000" };
  await store.storeApplicantInput("decision-1", input);
  const retrieved = await store.getApplicantInput("decision-1");
  assert.deepEqual(retrieved, input);
});

test("ApplicantStore: returns null for unknown decisionId", async () => {
  const store = makeStore();
  const retrieved = await store.getApplicantInput("nonexistent");
  assert.equal(retrieved, null);
});

test("ApplicantStore: underlying backend never contains plaintext", async () => {
  const backend = new InMemoryBackend();
  const key = randomBytes(32).toString("hex");
  const store = new ApplicantStore({ backend, encryptionKeyHex: key });

  const secret = "very-secret-ssn-123-45-6789";
  await store.storeApplicantInput("decision-2", { ssn: secret });

  const rawStored = await backend.get("applicant-input:decision-2");
  assert.ok(rawStored !== null);
  assert.ok(!rawStored!.includes(secret), "plaintext leaked into storage backend");
});

test("ApplicantStore: deleteApplicantInput removes the record", async () => {
  const store = makeStore();
  await store.storeApplicantInput("decision-3", { foo: "bar" });
  await store.deleteApplicantInput("decision-3");
  const retrieved = await store.getApplicantInput("decision-3");
  assert.equal(retrieved, null);
});

test("ApplicantStore: different keys cannot decrypt each other's data", async () => {
  const backend = new InMemoryBackend();
  const storeA = new ApplicantStore({
    backend,
    encryptionKeyHex: randomBytes(32).toString("hex"),
  });
  const storeB = new ApplicantStore({
    backend,
    encryptionKeyHex: randomBytes(32).toString("hex"),
  });

  await storeA.storeApplicantInput("shared-key", { data: "from A" });
  await assert.rejects(() => storeB.getApplicantInput("shared-key"));
});
