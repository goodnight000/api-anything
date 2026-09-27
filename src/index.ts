/** Library entry: `import { call } from "api-anything"`. */
export { call, heal, type CallOptions, type CallResult, type Tier } from "./execute.js";
export { addOperation, capturePage, healOperation, type AddInput } from "./heal.js";
export { learnOperation, rankCandidates } from "./learn.js";
export { classify } from "./classify.js";
export { exportSite, listSites, loadSite, saveSite } from "./store.js";
export { closeBrowser } from "./browser.js";
export { createServer, serveStdio } from "./mcp.js";
export { parseSite, type Match, type Operation, type Param, type Request, type ResponseSpec, type Site, type Slot, type Trigger } from "./spec.js";
export type { CaptureResult, Exchange, StoredCookie, TriggerStep } from "./types.js";
