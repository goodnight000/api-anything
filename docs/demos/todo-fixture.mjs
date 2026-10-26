// The safety demo's site: the test suite's local fixture server (test/fixture/server.ts), with two
// captures of its to-do page seeded into $API_ANYTHING_HOME, as test/cli.test.ts seeds them: the
// list's GET, and the add's POST as a --write capture aborts it (so nothing was sent while learning).
// Usage: node --import tsx docs/demos/todo-fixture.mjs   (prints the URL, runs until killed)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startFixture } from "../../test/fixture/server.ts";

const home = process.env.API_ANYTHING_HOME;
if (!home) throw new Error("set API_ANYTHING_HOME to the demo's state directory");
const fx = await startFixture();
const page = { id: 1, resourceType: "document", request: { method: "GET", url: `${fx.url}/todos`, headers: {} } };
const list = await fetch(`${fx.url}/api/todos`);
const captures = {
  ctodos: [
    page,
    {
      id: 2,
      resourceType: "fetch",
      request: { method: "GET", url: `${fx.url}/api/todos`, headers: {} },
      response: { status: list.status, headers: {}, contentType: "application/json", body: await list.text() },
    },
  ],
  caddtodo: [
    page,
    {
      id: 2,
      resourceType: "fetch",
      request: {
        method: "POST",
        url: `${fx.url}/api/todos`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "buy milk" }),
      },
      aborted: true,
    },
  ],
};
mkdirSync(join(home, "captures"), { recursive: true });
for (const [id, exchanges] of Object.entries(captures)) {
  const capture = {
    id,
    at: new Date().toISOString(),
    url: `${fx.url}/todos`,
    finalUrl: `${fx.url}/todos`,
    cookies: [],
  };
  const write = id === "caddtodo" && {
    write: true,
    steps: [
      { action: "fill", selector: "#title", value: "buy milk" },
      { action: "click", selector: "#add" },
    ],
  };
  writeFileSync(join(home, "captures", `${id}.json`), JSON.stringify({ ...capture, ...write, exchanges }));
}
console.log(fx.url);
