/** Library entry: `import { call } from "api-anything"`. */

export { closeBrowser } from "./browser.js";
export { classify } from "./classify.js";
export { type CallOptions, type CallResult, call, heal, type Tier } from "./execute.js";
export { type AddInput, addOperation, capturePage, healOperation } from "./heal.js";
export { learnOperation, rankCandidates } from "./learn.js";
export { createServer, serveStdio } from "./mcp.js";
export {
  type Match,
  type Operation,
  type Param,
  parseSite,
  type Request,
  type ResponseSpec,
  type Site,
  type Slot,
  type Trigger,
} from "./spec.js";
export { exportSite, listSites, loadSite, saveSite } from "./store.js";
export type { CaptureResult, Exchange, StoredCookie, TriggerStep } from "./types.js";
