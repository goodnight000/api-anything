/**
 * Why the registry holds a version for review, by category: the fixed names `GET /v1/stats` counts
 * (never a stored reason, which can name a host or a cookie of what someone learned), and the words and
 * the next step an uploader is shown. The registry's reasons are `reviewReasons` in registry/src/upload.ts
 * and the claim reason in registry/src/worker.ts; this reads their wording. Pure: the Worker bundles it.
 */
import type { Operation } from "./spec.js";

export const REVIEW_CATEGORIES = [
  "clean-replay-skipped",
  "clean-replay-failed",
  "signed-in",
  "write",
  "post-read",
  "own-credential",
  "cookie-lookup",
  "login-site",
  "established-site",
  "differs-from-live",
  "public-values",
  "off-site",
  "secret-scan",
  "other",
] as const;
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

const RULES: [RegExp, ReviewCategory][] = [
  [/^its clean replay was skipped\b/, "clean-replay-skipped"],
  [/^its clean replay was /, "clean-replay-failed"],
  [/^learned (while )?signed in\b/, "signed-in"],
  [/^a write$/, "write"],
  [/^a read sent as /, "post-read"],
  [/^sends the caller's own /, "own-credential"],
  [/ from a lookup sent with the caller's cookies$/, "cookie-lookup"],
  [/^a new op on a site with a login: /, "login-site"],
  [/^a new op on an established site: /, "established-site"],
  [
    /^(no live version of .* to compare its match with|its (match|request|trigger) .*differs from the live version's)/,
    "differs-from-live",
  ],
  [/^lists public values: /, "public-values"],
  [/^sends to or opens .*, off its site /, "off-site"],
  [/^\$/, "secret-scan"],
];

export const reviewCategory = (reason: string): ReviewCategory => RULES.find(([re]) => re.test(reason))?.[1] ?? "other";

/** Each category in words a user can act on. */
const MEANS: Record<ReviewCategory, string> = {
  "clean-replay-skipped": "no call with no cookies showed that it answers a visitor",
  "clean-replay-failed": "its call with no cookies did not answer with data",
  "signed-in": "it was learned signed in",
  write: "it writes",
  "post-read": "it reads with a method other than GET (only a GraphQL query may read by POST)",
  "own-credential": "it sends each caller's own cookie or session value",
  "cookie-lookup": "it fills a value from a lookup sent with each caller's cookies",
  "login-site": "it is a new op on a site with a login",
  "established-site": "it is a new op on a site the catalog already trusts",
  "differs-from-live": "it differs from the op's live version (its match, its request or its trigger)",
  "public-values": "it lists public values (a key every caller sends)",
  "off-site": "it sends to or opens a host off its site",
  "secret-scan": "the secret scan saw what may be a credential in it",
  other: "a rule of the registry's",
};

export interface Held {
  /** the registry's reason, as it gave it */
  reason: string;
  category: ReviewCategory;
  /** the category in words */
  means: string;
}

const WAIT = "nothing to do but wait for a maintainer to review it; until then it is served only to this install";

/**
 * Why a clean replay cannot run on `op` (plain HTTP, no cookies, its own examples), or undefined
 * when it can. `cleanCall` refuses a write by itself; the rest would send a request that proves nothing.
 */
export function unreplayable(op: Operation): string | undefined {
  if (!op.readOnly) return "a write is never replayed";
  if (op.minTier > 1) return `it needs the browser (minTier ${op.minTier}), and a clean replay is plain HTTP`;
  const missing = op.params.filter((p) => p.required && p.example === undefined && p.default === undefined);
  if (missing.length) return `no example for ${missing.map((p) => p.name).join(", ")}`;
  return undefined;
}

/** The step that gets a skipped replay run, when there is one: examples for the params that have none. */
function replayFix(site: string, op: Operation): string | undefined {
  if (!op.readOnly || op.minTier > 1) return undefined;
  const missing = op.params.filter((p) => p.required && p.example === undefined && p.default === undefined);
  if (!missing.length) return undefined;
  const flags = op.params.map((p) => `--example ${p.name}=<value>`).join(" ");
  return `give ${missing.map((p) => p.name).join(", ")} an example anyone may see: learn it again with api-anything add ${site} ${op.name} ... ${flags}, then run api-anything publish ${site} ${op.name} --yes, and its clean replay runs`;
}

/**
 * What the uploader is told of a version held for review: a `reason` saying it is served only to this
 * install and why, each reason with its category and words, and the `next` step. A step exists only
 * where a new version would pass: a skipped replay of a read that lacks examples. A re-upload of the
 * same version is a duplicate and changes nothing, so anything else waits for a maintainer.
 * `cleanReason`: what this machine's clean replay met or why it did not run.
 */
export function heldForReview(
  reasons: string[],
  o: { site: string; op?: Operation; cleanReason?: string },
): { reason: string; next: string; held: Held[] } {
  const held = reasons.map((reason): Held => {
    const category = reviewCategory(reason);
    const words = category === "other" ? reason : MEANS[category];
    const why =
      o.cleanReason && (category === "clean-replay-failed" || category === "clean-replay-skipped")
        ? ` (${o.cleanReason})`
        : "";
    return { reason, category, means: `${words}${why}` };
  });
  return {
    reason: `held for review: served only to this install until a maintainer approves it, because ${
      held.length ? held.map((h) => h.means).join("; ") : "of the registry's rules"
    }`,
    held,
    next: nextStep(
      held.map((h) => h.category),
      o,
    ),
  };
}

/** The next step for a version held for these categories (status reads them from the local op's record). */
export function nextStep(categories: ReviewCategory[], o: { site: string; op?: Operation }): string {
  const fix = o.op && replayFix(o.site, o.op);
  if (fix && categories.length && categories.every((c) => c === "clean-replay-skipped")) return fix;
  return WAIT;
}

/** A review version's categories in words, for `status`. */
export const meansOf = (categories: ReviewCategory[]): string[] => categories.map((c) => MEANS[c] ?? MEANS.other);
