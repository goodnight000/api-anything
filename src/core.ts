/**
 * Embedding entry: `import { replay } from "api-anything/core"`. Everything here is pure: no file
 * system, no browser, no session store. The embedder supplies the operation, the session values
 * and the transport, and keeps what comes back.
 */
export { replay, type ReplayResult, type ReplayTransport } from "./replay.js";
export { rescanOperation, type FetchText } from "./rescan.js";
export { learnOperation, type LearnInput, type Learned } from "./learn.js";
export { scanSecrets } from "./secrets.js";
export { classify, judge, type Class, type Classified, type Judged, type Observed } from "./classify.js";
export { buildRequest } from "./http.js";
export type { Session } from "./cookies.js";
export { OperationSchema, SiteSchema, parseSite, type Match, type Operation, type Param, type Request, type ResponseSpec, type Site, type Slot, type Trigger, type Volatile } from "./spec.js";
export type { CaptureResult, Exchange, StoredCookie, TriggerStep } from "./types.js";
