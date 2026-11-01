// A Vercel AI SDK agent with API Anything's tools, over MCP (stdio).
//
//   npm install ai @ai-sdk/mcp @ai-sdk/anthropic
//   ANTHROPIC_API_KEY=... node examples/vercel-ai-sdk.mjs "What does Goodreads rate Piranesi?"
//
// Written against ai 7 and @ai-sdk/mcp 2 (October 2026). MODEL picks another Anthropic model.
// The server serves reads only; call_write_operation exists only with `mcp --allow-writes`.
import { anthropic } from "@ai-sdk/anthropic";
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { generateText, isStepCount } from "ai";

const prompt = process.argv.slice(2).join(" ") || "What does Goodreads rate Piranesi?";

const mcp = await createMCPClient({
  transport: new StdioMCPTransport({ command: "npx", args: ["-y", "api-anything", "mcp"] }),
});
try {
  const { text, steps } = await generateText({
    model: anthropic(process.env.MODEL ?? "claude-opus-5-5"),
    tools: await mcp.tools(),
    stopWhen: isStepCount(10),
    system:
      "You answer questions about websites with the api-anything tools. Call find_sites first, then " +
      "call_operation. If nothing is shared for the site, call learn_site. If a result has class " +
      '"pending", call get_job with its job instead of calling the tool again.',
    prompt,
  });
  for (const step of steps) for (const call of step.toolCalls) console.error(`tool: ${call.toolName}`);
  console.log(text);
} finally {
  await mcp.close();
}
