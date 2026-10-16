# roomle-configurator-mcp

Standalone Roomle configurator example (one `minimal-configurator-example/index.html`) with the
Roomle configurator MCP server (`configurator-mcp`): an AI agent changes a Roomle configuration in a
live standalone configurator session, the way the HI MCP server of
[roomle-hi-example](https://github.com/roomle-dev/roomle-hi-example) plans HOMAG Intelligence
object groups in a live room-planner session. The server offers `undo` and `redo`; the example's AI
Planning Assistant window talks to a Mistral model that calls them.

## Usage

```bash
npm install
npm start
```

| Invocation | What you get |
| ---------- | ------------ |
| `npm start` | Example page on :3000, MCP server on :3100, browser opens |
| `npm start mistral-medium <api-key>` | Plus the chat backend on :3200 with `mistral-medium-latest` and the AI Planning Assistant window |
| `npm start mistral-large <api-key>` | Plus the chat backend with `mistral-large-latest` |
| `npm run mcp-server` | The MCP server alone on :3100, for an external MCP client |
| `npm start -- --no-open` | Without opening the browser; flags go after `--` |
| `npm run dev <same arguments>` | The configurator loads from the local Rubens UI dev server (:5173) |
| `EXAMPLE_SERVER_URL=<url> npm start <same arguments>` | The configurator loads from `<url>` (passed to the page as `overrideServerUrl`) |
| `EXAMPLE_PORT=3001 npm start` | The page on another port (`CONFIGURATOR_MCP_PORT`, `CONFIGURATOR_CHAT_PORT` for the others) |

The page loads the item `usm:frame` into the `demoConfigurator`; `?id=<item or configuration id>`
loads another object, and every other URL parameter is an init option of the configurator — see
[minimal-configurator-example/README.md](./minimal-configurator-example/README.md). The chat needs a
Rubens UI whose configurator has the AI Planning Assistant window.

Ask the assistant in the window: `undo`, `redo`, "take back the last change". External MCP clients
connect to `http://localhost:3100/mcp`, e.g.
`claude mcp add --transport http --scope user configurator-mcp http://localhost:3100/mcp`.
Everything about the server, the tools and the chat: [docs/configurator-mcp-server.md](./docs/configurator-mcp-server.md).

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`.

## Repository layout

| Folder | Content |
| ------ | ------- |
| [`minimal-configurator-example/`](./minimal-configurator-example/README.md) | The example page and its launcher |
| [`configurator-mcp/`](./configurator-mcp/README.md) | The TypeScript workspace of the MCP server and the chat backend |
| [`docs/`](./docs/README.md) | Living reference for users and developers |
| [`.agents/`](./.agents/README.md) | The digital brain for AI agents: skills, analyses, decisions, backlog |
| [`AGENTS.md`](./AGENTS.md) | Instructions for AI assistants (`CLAUDE.md` redirects there, `.github/copilot-instructions.md` mirrors it) |
| `.temp/` | Scratch space, git-ignored |
