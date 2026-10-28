# gemini-search-mcp

An [MCP](https://modelcontextprotocol.io) server that lets AI assistants search the web with **Google Search via Gemini grounding**. It returns a summarized answer with inline citations (`[1]`, `[2,3]`) and a list of source URLs.

Inspired by [yukukotani/mcp-gemini-google-search](https://github.com/yukukotani/mcp-gemini-google-search), rewritten with these fixes:

- Citation markers are placed using UTF-8 byte offsets (as Gemini reports them), so they land correctly in Chinese / Japanese / emoji text.
- Missing credentials are reported as a tool error instead of crashing the server at startup.
- Requests have a timeout and honor MCP cancellation.
- Errors are returned as `isError` tool results so the model can see and react to them.

## Tool

### `google_search`

| Param | Type | Description |
| --- | --- | --- |
| `query` | string (required) | The search query or question. |

## Usage

Requires Node.js >= 20.

Installed directly from GitHub (built automatically on install via `prepare`):

```json
{
  "mcpServers": {
    "gemini-search": {
      "command": "npx",
      "args": ["-y", "github:spotmaxtech/gemini-search-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

Pin a version with a tag or commit, e.g. `github:spotmaxtech/gemini-search-mcp#v0.1.0`.

Claude Code:

```bash
claude mcp add gemini-search -e GEMINI_API_KEY=your-api-key -- npx -y github:spotmaxtech/gemini-search-mcp
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | - | Google AI Studio API key. Required unless using Vertex AI. |
| `GEMINI_PROVIDER` | - | Set to `vertex` to use Vertex AI. |
| `VERTEX_PROJECT_ID` | - | GCP project ID. Required when `GEMINI_PROVIDER=vertex`. |
| `VERTEX_LOCATION` | `us-central1` | Vertex AI location. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model to use. |
| `GEMINI_TIMEOUT_MS` | `60000` | Request timeout in milliseconds. |
| `RESOLVE_SOURCE_URLS` | `true` | Replace Google grounding redirect links with the real page URLs (reads only the redirect header, 3s timeout per link). Set to `false` to skip. |

Vertex AI uses Application Default Credentials (e.g. `gcloud auth application-default login`).

## Development

```bash
npm install        # also builds via prepare
npm test           # unit tests
npm run typecheck
npm run build
GEMINI_API_KEY=... npm run inspect   # open MCP Inspector
```

The Inspector does not pass your shell environment to the server process; `npm run inspect` forwards the variables above explicitly via `-e`.

## License

MIT
