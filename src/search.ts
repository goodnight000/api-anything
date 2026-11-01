/**
 * Pure pieces of search and the registry's index, with no file or network access, so the registry
 * service shares them: an op's summary, the index entry schema, and how a query scores an entry.
 */
import { createHash } from "node:crypto";
import { parse } from "tldts";
import { z } from "zod";
import { siteOf } from "./domain.js";
import { returnedFields } from "./extract.js";
import type { Operation, Site } from "./spec.js";
import { LIMITS } from "./vet.js";

export const hostsOf = (op: Operation) => {
  const urls = [op.request.url, op.trigger.url, op.trigger.softFrom];
  return [...new Set(urls.flatMap((u) => (u ? [new URL(u).hostname] : [])))];
};

/** One op as the person deciding whether to run it needs to see it. */
export function summarize(op: Operation) {
  const fields = returnedFields(op.response);
  return {
    op: `${op.name}(${op.params.map((p) => `${p.name}${p.required ? "" : "?"}`).join(", ")})${fields ? ` -> ${fields.join(", ")}` : ""}`,
    method: op.request.method.toUpperCase(),
    hosts: hostsOf(op),
    ...(op.readOnly ? {} : { write: true as const }),
    ...(op.learnedLoggedIn ? { login: true as const } : {}),
  };
}

// The index reaches the agent as text, so it is held to the limits the shared rules put on a spec.
const text = z.string().max(LIMITS.text);
const HOST = z.string().regex(/^[a-z0-9.-]{1,253}$/);
export const IndexOpSchema = z.object({
  // a signature: `name(params) -> fields`, whose name the shared rules restrict
  op: z
    .string()
    .max(2000)
    .regex(/^[A-Za-z][A-Za-z0-9_.-]{0,63}\(/),
  method: z.string().regex(/^[A-Z]{1,10}$/),
  hosts: z.array(HOST).max(20),
  write: z.literal(true).optional(),
  login: z.literal(true).optional(),
  description: text.optional(),
});
export const IndexEntrySchema = z.object({
  site: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
  displayName: z.string().max(100).optional(),
  description: text.optional(),
  /** the registrable domains the spec's ops send to or open: what a search by domain or URL matches */
  domains: z.array(HOST).max(50),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  operations: z.array(IndexOpSchema).max(LIMITS.operations),
});
export const IndexSchema = z.object({ generated: z.string(), sites: z.array(IndexEntrySchema) });
export type IndexEntry = z.infer<typeof IndexEntrySchema>;
export type RegistryIndex = z.infer<typeof IndexSchema>;

export function indexEntry(site: Site, text: string): IndexEntry {
  return {
    site: site.name,
    ...(site.displayName ? { displayName: site.displayName } : {}),
    ...(site.description ? { description: site.description } : {}),
    domains: [
      ...new Set([new URL(site.baseUrl).hostname, ...site.operations.flatMap(hostsOf)].map((h) => siteOf(h))),
    ].sort(),
    sha256: createHash("sha256").update(text).digest("hex"),
    operations: site.operations.map((op) => ({
      ...summarize(op),
      ...(op.description ? { description: op.description } : {}),
    })),
  };
}

// Words that say nothing about which site: a query is often a sentence ("the weather in paris").
export const STOP = new Set(
  "and are best can cheap find for from get how into list near new now of on one or out per show some than that the their them then this top what when where which who why with you your".split(
    " ",
  ),
);

/** A text's search words: lower-cased, no stopword, none under 3 letters, a plural `s` dropped (not "news"). */
export const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !/[su]s$/.test(w) ? w.slice(0, -1) : w));

/** An op's signature, its camelCase names split: `searchBooks(q) -> avgRating` reads as search books ... rating. */
export const opWords = (text: string) => words(text.replace(/([a-z])([A-Z])/g, "$1 $2"));

/** A query that names a domain or a URL, as its registrable domain. */
export function domainOf(query: string): string | undefined {
  const q = query.trim();
  if (!/^\S+\.\S+$/.test(q)) return undefined;
  try {
    const host = new URL(/^[a-z]+:\/\//i.test(q) ? q : `https://${q}`).hostname;
    return parse(host, { allowPrivateDomains: true }).domain ? siteOf(host) : undefined;
  } catch {
    return undefined;
  }
}

type SearchEntry = Pick<IndexEntry, "site" | "displayName" | "description" | "domains"> & {
  operations: { op: string; description?: string }[];
};

export interface QueryMatch {
  matched: string[];
  unmatched: string[];
}

// An action or a common output field alone does not identify a capability in a longer query.
const GENERIC = new Set(["search", "price", "title", "name", "description", "result", "data"]);

const hit = (w: string, list: string[], whole: number, part: number, min = 3) =>
  list.includes(w) ? whole : w.length >= min && list.some((x) => x.includes(w)) ? part : 0;

const coverage = (query: string, weight: (word: string) => number) => {
  const matched: string[] = [];
  const unmatched: string[] = [];
  let total = 0;
  for (const w of new Set(words(query))) {
    const s = weight(w);
    (s ? matched : unmatched).push(w);
    total += s;
  }
  // Reward covering more capabilities, without treating the user's extra constraints as negatives.
  return {
    matched,
    unmatched,
    score: unmatched.length && matched.every((w) => GENERIC.has(w)) ? 0 : total * matched.length,
  };
};

/** Query coverage in this op's own summary, not text about another op at the same site. */
export function operationMatch(op: SearchEntry["operations"][number], query: string): QueryMatch {
  if (domainOf(query)) return { matched: [], unmatched: [] };
  const signature = opWords(op.op);
  const description = words(op.description ?? "");
  const { matched, unmatched } = coverage(query, (w) =>
    Math.max(hit(w, signature, 4, 2, 5), hit(w, description, 1, 0.5, 5)),
  );
  return { matched, unmatched };
}

/** Shared lexical ranking and its explanation, for the client and Worker. */
export function matchQuery(e: SearchEntry, query: string): QueryMatch & { score: number } {
  const domain = domainOf(query);
  if (domain)
    return e.domains.includes(domain)
      ? { score: 100, matched: [domain], unmatched: [] }
      : { score: 0, matched: [], unmatched: [domain] };
  const name = words(e.site);
  const title = words(`${e.displayName ?? ""} ${e.domains.join(" ")}`);
  const about = words(e.description ?? "");
  const descriptions = words(e.operations.map((o) => o.description ?? "").join(" "));
  const signatures = opWords(e.operations.map((o) => o.op).join(" "));
  return coverage(query, (w) =>
    Math.max(
      // a short word inside a longer name is usually another word ("book" in "booking")
      hit(w, name, 10, 6, 5),
      hit(w, title, 6, 3, 5),
      hit(w, about, 2, 1, 5),
      hit(w, signatures, 4, 2, 5),
      hit(w, descriptions, 1, 0.5, 5),
    ),
  );
}

export const score = (e: SearchEntry, query: string): number => matchQuery(e, query).score;
