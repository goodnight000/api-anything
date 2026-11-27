/**
 * What a call that met a wall (a bot challenge, a refusal of this network, a page the site wants
 * finished first) is told to do, from what that call may carry: `call`, the cool-down's answer and
 * `status` all ask here, so none of them suggests a step that cannot reach the call.
 */
import { attached, windowWhere } from "./attach.js";
import type { NextCall, Retry } from "./execute.js";
import type { Operation, Site } from "./spec.js";

/**
 * Whether this op goes without the user's cookies and session values: a request that is no GET or HEAD,
 * of a spec an agent pulled (page text may have steered it there), may change something whatever the
 * spec says it is. A human's pull and a bundled spec upgraded from the registry keep them: the registry
 * serves no such op to anyone but its uploader until a maintainer reviewed it (a POST read, a slot
 * holding a cookie or session ref), and the seeded POST reads need theirs (airbnb search).
 */
export function bareCall(site: Pick<Site, "shared">, op: Operation): boolean {
  // An unreviewed candidate is a public read by the registry's rules, so it needs no session; and a
  // GET can do harm with the user's cookies too (a one-click account action), whoever pulled it.
  if (site.shared && op.version?.status === "candidate") return true;
  if (site.shared?.by !== "agent") return false;
  const method = op.request.method.toUpperCase();
  return method !== "GET" && method !== "HEAD";
}

/**
 * What can clear a wall for a call of `op`. `window`: the sign-in window, whose kept cookies the call
 * sends. `own-browser`: api-anything's own browser only: a spec someone else wrote, while attached,
 * gets none of the stored cookies at tiers 2 and 3 there (browser.ts `seed`). `none`: a bare call,
 * which sends no cookie at any tier, so nothing a window keeps reaches it.
 */
export type Reach = "window" | "own-browser" | "none";

export function wallReach(shared: Site["shared"], op: Operation): Reach {
  if (bareCall({ shared }, op)) return "none";
  return shared && attached() ? "own-browser" : "window";
}

/**
 * A wall, as the site showed it. `consent` and `page` (terms, verify it's you) at `at`, the address
 * shown as a spec's is; `refused`: a 403 with no challenge or sign-in to clear; `challenge`: a bot check.
 */
export interface Wall {
  kind: "consent" | "page" | "refused" | "challenge";
  at?: string;
}

/** The wall in words, as a `next` names it. */
export const wallSaid = (w: Wall) =>
  w.kind === "consent"
    ? `the site asks this visitor for a cookie-consent choice first${w.at ? ` (${w.at})` : ""}`
    : w.kind === "page"
      ? `the site wants a page finished first (consent, terms, or verify it's you)${w.at ? ` at ${w.at}` : ""}`
      : w.kind === "refused"
        ? "the site refuses requests from this machine or network"
        : "the site is challenging automated requests";

/** Why nothing a window does reaches a bare call of `op`, and what does work instead. */
function noReach(site: string, op: Operation, shared: Site["shared"]): string {
  const own = `learn the page as an operation of the user's own, under a site name of their own: api-anything add <name> ${op.name} <page url>${op.readOnly ? "" : " --write"}`;
  if (shared && op.version?.status === "candidate")
    return `${op.name} of ${site} is a version from the catalog that no maintainer has confirmed yet, and a call of one sends none of the stored cookies, so nothing a window keeps reaches it: do not retry as it is. What works: wait until the registry confirms the version, then pull the site again (api-anything pull ${site}), or ${own}`;
  return `an agent pulled ${site} from the catalog, and a ${op.request.method.toUpperCase()} of a spec an agent pulled sends none of the stored cookies, so nothing a window keeps reaches it: do not retry as it is. What works: ask the user to pull it themselves, in a terminal: api-anything pull ${site} (a spec the user pulled sends their cookies), or ${own}`;
}

/** The api-anything's-own-browser step, for a spec someone else wrote while attached. */
const ownBrowser = (site: string) =>
  `${site} is a spec pulled from the catalog, which carries none of the stored cookies in the attached browser (API_ANYTHING_CDP), so a window there would clear nothing for its calls. Ask the user to unset API_ANYTHING_CDP and run api-anything login ${site} --window, which opens api-anything's own browser, whose profile keeps what they do there; then retry once with API_ANYTHING_CDP unset`;

/** The window's step for the user's own spec, for each wall a window answers. */
function windowStep(site: string, w: Wall): string {
  const where = windowWhere();
  if (w.kind === "consent")
    return `${wallSaid(w)}, which api-anything never makes for the user: ask the user to run api-anything login ${site} --window${where}, make the choice on the site's page there and close the window (the cookies the site sets then are kept for ${site}); then retry once`;
  if (w.kind === "refused")
    return `${wallSaid(w)} (a 403 with no challenge or sign-in to clear): do not retry as it is; a window may show why: ask the user to run api-anything login ${site} --window${where}, then retry once`;
  return `${wallSaid(w)}: ask the user to run api-anything login ${site} --window${where} and clear the challenge in the window, then retry once`;
}

/**
 * What a call of `op` that met `w` is told. A `page` wall is the everyday browser's to finish
 * (execute.ts `unfinishedNext`) unless nothing reaches the call: undefined then.
 */
export function wallStep(
  site: string,
  op: Operation,
  shared: Site["shared"],
  w: Wall,
): { next: string; nextCall: NextCall; retry: Retry } | undefined {
  const reach = wallReach(shared, op);
  if (reach === "none")
    return { next: `${wallSaid(w)}. ${noReach(site, op, shared)}`, nextCall: { action: "report" }, retry: "no" };
  if (w.kind === "page") return undefined;
  if (reach === "own-browser")
    return { next: `${wallSaid(w)}: ${ownBrowser(site)}`, nextCall: { action: "report" }, retry: "after_fix" };
  return { next: windowStep(site, w), nextCall: { action: "login", mode: "window" }, retry: "after_fix" };
}

/**
 * What a call is told while its site cools down after a block at every tier: nothing is sent. `op`:
 * the call's, when there is one (`status` names a site's cool-down, which the op that met it recorded).
 */
export function coolStep(
  site: string,
  op: Operation | undefined,
  shared: Site["shared"],
): { next: string; nextCall?: NextCall; retry?: Retry } {
  const wait = "the site blocked its last call at every tier: do not retry before retryAfterMs";
  const reach = op ? wallReach(shared, op) : shared && attached() ? "own-browser" : "window";
  if (reach === "none" && op)
    return { next: `${wait}. ${noReach(site, op, shared)}`, nextCall: { action: "report" }, retry: "no" };
  if (reach === "own-browser")
    return {
      next: `${wait}. ${ownBrowser(site)} (a login ends the wait)`,
      nextCall: { action: "report" },
      retry: "after_fix",
    };
  return {
    next: `${wait}. To look sooner, ask the user to run api-anything login ${site} --window${windowWhere()} (a login ends the wait), then retry once`,
  };
}
