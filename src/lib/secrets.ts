/**
 * Secret encryption at rest (AES-256-GCM).
 *
 * ERP credentials, ZATCA private keys, and CSIDs are stored as ciphertext in the
 * database and only decrypted in memory when needed. The master key comes from the
 * ENCRYPTION_MASTER_KEY env var (32 bytes, base64). See docs/05-Architecture.md §7.
 *
 * Token format (base64):  [ iv(12) | authTag(16) | ciphertext ]
 */
import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer {
  const b64 = process.env.ENCRYPTION_MASTER_KEY;
  if (!b64) {
    throw new Error("ENCRYPTION_MASTER_KEY is not set (32-byte base64 key required).");
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_MASTER_KEY must decode to 32 bytes, got ${key.length}.`);
  }
  return key;
}

/** Encrypt a UTF-8 string. Returns a base64 token, or null/empty passthrough. */
export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return plaintext ?? null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, masterKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt a base64 token produced by encryptSecret. */
export function decryptSecret(token: string | null | undefined): string | null {
  if (token == null || token === "") return token ?? null;
  const raw = Buffer.from(token, "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
