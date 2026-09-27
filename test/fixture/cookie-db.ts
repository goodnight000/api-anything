/** Build synthetic browser cookie DBs for the import tests, matching what real browsers write. */
import { createCipheriv, createHash, pbkdf2Sync } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface CookieRow {
  host_key: string;
  name: string;
  value: string;
  path?: string;
  expires_utc?: number;
  secure?: boolean;
  httpOnly?: boolean;
  samesite?: number;
}

function encrypt(value: string, key: Buffer, metaVersion: number, hostKey: string): Buffer {
  const cipher = createCipheriv("aes-128-cbc", key, Buffer.alloc(16, 0x20));
  const prefix = metaVersion >= 24 ? createHash("sha256").update(hostKey).digest() : Buffer.alloc(0);
  return Buffer.concat([Buffer.from("v10"), cipher.update(Buffer.concat([prefix, Buffer.from(value, "utf8")])), cipher.final()]);
}

/** Write <profileDir>/Network/Cookies as modern Chrome does, with v10-encrypted values. */
export function makeChromiumDb(profileDir: string, rows: CookieRow[], o: { password: string; iterations?: number; metaVersion?: number }): void {
  const metaVersion = o.metaVersion ?? 24;
  const key = pbkdf2Sync(o.password, "saltysalt", o.iterations ?? 1003, 16, "sha1");
  mkdirSync(join(profileDir, "Network"), { recursive: true });
  const db = new DatabaseSync(join(profileDir, "Network", "Cookies"));
  db.exec("DROP TABLE IF EXISTS meta; DROP TABLE IF EXISTS cookies");
  db.exec("CREATE TABLE meta(key TEXT, value TEXT)");
  db.prepare("INSERT INTO meta VALUES('version', ?)").run(String(metaVersion));
  db.exec(
    "CREATE TABLE cookies(host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB, path TEXT, expires_utc INTEGER, is_secure INTEGER, is_httponly INTEGER, samesite INTEGER)",
  );
  const stmt = db.prepare("INSERT INTO cookies VALUES(?,?,?,?,?,?,?,?,?)");
  for (const r of rows) {
    stmt.run(r.host_key, r.name, "", encrypt(r.value, key, metaVersion, r.host_key), r.path ?? "/", r.expires_utc ?? 0, r.secure ? 1 : 0, r.httpOnly ? 1 : 0, r.samesite ?? -1);
  }
  db.close();
}

/** Write <profileDir>/cookies.sqlite as Firefox does (moz_cookies is plaintext). */
export function makeFirefoxDb(profileDir: string, rows: CookieRow[]): void {
  mkdirSync(profileDir, { recursive: true });
  const db = new DatabaseSync(join(profileDir, "cookies.sqlite"));
  db.exec("CREATE TABLE moz_cookies(host TEXT, name TEXT, value TEXT, path TEXT, expiry INTEGER, isSecure INTEGER, isHttpOnly INTEGER, sameSite INTEGER)");
  const stmt = db.prepare("INSERT INTO moz_cookies VALUES(?,?,?,?,?,?,?,?)");
  for (const r of rows) stmt.run(r.host_key, r.name, r.value, r.path ?? "/", r.expires_utc ?? 0, r.secure ? 1 : 0, r.httpOnly ? 1 : 0, r.samesite ?? 0);
  db.close();
}
