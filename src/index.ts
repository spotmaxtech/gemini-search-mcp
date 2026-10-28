import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getConfig } from "./config.js";
import { googleSearch } from "./search.js";

const server = new McpServer({
  name: "gemini-search-mcp",
  version: "0.1.0",
});

server.registerTool(
  "google_search",
  {
    title: "Google Search",
    description:
      "Searches the web with Google Search (via Gemini grounding) and returns a summarized answer with inline citations [n] and a list of source URLs. Use it for up-to-date information or facts not in your training data.",
    inputSchema: {
      query: z
        .string()
        .trim()
        .min(1, "query must not be empty")
        .describe("The search query or question to look up on the web."),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async ({ query }, extra) => {
    try {
      const text = await googleSearch(getConfig(), query, extra.signal);
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Google search failed: ${describeError(error)}` }],
      };
    }
  },
);

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "request timed out";
    if (error.name === "AbortError") return "request was cancelled";
    return error.message;
  }
  return String(error);
}

async function main() {
  await server.connect(new StdioServerTransport());
  console.error("gemini-search-mcp running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
