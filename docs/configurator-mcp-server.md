# Configurator MCP Server — Reference

The configurator MCP server lets an AI agent inspect a Roomle configuration and its product options, and undo or redo changes in a live configurator
session. Its tools call the API of the `RoomleConfigurator` of the roomle-ui web-sdk, and nothing
else: the connected page executes the calls on the configurator it embeds. The tools are eight reads —
`get-configurator-capabilities`, `get-configuration`, `get-component-parameters`, `get-global-parameters`,
`get-possible-children`, `get-docking-positions`, `get-component-docking-positions`, `get-delete-impact` —
and `undo` and `redo`.

Three processes work together, all local:

| Process | Port | What it does |
| --- | --- | --- |
| The example page ([`minimal-configurator-example/index.html`](../minimal-configurator-example/index.html)) | 3000 | Embeds the configurator, executes the server's configurator calls, hosts the AI Planning Assistant window |
| The MCP server ([`configurator-mcp/configurator-mcp-server`](../configurator-mcp/configurator-mcp-server/)) | 3100 | Serves the tools at `/mcp`, relays their configurator calls to the page over the `/bridge` WebSocket |
| The chat backend ([`configurator-mcp/configurator-mcp-chat`](../configurator-mcp/configurator-mcp-chat/)) | 3200 | Runs a chat turn with a Mistral model (Vercel AI SDK) and the server's tools at `/chat` |

The launcher [`minimal-configurator-example/start.mjs`](../minimal-configurator-example/start.mjs)
starts them together.

## Running it

```bash
npm install
npm start                            # page and MCP server, browser opens
npm start mistral-medium <api-key>   # plus the chat with mistral-medium-latest
npm start mistral-large <api-key>    # plus the chat with mistral-large-latest
npm run mcp-server                   # the MCP server alone, for an external MCP client
npm run dev <same arguments>         # the configurator from the local Rubens UI dev server (:5173)
```

The first `npm start` installs the repository and type-checks the server and the chat before
anything starts. Launcher flags go after `--`: `npm start -- --no-open`,
`npm start -- mistral-medium <api-key> --no-open`. The API key goes into the chat backend's
environment, never into the page or its URL. Another model name ends the launcher with the two
supported names. The servers end with the launcher: when one of them ends, the launcher stops the
others and exits.

| Variable | Default | What it sets |
| --- | --- | --- |
| `EXAMPLE_PORT` | `3000` | The page's port; the MCP server and the chat accept the page from this origin |
| `CONFIGURATOR_MCP_PORT` | `3100` | The MCP server's port; passed to the page as `mcp_port` when set |
| `CONFIGURATOR_CHAT_PORT` | `3200` | The chat backend's port; passed to the page as `chat_port` when set |
| `EXAMPLE_SERVER_URL` | none | The Rubens UI the configurator loads from, passed as `overrideServerUrl`; `--dev` sets `http://localhost:5173/` |

A Rubens UI with the configurator's AI Planning Assistant window is needed for the chat: the page
starts no chat on a configurator without `planningAssistantOutput` and logs that. Undo and redo
through an external MCP client work with any configurator.

The reads require a Rubens UI that exposes `RoomleConfigurator.queryConfigurationOperation` — every read
tool relays it, `get-configurator-capabilities` included. If the connected UI is older, a read returns an
error naming the method and asking to update the UI; undo and redo remain available. Use `npm run dev` with
the local UI feature branch for development.

## The page

The launcher opens `http://localhost:3000/` (`?chat=true` with a model). The page's own
parameters are `id` (the item or configuration, default `usm:frame`), `chat=true` (show the window
and run the chat), `mcp_port` and `chat_port`. Every other parameter is an init option of `createConfigurator`; `chat=true` adds
`featureFlags: { planningAssistant: true }`.

The page opens the WebSocket `ws://localhost:<mcp_port>/bridge` and:

- announces itself with `hello` (protocol `2`, a `clientId` of its own, its URL without the query);
- on `ready`, sends the configurator's last undo history state as a `historyChange` event, and
  enables the window;
- executes a `call` on `instance.extended` when its method is in `CONFIGURATOR_METHODS`
  (`undo`, `redo`, `getConfiguratorCapabilities`, `queryConfigurationOperation`) and answers with `result`; any other method is refused without touching the
  configurator;
- relays every `onHistoryChange(undo, redo)` of the configurator as a `historyChange` event;
- reconnects every 3 s after a lost connection; a server that already serves another page closes
  the connection with code 4409, and the window then says so.

With `chat=true` the page also sets `instance.extended.callbacks.onPlanningAssistantPrompt`: every
message posts the conversation and the `clientId` to `POST http://localhost:<chat_port>/chat`,
streams the answer into `planningAssistantOutput` `text` parts, the `[tool] <name>` lines of the
stream into `activity` parts, and ends the turn with `done` or `error`. The conversation is kept in
the page as text. The window takes no images.

## The MCP server

The server binds to loopback only. `POST /mcp` speaks Streamable HTTP in JSON response mode, with
a new server and transport per request. A `client` query parameter binds the request to the page of that `clientId`; a request for
a page that is not connected is answered with `409`. `/bridge` accepts WebSocket upgrades from the
page origins (`CONFIGURATOR_MCP_PAGE_ORIGINS`, default `http://localhost:3000,http://127.0.0.1:3000`)
and from origin-less clients. One page is served at a time. A configurator call times out after
30 s; without a connected page a tool fails with a message that names the example URL
(`CONFIGURATOR_MCP_PAGE_URL`, set by the launcher).

The server keeps the configurator's undo history state from the page's events: whether an undo and a
redo are possible, and how many events arrived. The state is unknown until the page reports it, and
again once a page connects anew or disconnects.

### Tools

| Tool | Does | Result |
| --- | --- | --- |
| `undo` | Reverts the last change of the configuration, as the configurator's undo button does | `{ undone, canUndo, canRedo, hint? }` |
| `redo` | Brings back the change the last undo reverted; a new change of the configuration ends redo | `{ redone, canUndo, canRedo, hint? }` |
| `get-configurator-capabilities` | Reads current configuration state and recursively declared product options | JSON with `context`, `complete`, `unresolved` and requested sections |
| `get-configuration` | Reads the current configuration as parsed JSON plus its hash | JSON with `type`, `context`, `configuration`, `configurationHash` |
| `get-component-parameters` | Reads the current parameters and parameter groups of one component | JSON with `type`, `context`, `runtimeId`, `componentId`, `parameters`, `groups` |
| `get-global-parameters` | Reads the current global parameters of the configuration | JSON with `type`, `context`, `scope`, `parameters`, `groups` |
| `get-possible-children` | Reads the possible children that can be docked, of the configuration or one component | JSON with `type`, `context`, `runtimeId`, `tags`, `defaultChild` |
| `get-docking-positions` | Reads the docking positions a possible child can be docked at, without drawing previews | JSON with `type`, `context`, `allowInsertInBetween`, `dockPairs` |
| `get-component-docking-positions` | Reads the docking positions an existing component can be moved to, without drawing previews | JSON with `type`, `context`, `runtimeId`, `allowInsertInBetween`, `dockPairs` |
| `get-delete-impact` | Reads the impact of deleting one component, with re-dock enabled or disabled | JSON with `type`, `context`, `runtimeId`, `redockChildrenToParent`, `deletable`, `componentsDeleted` |

Undo and redo take no arguments and run one at a time. A step that the reported history state rules out is answered
without a configurator call: `undone: false` (or `redone: false`) with the hint
`Nothing to undo: …` (or `Nothing to redo: …`) — a result, not an error. Otherwise the server calls
the configurator and waits for the history event of the step; the configurator fires it before its
call returns, and a step without an event within 1 s is reported as `undone: false` with a hint
that the configurator did not report it. A failed configurator call — no page, a lost page, a
timeout — is a tool error with the message.

The eight read tools each relay one `queryConfigurationOperation(type, payload)` call on the page — the
tool's name fixes the type, its arguments are the payload, validated before the page call — and return
the SDK's JSON result as text. Every result carries the read `context`: the configuration's runtime id,
the root component, the selection and the configuration hash. A missing configuration, an HI external
object, or a configuration or selection change during the read rejects it; read again after an edit
completes. No read changes the configuration, the selection or the history, waits for a history event
or enters the history queue; the docking reads compute their positions without drawing previews or
touching the scene. Runtime ids identify instances, while catalog ids identify definitions and presets.

`get-configuration` takes no arguments and returns the parsed current configuration plus
`configurationHash` for change detection.

`get-component-parameters` takes `runtimeId` and returns the current `parameters` and `groups` of that
component with its catalog `componentId`.

`get-global-parameters` takes no arguments and returns the current global `parameters` and `groups`;
`scope` reports whether the plan object or the root component was read.

`get-possible-children` takes an optional `runtimeId`: omitted reads the possible children of the whole
configuration, given reads them of that component. The result carries the child `tags` and the
`defaultChild`.

`get-docking-positions` takes `child` — exactly one of `componentId`, `itemId` or `configuration` (an
assembly configuration JSON) — and optional `allowInsertInBetween`. It returns the `dockPairs`: parent
and child dock ids, position, rotation, `insertInBetween` and `displacedComponents` for every valid
placement, computed by the kernel without drawing previews.

`get-component-docking-positions` takes `runtimeId` and optional `allowInsertInBetween` and returns the
`dockPairs` the component can be moved to.

`get-delete-impact` takes `runtimeId` and `redockChildrenToParent` and returns `deletable` — whether the
component can be deleted — and `componentsDeleted`, the runtime ids deleted with it, re-docked to the
parent or not.

`get-configurator-capabilities` accepts optional `include`, an array containing `configuration`, `components`, `items`, `parameters`, `materials` or `docking`. Omitted or empty means all; duplicates have no effect. Invalid names are rejected before calling the page.

```json
{ "name": "get-configurator-capabilities", "arguments": { "include": ["parameters", "materials"] } }
```

The SDK response passes through as JSON text. `configuration` contains parsed data and runtime instances; `components` and `items` contain the recursively reachable definitions and presets. `parameters` separates declarations from kernel-evaluated current global and per-instance choices. `materials` contains compact metadata and memberships keyed by requested group IDs. `docking` separates declared constraints from currently offered children; it does not calculate valid placements.

`complete: false` and `unresolved` identify unavailable resources; these are successful partial reads. The capabilities read may fetch catalog metadata; configuration-only reads skip catalog discovery.

The server instructions and chat prompt use the read tools for product questions. Declared alternatives can be inactive; current choices come from kernel results. The agent must acknowledge unresolved information. Only undo and redo can modify the configuration. The SDK also exposes the reads through `instance.configurator` in planner isolation; this example remains a standalone configurator host.

### Connecting an MCP client

With the page open, any MCP client reaches the tools at `http://localhost:3100/mcp`:

```bash
claude mcp add --transport http --scope user configurator-mcp http://localhost:3100/mcp
```

GitHub Copilot in VS Code and Cursor take the same URL as an HTTP MCP server. A browser-hosted
client cannot reach a localhost server.

## The chat backend

`POST /chat` takes `{ messages, clientId }`: the conversation as `user` and `assistant` messages
with text content, and the page's `clientId`. Images are refused with `400`. The backend connects
an MCP client to the server with `?client=<clientId>`, so the tools act on that page, and streams
the model's answer as plain text with a `[tool] <name>` line before each tool call. A failure during
the stream ends the text with an `[error]` line and a summary of what the tools did in the turn —
completed or unconfirmed changes, and completed/partial/incomplete reads, with no call repeated. Read recovery explicitly says the configuration was unchanged and omits the read payloads. `GET /health` answers `ok`.

| Variable | Default | What it sets |
| --- | --- | --- |
| `CONFIGURATOR_CHAT_MODEL` | none, required | `mistral-medium` (`mistral-medium-latest`) or `mistral-large` (`mistral-large-latest`) |
| `CONFIGURATOR_CHAT_TOKEN` | none | The Mistral API key; without it `/chat` answers `503` |
| `CONFIGURATOR_CHAT_PORT` | `3200` | The port; the backend binds to loopback only |
| `CONFIGURATOR_MCP_URL` | `http://localhost:3100/mcp` | The MCP server |
| `CONFIGURATOR_CHAT_PAGE_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | The origins allowed to post |
| `CONFIGURATOR_CHAT_TURN_TIMEOUT_MS` | `300000` | A turn without an answer ends after this time |

The system prompt is the example's own (`SYSTEM_PROMPT` in `chat-config.ts`): the assistant of a
Roomle product configurator with the eight read tools, `undo` and `redo`. Product answers use returned capabilities and query results; history answers report whether a further undo or redo is possible. Other edits are unavailable. A turn runs up to 16 model steps; the last step may not call a tool, so it ends with
an answer.

## Example prompts

```text
undo
Take back the last change.
redo
Which finishes are currently available?
What additions are declared for this product?
Where can I dock another shelf?
What happens to the children if I delete the frame?
Make the shelf blue.     (the assistant explains that this edit is not supported yet)
```

## Checking it

```bash
npm test             # the unit tests of the server and the chat (vitest)
npm run typecheck
npm run lint
npm run format:check
```

The live check: the roomle-ui dev server with the configurator's AI Planning Assistant window on
`:5173`, `npm run dev mistral-medium <api-key>`, a parameter changed in the configurator, a docking
positions query and `undo` from an external MCP client, "undo" and "redo" in the window.
