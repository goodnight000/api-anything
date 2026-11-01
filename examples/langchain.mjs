// A LangChain.js agent with API Anything's tools, over MCP (stdio).
//
//   npm install langchain @langchain/anthropic @langchain/mcp-adapters @langchain/core @langchain/langgraph
//   ANTHROPIC_API_KEY=... node examples/langchain.mjs "What does Goodreads rate Piranesi?"
//
// Written against langchain 1 and @langchain/mcp-adapters 2 (October 2026). MODEL picks another
// Anthropic model. The server serves reads only; call_write_operation exists only with `mcp --allow-writes`.
import { ChatAnthropic } from "@langchain/anthropic";
import { MCPAdapter } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";

const prompt = process.argv.slice(2).join(" ") || "What does Goodreads rate Piranesi?";

// mcp-adapters 2 prefixes each tool with its server's name: the agent sees api-anything_find_sites
const adapter = new MCPAdapter({
  servers: { "api-anything": { command: "npx", args: ["-y", "api-anything", "mcp"] } },
});
try {
  const agent = createAgent({
    model: new ChatAnthropic({ model: process.env.MODEL ?? "claude-opus-5-5" }),
    tools: await adapter.listTools(),
    systemPrompt:
      "You answer questions about websites with the api-anything tools. Call find_sites first, then " +
      "call_operation. If nothing is shared for the site, call learn_site. If a result has class " +
      '"pending", call get_job with its job instead of calling the tool again.',
  });
  const result = await agent.invoke({ messages: [{ role: "user", content: prompt }] });
  console.log(result.messages.at(-1)?.content);
} finally {
  await adapter.close();
}
