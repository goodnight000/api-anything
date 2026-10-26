/** Site spec schema: one JSON file per site, zod-validated. Unknown fields are stripped. */
import { z } from "zod";

/** A step through decoded request layers; see codec.ts. */
const Step = z
  .string()
  .regex(
    /^(path:\d+|(query|form)(\[\d+\])?:.+|header:.+|json:(\/.*)?|b64|body)$/,
    "step must be path:<i>, query:<k>, header:<n>, form:<k>, json:<pointer>, or body",
  );

export const RequestSchema = z.object({
  method: z.string(),
  url: z.string(),
  // Lower-cased, as the codec writes them: a hand-written "X-CSRF-Token" would otherwise be sent twice.
  headers: z
    .record(z.string(), z.string())
    .default({})
    .transform((h) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]))),
  body: z.string().optional(),
});

export const SlotSchema = z
  .object({
    param: z.string().optional(),
    ref: z
      .string()
      .regex(/^(cookie|session):.+/, "ref must be cookie:<name> or session:<name>")
      .optional(),
    at: z.array(Step).min(1),
    /** the leaf's text with `{param}` where the value goes (value is a substring of the leaf) */
    template: z.string().optional(),
    transform: z.enum(["strip-quotes", "url-decode"]).optional(),
    /** with a template: how the value is escaped inside the leaf (see codec.ts Escape) */
    escape: z.enum(["url", "json"]).optional(),
  })
  .refine((s) => (s.param === undefined) !== (s.ref === undefined), "a slot needs exactly one of param or ref");

export const VolatileSchema = z.object({
  at: z.array(Step).min(1),
  shape: z.object({
    charset: z.enum(["digits", "hex", "base64url", "base64"]),
    length: z.number().int().positive(),
  }),
  /** stable string found near the token in the site's JS (operationName or neighboring path segment) */
  anchor: z.string(),
});

export const TriggerStepSchema = z.object({
  action: z.enum(["click", "fill", "press", "wait", "goto"]),
  selector: z.string().optional(),
  value: z.string().optional(),
  ms: z.number().optional(),
});

/** A confirm() a write's learning accepted: the step it came at (-1: before the first) and its digest (confirm.ts). */
export const ConfirmSchema = z.object({
  step: z.number().int().min(-1),
  digest: z.string().regex(/^[0-9a-f]{64}$/, "digest must be 64 lowercase hex characters"),
});

export const TriggerSchema = z.object({
  /** URL template, `{param}` filled from args */
  url: z.string(),
  steps: z.array(TriggerStepSchema).optional(),
  /** neutral page to load first, then soft-navigate to `url` */
  softFrom: z.string().optional(),
  /** a write's confirm() dialogs that a tier-3 run accepts when the page asks them again; any other is dismissed */
  confirms: z.array(ConfirmSchema).optional(),
});

/** Stable request identity only. Never a queryId/doc_id/hash. */
export const MatchSchema = z.object({
  method: z.string().optional(),
  host: z.string().optional(),
  /** pathname with `*` for any one segment */
  path: z.string().optional(),
  operationName: z.string().optional(),
});

function validRegex(p: string): boolean {
  try {
    new RegExp(p);
    return true;
  } catch {
    return false;
  }
}

export const HtmlRecipeSchema = z.object({ items: z.string(), fields: z.record(z.string(), z.string()) });

export const ResponseSchema = z.object({
  format: z.enum(["json", "html", "embedded"]).default("json"),
  contentType: z.string().optional(),
  xssiPrefix: z.string().optional(),
  extract: z.string().optional(),
  /** paths kept per item; `name=path~regex` keeps what the regex's group 1 finds in a string */
  pick: z
    .array(
      z
        .string()
        .refine(
          (p) => !p.includes("~") || validRegex(p.slice(p.indexOf("~") + 1)),
          "the regex after ~ in pick must be valid",
        ),
    )
    .optional(),
  /** key path -> type, for drift detection */
  shape: z.record(z.string(), z.string()).optional(),
  html: HtmlRecipeSchema.optional(),
  /** capture group 1 is where the JSON starts */
  embedded: z.object({ regex: z.string() }).optional(),
});

export const ParamSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["string", "number", "boolean", "object", "array"]).default("string"),
    required: z.boolean().default(true),
    description: z.string().optional(),
    example: z.unknown().optional(),
    default: z.unknown().optional(),
    /** a regex the whole value must match; a call with an arg that doesn't is `input`, and nothing is sent */
    pattern: z.string().refine(validRegex, "pattern must be a valid regular expression").optional(),
    /** what a valid value looks like, said to the agent when an arg fails `pattern` ("YYYY-MM-DD") */
    hint: z.string().optional(),
    /** the site's whole set of values for it (not just the example's); any other is `input`, and nothing is sent */
    enum: z.array(z.string()).min(1).optional(),
    /** bounds on the value read as a number; a value outside them, or not a number, is `input` */
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((p) => p.min === undefined || p.max === undefined || p.min <= p.max, "a param's min is above its max");

/** A call a human confirmed, and what the site answers it with: data, no data, or a refusal of the args. */
export const CheckSchema = z.object({
  args: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  expect: z.enum(["result", "empty", "input"]),
  /** why this case: which value excludes what ("open=no leaves out the open store in example 1") */
  purpose: z.string().optional(),
});

/** How a read's list continues: the param that takes the next page, and where the answer says what that is. */
export const PagingSchema = z.object({
  /** the param a call sets to get the next page: a cursor, or a page number */
  param: z.string().min(1),
  /**
   * path in the whole answer (before `extract`; for `embedded`, the embedded JSON) to the next page's
   * cursor or number. Without it the pages are numbered and the answer says nothing about the next one.
   */
  next: z.string().min(1).optional(),
});

/**
 * How a write's call proves it landed: one read of the same site, run once after the write was sent.
 * Every value may hold `{writeParam}`, filled from the write's args.
 */
export const ReadbackSchema = z.object({
  /** a read op of the same site */
  op: z.string().min(1),
  /** the read's args */
  args: z.record(z.string(), z.string()).default({}),
  /** an item of the read's answer (or the answer itself) whose `field` equals `equals`; without it, any data counts */
  find: z.object({ field: z.string().min(1), equals: z.string() }).optional(),
});

export const OperationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  request: RequestSchema,
  slots: z.array(SlotSchema).default([]),
  volatile: z.array(VolatileSchema).default([]),
  trigger: TriggerSchema,
  match: MatchSchema.default({}),
  response: ResponseSchema.default({ format: "json" }),
  params: z.array(ParamSchema).default([]),
  readOnly: z.boolean(),
  /**
   * header or field names whose captured value is a public constant, kept literal: a human's call (a
   * web app's shared bearer), or a credential-named value the site ships in its own JS (an API key)
   */
  public: z.array(z.string()).optional(),
  minTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  learnedLoggedIn: z.boolean().default(false),
  learnedAt: z.string().optional(),
  /** run by `verify` beside the examples; `publish` refuses while one fails */
  checks: z.array(CheckSchema).optional(),
  /** a read's list pages: a call returns the next page's cursor (nextPage), and verify checks page 2 is not page 1 again */
  paging: PagingSchema.optional(),
  /** a write's proof: a read run once after it is sent; finding it makes the call's `write` "applied" */
  readback: ReadbackSchema.optional(),
  /**
   * Learning could not show these params change the answer: example 2, which gave them other values,
   * was answered with example 1's data. `publish` refuses while it is set; a `verify` clears it when
   * two of its passing cases that differ only in these params answer differently.
   */
  unproven: z.object({ params: z.array(z.string()), reason: z.string() }).optional(),
});

export const SiteSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i),
  displayName: z.string().optional(),
  baseUrl: z.string(),
  description: z.string().optional(),
  /** cookie names whose presence means logged in (overrides the heuristic) */
  loginCookies: z.array(z.string()).optional(),
  operations: z.array(OperationSchema).default([]),
  /**
   * Where `pull` fetched this spec from. A spec that carries it is someone else's wherever it is
   * saved now (a heal writes a user copy): it is checked against the shared rules on every load,
   * and its heals do not rescan.
   */
  shared: z.object({ from: z.string(), sha256: z.string() }).optional(),
});

export type Request = z.infer<typeof RequestSchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type Volatile = z.infer<typeof VolatileSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Confirm = z.infer<typeof ConfirmSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type ResponseSpec = z.infer<typeof ResponseSchema>;
export type Param = z.infer<typeof ParamSchema>;
export type Check = z.infer<typeof CheckSchema>;
export type Paging = z.infer<typeof PagingSchema>;
export type Readback = z.infer<typeof ReadbackSchema>;
export type Operation = z.infer<typeof OperationSchema>;
export type Site = z.infer<typeof SiteSchema>;

export function parseSite(input: unknown): Site {
  const r = SiteSchema.safeParse(input);
  if (!r.success) throw new Error(`invalid site spec:\n${z.prettifyError(r.error)}`);
  return r.data;
}
