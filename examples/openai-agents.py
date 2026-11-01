# An OpenAI Agents SDK (Python) agent with API Anything's tools, over MCP (stdio).
#
#   pip install openai-agents
#   OPENAI_API_KEY=... python examples/openai-agents.py "What does Goodreads rate Piranesi?"
#
# Written against openai-agents with MCP Python SDK 1 or 2 (October 2026). Node 22.13+ must be on
# PATH for npx. The server serves reads only; call_write_operation exists only with `mcp --allow-writes`.
import asyncio
import sys

from agents import Agent, Runner
from agents.mcp import MCPServerStdio

INSTRUCTIONS = (
    "You answer questions about websites with the api-anything tools. Call find_sites first, then "
    "call_operation. If nothing is shared for the site, call learn_site. If a result has class "
    '"pending", call get_job with its job instead of calling the tool again.'
)


async def main(prompt: str) -> None:
    async with MCPServerStdio(
        name="api-anything",
        params={"command": "npx", "args": ["-y", "api-anything", "mcp"]},
        # a tool call answers within about 25 s (a slower one returns a job), above the 5 s default
        client_session_timeout_seconds=60,
    ) as server:
        agent = Agent(name="Web data", instructions=INSTRUCTIONS, mcp_servers=[server])
        result = await Runner.run(agent, prompt)
        print(result.final_output)


if __name__ == "__main__":
    asyncio.run(main(" ".join(sys.argv[1:]) or "What does Goodreads rate Piranesi?"))
