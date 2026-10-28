/**
 * This install's identity and its sharing choice. The key is an Ed25519 pair made once (`ensureKey`)
 * and kept in `~/.api-anything/key.json` (0600); the registry knows an install only by its public key.
 * `settings.json` holds the answer to the one question (`QUESTION`), asked by setup or by learn_site the
 * first time something could be shared: until it was answered, nothing is shared or reported.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { signingText } from "./registry-api.js";
import { home, readJson, writePrivate } from "./session.js";

interface KeyFile {
  /** the raw 32-byte public key, base64url */
  publicKey: string;
  /** PKCS#8 PEM */
  privateKey: string;
  createdAt: string;
}

export const keyFile = () => join(home(), "key.json");
export const settingsFile = () => join(home(), "settings.json");

export function ensureKey(): KeyFile {
  if (existsSync(keyFile())) return readJson<KeyFile>(keyFile(), undefined as unknown as KeyFile);
  const { privateKey } = generateKeyPairSync("ed25519");
  const k: KeyFile = {
    publicKey: createPublicKey(privateKey).export({ format: "jwk" }).x!,
    privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    createdAt: new Date().toISOString(),
  };
  writePrivate(keyFile(), `${JSON.stringify(k, null, 2)}\n`);
  return k;
}

/** The headers that sign a request to the registry (see `signingText`). */
export function signedHeaders(method: string, path: string, body: string, now = Date.now()): Record<string, string> {
  const k = ensureKey();
  const ts = String(now);
  const text = signingText(method, path, ts, createHash("sha256").update(body).digest("hex"));
  const sig = sign(null, Buffer.from(text), createPrivateKey(k.privateKey)).toString("base64url");
  return { "x-aa-key": k.publicKey, "x-aa-ts": ts, "x-aa-sig": sig };
}

export interface Settings {
  /**
   * share public reads this install learns or heals, report how calls go, and check a few candidates a
   * day in the background. Off until the user answered.
   */
  share: boolean;
  /** when the user answered, ISO time; absent: never asked */
  askedAt?: string;
}

export const QUESTION =
  "Help build the shared catalog? Your agent will share operations it learns from public pages (never your cookies or logins), report under this install's anonymous key whether calls work, and test a few new operations a day from your network. Site searches go to the catalog either way.";

export function loadSettings(): Settings {
  try {
    const s = readJson<Partial<Settings>>(settingsFile(), {}) ?? {};
    return { share: s.share === true && !!s.askedAt, ...(s.askedAt ? { askedAt: s.askedAt } : {}) };
  } catch {
    return { share: false };
  }
}

export function saveSettings(s: Settings): void {
  writePrivate(settingsFile(), `${JSON.stringify(s, null, 2)}\n`);
}

/** Keeps the user's answer to `QUESTION`: it is not asked again. */
export const answerShare = (share: boolean) => saveSettings({ share, askedAt: new Date().toISOString() });
