/**
 * Slow MCP tool calls as jobs. Many clients give up on a tool call after about a minute, and a call
 * that heals or runs the page in the browser, or a sign-in window the user is still using, can take
 * longer. A call still running at its deadline answers with a job id and keeps running; `wait`
 * reads its result later and never runs it again. Jobs live in this process's memory and end with it.
 * A call identical to one still running joins it: a second login opens no second window, and a
 * repeated write is not sent twice.
 */
import { randomBytes } from "node:crypto";

export interface Job<T> {
  id: string;
  /** what the pending answer says about it: what is running, and what not to do meanwhile */
  note: string;
  started: number;
  finished?: number;
  settled: Promise<T>;
}

/** A finished job's result stays readable this long. */
const KEEP_MS = 15 * 60_000;

export class Jobs<T> {
  private readonly byId = new Map<string, Job<T>>();
  private readonly running = new Map<string, Job<T>>();

  constructor(readonly waitMs: number) {}

  /** Runs `work` under `key`, or joins the job running under it; the result, or the job once `waitMs` passes. */
  start(key: string, note: string, work: () => Promise<T>): Promise<{ result: T } | { job: Job<T> }> {
    let job = this.running.get(key);
    if (!job) {
      let id = randomBytes(4).toString("hex");
      while (this.byId.has(id)) id = randomBytes(4).toString("hex");
      const settled = work();
      const started: Job<T> = { id, note, started: Date.now(), settled };
      this.running.set(key, started);
      // a rejection is read by whoever waits; with no one waiting it must not crash the server
      settled
        .catch(() => {})
        .finally(() => {
          started.finished = Date.now();
          this.running.delete(key);
        });
      job = started;
    }
    return this.wait(job, this.waitMs);
  }

  /** A job a pending answer named, until 15 minutes after it finished. */
  get(id: string): Job<T> | undefined {
    for (const [k, j] of this.byId)
      if (j.finished !== undefined && Date.now() - j.finished > KEEP_MS) this.byId.delete(k);
    return this.byId.get(id);
  }

  /** The result, once the job finishes within `ms`; else the job, which is from then on found by its id. */
  async wait(job: Job<T>, ms: number): Promise<{ result: T } | { job: Job<T> }> {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<"late">((resolve) => {
      timer = setTimeout(() => resolve("late"), ms);
    });
    try {
      const r = await Promise.race([job.settled.then((result) => ({ result })), late]);
      if (r !== "late") return r;
      this.byId.set(job.id, job);
      return { job };
    } finally {
      clearTimeout(timer);
    }
  }
}
