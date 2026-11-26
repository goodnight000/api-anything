/**
 * The Worker under test: D1 stood in for by node:sqlite running the same migration, installs that sign
 * as identity.ts does, and requests sent straight to the fetch handler. No network.
 */
import { createHash, createPrivateKey, generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { signingText } from "../../src/registry-api.js";
import type { D1Database, D1Statement } from "../src/store.js";
import worker, { type Env } from "../src/worker.js";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

/** The D1 surface the registry uses, over node:sqlite. */
export function d1(): { db: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIGRATIONS).sort()) raw.exec(readFileSync(new URL(f, MIGRATIONS), "utf8"));
  const value = (v: unknown): SQLInputValue => {
    // D1 refuses undefined; so does this, to catch a missing value here rather than in production
    if (v === undefined) throw new Error("D1_TYPE_ERROR: undefined is not a bindable value");
    return typeof v === "boolean" ? (v ? 1 : 0) : (v as SQLInputValue);
  };
  const statement = (sql: string, values: SQLInputValue[] = []): D1Statement => ({
    bind: (...v) => statement(sql, v.map(value)),
    first: async <T>() => (raw.prepare(sql).get(...values) ?? null) as T | null,
    all: async <T>() => ({ results: raw.prepare(sql).all(...values) as T[] }),
    // D1's shape: the rows changed under meta
    run: async () => {
      const r = raw.prepare(sql).run(...values);
      return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  const db: D1Database = {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      raw.exec("BEGIN");
      try {
        const out: unknown[] = [];
        for (const s of statements) out.push(await s.run());
        raw.exec("COMMIT");
        return out;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, raw };
}

export const ADMIN = "test-admin-token";

export function registry(vars: Record<string, string> = {}) {
  const { db, raw } = d1();
  const env: Env = { DB: db, ADMIN_TOKEN: ADMIN, SALT: "test-salt", ...vars };
  return { env, raw };
}

export interface Install {
  key: string;
  privateKey: KeyObject;
}

export function install(): Install {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { key: publicKey.export({ format: "jwk" }).x!, privateKey };
}

export function signed(as: Install, method: string, path: string, body: string, now = Date.now()) {
  const ts = String(now);
  const text = signingText(method, path, ts, createHash("sha256").update(body).digest("hex"));
  const sig = sign(null, Buffer.from(text), createPrivateKey(as.privateKey.export({ format: "pem", type: "pkcs8" })));
  return { "x-aa-key": as.key, "x-aa-ts": ts, "x-aa-sig": sig.toString("base64url") };
}

export interface Sent {
  status: number;
  headers: Headers;
  // biome-ignore lint/suspicious/noExplicitAny: a test reads whatever the endpoint answered
  body: any;
  text: string;
}

export async function send(
  env: Env,
  method: string,
  path: string,
  o: {
    body?: unknown;
    as?: Install;
    ip?: string;
    asn?: number;
    headers?: Record<string, string>;
    ts?: number;
  } = {},
): Promise<Sent> {
  const text = o.body === undefined ? "" : typeof o.body === "string" ? o.body : JSON.stringify(o.body);
  const headers = {
    "cf-connecting-ip": o.ip ?? "203.0.113.9",
    ...(o.as ? signed(o.as, method, path, text, o.ts) : {}),
    ...o.headers,
  };
  const request = new Request(`https://registry.test${path}`, {
    method,
    headers,
    ...(method === "GET" ? {} : { body: text }),
  });
  if (o.asn) Object.defineProperty(request, "cf", { value: { asn: o.asn } });
  const res = await worker.fetch(request, env);
  const body = await res.text();
  let parsed: unknown = body;
  if (res.headers.get("content-type")?.startsWith("application/json")) parsed = JSON.parse(body);
  return { status: res.status, headers: res.headers, body: parsed, text: body };
}

// biome-ignore lint/suspicious/noExplicitAny: fixtures are overridden field by field
export const op = (over: Record<string, any> = {}) => ({
  name: "searchBooks",
  description: "Find books by title words, with their ratings",
  request: { method: "GET", url: "https://www.example.com/api/search?q=dune", headers: {} },
  slots: [{ param: "q", at: ["query:q"] }],
  trigger: { url: "https://www.example.com/search?q={q}" },
  match: { host: "www.example.com", path: "/api/search" },
  response: { format: "json", pick: ["title", "avgRating"] },
  params: [{ name: "q", type: "string", required: true, example: "dune", description: "title words" }],
  readOnly: true,
  ...over,
});

export const site = {
  name: "example-com",
  domain: "example.com",
  baseUrl: "https://www.example.com",
  displayName: "Books",
  description: "A catalog of books and their ratings.",
};

export const evidence = { clientVersion: "0.1.0", learnedLoggedIn: false, cleanReplay: "ok" as const };

// biome-ignore lint/suspicious/noExplicitAny: fixtures are overridden field by field
export const upload = (o: { site?: any; operation?: any; evidence?: any; parent?: string } = {}) => ({
  site: o.site ?? site,
  operation: o.operation ?? op(),
  evidence: o.evidence ?? evidence,
  ...(o.parent ? { parent: o.parent } : {}),
});

/** A report from `as` on the network of `ip`. */
export const report = (env: Env, as: Install, hash: string, outcome: string, ip = "198.51.100.7") =>
  send(env, "POST", "/v1/reports", { as, ip, body: { reports: [{ hash, outcome }] } });

export const seed = (env: Env, body: unknown) =>
  send(env, "POST", "/v1/admin/seed", { body, headers: { authorization: `Bearer ${ADMIN}` } });
