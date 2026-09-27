/** Site spec schema: one JSON file per site, zod-validated. Unknown fields are stripped. */
import { z } from "zod";

/** A step through decoded request layers; see codec.ts. */
const Step = z
  .string()
  .regex(/^(path:\d+|query:.+|header:.+|form:.+|json:(\/.*)?|body)$/, "step must be path:<i>, query:<k>, header:<n>, form:<k>, json:<pointer>, or body");

export const RequestSchema = z.object({
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().optional(),
});

export const SlotSchema = z
  .object({
    param: z.string().optional(),
    ref: z.string().regex(/^(cookie|session):.+/, "ref must be cookie:<name> or session:<name>").optional(),
    at: z.array(Step).min(1),
    /** the leaf's text with `{param}` where the value goes (value is a substring of the leaf) */
    template: z.string().optional(),
    transform: z.enum(["strip-quotes", "url-decode"]).optional(),
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

export const TriggerSchema = z.object({
  /** URL template, `{param}` filled from args */
  url: z.string(),
  steps: z.array(TriggerStepSchema).optional(),
  /** neutral page to load first, then soft-navigate to `url` */
  softFrom: z.string().optional(),
});

/** Stable request identity only. Never a queryId/doc_id/hash. */
export const MatchSchema = z.object({
  method: z.string().optional(),
  host: z.string().optional(),
  /** pathname with `*` for any one segment */
  path: z.string().optional(),
  operationName: z.string().optional(),
});

export const ResponseSchema = z.object({
  format: z.enum(["json", "html", "embedded"]).default("json"),
  contentType: z.string().optional(),
  xssiPrefix: z.string().optional(),
  extract: z.string().optional(),
  pick: z.array(z.string()).optional(),
  /** key path -> type, for drift detection */
  shape: z.record(z.string(), z.string()).optional(),
  html: z.object({ items: z.string(), fields: z.record(z.string(), z.string()) }).optional(),
  /** capture group 1 is where the JSON starts */
  embedded: z.object({ regex: z.string() }).optional(),
});

export const ParamSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "object", "array"]).default("string"),
  required: z.boolean().default(true),
  description: z.string().optional(),
  example: z.unknown().optional(),
  default: z.unknown().optional(),
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
  /** header names whose captured value is a public constant (a web app's bearer), kept literal; a human's call */
  public: z.array(z.string()).optional(),
  minTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  learnedLoggedIn: z.boolean().default(false),
  learnedAt: z.string().optional(),
});

export const SiteSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i),
  displayName: z.string().optional(),
  baseUrl: z.string(),
  description: z.string().optional(),
  /** cookie names whose presence means logged in (overrides the heuristic) */
  loginCookies: z.array(z.string()).optional(),
  operations: z.array(OperationSchema).default([]),
});

export type Request = z.infer<typeof RequestSchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type Volatile = z.infer<typeof VolatileSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type ResponseSpec = z.infer<typeof ResponseSchema>;
export type Param = z.infer<typeof ParamSchema>;
export type Operation = z.infer<typeof OperationSchema>;
export type Site = z.infer<typeof SiteSchema>;

export function parseSite(input: unknown): Site {
  const r = SiteSchema.safeParse(input);
  if (!r.success) throw new Error(`invalid site spec:\n${z.prettifyError(r.error)}`);
  return r.data;
}
