/**
 * `stats`: what this install's calls did over the last days, from the local call log only (nothing is
 * sent): counts, ok rate, tiers, sites, median ms, heals, and an estimate of the browser-agent time
 * they stood in for. `card` is the same in a few lines a person can paste into a post.
 */
import { type CallRecord, KEEP_CALLS_DAYS, loadCalls } from "./store.js";

const DAY_MS = 24 * 60 * 60_000;

/**
 * The browser-agent time one ok call is counted as replacing, before its own time comes off. Below what
 * bench/ measured: on Google Flights (5 dates) the browser agent took 41.6 s and the API Anything agent
 * 21.1 s over 10 calls of about 1.2 s each, so about 3.2 s of browser time per call; on Goodreads (5
 * books) 182.5 s against 30.5 s.
 */
export const BROWSER_MS_PER_CALL = 2500;
const PER_CALL = `${BROWSER_MS_PER_CALL / 1000} s`;

export const ASSUMPTION =
  `each ok call that sent a request counts as ${PER_CALL} of an agent driving a browser, less the call's own time (nothing when slower). ` +
  "Measured in bench/: about 3.2 s per call on Google Flights (41.6 s with a browser vs 21.1 s over 10 calls), " +
  "more on Goodreads (182.5 s vs 30.5 s for 5 books). One model, two sites: an estimate, not a measurement of your calls.";

export const REPO = "github.com/goodnight000/api-anything";
const TOP = 5;

export interface Stats {
  ok: true;
  /** `firstCall`: the oldest call in the window, when it holds any */
  window: { days: number; since: string; until: string; firstCall?: string };
  calls: number;
  /** share of calls answered ok, 0..1 */
  okRate: number;
  /** calls that sent a request: a cool-down's answer or refused args send nothing */
  sent: number;
  /** calls per tier that answered them; tier 1 is plain HTTP, 2 and 3 use Chrome */
  tiers: Partial<Record<"1" | "2" | "3", number>>;
  /** share of sent calls answered over plain HTTP, 0..1 */
  plainHttp: number;
  sites: number;
  ops: number;
  topSites: { site: string; calls: number; okRate: number }[];
  /** of the calls that sent a request */
  medianMs?: number;
  /** calls that repaired a drifted request on the way */
  heals: number;
  writes: number;
  saved: { ms: number; minutes: number; counted: number; browserMsPerCall: number; assumption: string };
}

const rate = (n: number, of: number) => (of ? Math.round((n / of) * 100) / 100 : 0);

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

export function stats(days = KEEP_CALLS_DAYS, now = Date.now()): Stats {
  const calls = loadCalls(undefined, now, days * DAY_MS);
  const sent = calls.filter((c): c is CallRecord & { tier: 1 | 2 | 3 } => c.tier !== undefined);
  const isOk = (c: CallRecord) => c.class === "ok";
  const tiers: Stats["tiers"] = {};
  for (const c of sent) tiers[`${c.tier}`] = (tiers[`${c.tier}`] ?? 0) + 1;
  const bySite = new Map<string, CallRecord[]>();
  for (const c of calls) bySite.set(c.site, [...(bySite.get(c.site) ?? []), c]);
  const counted = sent.filter(isOk);
  const savedMs = counted.reduce((sum, c) => sum + Math.max(0, BROWSER_MS_PER_CALL - c.ms), 0);
  const medianMs = median(sent.map((c) => c.ms));
  return {
    ok: true,
    window: {
      days,
      since: new Date(now - days * DAY_MS).toISOString(),
      until: new Date(now).toISOString(),
      ...(calls[0] ? { firstCall: calls[0].at } : {}),
    },
    calls: calls.length,
    okRate: rate(calls.filter(isOk).length, calls.length),
    sent: sent.length,
    tiers,
    plainHttp: rate(tiers["1"] ?? 0, sent.length),
    sites: bySite.size,
    ops: new Set(calls.map((c) => `${c.site}\n${c.op}`)).size,
    topSites: [...bySite]
      .map(([site, cs]) => ({ site, calls: cs.length, okRate: rate(cs.filter(isOk).length, cs.length) }))
      .sort((a, b) => b.calls - a.calls || a.site.localeCompare(b.site))
      .slice(0, TOP),
    ...(medianMs !== undefined ? { medianMs } : {}),
    heals: calls.filter((c) => c.healed).length,
    writes: calls.filter((c) => c.write).length,
    saved: {
      ms: savedMs,
      minutes: Math.round(savedMs / 6_000) / 10,
      counted: counted.length,
      browserMsPerCall: BROWSER_MS_PER_CALL,
      assumption: ASSUMPTION,
    },
  };
}

const num = (n: number) => n.toLocaleString("en-US");
const pct = (r: number) => `${Math.round(r * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

function duration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  if (ms < 120 * 60_000) return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}

/** A few plain lines for a post: what the calls did, the estimate with its assumption, and how to get it. */
export function card(s: Stats): string {
  const lines = [`API Anything, last ${plural(s.window.days, "day")}`];
  if (!s.calls) lines.push("No calls yet.");
  else {
    const http = s.sent ? `, ${pct(s.plainHttp)} over plain HTTP with no browser` : "";
    lines.push(`${plural(s.calls, "call")} to ${plural(s.sites, "site")}, ${pct(s.okRate)} ok${http}`);
    const healed = s.heals ? `, ${plural(s.heals, "call")} repaired after the site changed` : "";
    if (s.medianMs !== undefined) lines.push(`median call ${num(s.medianMs)} ms${healed}`);
    if (s.saved.ms)
      lines.push(
        `about ${duration(s.saved.ms)} of browser-agent time saved (estimate: ${PER_CALL} per ok call, less the call's own time)`,
      );
    lines.push(`top: ${s.topSites.map((t) => `${t.site} ${num(t.calls)}`).join(", ")}`);
  }
  lines.push("npx -y api-anything setup", REPO);
  return `${lines.join("\n")}\n`;
}
