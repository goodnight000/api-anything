/** Where the attach lock goes when the OS account's home is empty, relative or missing: nowhere, with a next that is true. */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os, { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AttachError, attachLock } from "../src/attach.js";

/** attachLock with the OS account's home directory as `homedir` says. */
function withHome<T>(homedir: string, f: () => T): T {
  const real = os.userInfo;
  os.userInfo = ((o?: object) => ({ ...real(o as never), homedir })) as typeof os.userInfo;
  syncBuiltinESMExports();
  try {
    return f();
  } finally {
    os.userInfo = real;
    syncBuiltinESMExports();
  }
}

test("an empty or relative home is refused, never a lock path under the working directory", () => {
  for (const home of ["", "relative/home", "."]) {
    assert.throws(
      () => withHome(home, () => attachLock("127.0.0.1:9222")),
      (e: Error) => {
        assert.ok(e instanceof AttachError, e.message);
        assert.match(e.message, /attach lock has no place: .*(empty|not an absolute path)/);
        assert.match(e.next, /home directory exists and is an absolute path, or unset API_ANYTHING_CDP/);
        return true;
      },
      JSON.stringify(home),
    );
    assert.equal(existsSync(join(home || ".", ".api-anything-locks")), false, "no directory was made where it ran");
  }
});

test("a home that does not exist is refused with a next that does not ask to remove anything", () => {
  const gone = join(mkdtempSync(join(tmpdir(), "aa-home-")), "no-such-home");
  assert.throws(
    () => withHome(gone, () => attachLock("127.0.0.1:9222")),
    (e: Error) => {
      assert.ok(e instanceof AttachError, e.message);
      assert.match(e.message, /the home directory .*no-such-home does not exist/);
      assert.doesNotMatch(e.next, /remove/);
      return true;
    },
  );
  assert.equal(existsSync(gone), false);
});
