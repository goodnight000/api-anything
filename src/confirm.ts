/**
 * A write's confirm() dialogs: the record its learning keeps of each one it accepted, and the check
 * a tier-3 run makes before accepting one. The record is a digest, so a spec holds no page text.
 */
import { createHash } from "node:crypto";
import { asText } from "./codec.js";
import type { Confirm } from "./spec.js";
import type { CaptureResult } from "./types.js";

/** A confirm() as a run saw it: its message, the origin of the page that asked, and the trigger step (-1: before the first). */
export interface Asked {
  message: string;
  origin: string;
  step: number;
}

const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
const WORD = /[\p{L}\p{N}_]/u;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The message with each arg value it names, as a whole word or number in any letter case, replaced
 * by `[param]`, longest value first: "Delete post 48213?" with id=48213 is `["Delete post ", ["id"], "?"]`.
 * A value matches only between non-word characters, so "12" in "123" stays text.
 */
export function confirmTemplate(message: string, args: Record<string, unknown>): (string | [string])[] {
  const text = norm(message);
  const values = Object.entries(args)
    .map(([name, v]) => [name, norm(asText(v))] as const)
    .filter(([, v]) => v.length > 0 && v.length <= text.length)
    .sort((a, b) => b[1].length - a[1].length);
  if (!values.length) return [text];
  const word = (c: string | undefined) => !!c && WORD.test(c);
  const re = new RegExp(
    values
      .map(
        ([, v]) =>
          `(${word(v[0]) ? "(?<![\\p{L}\\p{N}_])" : ""}${escapeRe(v)}${word(v.at(-1)) ? "(?![\\p{L}\\p{N}_])" : ""})`,
      )
      .join("|"),
    "giu",
  );
  const out: (string | [string])[] = [];
  let end = 0;
  for (const m of text.matchAll(re)) {
    const i = m.slice(1).findIndex((g) => g !== undefined);
    out.push(text.slice(end, m.index), [values[i]![0]]);
    end = m.index + m[0].length;
  }
  out.push(text.slice(end));
  return out;
}

/** The digest kept for a confirm: the page's origin, the step, and the message's template. */
export const confirmDigest = (a: Asked, args: Record<string, unknown>): string =>
  createHash("sha256")
    .update(JSON.stringify(["api-anything.confirm.v1", a.origin, a.step, confirmTemplate(a.message, args)]))
    .digest("hex");

/** The record of the confirms a run accepted (a write's learning: its request was intercepted), made with its args. */
export const acceptedConfirms = (c: CaptureResult, args: Record<string, unknown>): Confirm[] =>
  (c.dialogs ?? [])
    .filter((d) => d.type === "confirm" && d.accepted)
    .map((d) => ({ step: d.step, digest: confirmDigest(d, args) }));

/**
 * Whether to accept each confirm of a tier-3 run: one that matches a record (the same question
 * with this call's values, at the same step, on the same origin), each record once.
 */
export function recordedConfirms(records: Confirm[], args: Record<string, unknown>): (a: Asked) => boolean {
  const left = [...records];
  return (a) => {
    const digest = confirmDigest(a, args);
    const i = left.findIndex((r) => r.step === a.step && r.digest === digest);
    if (i >= 0) left.splice(i, 1);
    return i >= 0;
  };
}
