// backend/storage/applicantStore.ts
//
// Raw applicant data (name, income, health details, etc.) must NEVER
// go on-chain — only hashes do. This module is where the raw data
// actually lives: encrypted at rest, keyed by the same decisionId used
// in DecisionAnchor, so a regulator/auditor/applicant with proper
// authorization can look up "what data produced hash X" without that
// data ever having touched a public ledger.
//
// This is a reference implementation using AES-256-GCM and a pluggable
// storage backend interface. Swap `InMemoryBackend` for a real backend
// (Postgres with column encryption, a KMS-backed S3 bucket, etc.)
// before this touches real applicant data.

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

export interface StorageBackend {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

/// Reference in-memory backend for local development/testing only.
/// Data does not persist across process restarts. Do not use in
/// production — swap for a real encrypted-at-rest datastore.
export class InMemoryBackend implements StorageBackend {
  private store = new Map<string, string>();

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export interface EncryptedRecord {
  iv: string;         // base64
  authTag: string;    // base64
  ciphertext: string; // base64
}

export class ApplicantStore {
  private backend: StorageBackend;
  private encryptionKey: Buffer; // 32 bytes, AES-256

  constructor(opts: { backend: StorageBackend; encryptionKeyHex: string }) {
    if (Buffer.from(opts.encryptionKeyHex, "hex").length !== 32) {
      throw new Error(
        "ApplicantStore: encryption key must be 32 bytes (64 hex chars) for AES-256"
      );
    }
    this.backend = opts.backend;
    this.encryptionKey = Buffer.from(opts.encryptionKeyHex, "hex");
  }

  private encrypt(plaintext: string): EncryptedRecord {
    const iv = randomBytes(12); // 96-bit IV, standard for GCM
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  private decrypt(record: EncryptedRecord): string {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      Buffer.from(record.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }

  /// Store raw applicant input, keyed by the same decisionId anchored
  /// on-chain. Only ciphertext is written to the backend.
  async storeApplicantInput(decisionId: string, rawInput: unknown): Promise<void> {
    const record = this.encrypt(JSON.stringify(rawInput));
    await this.backend.put(this.key(decisionId), JSON.stringify(record));
  }

  /// Retrieve and decrypt raw applicant input. In production this call
  /// should be gated behind authorization checks (the applicant
  /// themselves, an authorized underwriter, or an auditor with a valid
  /// legal basis) — that access-control layer is intentionally NOT
  /// implemented here since it depends on the surrounding auth system.
  async getApplicantInput<T = unknown>(decisionId: string): Promise<T | null> {
    const raw = await this.backend.get(this.key(decisionId));
    if (!raw) return null;
    const record: EncryptedRecord = JSON.parse(raw);
    return JSON.parse(this.decrypt(record)) as T;
  }

  /// Right-to-erasure support (e.g. CCPA/GDPR-style deletion requests).
  /// Note: this deletes the raw data but does NOT and cannot alter the
  /// on-chain hash record, which is append-only by design. The hash
  /// alone reveals nothing about the underlying data once deleted.
  async deleteApplicantInput(decisionId: string): Promise<void> {
    await this.backend.delete(this.key(decisionId));
  }

  private key(decisionId: string): string {
    return `applicant-input:${decisionId}`;
  }
}
