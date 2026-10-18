# Configurator MCP Server Skill

Load this skill when the task touches the configurator MCP server, its tools, the page bridge, the
chat backend, or the example page's MCP and chat code. The user-facing reference — ports,
variables, tools, results — is [`docs/configurator-mcp-server.md`](../../docs/configurator-mcp-server.md);
keep both in step when the behaviour changes.

## Architecture

```
AI Planning Assistant window (roomle-ui, inside the configurator iframe)
  │ onPlanningAssistantPrompt / planningAssistantOutput
  ▼
example page (minimal-configurator-example/index.html)
  │ POST /chat {messages, clientId}           ▲ WebSocket /bridge: call / result / event
  ▼                                           │
chat backend (configurator-mcp-chat, :3200)   │
  │ MCP client, ?client=<clientId>            │
  ▼                                           │
MCP server (configurator-mcp-server, :3100) ──┘
```

- **The tool logic runs in the server; the page only executes configurator methods.** A tool calls
  `ConfiguratorApi.extended.<method>` (`configurator-api.ts`), which the `PageBridge`
  (`page-bridge.ts`) sends to the page as a `call`; the page runs it on `instance.extended` of the
  embedding-lib and answers with a `result`.
- **The API restriction is two lists that must match**: `CONFIGURATOR_METHODS` in
  `configurator-api.ts` and the allow-list `CONFIGURATOR_METHODS` in the page. The test
  `calls exactly the configurator methods the page bridge exposes` reads the page and compares them.
- **The undo history comes from the configurator.** The page relays `onHistoryChange(undo, redo)` as
  `historyChange` events and sends its last state on `ready`; `HistoryState` (`history-state.ts`)
  keeps it. The configurator fires the event of an undo or redo synchronously before its call
  returns, so the event reaches the server before the call's result; `runHistoryStep`
  (`tool-executors.ts`) waits for it at most `HISTORY_EVENT_WAIT_MS`.
- **The bridge protocol is the one of roomle-hi-example** (protocol 2: `hello`, `ready`, `call`,
  `result`, `event`), with the configurator's methods instead of the planner's.
- **The chat is an MCP client beside the server**, not a route of it: the backend holds the
  Mistral key and the system prompt, connects to `/mcp` per request and streams the answer.
- **The page owns the conversation** and the window owns the display; roomle-ui provides the window
  and no system prompt.

## Configuration reads

- `get-configurator-capabilities` forwards optional `include` (configuration, components, items, parameters, materials, docking) through `queryConfigurationOperation('capabilities', …)` and returns its JSON. Omitted/empty requests all sections.
- The other seven read tools — `get-configuration`, `get-component-parameters`, `get-global-parameters`, `get-possible-children`, `get-docking-positions`, `get-component-docking-positions`, `get-delete-impact` — relay `queryConfigurationOperation` with their fixed query type; their payload shapes are `configurationQueryInputSchemas` in `tool-executors.ts`, validated with zod before any page call and registered as each tool's `inputSchema`.
- Reads bypass the history queue and event wait. Preserve `clientId`, arguments, results and failures; keep undo/redo's void relay contract.
- The SDK owns discovery and validity, including the dock-pair calculation (the kernel's `getDockPairs`) and the delete impact. Its collectors are dynamically imported in roomle-ui; do not duplicate product interpretation in the MCP server. Declared alternatives can be inactive, current choices are kernel results, and `complete: false` / `unresolved` stay successful partial reads.
- Every read tool is annotated read-only, non-destructive, idempotent and open-world because catalog metadata may be requested. Log operation summaries, never the full payload.
- An older UI without `queryConfigurationOperation` receives an update message from the page. The protocol stays at version 2 and the bridge deadline stays at 30 seconds.
- Both server instructions and the chat prompt permit product inspection. Chat recovery describes failed/pending reads as incomplete, never as unconfirmed modifications; it omits read payloads and preserves outcomes of undo/redo in mixed turns.

## Adding a tool

1. Register it in `configurator-mcp-server.ts` (`server.registerTool`, a zod raw shape as
   `inputSchema`, a description that says what the tool returns and how to succeed).
2. Implement its executor in `tool-executors.ts`; a tool that changes the configuration runs
   through `oneAtATime`, so it never runs beside another change.
3. When it needs a configurator method the page does not expose yet: add the method to
   `ConfiguratorApi` and `createConfiguratorApi` in `configurator-api.ts` and to the page's
   `CONFIGURATOR_METHODS`. The method must be a public method of `RoomleConfigurator`
   (roomle-ui `packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts`); the
   embedding-lib creates `instance.extended.<method>` from the names the configurator announces.
4. Mention the tool in the server's `INSTRUCTIONS` and the chat's `SYSTEM_PROMPT` when the agent
   needs to know when to use it; give it a label in `TOOL_LABELS` (`chat-recovery.ts`).
5. Add tests in `configurator-mcp-server/tests/` (executor, registration) and, for a page method,
   extend `configurator-api.test.ts`.
6. Update [`docs/configurator-mcp-server.md`](../../docs/configurator-mcp-server.md) and this skill.

## Tests

- `npm test` runs vitest over `configurator-mcp-server/tests` and `configurator-mcp-chat/tests`.
- `tests/fake-page-socket.ts` is a page on the bridge: `attachPage(bridge)` connects one,
  `historyEvent(undo, redo)` builds an event, `respond` answers calls.
- `configurator-mcp-server.test.ts` connects a `Client` over `InMemoryTransport` to a server with a
  mocked `ConfiguratorApi`.
- `chat-stream.test.ts` mocks `@ai-sdk/mistral`, `@ai-sdk/mcp` and the MCP SDK transport and drives
  turns with `MockLanguageModelV3` from `ai/test`.
- `example-launcher.test.ts` starts the launcher on free ports and checks start and shutdown.
- The page has no unit tests; the live check covers it: a configurator with the AI Planning
  Assistant window (roomle-ui), the launcher with a model and key, a parameter changed, "undo" and
  "redo" in the window. Without a key, call the tools with an MCP client and read the configuration
  inside the iframe (`$sdkConnector.configuratorApi` → `getCurrentConfiguration()` of the Vue app's
  global properties) before and after.
