/**
 * One send of a read's stored template through a transport the caller owns, judged. For an
 * embedder that holds the session itself: no pacing, timeout, redirect, retry, tier climb, heal
 * or session file here. Nothing is capped: `decoded` is everything the response held.
 */
import { judge, type Classified, type Observed } from "./classify.js";
import type { Session } from "./cookies.js";
import { decode } from "./extract.js";
import { buildRequest } from "./http.js";
import type { Operation, Request } from "./spec.js";

/** Sends the filled request once and returns the final answer. Redirects and time limits are its own. */
export type ReplayTransport = (request: Request, signal?: AbortSignal) => Promise<Observed>;

export interface ReplayResult extends Omit<Classified, "class"> {
  class: Classified["class"] | "refused";
  /** false when nothing left this process: a write, bad args, or a signal already aborted */
  sent: boolean;
  status?: number;
  /** the response body's whole value, before `extract` and `pick`; only when ok */
  decoded?: unknown;
  /** extracted and picked, never capped; only when ok */
  data?: unknown;
  ms: number;
}

export async function replay(op: Operation, args: Record<string, unknown>, session: Session, o: { transport: ReplayTransport; signal?: AbortSignal }): Promise<ReplayResult> {
  const t0 = performance.now();
  const done = (r: Omit<ReplayResult, "ms">): ReplayResult => ({ ...r, ms: Math.round(performance.now() - t0) });
  if (!op.readOnly) return done({ class: "refused", reason: `${op.name} is a write: replay sends reads only`, sent: false });
  const unknown = Object.keys(args).filter((k) => !op.params.some((p) => p.name === k));
  if (unknown.length) return done({ class: "input", reason: `unknown arg ${unknown.join(", ")}`, sent: false });
  let request: Request;
  try {
    request = buildRequest(op, args, session);
  } catch (e) {
    return done({ class: "input", reason: (e as Error).message, sent: false });
  }
  if (o.signal?.aborted) return done({ class: "error", reason: "aborted before sending", sent: false });
  let observed: Observed;
  try {
    observed = await o.transport(request, o.signal);
  } catch (e) {
    return done({ class: "error", reason: (e as Error).message.split("\n")[0]!, sent: true });
  }
  const { data, ...judged } = judge(op, observed);
  if (judged.class !== "ok") return done({ ...judged, sent: true, status: observed.status });
  return done({ ...judged, sent: true, status: observed.status, decoded: decode(op.response, observed.body), data });
}
