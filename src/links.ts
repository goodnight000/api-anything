/** Declarative edges prepare a next call; they never choose an item or execute a request. */
import { getPath, pickEntry, returnedFields } from "./extract.js";
import type { Operation, OperationLink, Site } from "./spec.js";

/** What is wrong with an op's links: a target op or param the site lacks, a source field the op does not return, a transform outside the set. */
export function linkProblems(site: Site, op: Operation): string[] {
  const fields = returnedFields(op.response);
  return (op.links ?? []).flatMap((link) => {
    const problems: string[] = [];
    const target = site.operations.find((o) => o.name === link.to.op);
    if (!target) problems.push(`link target ${link.to.op} is no operation of ${site.name}`);
    else if (!target.params.some((p) => p.name === link.to.arg))
      problems.push(`link target ${link.to.op}.${link.to.arg} is no param`);
    if (fields && !fields.includes(link.from.split(/[.[]/)[0]!))
      problems.push(`link source ${link.from} is no field ${op.name} returns`);
    if (link.transform && link.transform !== "lastPathSegment") {
      try {
        // pick's `name=` rename means nothing here
        if (!link.transform.includes("~") || /^[\w$-]+=/.test(link.transform)) throw new Error();
        pickEntry(link.transform);
      } catch {
        problems.push("link transform must be lastPathSegment or path~regex (a valid pick expression)");
      }
    }
    return problems;
  });
}

/**
 * The next call a declared link makes of one chosen result item: the target's defaults, then `args`,
 * then the linked value. Nothing is sent, and the value is passed as the item holds it.
 */
export function prepareLink(
  site: Site,
  source: string,
  item: Record<string, unknown>,
  link: OperationLink,
  args: Record<string, unknown> = {},
): { site: string; op: string; args: Record<string, unknown> } {
  const op = site.operations.find((o) => o.name === source);
  if (
    !op?.links?.some(
      (l) =>
        l.from === link.from && l.to.op === link.to.op && l.to.arg === link.to.arg && l.transform === link.transform,
    )
  )
    throw new Error("link is not declared by the source operation");
  const problems = linkProblems(site, { ...op, links: [link] });
  if (problems.length) throw new Error(problems.join("; "));
  if (!item || typeof item !== "object" || Array.isArray(item))
    throw new Error("choose one result item (an object), not a list or a call envelope");
  let value = Object.hasOwn(item, link.from) ? item[link.from] : getPath(item, link.from);
  if (link.transform === "lastPathSegment") {
    try {
      if (typeof value !== "string") throw new Error();
      value = new URL(value).pathname.split("/").filter(Boolean).at(-1);
    } catch {
      throw new Error("lastPathSegment needs an absolute URL in the source field");
    }
  } else if (link.transform) {
    const { path, re } = pickEntry(link.transform);
    const at = getPath(value, path);
    const match = typeof at === "string" ? re!.exec(at) : null;
    value = match ? (match[1] ?? match[0]) : undefined;
  }
  if (value === undefined || value === null || value === "")
    throw new Error("the selected item has no value for the link");
  const target = site.operations.find((o) => o.name === link.to.op)!;
  const next = {
    ...Object.fromEntries(target.params.filter((p) => p.default !== undefined).map((p) => [p.name, p.default])),
    ...args,
    [link.to.arg]: value,
  };
  const unknown = Object.keys(next).find((k) => !target.params.some((p) => p.name === k));
  if (unknown) throw new Error("extra args name a param the target operation does not have");
  const missing = target.params.filter(
    (p) => p.required && (!Object.hasOwn(next, p.name) || next[p.name] === undefined),
  );
  if (missing.length) throw new Error(`supply the target's required args: ${missing.map((p) => p.name).join(", ")}`);
  return { site: site.name, op: target.name, args: next };
}
