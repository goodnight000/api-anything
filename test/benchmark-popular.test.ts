import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

const grader = new URL("../bench/popular.mjs", import.meta.url).href;
function grade(task: string, answer: unknown, rows?: unknown[]) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { gradePopular } from ${JSON.stringify(grader)};
     const [task, answer, truth] = JSON.parse(process.argv[1]);
     console.log(JSON.stringify(gradePopular(task, answer, truth)));`,
        JSON.stringify([task, typeof answer === "string" ? answer : JSON.stringify(answer), rows && { rows }]),
      ],
      { encoding: "utf8" },
    ),
  );
}

test("Netflix grading requires every episode and runtime in displayed order", () => {
  const rows = [
    { title: "Chapter One: First", minutes: 49 },
    { title: "Chapter Two: Second", minutes: 56 },
    { title: "Chapter Three: Third", minutes: 52 },
  ];
  assert.equal(grade("netflix-1", rows, rows).correct, true);
  assert.equal(
    grade(
      "netflix-1",
      rows.map((r, i) => ({ ...r, title: `${i + 1}. ${r.title}` })),
      rows,
    ).correct,
    true,
  );
  assert.equal(grade("netflix-1", [...rows].reverse(), rows).correct, false);
  assert.equal(
    grade(
      "netflix-1",
      rows.map((r) => ({ ...r, minutes: 50 })),
      rows,
    ).correct,
    false,
  );
  assert.equal(grade("netflix-1", [rows[0], rows[0], rows[0]], rows).correct, false);
  assert.equal(grade("netflix-1", "Unavailable", rows).correct, false);
  assert.equal(grade("netflix-1", rows).correct, null);
});

test("IKEA grading requires all five complete addresses under the right store", () => {
  const rows = ["Emeryville", "East Palo Alto", "West Sacramento", "Costa Mesa", "San Diego"].map((store, i) => ({
    store,
    address: `${100 + i} Example Street ${store}, CA 9000${i}`,
  }));
  assert.equal(grade("ikea-5", [...rows].reverse(), rows).correct, true);
  assert.equal(
    grade(
      "ikea-5",
      rows.map((r) => ({ ...r, address: r.address.replace("Street", "St.") })),
      rows,
    ).correct,
    true,
  );
  assert.equal(
    grade(
      "ikea-5",
      rows.map((r) => ({ ...r, address: r.address.replace("9000", "8000") })),
      rows,
    ).correct,
    false,
  );
  assert.equal(
    grade(
      "ikea-5",
      rows.map((r, i) => ({ ...r, address: rows[(i + 1) % 5].address })),
      rows,
    ).correct,
    false,
  );
  assert.equal(grade("ikea-5", [rows[0], rows[1], rows[2], rows[3], rows[3]], rows).correct, false);
  assert.equal(grade("ikea-5", rows.slice(0, 4), rows).correct, false);
});
