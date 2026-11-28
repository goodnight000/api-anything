/**
 * A deterministic graph over the catalog: sites, operations, their args and returned fields, the
 * domains they call, and the words that describe them. It is built from installed specs alone (no
 * network, no model), cached by a fingerprint of the spec files, and queried by budgeted traversal:
 * a question seeds nodes, edges carry a weight and a confidence label, and only the top-ranked
 * operations reach the model. The shape borrows from graph-first context layers (typed nodes and
 * edges, clusters of a kind, traversal instead of a catalog dump); nothing here depends on one.
 *
 * Confidence says where an edge came from, never how sure the caller should be about the site:
 * `declared` (the spec says it), `observed` (a learned shape saw it), `lexical` (a word of a name or
 * description), `inferred` (reached only through shared nodes). A match's own confidence is `exact`
 * (a domain or the site's name), `lexical` (words in its own text), or `inferred` (traversal only).
 */
import { describeOperation } from "./describe.js";
import { siteOf } from "./domain.js";
import { domainOf, hostsOf, opWords, words } from "./search.js";
import type { Site } from "./spec.js";

export type NodeKind = "site" | "op" | "param" | "field" | "domain" | "topic";
export type EdgeConfidence = "declared" | "observed" | "lexical" | "inferred";
export type MatchConfidence = "exact" | "lexical" | "inferred";
export type EdgeKind = "has_op" | "takes" | "returns" | "links_to" | "at_domain" | "alias_of" | "mentions";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  /** the site's name, the op's name, the param's or field's name, a domain, or a topic word */
  label: string;
  /** a site's display name: what to show beside its name */
  title?: string;
  /** a site's or op's prose, cut short: the graph is a map, not the spec */
  description?: string;
  site?: string;
  op?: string;
  write?: true;
  login?: true;
  paging?: true;
  tier?: 2 | 3;
  required?: true;
  type?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  confidence: EdgeConfidence;
  weight: number;
}

export interface Graph {
  version: 1;
  /** what the graph was built from: a hash of the spec files' paths, sizes and times */
  fingerprint: string;
  builtAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ContextArg {
  name: string;
  required: boolean;
  type?: string;
  hint?: string;
}

export interface ContextOp {
  op: string;
  score: number;
  why: string[];
  args: ContextArg[];
  returns: string[];
  write?: true;
  login?: true;
  pages?: true;
  tier?: 2 | 3;
}

export interface ContextSite {
  site: string;
  title?: string;
  score: number;
  confidence: MatchConfidence;
  why: string[];
  ops: ContextOp[];
}

export interface ContextAlso {
  site: string;
  op: string;
  score: number;
  via: string;
}

export interface Context {
  query: string;
  sites: ContextSite[];
  also: ContextAlso[];
  truncated: boolean;
  chars: number;
  stats: { nodes: number; edges: number };
}

/** Fields every list has: a hub on them would connect unrelated sites, so they make no field node. */
const FIELD_NOISE = new Set(
  "id ids url urls href link links name title titles description descriptions text type types status code message error errors count total page pages limit offset cursor next prev previous image images thumbnail avatar date time timestamp created updated year value values data result results item items index size length slug key label html content summary source language locale currency symbol amount".split(
    " ",
  ),
);

const noisyField = (name: string) => {
  const w = name.toLowerCase();
  return FIELD_NOISE.has(w) || FIELD_NOISE.has(w.replace(/s$/, ""));
};

const siteId = (name: string) => `site:${name}`;
const opId = (site: string, op: string) => `op:${site}/${op}`;
const paramId = (site: string, op: string, param: string) => `param:${site}/${op}/${param}`;
const fieldId = (name: string) => `field:${name.toLowerCase()}`;
const domainId = (domain: string) => `domain:${domain}`;
const topicId = (word: string) => `topic:${word}`;

/** Build the graph. Deterministic: the same specs always give the same nodes and edges, in order. */
export function buildGraph(sites: Site[], fingerprint = ""): Graph {
  const ordered = [...sites].sort((a, b) => a.name.localeCompare(b.name));
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const topicText: { from: string; text: string }[] = [];
  const topicSites = new Map<string, Set<string>>();

  const node = (n: GraphNode) => {
    if (!nodes.has(n.id)) nodes.set(n.id, n);
    return n;
  };
  const edge = (from: string, to: string, kind: EdgeKind, confidence: EdgeConfidence, weight: number) =>
    edges.push({ from, to, kind, confidence, weight });

  const topic = (from: string, site: string, text: string, cap: number) => {
    topicText.push({ from, text });
    for (const w of words(text).slice(0, cap)) {
      let set = topicSites.get(w);
      if (!set) {
        set = new Set();
        topicSites.set(w, set);
      }
      set.add(site);
    }
  };

  for (const site of ordered) {
    const id = siteId(site.name);
    node({
      id,
      kind: "site",
      label: site.name,
      ...(site.displayName ? { title: site.displayName } : {}),
      ...(site.description ? { description: cut(site.description, 240) } : {}),
      site: site.name,
    });
    topic(id, site.name, `${site.name} ${site.displayName ?? ""} ${site.description ?? ""}`, 8);

    const domains = new Set<string>([siteOf(new URL(site.baseUrl).hostname)]);
    for (const alias of site.aliases ?? []) domains.add(siteOf(alias));
    for (const op of site.operations) for (const host of hostsOf(op)) domains.add(siteOf(host));
    for (const d of [...domains].sort()) {
      node({ id: domainId(d), kind: "domain", label: d });
      edge(id, domainId(d), (site.aliases ?? []).includes(d) ? "alias_of" : "at_domain", "declared", 0.9);
    }

    for (const op of [...site.operations].sort((a, b) => a.name.localeCompare(b.name))) {
      const opNode = opId(site.name, op.name);
      node({
        id: opNode,
        kind: "op",
        label: op.name,
        ...(op.description ? { description: cut(op.description, 240) } : {}),
        site: site.name,
        op: op.name,
        ...(op.readOnly ? {} : { write: true as const }),
        ...(op.learnedLoggedIn ? { login: true as const } : {}),
        ...(op.paging ? { paging: true as const } : {}),
        ...(op.minTier > 1 ? { tier: op.minTier as 2 | 3 } : {}),
      });
      edge(id, opNode, "has_op", "declared", 1);

      for (const p of op.params) {
        const pid = paramId(site.name, op.name, p.name);
        node({
          id: pid,
          kind: "param",
          label: p.name,
          site: site.name,
          op: op.name,
          type: p.type,
          ...(p.required ? { required: true as const } : {}),
        });
        edge(opNode, pid, "takes", "declared", 0.45);
      }

      let output: ReturnType<typeof describeOperation>["output"] | undefined;
      try {
        output = describeOperation(site, op.name).output;
      } catch {
        output = undefined;
      }
      for (const [name, hint] of Object.entries(output?.fields ?? {})) {
        if (noisyField(name)) continue;
        const fid = fieldId(name);
        node({ id: fid, kind: "field", label: name, ...(hint.type ? { type: hint.type } : {}) });
        edge(opNode, fid, "returns", hint.source === "declared" ? "declared" : "observed", 0.5);
      }

      for (const link of op.links ?? []) {
        const target = opId(site.name, link.to.op);
        if (nodes.has(target)) edge(opNode, target, "links_to", "declared", 1.2);
      }

      topic(opNode, site.name, `${op.name} ${op.description ?? ""} ${op.params.map((p) => p.name).join(" ")}`, 6);
    }
  }

  // A topic kept only when a few sites share it: one site's own word adds nothing (its ops already
  // match), and a word most sites use would connect the whole catalog into one blob.
  const maxDf = Math.max(4, Math.ceil(ordered.length * 0.06));
  const kept = new Set([...topicSites].filter(([, s]) => s.size >= 2 && s.size <= maxDf).map(([w]) => w));
  for (const { from, text } of topicText) {
    for (const w of new Set(words(text))) {
      if (!kept.has(w)) continue;
      node({ id: topicId(w), kind: "topic", label: w });
      edge(from, topicId(w), "mentions", "lexical", from.startsWith("site:") ? 0.5 : 0.35);
    }
  }

  return { version: 1, fingerprint, builtAt: new Date().toISOString(), nodes: [...nodes.values()], edges };
}

const cut = (text: string, n: number) => (text.length <= n ? text : `${text.slice(0, n - 1)}…`);

export function graphStats(g: Graph) {
  const count = (kind: NodeKind) => g.nodes.filter((n) => n.kind === kind).length;
  const byConfidence = { declared: 0, observed: 0, lexical: 0, inferred: 0 };
  for (const e of g.edges) byConfidence[e.confidence]++;
  return {
    sites: count("site"),
    ops: count("op"),
    params: count("param"),
    fields: count("field"),
    domains: count("domain"),
    topics: count("topic"),
    nodes: g.nodes.length,
    edges: g.edges.length,
    byConfidence,
  };
}

interface Step {
  to: string;
  weight: number;
  edge: GraphEdge;
}
interface Index {
  byId: Map<string, GraphNode>;
  out: Map<string, Step[]>;
  outSum: Map<string, number>;
  siteOps: Map<string, string[]>;
}
const indexes = new WeakMap<Graph, Index>();

function indexOf(g: Graph): Index {
  const had = indexes.get(g);
  if (had) return had;
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const out = new Map<string, Step[]>();
  const outSum = new Map<string, number>();
  const add = (from: string, step: Step) => {
    const list = out.get(from);
    if (list) list.push(step);
    else out.set(from, [step]);
    outSum.set(from, (outSum.get(from) ?? 0) + step.weight);
  };
  // Every edge is walked both ways: forward at full weight, backward at BACK. That is what lets a
  // question seed a field ("rating") or a topic ("book") and reach the ops that carry it.
  for (const e of g.edges) {
    add(e.from, { to: e.to, weight: e.weight, edge: e });
    add(e.to, { to: e.from, weight: e.weight * BACK, edge: e });
  }
  const siteOps = new Map<string, string[]>();
  for (const e of g.edges) {
    if (e.kind !== "has_op") continue;
    const list = siteOps.get(e.from);
    if (list) list.push(e.to);
    else siteOps.set(e.from, [e.to]);
  }
  const index = { byId, out, outSum, siteOps };
  indexes.set(g, index);
  return index;
}

const BACK = 0.7;
const DAMP = 0.55;
const HOPS = 2;

const hit = (w: string, list: string[], whole: number, part: number, min = 4) =>
  list.includes(w) ? whole : w.length >= min && list.some((x) => x.includes(w)) ? part : 0;

/** Action words name the machinery, not a capability: alone they must not choose a site. */
const ACTION = new Set(
  "search list get find fetch read show top best all one video videos article articles item items detail details info page data result results".split(
    " ",
  ),
);

interface Seed {
  /** what the query itself matched, before any traversal */
  score: Map<string, number>;
  why: Map<string, string[]>;
  /** the query words each node matched, for the coverage bonus */
  words: Map<string, Set<string>>;
  /** the words matched in a node's own name (a site's, an op's signature, a param, a field, a topic) */
  names: Map<string, Set<string>>;
}

/** Domain suffixes and web words: a query that is a URL should not match every "something.com". */
const WEB = new Set("com org net www co io ai app dev uk de fr jp cn".split(" "));

/** Query words into node scores: the same lexical rules the shared catalog uses, per node kind. */
function seedOf(g: Graph, query: string): Seed {
  const score = new Map<string, number>();
  const why = new Map<string, string[]>();
  const wordsOf = new Map<string, Set<string>>();
  const namesOf = new Map<string, Set<string>>();
  const domain = domainOf(query);
  const qwords = [...new Set([...words(query), ...opWords(query)])].filter((w) => !WEB.has(w));
  if (!qwords.length && !domain) return { score, why, words: wordsOf, names: namesOf };

  const bump = (id: string, value: number, reason: string, word: string, named = false) => {
    if (value <= 0) return;
    score.set(id, Math.min(40, (score.get(id) ?? 0) + value));
    const list = why.get(id);
    if (list) list.push(reason);
    else why.set(id, [reason]);
    const set = wordsOf.get(id);
    if (set) set.add(word);
    else wordsOf.set(id, new Set([word]));
    if (!named) return;
    const names = namesOf.get(id);
    if (names) names.add(word);
    else namesOf.set(id, new Set([word]));
  };
  const weight = (w: string) => (ACTION.has(w) ? 0.35 : 1);

  for (const n of g.nodes) {
    if (n.kind === "domain") {
      if (domain && n.label === domain) bump(n.id, 100, `domain ${domain}`, domain, true);
      continue;
    }
    if (n.kind === "topic") {
      for (const w of qwords) if (w === n.label) bump(n.id, 4, `topic ${w}`, w, true);
      continue;
    }
    const label = words(n.label);
    const about = words(n.description ?? "");
    for (const w of qwords) {
      const k = weight(w);
      if (n.kind === "site") {
        bump(n.id, hit(w, label, 12, 6, 5), `${w} in the site's name`, w, true);
        bump(n.id, k * hit(w, about, 3, 1, 5), `${w} in the site's description`, w);
      } else if (n.kind === "op") {
        const sig = opWords(n.label);
        bump(n.id, k * hit(w, sig, 6, 2.5, 5), `${w} in ${n.label}`, w, true);
        // An op's own description is its text too, but a word it shares with the site's name says
        // where it lives, not what it does: that is not a capability match.
        const own = hit(w, about, 2, 0.8, 5);
        bump(n.id, k * own, `${w} in ${n.label}'s description`, w, own > 0 && !words(n.site ?? "").includes(w));
      } else if (n.kind === "param") {
        bump(n.id, hit(w, label, 2.5, 1, 5), `${w} is an arg of ${n.site}/${n.op}`, w, true);
      } else if (n.kind === "field") {
        bump(n.id, hit(w, opWords(n.label), 2.5, 1, 5), `${w} is a field of ${n.label}`, w, true);
      }
    }
  }
  return { score, why, words: wordsOf, names: namesOf };
}

export interface ContextOptions {
  /** characters of rendered text the answer may take (default 1600) */
  budget?: number;
  /** how many sites to show (default 4) */
  sites?: number;
  /** how many operations per site (default 3) */
  ops?: number;
  /** rank only this site (a question that already names one) */
  onlySite?: string;
}

/** The catalog as a compact, ranked answer: the sites and operations a question reaches, in budget. */
export function queryContext(g: Graph, query: string, o: ContextOptions = {}): Context {
  const budget = Math.max(200, Math.min(20_000, o.budget ?? 1600));
  const maxSites = Math.max(1, Math.min(20, o.sites ?? 4));
  const maxOps = Math.max(1, Math.min(20, o.ops ?? 3));
  const index = indexOf(g);
  const seed = seedOf(g, query);
  const { score, why } = seed;
  const own = new Map(score);
  const qwords = new Set([...words(query), ...opWords(query)].filter((w) => !WEB.has(w)));

  // Traverse: each node passes its score along its edges, a hub's share split by its degree.
  const pred = new Map<string, { from: string; weight: number; edge: GraphEdge }>();
  let current = new Map(score);
  for (let hop = 0; hop < HOPS; hop++) {
    const delta = new Map<string, { value: number; from: string; weight: number; edge: GraphEdge }>();
    for (const [from, steps] of index.out) {
      const s = current.get(from) ?? 0;
      if (s <= 0) continue;
      const total = index.outSum.get(from) || 1;
      for (const step of steps) {
        const value = (s * step.weight) / total;
        if (value <= 0) continue;
        const had = delta.get(step.to);
        if (had) had.value += value;
        else delta.set(step.to, { value, from, weight: value, edge: step.edge });
        const best = pred.get(step.to);
        if (!best || value > best.weight) pred.set(step.to, { from, weight: value, edge: step.edge });
      }
    }
    for (const [id, d] of delta) score.set(id, (score.get(id) ?? 0) + DAMP * d.value);
    current = score;
  }

  const label = (id: string) => index.byId.get(id)?.label ?? id.replace(/^[a-z]+:/, "");
  // An op reached in one step from a word the query itself matched (its field, param, topic or domain)
  // is a direct answer, not a traversal guess.
  const touched = new Set<string>();
  for (const [from, steps] of index.out) {
    if (!own.has(from)) continue;
    const kind = index.byId.get(from)?.kind;
    if (kind !== "field" && kind !== "param" && kind !== "topic" && kind !== "domain") continue;
    for (const step of steps) if (index.byId.get(step.to)?.kind === "op") touched.add(step.to);
  }
  const via = (id: string) => {
    const p = pred.get(id);
    return p ? `via ${label(p.from)} (${p.edge.kind}, ${p.edge.confidence})` : "via the catalog";
  };
  const whyOf = (id: string) => {
    const seeded = why.get(id);
    return seeded?.length ? seeded.slice(0, 3) : [via(id)];
  };
  // A site that answers more of the query's words is the better answer: one word in a site's name
  // must not outrank a site whose own operations cover the whole question.
  const coverage = (ids: string[]) => {
    const covered = new Set<string>();
    for (const id of ids) for (const w of seed.words.get(id) ?? []) covered.add(w);
    return Math.max(1, Math.min(qwords.size, covered.size));
  };

  const realSeed = (id: string) =>
    touched.has(id) || ((own.get(id) ?? 0) >= 0.8 && [...(seed.names.get(id) ?? [])].some((w) => !ACTION.has(w)));
  /** Two capability words in a site's own text describe a task even when its op names are generic. */
  const described = (id: string) => [...(seed.words.get(id) ?? [])].filter((w) => !ACTION.has(w)).length >= 2;

  const ranked: {
    site: string;
    node: GraphNode;
    score: number;
    strong: boolean;
    ops: { id: string; score: number }[];
  }[] = [];
  for (const [sid, opIds] of index.siteOps) {
    const n = index.byId.get(sid);
    if (!n) continue;
    const ops = opIds
      .map((id) => ({ id, score: score.get(id) ?? 0 }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const top = ops[0]?.score ?? 0;
    const top3 = ops.slice(0, 3).reduce((sum, x) => sum + x.score, 0);
    const base = (score.get(sid) ?? 0) + 0.9 * top + 0.25 * top3;
    const covered = coverage([sid, ...ops.slice(0, 3).map((x) => x.id)]);
    const total = base * (1 + 0.6 * (covered - 1));
    const seeded = why.get(sid);
    const names = new Set([...words(n.label), ...(n.title ? words(n.title) : [])]);
    // The site itself is the answer when its domain was asked for or the query is its whole name:
    // then every op it has is a fair candidate. One word in its name is not enough: its ops must
    // still match the query on their own.
    const strong =
      (seeded?.some((w) => w.startsWith("domain ")) ?? false) ||
      (qwords.size > 0 && [...qwords].every((w) => names.has(w))) ||
      (index.out.get(sid) ?? []).some(
        (step) => index.byId.get(step.to)?.kind === "domain" && (own.get(step.to) ?? 0) >= 50,
      );
    if (total > 0) ranked.push({ site: n.label, node: n, score: total, strong, ops });
  }
  ranked.sort((a, b) => b.score - a.score || a.site.localeCompare(b.site));
  // `onlySite` confines the answer, not the graph: other sites are still available as `also`.
  const wanted = o.onlySite ? ranked.filter((r) => r.site === o.onlySite) : ranked;
  const topScore = wanted[0]?.ops[0]?.score ?? 0;
  const floor = topScore * 0.15;
  const buildSites = (relaxed: boolean): ContextSite[] => {
    const out: ContextSite[] = [];
    for (const r of wanted.slice(0, maxSites)) {
      // An op reached only by traversal (a shared field, a hub) is a guess: show it only when the
      // site itself is the answer, or two words of its own description name the task.
      const ops = r.ops
        .filter((x) => {
          if (x.score <= 0 || x.score < floor) return false;
          if (r.strong || realSeed(x.id)) return true;
          return !relaxed && described(r.node.id);
        })
        .slice(0, maxOps)
        .map((x) => opView(index, x.id, x.score, whyOf(x.id)))
        .filter((x): x is ContextOp => !!x);
      if (!ops.length) continue;
      const seeded = why.get(r.node.id);
      out.push({
        site: r.site,
        ...(r.node.title ? { title: r.node.title } : {}),
        score: round(r.score),
        confidence: r.strong ? "exact" : seeded?.length ? "lexical" : "inferred",
        why: whyOf(r.node.id),
        ops,
      });
    }
    return out;
  };
  // a query of nothing but action words ("search") still answers: the strict rule would drop it all
  const strict = buildSites(false);
  const sites = strict.length ? strict : buildSites(true);

  // Neighbours from other sites, only when the op matched the query itself (a field hub reaching it
  // is a guess, not a match) and is close to the top.
  const shown = new Set(sites.map((s) => s.site));
  const also: ContextAlso[] = [];
  for (const r of ranked) {
    if (shown.has(r.site)) continue;
    const best = r.ops.find((x) => realSeed(x.id) && x.score >= topScore * 0.5);
    if (!best) continue;
    const n = index.byId.get(best.id);
    if (!n?.op) continue;
    also.push({ site: r.site, op: n.op, score: round(best.score), via: via(best.id) });
  }
  also.sort((a, b) => b.score - a.score || a.site.localeCompare(b.site));

  const context: Context = {
    query,
    sites,
    also: also.slice(0, 3),
    truncated: false,
    chars: 0,
    stats: { nodes: g.nodes.length, edges: g.edges.length },
  };
  context.chars = renderContext(context).length;
  while (context.chars > budget && context.sites.length) {
    const last = context.sites[context.sites.length - 1]!;
    if (last.ops.length > 1) last.ops.pop();
    else context.sites.pop();
    context.truncated = true;
    context.chars = renderContext(context).length;
  }
  if (context.chars > budget && context.also.length) {
    context.also = [];
    context.chars = renderContext(context).length;
  }
  return context;
}

function opView(index: Index, id: string, score: number, why: string[]): ContextOp | undefined {
  const n = index.byId.get(id);
  if (!n?.op || !n.site) return undefined;
  const facts = opFacts(index, n.site, n.op);
  return {
    op: n.op,
    score: round(score),
    why,
    args: facts.args,
    returns: facts.returns,
    ...(n.write ? { write: true as const } : {}),
    ...(n.login ? { login: true as const } : {}),
    ...(n.paging ? { pages: true as const } : {}),
    ...(n.tier ? { tier: n.tier } : {}),
  };
}

const opCache = new WeakMap<Index, Map<string, { args: ContextArg[]; returns: string[] }>>();

/** An op's args and returned fields, read once from the graph's own nodes (never from a call). */
function opFacts(index: Index, site: string, op: string) {
  let cache = opCache.get(index);
  if (!cache) {
    cache = new Map();
    opCache.set(index, cache);
  }
  const key = `${site}/${op}`;
  const had = cache.get(key);
  if (had) return had;
  const id = opId(site, op);
  const args: ContextArg[] = [];
  const returns: string[] = [];
  for (const step of index.out.get(id) ?? []) {
    const n = index.byId.get(step.to);
    if (!n) continue;
    if (n.kind === "param") {
      args.push({ name: n.label, required: !!n.required, ...(n.type ? { type: n.type } : {}) });
    } else if (n.kind === "field" && step.edge.from === id) returns.push(n.label);
  }
  args.sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));
  returns.sort((a, b) => a.localeCompare(b));
  const value = { args, returns };
  cache.set(key, value);
  return value;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The compact text a model reads: one line per site, one per op, then cross-site neighbours. */
export function renderContext(c: Context): string {
  const lines: string[] = [];
  for (const s of c.sites) {
    const title = s.title && s.title !== s.site ? ` (${cut(s.title, 60)})` : "";
    lines.push(`${s.site}${title} — ${s.confidence}${s.why.length ? `: ${s.why.slice(0, 2).join("; ")}` : ""}`);
    for (const o of s.ops) {
      const args = o.args.map((a) => (a.required ? a.name : `${a.name}?`)).join(", ");
      const returns = o.returns.length ? ` -> ${o.returns.slice(0, 6).join(", ")}` : "";
      const marks = [o.write ? "write" : "read", o.login ? "login" : "", o.pages ? "pages" : ""].filter(Boolean);
      lines.push(`  ${o.op}(${args})${returns} [${marks.join(",")}]`);
    }
  }
  if (c.also.length) lines.push(`also: ${c.also.map((a) => `${a.site}/${a.op} (${a.via})`).join("; ")}`);
  return lines.join("\n");
}
