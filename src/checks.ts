/**
 * Proof that an operation works: `verify` calls each read with its stored example and its checks,
 * judges every answer pass, fail or inconclusive, and keeps the outcomes per op, which `publish`
 * reads to refuse a spec whose checks fail.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import { asText } from "./codec.js";
import { type CallOptions, type CallResult, call } from "./execute.js";
import { home, readJson, safeName, writePrivate } from "./session.js";
import type { Check, Operation, Site } from "./spec.js";
import { loadSite, updateSite } from "./store.js";

export type Outcome = "pass" | "fail" | "inconclusive";

export interface CaseResult {
  op: string;
  /** "example", or "check <n>" (1-based, in the op's `checks`) */
  case: string;
  expect: Check["expect"];
  outcome: Outcome;
  /** what the answer was: result, empty, input, or the class of a failure */
  got: string;
  args?: Check["args"];
  purpose?: string;
  tier?: number;
  healed?: boolean;
  reason?: string;
  next?: string;
  ms?: number;
}

interface OpRecord {
  /** of the op as it was when its cases ran; a changed op has no record */
  hash: string;
  at: string;
  results: CaseResult[];
}

const recordFile = (site: string) => join(home(), "checks", `${safeName(site)}.json`);

export const loadRecord = (site: string): Record<string, OpRecord> =>
  readJson<Record<string, OpRecord>>(recordFile(site), {});

/** The op's identity for its record: everything but when it was learned and the mark a verify clears. */
export function opHash(op: Operation): string {
  const { learnedAt: _at, unproven: _u, ...rest } = op;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex").slice(0, 16);
}

const isEmpty = (d: unknown) =>
  d === undefined ||
  d === null ||
  d === "" ||
  (Array.isArray(d) && !d.length) ||
  (typeof d === "object" && !Array.isArray(d) && !Object.keys(d as object).length);

/**
 * A challenge, a sign-in page, a rate limit or a server that failed or could not be reached says
 * nothing about the op: inconclusive, counted neither way.
 */
export function judgeCase(expect: Check["expect"], r: CallResult): { outcome: Outcome; got: string } {
  const got = r.ok ? (isEmpty(r.data) ? "empty" : "result") : r.class === "input" ? "input" : r.class;
  if (!r.ok && (r.class === "blocked" || r.class === "auth" || r.class === "rate" || r.server))
    return { outcome: "inconclusive", got };
  return { outcome: got === expect ? "pass" : "fail", got };
}

/** The op's stored example args, defaults filled; undefined when a required param has neither. */
function exampleArgs(op: Operation): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const p of op.params) {
    const v = p.example ?? p.default;
    if (v !== undefined) out[p.name] = v;
    else if (p.required) return undefined;
  }
  return out;
}

/**
 * Two passing cases that answered differently while their args differ in `params` and in nothing
 * else: what changed the answer was one of those params.
 */
function answersDiffer(op: Operation, params: string[], answers: { args: Record<string, unknown>; data: string }[]) {
  const value = (a: Record<string, unknown>, p: Operation["params"][number]) => asText(a[p.name] ?? p.default ?? "");
  return answers.some((a, i) =>
    answers.slice(i + 1).some((b) => {
      if (a.data === b.data) return false;
      const changed = op.params.filter((p) => value(a.args, p) !== value(b.args, p)).map((p) => p.name);
      return changed.length > 0 && changed.every((n) => params.includes(n));
    }),
  );
}

export interface Verified {
  results: (CaseResult | { op: string; skipped: string })[];
  /** ops whose `unproven` mark this run cleared: their cases answered differently for different args */
  proven: string[];
}

/** Run every read's example and checks, record the outcomes, and clear `unproven` where the answers differ. */
export async function verifySite(name: string, opts: CallOptions = {}): Promise<Verified> {
  const site = loadSite(name)?.site;
  if (!site) throw new Error(`no site "${name}"`);
  const results: Verified["results"] = [];
  const proven: string[] = [];
  const ran: Record<string, CaseResult[]> = {};
  for (const op of site.operations) {
    if (!op.readOnly) continue;
    const example = exampleArgs(op);
    const cases: [string, Record<string, unknown>, Check["expect"], Check?][] = [
      ...(example ? [["example", example, "result"] as [string, Record<string, unknown>, Check["expect"]]] : []),
      ...(op.checks ?? []).map((c, i): [string, Record<string, unknown>, Check["expect"], Check] => [
        `check ${i + 1}`,
        c.args,
        c.expect,
        c,
      ]),
    ];
    if (!cases.length) {
      const missing = op.params.filter((p) => p.required && p.example === undefined && p.default === undefined);
      results.push({ op: op.name, skipped: `no example for ${missing.map((p) => p.name).join(", ")}, and no checks` });
      continue;
    }
    const answers: { args: Record<string, unknown>; data: string }[] = [];
    ran[op.name] = [];
    for (const [label, args, expect, check] of cases) {
      const r = await call(name, op.name, args, opts);
      const j = judgeCase(expect, r);
      if (j.outcome === "pass" && (j.got === "result" || j.got === "empty"))
        answers.push({ args, data: JSON.stringify(r.data ?? null) });
      const one: CaseResult = {
        op: op.name,
        case: label,
        expect,
        ...j,
        ...(check ? { args: check.args, ...(check.purpose ? { purpose: check.purpose } : {}) } : {}),
        ...(r.tier ? { tier: r.tier } : {}),
        ...(r.healed ? { healed: true } : {}),
        ...(j.outcome !== "pass" ? { reason: r.reason ?? `answered ${j.got}, expected ${expect}`, next: r.next } : {}),
        ms: r.ms,
      };
      results.push(one);
      ran[op.name]!.push(one);
    }
    if (op.unproven && answersDiffer(op, op.unproven.params, answers)) proven.push(op.name);
  }
  if (proven.length)
    updateSite(name, (cur) => {
      if (!cur) throw new Error(`site "${name}" disappeared during verify`);
      return {
        ...cur,
        operations: cur.operations.map((o) => {
          if (!proven.includes(o.name)) return o;
          const { unproven: _, ...rest } = o;
          return rest;
        }),
      };
    });
  // Hashed as the ops are now: a call may have healed one, and that is the version its answers came from.
  const now = loadSite(name)?.site ?? site;
  const record = loadRecord(name);
  const at = new Date().toISOString();
  for (const op of now.operations) if (ran[op.name]) record[op.name] = { hash: opHash(op), at, results: ran[op.name]! };
  for (const k of Object.keys(record)) if (!now.operations.some((o) => o.name === k)) delete record[k];
  writePrivate(recordFile(name), JSON.stringify(record, null, 1));
  return { results, proven };
}

export interface Gate {
  errors: string[];
  /** the record's cases for every op, current ones only, for the pull request */
  rows: { op: string; verified?: string; results: CaseResult[] }[];
}

const label = (r: CaseResult) =>
  `${r.case}${
    r.args
      ? ` (${Object.entries(r.args)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")})`
      : ""
  }`;

/**
 * What `publish` asks of each op beyond the shared rules (which refuse an `unproven` mark): for an op
 * with checks, a record of them on this version of it with no case failing. Every counted case must
 * pass; an inconclusive one is shown and counted neither way.
 */
export function gate(site: Site): Gate {
  const record = loadRecord(site.name);
  const errors: string[] = [];
  const rows: Gate["rows"] = [];
  for (const op of site.operations) {
    const rec = record[op.name];
    const current = rec && rec.hash === opHash(op) ? rec : undefined;
    if (op.checks?.length && !current)
      errors.push(`${op.name}: its checks have not run on this version of it: api-anything verify ${site.name}`);
    for (const r of current?.results ?? [])
      if (r.outcome === "fail") errors.push(`${op.name}: ${label(r)} expects ${r.expect}, and answered ${r.got}`);
    rows.push({ op: op.name, ...(current ? { verified: current.at } : {}), results: current?.results ?? [] });
  }
  return { errors, rows };
}

/** The gate's record as the pull request shows it: no reasons, which may quote the publisher's pages. */
export function checksTable(rows: Gate["rows"]): string[] {
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 200);
  return [
    "| operation | case | expects | outcome |",
    "|---|---|---|---|",
    ...rows.flatMap((row) =>
      row.results.length
        ? row.results.map(
            (r) =>
              `| \`${cell(row.op)}\` | ${cell(label(r))}${r.purpose ? `: ${cell(r.purpose)}` : ""} | ${r.expect} | ${r.outcome}${r.outcome === "pass" ? "" : ` (${r.got})`} |`,
          )
        : [`| \`${cell(row.op)}\` | not verified | | |`],
    ),
  ];
}
