# configurator-mcp

The TypeScript workspace of the Roomle configurator MCP server and the chat backend of the
configurator example. Reference: [`../docs/configurator-mcp-server.md`](../docs/configurator-mcp-server.md).

| Package | Entry | What it is |
| --- | --- | --- |
| [`configurator-mcp-server/`](./configurator-mcp-server/) | `server.ts` | The MCP server on :3100 — `/mcp` (Streamable HTTP) and the `/bridge` WebSocket to the example page; the tools `undo` and `redo` |
| [`configurator-mcp-chat/`](./configurator-mcp-chat/) | `chat-server.ts` | The chat backend on :3200 — `POST /chat` with a Mistral model (Vercel AI SDK) and the server's tools |

| File | What it holds |
| --- | --- |
| `configurator-mcp-server/types.ts` | The bridge protocol: `hello`, `ready`, `call`, `result`, `event` |
| `configurator-mcp-server/page-bridge.ts` | The connected page, call correlation and timeouts, the history events |
| `configurator-mcp-server/configurator-api.ts` | The configurator methods the tools call — `undo`, `redo` — relayed to the page |
| `configurator-mcp-server/history-state.ts` | The configurator's undo history state from the page's events |
| `configurator-mcp-server/tool-executors.ts` | One undo or redo step, confirmed by its history event |
| `configurator-mcp-server/configurator-mcp-server.ts` | The `McpServer`: instructions and the tool registrations |
| `configurator-mcp-chat/chat-config.ts` | The two chat models, the system prompt, the environment, the message parsing |
| `configurator-mcp-chat/chat-handler.ts` | `/health` and `/chat`, CORS for the page origins |
| `configurator-mcp-chat/chat-stream.ts` | The MCP client, `streamText`, the `[tool]` and `[error]` lines |
| `configurator-mcp-chat/chat-steps.ts` | The step loop, the step log, the turn timeout |
| `configurator-mcp-chat/chat-recovery.ts` | What an interrupted reply says about the tool calls |

Scripts, run here or through the repository root: `npm start` (the MCP server), `npm test`
(vitest over both packages' `tests/`), `npm run typecheck` (`tsc --noEmit` per package, strict
ES2022 from `tsconfig.base.json`).

The page the server drives is [`../minimal-configurator-example/`](../minimal-configurator-example/README.md).
