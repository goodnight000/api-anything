import assert from "node:assert/strict";
import { test } from "node:test";
import { getAt, setAt, walk } from "../src/codec.js";
import type { Request } from "../src/spec.js";

test("multipart form: JSONString and organization_id are separate leaves, and rewrites keep the other bytes", () => {
  const body =
    '--ZBOUND\r\nContent-Disposition: form-data; name="JSONString"\r\n\r\n' +
    '{"contact_name":"example","company_name":"example","tax_treatment":"vat_not_registered"}\r\n' +
    '--ZBOUND\r\nContent-Disposition: form-data; name="organization_id"\r\n\r\n' +
    "885922965\r\n--ZBOUND--\r\n";
  const r: Request = {
    method: "POST",
    url: "https://books.zoho.com/api/v3/contacts",
    headers: { "content-type": "multipart/form-data; boundary=ZBOUND" },
    body,
  };
  const byAt = new Map(walk(r).map((l) => [l.at.join(" "), l]));
  assert.equal(byAt.get("form:JSONString json:/company_name")!.value, "example");
  assert.equal(byAt.get("form:organization_id")!.value, "885922965");
  assert.equal(getAt(r, ["form:JSONString", "json:/company_name"]), "example");
  const changed = setAt(r, ["form:JSONString", "json:/company_name"], "sample");
  assert.equal(changed.body, body.replace('"company_name":"example"', '"company_name":"sample"'));
  const org = setAt(r, ["form:organization_id"], "{cookie:zalb_zid}");
  assert.equal(org.body, body.replace("\r\n885922965\r\n", "\r\n{cookie:zalb_zid}\r\n"));
  assert.throws(() => setAt(r, ["form:organization_id"], "a\r\nb"), /line break or the boundary/);
});
