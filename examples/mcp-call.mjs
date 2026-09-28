// Call an operation the way an MCP client does: start `api-anything mcp` over stdio and use its tools.
// Usage: node examples/mcp-call.mjs <site> <op> [name=value ...]
//   e.g. node examples/mcp-call.mjs hn-demo links domain=nature.com
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [site, op, ...pairs] = process.argv.slice(2);
if (!site || !op) {
  console.error("usage: node examples/mcp-call.mjs <site> <op> [name=value ...]");
  process.exit(2);
}
const args = Object.fromEntries(pairs.map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]));

const client = new Client({ name: "api-anything-example", version: "0.1.0" });
await client.connect(new StdioClientTransport({ command: "api-anything", args: ["mcp"], env: process.env }));
try {
  const { tools } = await client.listTools();
  console.log("tools:", tools.map((t) => t.name).join(", "));
  console.log("call_operation", JSON.stringify({ site, op, args }));
  const res = await client.callTool({ name: "call_operation", arguments: { site, op, args } });
  const r = JSON.parse(res.content[0].text);
  const items = Array.isArray(r.data) ? r.data : [];
  console.log(JSON.stringify({ ok: r.ok, class: r.class, tier: r.tier, ms: r.ms, results: items.length, first: items.slice(0, 3), reason: r.reason, next: r.next }, null, 2));
  if (!r.ok) process.exitCode = 1;
} finally {
  await client.close();
}
