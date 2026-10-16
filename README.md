# roomle-configurator-mcp

Standalone Roomle configurator example (one `minimal-configurator-example/index.html`) and the
workspace for a Roomle configurator MCP server (`configurator-mcp`): an AI agent configures Roomle
objects in a live standalone configurator session, the way the HI MCP server of
[roomle-hi-example](https://github.com/roomle-dev/roomle-hi-example) plans HOMAG Intelligence
object groups in a live room-planner session.

The MCP server is not implemented yet. The repository holds the example page, the tooling and the
documentation structure the server is built into.

## Usage

```bash
npm install
npm start
```

| Invocation | What you get |
| ---------- | ------------ |
| `npm start` | Example page on :3000, browser opens |
| `npm start -- --no-open` | Same, without opening the browser |
| `npm run dev` | Same, but the configurator loads from the local Rubens UI dev server (:5173) |
| `EXAMPLE_SERVER_URL=<url> npm start` | Same, but the configurator loads from `<url>` (passed to the page as `overrideServerUrl`) |
| `EXAMPLE_PORT=3001 npm start` | The page on another port |

The page loads the item `usm:frame` into the `demoConfigurator`; `?id=<item or configuration id>`
loads another object, and every other URL parameter is an init option of the configurator — see
[minimal-configurator-example/README.md](./minimal-configurator-example/README.md).

Checks: `npm run format:check`, `npm run lint`, `npm run typecheck`.

## Repository layout

| Folder | Content |
| ------ | ------- |
| [`minimal-configurator-example/`](./minimal-configurator-example/README.md) | The example page and its launcher |
| [`configurator-mcp/`](./configurator-mcp/README.md) | The TypeScript workspace for the MCP server |
| [`docs/`](./docs/README.md) | Living reference for users and developers |
| [`.agents/`](./.agents/README.md) | The digital brain for AI agents: skills, analyses, decisions, backlog |
| [`AGENTS.md`](./AGENTS.md) | Instructions for AI assistants (`CLAUDE.md` redirects there, `.github/copilot-instructions.md` mirrors it) |
| `.temp/` | Scratch space, git-ignored |
