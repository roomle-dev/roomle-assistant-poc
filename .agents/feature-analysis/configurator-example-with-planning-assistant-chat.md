# The configurator example with the AI Planning Assistant chat and a first configurator MCP server

> **Type**: Feature analysis (step 2 of the [change workflow](../../AGENTS.md#suggested-change-workflow))  
> **Domain**: the minimal configurator example of this repository as a host of roomle-ui's AI Planning Assistant window; the chat API of that window, today a planner API; the first configurator MCP server (undo and redo), local only  
> **Trigger**: [RML-18085](https://roomle.atlassian.net/browse/RML-18085) "research roomle configurator mcp", the last part of the description  
> **Date**: 2026-10-16  
> **Author**: AI Assistant  
> **Status**: Implemented 2026-10-16 on the branches below, with the deviations of §9. Unit tests, lint and type checks green; the live check without a model answer (no Mistral key). Branches not merged  
> **Branches**: roomle-ui `feat/configurator-planning-assistant-RML-18085` from `feat/planning-assistant-chat-RML-18190` (`b2dbcb202`, the rebased base); roomle-configurator-mcp `feat/undo-redo-mcp-RML-18085` from `feat/repository-setup-RML-18085`  
> **Constraints given with the task**: the chat models are `mistral-medium-latest` and `mistral-large-latest` only — no GPT models, no Azure agent; the first MCP server offers only `undo` and `redo`; the server runs locally, no deployment; roomle-hi-example and ligna-store should stay untouched if that is cleanly possible

## Affected repositories

- **roomle-ui** — the refactoring that makes the AI Planning Assistant window usable in the
  standalone configurator: the two callbacks and the output method of the chat move from the
  planner API to the API both SDKs share, the configurator gets the button and the subscription.
  Branched from `feat/planning-assistant-chat-RML-18190`.
- **roomle-configurator-mcp** — the host: the example page connects the window to a Vercel AI SDK
  agent (Mistral) and a page bridge; the `configurator-mcp` workspace gets the MCP server with
  `undo` and `redo` and the chat backend; the launcher starts the three.
- **roomle-hi-example** — unchanged with the recommended design (§5.5).
- **ligna-store** — unchanged with the recommended design (§5.5).
- **RoomleCore** — unchanged.

## 1. What was asked and why

The ticket describes a Roomle configurator MCP server in the manner of the HI MCP server of
roomle-hi-example. Its last part asks for the first concrete steps in this repository:

1. The MCP server is a **RoomleConfigurator API-restricted** server: its tools call the API of
   `RoomleConfigurator` (roomle-ui `packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts`)
   and nothing else, the way the HI server's tools call `roomDesignerApi.extended` of the planner.
   The first version offers **undo and redo only**.
2. The example page uses the **Vercel AI SDK** to connect to an AI agent and shows roomle-ui's
   **`PlanningAssistantChat.vue`** as the chat window. The models are **`mistral-medium-latest`** and
   **`mistral-large-latest`**.
3. The API of that window — the callback `onPlanningAssistantPrompt`, the callback
   `onPlanningAssistantOutput` and the method `planningAssistantOutput` — is implemented in the
   **planner** today. The configurator cannot use the window without a refactoring in roomle-ui,
   based on `feat/planning-assistant-chat-RML-18190`.
4. The refactoring must not force changes on roomle-hi-example and ligna-store, the two hosts of the
   window today, if a clean way exists; otherwise the necessary changes are to be named.
5. Local only, no deployment.
6. **Definition of done of this first step**: after the implementation the two commands **undo**
   and **redo** work — typed into the AI Planning Assistant window of the configurator example,
   the agent calls the `undo` or `redo` tool and the configurator reverts or restores its last
   change. They are the only tools of the first server, so nothing else has to work yet.
7. The system prompt the chat needs is the **client's business**: roomle-ui provides none for the
   configurator and none is added there; the example — the host — supplies it.

## 2. How it works today

### 2.1 The AI Planning Assistant window and its API in roomle-ui

On `feat/planning-assistant-chat-RML-18190` (commits `fd7db024d`, `7958a727e`, `0ca3c4180`) the
window is a drawer panel of roomle-ui behind `featureFlags.planningAssistant`; the agent that
answers runs in the host page. Its API lives in the planner core of the web-sdk:

- **The types** `PlanningAssistantPrompt` (`text`, `images` as JPEG data URLs) and
  `PlanningAssistantOutput` (a union of `text`, `activity`, `error`, `done`, `availability`,
  `images` parts) in `packages/web-sdk/packages/planner-core/src/planning-assistant.ts:1-24`,
  exported from `packages/web-sdk/packages/index.ts:166-168`.
- **The two callback fields** on `RoomlePlannerUiCallback`
  (`packages/web-sdk/packages/planner-core/src/roomle-planner-ui-callback.ts:363-371`):
  `onPlanningAssistantPrompt` — fired by the window when the user sends, forwarded to the host —
  and `onPlanningAssistantOutput` — called by the output method, consumed by the UI only.
- **The output method** `planningAssistantOutput(part)` on `RoomlePlanner`
  (`packages/web-sdk/packages/planner-core/src/roomle-planner.ts:3209-3213`), which hands the part
  to `this._roomlePlannerUiCallback.onPlanningAssistantOutput`.

`RoomlePlannerUiCallback` extends `UiCallback`
(`roomle-planner-ui-callback.ts:81-83`); so does the configurator's `ConfiguratorUiCallbacks`
(`packages/web-sdk/packages/configurator-core/src/services/configurator-ui-callback.ts:44-46`).
The two classes are siblings; their common base `UiCallback`
(`packages/web-sdk/packages/common-core/src/utils/ui-callback.ts:7-64`) carries the mute proxy for
every `on*` function and two shared callbacks (`cameraStartsMoving`, the deprecated
`onReadyForRender`).

The UI side is shared code already:

- `src/common/components/PlanningAssistantChat.vue` — the panel. It fires the prompt through
  `sdkConnector.plannerApi` (`firePrompt`, script lines 64-68): the one planner-specific line of the
  component. `AiImageChat.vue:150-153`, the panel it was modelled on, picks the API by
  `uiStateStore.isPlanner ? sdkConnector.plannerApi : sdkConnector.configuratorApi`.
- `src/common/store/planning-assistant-store.ts` — entries, busy, availability, `send`, `receive`.
- `src/common/components/PlanningAssistantButton.vue`, the panel type
  `LAYER_0_SIDEBAR_TYPES.PLANNING_ASSISTANT` (`src/common/composables/use-event-emitter-listener.ts:16`),
  `BUTTON_ACTIONS.PLANNING_ASSISTANT` (`src/configurator/store/ui-state.ts:42`), the `case` in
  `src/common/utils/ui-actions.ts:160-162`, the flag `featureFlags.planningAssistant`
  (`src/configurator/embedding/types.ts:90-94`) and `isPlanningAssistantEnabled`
  (`src/configurator/store/ui-state-store.ts:149-151`), the strings in `base.json`, `en.json`,
  `de.json`.

The planner wires it in three places: the subscription of `onPlanningAssistantOutput` to the store
(`src/planner/business-logic/sdk-connector-planner.ts:556-562`), the bottom button
(`src/planner/components/PlannerMain.vue:36-47, 266-270, 368-377`) and the drawer route
(`src/planner/components/PlannerSidebar.vue:65-67`).

### 2.2 What the configurator already has

The configurator's drawer already knows the panel: `InteractionsContainer.vue:114-116` imports it
and `:306-311` adds it to the layer-0 candidates when `isPlanningAssistantEnabled`. The flag, the
store, the strings and the panel type are shared. What the configurator lacks:

- the two callbacks on `ConfiguratorUiCallbacks` and the method `planningAssistantOutput` on
  `RoomleConfigurator` — the host-facing API;
- the subscription that routes `onPlanningAssistantOutput` into the store, beside the other
  `addCallback` registrations of `src/configurator/business-logic/sdk-connector-configurator.ts`
  (`onHistoryChange` at line 369 is the neighbour);
- a button: `ConfiguratorMain.vue` shows the `AiChatButton` behind `isImageGenEnabled` at lines
  14-18 (fullscreen) and 33-37 (bottom triggers), opened by `toggleAiChat` (lines 245-255), and
  `showBottomTriggers` (lines 200-204) decides whether the trigger row renders;
- the panel's `firePrompt`, which addresses the planner API only.

### 2.3 How the API reaches a host page

The embedding needs no list for a new method or callback. At setup roomle-ui enumerates the public
methods of the SDK instance and the function properties of its callback object and sends the names
to the embedding lib (`src/configurator/embedding/exposed-api.ts:376-420`,
`_getMethodsAndCallbacks`); the lib creates `extended.<method>` and `extended.callbacks.<event>`
from the names (`packages/embedding-lib/src/connector.ts`, `extended: any` at line 22). The SDK
instance is the `RoomlePlanner` or the `RoomleConfigurator`, chosen by the private
`_roomlePlannerUiCallback` (`exposed-api.ts:243-250`). The UI-only callback is kept from the host by
`UI_ONLY_SDK_CALLBACKS` (`exposed-api.ts:78-82`), applied to `this._sdk.callbacks`
(`getHostSdkCallbackNames`, lines 84-87, 210, 391). The callbacks of the planner's inner
configurator (`availableConfiguratorSdkCallbacks`, lines 214-219 and 400-405, namespace
`configuratorSdk`) are announced unfiltered.

Two consequences matter here. A method added to `RoomleConfigurator` reaches
`instance.extended.<method>` of a configurator page **without an embedding-lib release** — the page
only needs the roomle-ui build that has it. And every host types the API as `any`
(`RoomDesignerApiType = any` in roomle-ui `examples/utils/homag-intelligence/overlay.ts:19` and in
ligna-store `hi-mcp/types.ts:8`; the embedding lib's `RoomlePlannerApi` and `RoomleConfiguratorApi`
both declare `ConfiguratorUiCallbacks` as their callback type,
`packages/embedding-lib/src/roomle-embedding-lib.ts:203-214`), so a change of where the TypeScript
types are declared breaks no host build.

### 2.4 The hosts of the window today

- **roomle-hi-example, the example page** (`minimal-hi-example/index.html:1083-1240`): sets
  `featureFlags.planningAssistant` with `chat=true`, checks
  `typeof roomDesignerApi.extended.planningAssistantOutput === 'function'`, sets
  `roomDesignerApi.extended.callbacks.onPlanningAssistantPrompt`, posts the conversation to the chat
  backend `POST http://localhost:3200/chat`, streams the plain-text answer with `[tool] ` status
  lines into `planningAssistantOutput` parts, asks `GET /capabilities` whether the model reads images.
- **roomle-hi-example, the chat backend** (`hi-mcp/hi-mcp-chat`): `chat-server.ts` (39 lines),
  `chat-handler.ts` (CORS, `/health`, `/capabilities`, `/chat`), `chat-config.ts` (providers,
  model aliases, env, message parsing), `chat-stream.ts` (`createMCPClient` per request,
  `streamText` with the MCP tools, `stepCountIs`, the last step without tools), `chat-steps.ts`
  (step logging, turn timeout), `chat-recovery.ts` (interrupted turns), `tool-result-images.ts`
  (the Mistral middleware). Providers: Mistral, Anthropic, Google, Azure and the Foundry
  deployments. Dependencies: `ai` 7.0.122, `@ai-sdk/mistral` 4.0.54, `@ai-sdk/mcp` 2.0.62,
  `@modelcontextprotocol/sdk` 1.30.0, `vite-node` 3.2.4. The system prompt of the HI chat comes from the planner's HI API
  `getExternalObjectAgentPrompts` (RML-18187: the HI planning rules; not part of the chat window
  API), sent by the page with every request as `prompts`.
- **roomle-hi-example, the MCP server** (`hi-mcp/hi-mcp-server`): `server.ts` (176 lines: `/mcp`
  Streamable HTTP in JSON response mode, a new transport per request, the `/bridge` WebSocket,
  page origins, the `client` session), `page-bridge.ts` (159: one page, call correlation,
  timeouts, the `historyChange` event), `types.ts` (47: the bridge protocol `hello`, `ready`,
  `call`, `result`, `event`), `planner-api.ts` (52: the relay of the planner methods, `undo` and
  `redo` among them), `hi-mcp-server.ts` (the tool registrations with zod, `undo`/`redo` at lines
  708-732), `tool-executors.ts` and `plan-history.ts` (undo and redo per tool call, confirmed by the
  history event).
- **roomle-ui, the HI presets example**
  (`packages/embedding-lib/examples/utils/homag-intelligence/planning-assistant.ts`): the other
  host shape — the agent loop in the page, the AI SDK from esm.sh, the key in the URL, the bridge
  client with the allow-list `PLANNER_METHODS` (`undo` and `redo` included) and the
  `onHistoryChange` relay (lines 15-24, 154-216, 218-271).
- **ligna-store** (`hi-mcp/chat-host.ts:39-47, 112-120`): the same two API members on
  `api.extended`, the agent loop in the page.

Every host addresses the API as `extended.callbacks.onPlanningAssistantPrompt` and
`extended.planningAssistantOutput` of the **planner** instance.

### 2.5 Undo and redo of the configurator

`RoomleConfigurator.undo()` and `redo()` (`roomle-configurator.ts:2294-2305`) delegate to the
scene manager's configurator history; `clearHistory()` follows (2309). The configurator reports the
state of its history with `ConfiguratorUiCallbacks.onHistoryChange(undo, redo)`
(`configurator-ui-callback.ts:384`), which the UI routes into
`uiStateStore.historyChangedConfigurator` (`sdk-connector-configurator.ts:369-375`). Both methods
are public, so a configurator page reaches them as `instance.extended.undo()` and
`instance.extended.redo()` — the HI page already relays exactly these two for the planner.

## 3. The gaps

1. The configurator has the window, the flag and the drawer route, but **no API** for a host to feed
   it and **no button** to open it.
2. The window fires the prompt through the **planner API only**.
3. This repository has the page and the empty workspace, but **no MCP server, no chat backend, no
   bridge client and no launcher logic** for them.
4. The chat needs a **system prompt**, which the pattern's chat backend requires with every
   request and takes from the planner's HI API `getExternalObjectAgentPrompts` (RML-18187, the
   HI planning agent's, not the window's). roomle-ui provides none for the configurator, and none
   is to be added: the example supplies it (§5.2).

## 4. Proposed design — roomle-ui

Base: `feat/planning-assistant-chat-RML-18190`.

### 4.1 Move the chat API to the shared base — the planner surface stays

- **The types** `planning-assistant.ts` move from `planner-core/src/` to `common-core/src/`; the
  re-export in `packages/web-sdk/packages/index.ts:166-168` changes its path, the exported names
  stay.
- **The two callback fields** move from `RoomlePlannerUiCallback` to `UiCallback`
  (`common-core/src/utils/ui-callback.ts`), with their JSDoc. `RoomlePlannerUiCallback` and
  `ConfiguratorUiCallbacks` inherit them: the planner's callback object keeps
  `onPlanningAssistantPrompt` and `onPlanningAssistantOutput` as before, the configurator's gains
  them. The mute proxy of `UiCallback` applies to them as to every `on*` function. The GLB viewer
  inherits them too; it has no drawer, so nothing fires them — accepted.
- **The output method** `planningAssistantOutput(part)` is added to `RoomleConfigurator` beside
  `undo` and `redo`, implemented as `this.callbacks.onPlanningAssistantOutput(part)`; the planner's
  method (`roomle-planner.ts:3209`) stays as it is.
- **Exposed API**: `UI_ONLY_SDK_CALLBACKS` (`exposed-api.ts:78-82`) already keeps
  `sdk.callbacks.onPlanningAssistantOutput` from the host for both SDK instances. It has to cover the
  planner's inner configurator as well — `configuratorSdk.callbacks.onPlanningAssistantOutput`
  would otherwise be announced and echoed to the host once the callback is on
  `ConfiguratorUiCallbacks` — by filtering `availableConfiguratorSdkCallbacks` (lines 214-219 and
  400-405) with the same set.

Host-facing result: the planner API is unchanged in name, shape and behaviour; the configurator API
gains `extended.callbacks.onPlanningAssistantPrompt` and `extended.planningAssistantOutput` with
the same shapes.

### 4.2 The window in the configurator

- `PlanningAssistantChat.vue` `firePrompt`: the API by `uiStateStore.isPlanner`, as
  `AiImageChat.vue:150-153` does — the planner API in the planner, the configurator API in the
  configurator.
- `sdk-connector-configurator.ts`: `this.addCallback('onPlanningAssistantOutput', part =>
  usePlanningAssistantStore().receive(part), true)` beside `onHistoryChange` (line 369), the
  counterpart of `sdk-connector-planner.ts:556-562`.
- `ConfiguratorMain.vue`: a `PlanningAssistantButton` behind `isPlanningAssistantEnabled` where the
  `AiChatButton` stands (lines 14-18 and 33-37), opened with
  `uiActions.openLayer0View(LAYER_0_SIDEBAR_TYPES.PLANNING_ASSISTANT)` as `PlannerMain.vue:368-377`
  does, with the fullscreen handling of `toggleAiChat` (lines 250-252); `showBottomTriggers`
  (lines 200-204) counts the flag like `isImageGenEnabled`. To confirm in the plan: whether the
  configurator's layer-0 route needs a view state of its own, as the AI chat has with `showAiChat`
  and `aiChatShown` (`ui-state-store.ts:141-142, 340-341`), or whether `openLayer0View` is enough —
  `InteractionsContainer.vue:306-311` already lists the panel.
- The flag's JSDoc (`types.ts:92`) says "the planner"; it becomes "the planner and the
  configurator".

### 4.3 Documentation and tests in roomle-ui

- `packages/embedding-lib/docs/homag-intelligence-embedding.md:1969-2010` describes the window as
  a planner feature. The section moves to a document both embeddings share (the embedding-lib
  README or a document beside it), the HI document keeps a pointer.
- Tests: `planningAssistantOutput hands the part to the callback` for the configurator in
  `configurator-core/__tests__/configurator.ts` (the planner's is
  `planner-core/__tests__/roomle-planner.ts:4434`); `routes onPlanningAssistantOutput to the store`
  in `tests/unit/configurator/business-logic/sdk-connector-configurator.spec.ts` (the planner's in
  `sdk-connector-planner.spec.ts`); the host announcement for a configurator instance and the
  filtered inner configurator in `tests/unit/configurator/embedding/exposed-api.spec.ts` (the
  planner case is at line 395); the button behind the flag in
  `tests/integration/configurator/components/ConfiguratorMain.spec.ts`; the API switch of
  `firePrompt` in `tests/integration/common/components/PlanningAssistantChat.spec.ts`. The planner
  tests stay as they are.

## 5. Proposed design — roomle-configurator-mcp

Everything runs locally: the page on :3000, the MCP server on :3100, the chat backend on :3200,
the roomle-ui dev server on :5173. No deployment, no Cloudflare, no Azure.

### 5.1 The `configurator-mcp` workspace

The workspace becomes a workspace root like `hi-mcp` — `package.json` with the sub-packages,
`tsconfig.base.json` (already there), `vitest.config.ts` — with two packages:

- **`configurator-mcp-server`** — the MCP server, taken over from `hi-mcp/hi-mcp-server`:
  `server.ts` (`/mcp`, `/bridge`, page origins, the `client` session), `page-bridge.ts`,
  `types.ts` (the bridge protocol with the `historyChange` event), `configurator-api.ts` (the
  relay of `undo` and `redo` to the page's `instance.extended`, the counterpart of
  `planner-api.ts`), `configurator-mcp-server.ts` (the `McpServer` with its instructions and the
  tool registrations), `tool-executors.ts`. Dependencies as in the pattern:
  `@modelcontextprotocol/sdk` 1.30.0, `ws` 8.21.3, `zod` 4.6.5, `vite-node` 3.2.4.
- **`configurator-mcp-chat`** — the chat backend, taken over from `hi-mcp/hi-mcp-chat` with the
  Mistral provider only: `chat-server.ts`, `chat-handler.ts`, `chat-stream.ts`, `chat-steps.ts`,
  `chat-recovery.ts`, `tool-result-images.ts` stay; `chat-config.ts` loses Anthropic, Google,
  Azure and the Foundry deployments; `@ai-sdk/anthropic`, `@ai-sdk/azure` and `@ai-sdk/google` are
  not installed. Dependencies: `ai` 7.0.122, `@ai-sdk/mistral` 4.0.54, `@ai-sdk/mcp` 2.0.62.

### 5.2 The tools: `undo` and `redo`

- `undo` calls `extended.undo()` of the connected page, `redo` calls `extended.redo()`: one step of
  the configurator's own history per call, the same history the user's undo button uses. With no
  configuration-changing tool in this version, the steps they revert are the user's; the HI
  server's grouping of a tool call's steps (`plan-history.ts`) comes with the first changing tool.
- The page relays `onHistoryChange(undo, redo)` as the `historyChange` bridge event, exactly as the
  HI page does (`planning-assistant.ts:220-223`). The server keeps the last state: a call when
  nothing can be undone or redone answers "nothing to undo" without calling the page, and every
  result says whether a further undo or redo is possible.
- The tool descriptions say what the HI ones say, in the words of the configurator: undo reverts
  the last change of the configuration, redo brings back the change the last undo reverted, a new
  change ends redo.
- The server's `instructions`: a few sentences naming the configurator, the two tools and that
  nothing else can be changed yet.
- **The system prompt is the example's**, not roomle-ui's. The chat backend of this repository
  holds it as a constant: the assistant of a Roomle configurator, the two tools and what they
  do, nothing else can be changed yet. The page sends no `prompts` with a request, so the
  backend's `parseChatPrompts` and the `prompts` field go. What an agent must know later to
  change a configuration — rules generated from the component definitions — belongs to the main
  analysis of the ticket, not to this step.
- **Done when**: the user types "undo" or "redo", or asks for it in words, in the window of the
  configurator example; the model calls the tool; the configurator reverts or restores its last
  change; the answer says so and whether a further undo or redo is possible. The same two tools
  work from an external MCP client at `http://localhost:3100/mcp`.

### 5.3 The page as the host

`minimal-configurator-example/index.html` grows what `minimal-hi-example/index.html:1083-1240`
and `planning-assistant.ts:218-271` have, in plain JavaScript without a build step:

- `chat=true` sets `featureFlags: { planningAssistant: true }` in the init options — a dedicated
  parameter, because the page passes the query string flat and `featureFlags` is an object;
  `mcp_port` and `chat_port` as in the HI page.
- The bridge client: the WebSocket to `/bridge`, `hello` with a `clientId`, the allow-list
  `CONFIGURATOR_METHODS = ['undo', 'redo']` — the API-restriction of the ticket is this list —,
  `call` executed on `instance.extended`, `result` back, the `historyChange` event from
  `instance.extended.callbacks.onHistoryChange`, reconnect every 3 s, `availability` to the window
  from the connection state.
- The chat host: `instance.extended.callbacks.onPlanningAssistantPrompt` posts the conversation to
  `POST /chat` and streams the answer into `instance.extended.planningAssistantOutput` parts; the
  `[tool] ` line mapping of the HI page; `GET /capabilities` for the image drop.
- The guard `typeof instance.extended.planningAssistantOutput === 'function'`, logged when absent —
  the page then runs without the window, as today.

### 5.4 The launcher

`start.mjs` takes over the parts of `minimal-hi-example/start.mjs` that the local setup needs: the
build gate (install and typecheck of `configurator-mcp` on the first run), the MCP server on :3100
with the page origins, the chat backend on :3200 for `npm start mistral-medium <api-key>` and
`npm start mistral-large <api-key>` (the key goes into the backend's environment, never into the
page or the URL), the example URL with `mcp=true` and `chat=true`, `--dev` for the local roomle-ui
dev server, `--no-open`. `npm run mcp-server` starts the server alone for external MCP clients
(Claude Code, Copilot, Cursor at `http://localhost:3100/mcp`), which can call `undo` and `redo`
without the chat. No `--cf`, no Foundry or Azure names.

### 5.5 Can roomle-hi-example and ligna-store stay untouched?

**Yes, with §4.1.** The hosts address `extended.callbacks.onPlanningAssistantPrompt` and
`extended.planningAssistantOutput` on the planner instance, type the API as `any`, and the planner
keeps both members with the same shapes: the callbacks by inheritance from `UiCallback`, the method
unchanged in `roomle-planner.ts`. The exported type names of `@roomle/web-sdk` stay, only their
declaring file moves. roomle-hi-example's page, chat backend, prompt runner and documentation, and
ligna-store's `chat-host.ts`, need no change; the HI embedding document in roomle-ui gets a
pointer, not a correction. Clean, because the chat window is a feature of roomle-ui's drawer, which
both applications share — its API belongs to the base both SDK callback classes already share, not
to one of them.

**What the alternative would cost.** The conceptually purest home for a window of the UI layer is
the UI API (`instance.ui.callbacks.onPlanningAssistantPrompt`, `instance.ui.planningAssistantOutput`
on `ExposedCallbacks` and `ExposedApi`, which both applications share without any SDK change). It
changes the host-facing names: roomle-hi-example `minimal-hi-example/index.html` (the host, lines
1083-1240), `.agents/scripts/run-hi-mcp-prompt.js` and `docs/ai-chat.md`, roomle-ui's HI presets
example (`planning-assistant.ts`) and `homag-intelligence-embedding.md`, ligna-store
`hi-mcp/chat-host.ts` — each by replacing `extended` with `ui` for the two members — or it keeps
the planner's `extended` members as wrappers, which leaves two APIs for one window. Rejected for
this task (§6); the list is here in case the team prefers it.

## 6. Alternatives considered and rejected

- **The two callbacks duplicated on `ConfiguratorUiCallbacks`**, the planner's kept: two
  declarations of one API; a change of the prompt shape has to be made twice.
- **`RoomlePlannerUiCallback extends ConfiguratorUiCallbacks`**: every configurator callback would
  appear on the planner's callback object and be announced to every planner host; a wide change
  for two fields.
- **The chat API on the UI level** (`ui.*`): clean, but it changes the host-facing API and so the
  two hosts and the documentation — §5.5 names the cost; it needs a decision of its own.
- **The planner delegating to its inner configurator** (`getConfiguratorApi()`): the planner's
  `planningAssistantOutput` would go or become a wrapper, and the planner's host would wire a
  second namespace; more moving parts than the base class.
- **The agent loop in the page** (the roomle-ui HI presets example and the ligna-store shape):
  the API key in the URL and the browser history; the pattern repository's own example keeps the
  key in the backend's environment, and this example follows it.
- **More tools than undo and redo in the first server** — a read tool for the agent to confirm
  what it reverted, a parameter setter: out of scope by the task; the undo/redo results carry the
  availability instead.
- **The system prompt from the MCP server's `instructions`**: the AI SDK's MCP client does not put
  a server's instructions into the model's system prompt; the chat backend keeps a short system
  prompt of its own (§5.2).

## 7. Risks and open points

- **The roomle-ui branch is not on `master`.** `feat/planning-assistant-chat-RML-18190` carries
  RML-18164 and RML-18187 below the window; the configurator work lands after them. Until a build
  of the branch is deployed, the example runs with `npm run dev` against the local roomle-ui dev
  server on :5173. The published embedding-lib needs no change (§2.3).
- **The system prompt is settled** (§5.2): the example's chat backend holds it; nothing is asked
  of roomle-ui for it.
- **The default model** when `npm start mistral <key>` is given without a size: the pattern maps
  `mistral` to `mistral-large-latest`; to confirm.
- **Images.** Both Mistral models read images, so `/capabilities` would enable the drop; no tool
  of this version uses an image. Proposal: the backend reports `imageInput: false` in this version.
- **Undo reverts the user's steps.** With no changing tool, an agent asked to "undo" reverts
  whatever the user did last; the tool description says so.
- **The planner's inner configurator** must not echo the output to the host (§4.1, the filter).
- **The isolation mode of the planner** named in the ticket is not part of this version: the
  server talks to a standalone configurator page. The inner configurator of the planner exposes the
  same `RoomleConfigurator` API under the `configuratorSdk` namespace, so a later version can reach
  it from a planner page.
- **Node.** The AI SDK packages declare `node >= 22`; the pattern runs on Node 20+ and recommends
  22+. This machine runs Node 24.

## 8. Code and documents the work would touch

### roomle-ui (from `feat/planning-assistant-chat-RML-18190`)

| File | Change |
|---|---|
| `packages/web-sdk/packages/common-core/src/utils/ui-callback.ts` | `onPlanningAssistantPrompt`, `onPlanningAssistantOutput` with their JSDoc |
| `packages/web-sdk/packages/planner-core/src/roomle-planner-ui-callback.ts:46-49, 360-371` | the two fields and the type import go |
| `packages/web-sdk/packages/planner-core/src/planning-assistant.ts` → `packages/web-sdk/packages/common-core/src/planning-assistant.ts` | the types move |
| `packages/web-sdk/packages/index.ts:166-168` | the export path |
| `packages/web-sdk/packages/planner-core/src/roomle-planner.ts:148, 3209-3213` | the type import path; the method stays |
| `packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts` | `planningAssistantOutput(part)` beside `undo`/`redo` |
| `src/configurator/embedding/exposed-api.ts:78-82, 214-219, 400-405` | the UI-only filter for the inner configurator |
| `src/configurator/business-logic/sdk-connector-configurator.ts:369` | the subscription to the store |
| `src/common/components/PlanningAssistantChat.vue` (`firePrompt`) | the API by `isPlanner` |
| `src/configurator/components/ConfiguratorMain.vue:14-18, 33-37, 200-204, 245-255` | the button behind the flag |
| `src/configurator/embedding/types.ts:92` | the flag's description |
| `packages/embedding-lib/docs/homag-intelligence-embedding.md:1969-2010` | the window section to a shared document, a pointer stays |
| `packages/web-sdk/packages/configurator-core/__tests__/configurator.ts`, `tests/unit/configurator/business-logic/sdk-connector-configurator.spec.ts`, `tests/unit/configurator/embedding/exposed-api.spec.ts`, `tests/integration/configurator/components/ConfiguratorMain.spec.ts`, `tests/integration/common/components/PlanningAssistantChat.spec.ts` | the tests of §4.3 |

### roomle-configurator-mcp

| File | Change |
|---|---|
| `configurator-mcp/package.json`, `vitest.config.ts` | the workspace root with the two packages |
| `configurator-mcp/configurator-mcp-server/` | `server.ts`, `page-bridge.ts`, `types.ts`, `configurator-api.ts`, `configurator-mcp-server.ts`, `tool-executors.ts`, `tests/` |
| `configurator-mcp/configurator-mcp-chat/` | the Mistral-only port of `hi-mcp-chat`, `tests/` |
| `minimal-configurator-example/index.html` | `chat=true`, the bridge client, the chat host |
| `minimal-configurator-example/start.mjs` | build gate, the MCP server, the chat backend, the providers |
| `package.json` | `mcp-server`, the `start`/`dev` arguments |
| `docs/` | the reference of the server, its tools and the chat; `docs/README.md` |
| `.agents/skills/` | the server and the chat skills, taken over and reduced from roomle-hi-example |
| `AGENTS.md`, `.github/copilot-instructions.md`, `README.md` | the structure, the commands, the ports |

### roomle-hi-example, ligna-store

No change with the recommended design (§5.5).

### Verification

The step is done when "undo" and "redo" work from the window of the configurator example and
from an external MCP client (§5.2). roomle-ui: `npm run test -- planning-assistant sdk-connector-configurator exposed-api ConfiguratorMain configurator`, lint and type checks; the planner tests of the window unchanged and green. roomle-configurator-mcp: the server and chat unit tests (vitest), `npm run typecheck`, `npm run lint`, `npm run format:check`; the live check — `npm run dev mistral-medium <api-key>` with the roomle-ui branch on :5173, a parameter changed in the configurator, "undo that" in the window, the change reverted and the result naming the availability, "redo", an external MCP client calling `undo` at `http://localhost:3100/mcp`.

## 9. Implementation notes

What the implementation does differently from the plan posted on the ticket, and why.

- **One commit per repository** instead of the planned three and four: roomle-ui
  `feat: show the ai planning assistant window in the configurator`, roomle-configurator-mcp one
  commit with the analysis, the server, the chat, the page and the documentation.
- **roomle-ui: `INTERACTION_VIEW_TYPE.PLANNING_ASSISTANT` did not exist** — `ui-state.ts:42` is
  `BUTTON_ACTIONS.PLANNING_ASSISTANT`. The view type is added in `src/common/utils/types.ts`.
- **roomle-ui: the window chooses by the application, not by the mode.** `PlanningAssistantChat.vue`
  fires the prompt and closes by `sdkConnector.hasPlanner`, and `ConfiguratorMain.vue` shows the
  button only without a planner. With `isPlanner`, the configurator view of a planner object would
  have shown the button and sent prompts to the inner configurator, which no HI host listens to — a
  turn that never ends. Guarded by `leaves the window to the planner when the configurator runs inside it`.
- **roomle-ui: the fullscreen button is one of the selection buttons.** Positioned on its own, it
  sat on top of the "start configuring" button on mobile, where the configurator starts in
  fullscreen (live check). In the `SelectionButtons` stack it takes the stack's gap; no own CSS.
  Guarded by `stacks the planning assistant button with the selection buttons in fullscreen`.
- **roomle-ui: the chat component's test factory takes `hasPlanner`**, default the planner; the
  existing cases are unchanged.
- **MCP server: the page sends its history state on connection** — an ordinary `historyChange`
  event right after `ready`, from the last `onHistoryChange` it received — so "nothing to undo" is
  known from the start. The bridge tells its page-accepted listeners before it sends `ready`, so the
  state is reset before the page's event arrives.
- **MCP server: the history event wait is 1 s, not 5 s.** The configurator fires the event of an
  undo or redo synchronously before its call returns (roomle-ui
  `configurator-core/src/utils/configurator-history.ts:30-61`), so the event reaches the server
  before the result; the wait only bounds a step that did not happen.
- **Not ported, as nothing uses them in this step:** the Mistral image middleware
  (`tool-result-images.ts`), the recovery's message list (used by the ligna-store only), the
  backend's `/capabilities` (always "no images"), CORS on `/mcp` (no browser MCP client), the zod
  pin of the server (the MCP SDK's peer resolves to the AI SDK's copy, one copy).
- **The page has no `mcp=true` parameter**: it always connects to the MCP server, and `chat=true`
  adds the window. The launcher opens `http://localhost:3000/`.
- **The repository's `test` and `typecheck` scripts run in `configurator-mcp`**
  (`cd configurator-mcp && …`): `--workspace configurator-mcp` matched the nested packages as well.

### Verification

| Check | Result |
| --- | --- |
| roomle-ui in a worktree with a clean `npm ci` | `lint:types`, `lint:code`, `lint:flags`, `types-qa` green; `test:sdk` 2607 passed; `test:unit:ci` 1708 passed; `lint:docs:ui` and `lint:docs:sdk` with the same warnings and error as the base branch |
| roomle-ui in the developer checkout | the touched tests green; the type checks fail in `src/common/utils/markdown.ts` only, because `node_modules` holds `dompurify` 2.5.9 and `marked` 15 while the base branch requires 3.4.16 and 18.0.14 — `npm ci` would also replace the local kernel build |
| roomle-configurator-mcp | `npm test` 65 passed, `typecheck`, `lint`, `format:check` green |
| Live, desktop 1280×800 | the button beside "Add an element", the page connected; a depth change, `undo` through `/mcp` gives back exactly the configuration before the change, `redo` exactly the changed one, a further `undo` answers "Nothing to undo" without a change; "undo" in the window reaches Mistral through the chat backend (a placeholder key: `[error] Unauthorized` and the recovery note); closing returns to the parameters |
| Live, mobile 390×844 | the button stacked above "start configuring" in fullscreen; the window opens in the drawer with the input enabled |

Not run: a turn with a real Mistral key — steps 2 to 7 of the live check of the plan.
