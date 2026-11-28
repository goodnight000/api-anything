import assert from "node:assert/strict";
import test from "node:test";
import { parseSite } from "../src/spec.js";
import { vetShared } from "../src/vet.js";

const spec = (learnedLoggedIn: boolean, loginCookies?: string[]) =>
  parseSite({
    name: "demo",
    baseUrl: "https://demo.example.com",
    ...(loginCookies ? { loginCookies } : {}),
    operations: [
      {
        name: "follow",
        request: { method: "POST", url: "https://demo.example.com/api/follow" },
        slots: [],
        volatile: [],
        trigger: { url: "https://demo.example.com/app" },
        match: {},
        response: { format: "json" },
        params: [],
        readOnly: false,
        learnedLoggedIn,
      },
    ],
  })!;

test("vet warns when a signed-in write has no loginCookies to prove the session", () => {
  assert.match(vetShared(spec(true)).warnings.join("\n"), /names no loginCookies/);
});

test("vet does not warn when the write is not signed in or the site pins loginCookies", () => {
  assert.doesNotMatch(vetShared(spec(false)).warnings.join("\n"), /names no loginCookies/);
  assert.doesNotMatch(vetShared(spec(true, ["sid"])).warnings.join("\n"), /names no loginCookies/);
});
