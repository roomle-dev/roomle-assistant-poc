# The configurator example with the AI Planning Assistant chat

The minimal configurator example is both the host of the MCP bridge and the host of roomle-ui's AI
Planning Assistant chat window: the user types into the window in the configurator, the page posts
the conversation to a chat backend, the backend runs a Mistral model that calls the MCP tools, and
the tools read and change the live configuration through the page bridge. The MCP server offers
eight reads of the configuration and its product options, six writes, and `undo` and `redo`; the
window is how a user talks to them in natural language.

Everything runs locally: the page on :3000, the MCP server on :3100, the chat backend on :3200, and
— with `npm run dev` — the Rubens UI dev server on :5173. Nothing is deployed. The user-facing
reference is [`docs/configurator-mcp-server.md`](../../docs/configurator-mcp-server.md); the
operational detail for changing the server is [the skill](../skills/configurator-mcp-server.md).

## The pieces and the flow

```
AI Planning Assistant window (roomle-ui, inside the configurator iframe)
  │ onPlanningAssistantPrompt / planningAssistantOutput
  ▼
example page (minimal-configurator-example/index.html, :3000)
  │ POST /chat {messages, clientId}           ▲ WebSocket /bridge: call / result / event
  ▼                                           │
chat backend (configurator-mcp-chat, :3200)   │
  │ MCP client, ?client=<clientId>            │
  ▼                                           │
MCP server (configurator-mcp-server, :3100) ──┘
```

The launcher [`minimal-configurator-example/start.mjs`](../../minimal-configurator-example/start.mjs)
starts the page, the MCP server and — with a model argument — the chat backend together, runs the
build gate (install and typecheck of the `configurator-mcp` workspace) on the first run, and stops
all of them when one ends. `npm start mistral-medium <api-key>` or `npm start mistral-large
<api-key>` selects the model; the API key goes into the chat backend's environment, never into the
page or its URL. `npm run mcp-server` starts the server alone for external MCP clients.

## The chat window API in roomle-ui

The window and its API are a feature of the roomle-ui drawer that the planner and the configurator
share. The API lives on the base both SDK callback classes already share:

- The callbacks `onPlanningAssistantPrompt` — fired by the window when the user sends, forwarded to
  the host — and `onPlanningAssistantOutput` — called by the output method, consumed by the UI only —
  are declared on `UiCallback` (`packages/web-sdk/packages/common-core/src/utils/ui-callback.ts`),
  so `RoomlePlannerUiCallback` and `ConfiguratorUiCallbacks` both expose them with the same shapes.
  The mute proxy of `UiCallback` applies to them as to every `on*` function.
- The output method `planningAssistantOutput(part)` exists on `RoomlePlanner` and on
  `RoomleConfigurator`, beside `undo` and `redo`; it hands the part to the output callback.
- The types `PlanningAssistantPrompt` (`text`, `images` as JPEG data URLs) and
  `PlanningAssistantOutput` (a union of `text`, `activity`, `error`, `done`, `availability`,
  `images` parts) live in `common-core/src/planning-assistant.ts` and are exported from the web-sdk
  index.
- The panel `PlanningAssistantChat.vue` fires the prompt through the API of the running application:
  the planner API in the planner, the configurator API in the configurator. The configurator shows
  the button behind `featureFlags.planningAssistant` and leaves the window to the planner when the
  configurator runs inside it.
- `onPlanningAssistantOutput` is UI-only: the embedding filters it from the announced callbacks of
  both the configurator and the planner's inner configurator, so a host never receives it and the
  inner configurator does not echo the output.

Because the API sits on the shared base, hosts address `extended.callbacks.onPlanningAssistantPrompt`
and `extended.planningAssistantOutput` on the planner instance as before, and the same two members
exist on a configurator instance. The embedding-lib announces every public prototype method
automatically, so a configurator page reaches a new method as `instance.extended.<method>` without
an embedding-lib release — only the roomle-ui build has to have it.

## The page as the host

[`minimal-configurator-example/index.html`](../../minimal-configurator-example/index.html) is one
file of plain JavaScript without a build step. It imports `@roomle/embedding-lib` from unpkg
(pinned), creates the configurator with `createConfigurator('demoConfigurator', …)` and loads the
item or configuration of the `id` URL parameter (default `usm:frame`).

- `chat=true` adds `featureFlags: { planningAssistant: true }` to the init options and shows the
  window; `mcp_port` and `chat_port` configure the page itself. Every other URL parameter is an
  init option.
- The page runs the bridge client: the WebSocket to `/bridge`, `hello` with a `clientId` (protocol
  2), a `call` executed on `instance.extended` only when its method is in the page's
  `CONFIGURATOR_METHODS` allow-list — the API restriction of the server is this list —, `result`
  back, the `historyChange` event from `onHistoryChange` relayed and its last state sent on
  connection, a reconnect every 3 s, and code 4409 reported to the window when another page is
  connected.
- The page runs the chat host: `instance.extended.callbacks.onPlanningAssistantPrompt` posts the
  conversation and the `clientId` to `POST /chat`, streams the answer into `planningAssistantOutput`
  `text` parts, maps the `[tool] <name>` lines of the stream to `activity` parts, and ends the turn
  with `done` or `error`. The conversation is kept in the page as text; the window takes no images.
- The page checks `typeof instance.extended.planningAssistantOutput === 'function'` before it
  starts the chat; a configurator without the window runs without it and logs that.

## The MCP server: the tools

The server (`configurator-mcp/configurator-mcp-server`) registers its tools on two generic SDK
methods: every read tool relays one `queryConfigurationOperation(type, payload)` call, and every
write tool — `change-component-parameter`, `change-global-parameter`, `dock-component`,
`drag-component`, `delete-component`, `load-configuration`, plus `undo` and `redo` — relays one
`executeConfigurationOperation(name, payload)` call. Every write is one step of the configurator's
own history — the same history the user's undo button uses — confirmed by its own history event: the
event confirms the oldest write still waiting, so the late event of a timed-out write cannot confirm
the write after it. The server keeps the history state from the page's
events and answers "nothing to undo" / "nothing to redo" without calling the configurator when the
reported state rules the step out; a write without an event within 1 s is reported as not confirmed
(`confirmed: false` with a hint). Writes run one at a time. The tool results carry `canUndo` and
`canRedo` — the write tools also `confirmed` — so the answer can say what happened and whether a
further step is possible. The server instructions name the configurator, the tools and the
confirmation semantics.

## The chat backend

The backend (`configurator-mcp/configurator-mcp-chat`) holds the Mistral API key and the system
prompt and connects to the MCP server as an MCP client per turn, bound to the page with
`?client=<clientId>`. `POST /chat` takes `{ messages, clientId }` and streams the model's answer as
plain text with a `[tool] <name>` line before each tool call; a failure ends the text with an
`[error]` line and a recovery summary of what the tools did. `GET /health` answers `ok`.

- The models are `mistral-medium-latest` and `mistral-large-latest`, selected by the launcher's
  `mistral-medium` / `mistral-large` argument (`CHAT_MODELS` in `chat-config.ts`).
- The system prompt is the example's own (`SYSTEM_PROMPT` in `chat-config.ts`): the assistant of a
  Roomle product configurator, its read and write tools and what they do. roomle-ui provides no
  system prompt for the configurator; the host supplies it.
- Images are refused with `400`; a turn without an answer ends after 5 minutes
  (`CONFIGURATOR_CHAT_TURN_TIMEOUT_MS`), a turn runs up to 16 model steps.
- The recovery summary (`chat-recovery.ts`) records every tool outcome independently of whether the
  model finishes its step: an interrupted reply says what the tools changed — completed, unconfirmed
  or incomplete — and never repeats a call.

## Invariants

- The chat API lives on the shared `UiCallback` base so both SDKs expose the same shapes; the
  planner's host-facing API is unchanged and existing hosts need no change.
- The system prompt belongs to the host. roomle-ui provides none for the configurator and the chat
  backend of this repository holds it.
- The chat models are the two Mistral models only.
- The agent loop runs in the chat backend, not in the page: the API key stays in the backend's
  environment.
- The page's `CONFIGURATOR_METHODS` allow-list is the API restriction; the server names the same
  methods (`configurator-api.ts`), and a test compares the two lists.
- Everything is local; nothing is deployed.

## Where things live

| Area | Files |
|---|---|
| Example page (bridge client, chat host) | `minimal-configurator-example/index.html` |
| Launcher (build gate, processes, ports) | `minimal-configurator-example/start.mjs` |
| MCP server (tools, bridge, history state) | `configurator-mcp/configurator-mcp-server/` |
| Chat backend (Mistral, system prompt, recovery) | `configurator-mcp/configurator-mcp-chat/` |
| Chat window API (shared base, types, output method) | roomle-ui `common-core/src/utils/ui-callback.ts`, `common-core/src/planning-assistant.ts`, `configurator-core/src/roomle-configurator.ts`, `planner-core/src/roomle-planner.ts` |
| Chat window UI (panel, button, store, flag) | roomle-ui `src/common/components/PlanningAssistantChat.vue`, `src/configurator/components/ConfiguratorMain.vue`, `src/common/store/planning-assistant-store.ts`, `src/configurator/embedding/types.ts` |
| Embedding announcement (methods, UI-only filter) | roomle-ui `src/configurator/embedding/exposed-api.ts` |

## See also

- [The feature index](README.md) — every feature context document
- [`docs/configurator-mcp-server.md`](../../docs/configurator-mcp-server.md) — the user-facing
  reference: ports, variables, tools, results
- [The configurator MCP server skill](../skills/configurator-mcp-server.md) — architecture, adding a
  tool, tests
- [Configurator capabilities for the configurator MCP](get-configurator-capabilities.md) — the read
  tool the chat uses for product questions
