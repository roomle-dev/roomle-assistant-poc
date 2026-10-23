# Move the configurator agent tools into roomle-ui

> **Type:** Refactoring analysis
> **Status:** Done
> **Date:** 2026-10-23
> **Base:** roomle-configurator-mcp `master` at `bcf7adacaca2bb97aa8a47d07e9f2a59719e7196`; roomle-ui `feat/configurator-mcp-api` at `e997a1726337d20aac24e6ae7ae176c092a1d51a`
> **Analysis branch:** roomle-configurator-mcp `docs/configurator-agent-tools-refactoring`

## Affected repositories

- **roomle-ui:** add the configurator agent tool set and prompts as lazy SDK modules, complete local operation/history results, and provide an embedding-lib adapter and assistant using the existing chat window and a shared agent loop.
- **roomle-configurator-mcp:** become the standalone example and integration-test host; replace the Node MCP/chat stack and page bridge with the embedding-lib assistant, and migrate the tool tests and documentation to their owners.
- **roomle-hi-example:** pin both browser imports and the setup references to the published embedding-lib alpha, as requested during implementation.

## Conclusion and scope

The configurator already has the lower half of the required architecture on `feat/configurator-mcp-api`: SDK-owned capability discovery, queries and editing operations, loaded on demand. What is missing is the **agent-facing layer in the iframe** and the **browser agent integration in the embedding-lib**. Moving just the two servers into the embedding-lib would reproduce an intermediate HI design, not the current one.

The target follows [the planning-assistant overview](https://github.com/roomle-dev/roomle-ui/blob/e997a1726337d20aac24e6ae7ae176c092a1d51a/packages/embedding-lib/docs/planning-assistant-overview.md) and [HI ADR 0012](https://github.com/roomle-dev/roomle-ui/blob/e997a1726337d20aac24e6ae7ae176c092a1d51a/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md): the iframe owns tools, schemas, descriptions, prompts and execution; the host owns the model, credentials, conversation and agent loop. Tool discovery and execution cross the existing embedding message channel. There is no MCP protocol server in this path.

“The same way as HI” is interpreted as the same ownership and transport design, preserving configurator-specific behavior. In particular, configurator undo remains the configurator's normal undo, including manual edits. HI's agent-only undo ledger is not a drop-in replacement.

This is an analysis, not an implementation. Proposed names below are new APIs, not methods already present. No changes to RoomleCore or product/library calculations are required by this migration. roomle-hi-example is the reference consumer and needs no functional change if its public embedding-lib imports remain compatible. Retaining external MCP clients would require a separate, thin transport adapter; it is not part of the recommended default path.

## Evidence and repository comparison

References prefixed `UI` are relative to roomle-ui at the base above; `MCP` means this repository at its base. `HI` means roomle-hi-example at `0d2d38caf5fabf5d1e9a26561b18f4a0b7141592` on `docs/library-calculation-guarantee`. These are inspected local revisions, not an assertion about a deployed UI or the latest remote branch.

| Responsibility | HI example today | Configurator example today |
|---|---|---|
| Example runtime | One static launcher, `HI minimal-hi-example/start.mjs:39`, with `/planning-assistant-config.json` | Static launcher plus MCP on 3100 and chat on 3200, `MCP minimal-configurator-example/start.mjs:28` |
| Chat window | Shared roomle-ui `PlanningAssistantChat.vue` | The same window, already supported in the standalone configurator |
| Agent loop | Browser `startPlanningAssistant`, `UI packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts:108` | Node `MCP configurator-mcp/configurator-mcp-chat/chat-stream.ts:20` |
| Tool definitions and validation | Lazy iframe module, `UI packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts:134` | Node registrations, `MCP configurator-mcp/configurator-mcp-server/configurator-mcp-server.ts:208` |
| Tool execution | A forwarded `callExternalObjectAgentTool`, then direct planner calls | HTTP MCP request → WebSocket page bridge → embedding call → configurator SDK |
| Product knowledge | HI library and glue logic in the iframe | Native component definitions, RAPI metadata and kernel choices in the iframe; already SDK-owned |
| History | Tool-owned records and planner history; manual changes invalidate the agent ledger | `HistoryState` follows page-relayed history events; a second queue serializes writes and confirms each event |
| Prompts | `getExternalObjectAgentPrompts` from the deployed planner | Server `INSTRUCTIONS` plus chat `SYSTEM_PROMPT` in separate Node packages |
| Providers and credentials | Shared browser model loader; credentials in the host page | Two Mistral aliases; credentials held in the chat process |
| External clients | No MCP endpoint | `POST /mcp` while the page is connected |
| Tests | Tool and adapter tests in roomle-ui; live prompt runs in the example | Tool, transport, chat and launcher tests bundled in `configurator-mcp/` |

### Traced call paths

**HI:** `HI minimal-hi-example/index.html:1022` reads the model config and calls the assistant. `UI packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts:119` loads the AI SDK, model, prompts and tools. `hi-mcp-tools.ts:76` maps the iframe's JSON schemas to AI SDK tools and forwards execution. `UI packages/web-sdk/packages/planner-core/src/roomle-planner.ts:3253` lists definitions; `:3264` dispatches calls; `:3281` caches the lazy tool-set promise and clears it on failed initialization. Validation and error results come from `homag-intelligence/src/hi-mcp/mcp-tool.ts:26`. Tools then call planner methods directly. The model loop stays outside the iframe.

**Configurator:** `MCP minimal-configurator-example/index.html:53` installs the WebSocket bridge and history forwarder; `:191` owns the browser conversation and calls `/chat`. `configurator-mcp/configurator-mcp-chat/chat-stream.ts:33` creates an MCP client bound to the page's client id. `configurator-mcp/configurator-mcp-server/server.ts:49` creates an MCP server per request, backed by shared bridge/history objects. Registrations invoke `tool-executors.ts:96` for queries and `:223` for writes. `configurator-api.ts:80` sends one of two methods over the page bridge; the page executes it on `instance.extended` at `index.html:121`. The SDK finally runs the operation in the iframe.

The problem is ownership split across releases, duplicated chat infrastructure and an unnecessary network round trip back to the same browser. Product interpretation is already in the correct place; it should not be rebuilt.

### What the roomle-ui branch already supplies

The inspected branch has three commits beyond the local `origin/master`: `cb2b83a1e` (capabilities), `4df8360e7` (queries), and `e997a1726` (executes).

| Existing code | Contribution and remaining boundary |
|---|---|
| `UI packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts:1554` | `getConfiguratorCapabilities` dynamically imports the collector. Keep the public method for existing callers. |
| Same file `:1576` and `:1601` | `queryConfigurationOperation` and `executeConfigurationOperation` dynamically import `common-core/src/mcp-api/configuration-operations.ts`. These are low-level SDK APIs, not agent tool discovery or a chat assistant. |
| `UI packages/web-sdk/packages/common-core/src/mcp-api/configuration-operations.ts:1055` | One existing operation chain serializes queries and writes. Context capture rejects a missing native configuration, external HI objects, and planner use outside isolation; freshness checks protect asynchronous reads and pre-write work. |
| Same file `:863` and `configuration-operations-types.ts:203` | Writes return operation data, pre-operation context and the resulting hash. They do **not** return `confirmed`, `canUndo`, `canRedo`, `undone` or `redone`. Those currently come from the Node tool layer. |
| `UI packages/web-sdk/packages/common-core/src/mcp-api/configurator-capabilities.ts` and `configurator-capabilities-types.ts` | Recursive discovery, detached JSON, declared versus current choices, and partial results with `complete`/`unresolved`. Keep these contracts. |
| `UI packages/web-sdk/packages/common-core/src/configurator-kernel-access.ts`, its adjacent `rapi-access.ts`, and `UI packages/web-sdk/packages/typings/kernel.ts` | Existing native docking and metadata support. No second docking solver or product interpreter is needed. |
| `UI src/configurator/embedding/exposed-api.ts:376,1041`; `packages/embedding-lib/src/connector.ts:70` | Public methods are announced and forwarded dynamically. The new agent methods need contract tests, not another custom message protocol. |

The chat window and output path already exist independently of these three commits: `RoomleConfigurator.planningAssistantOutput` at `roomle-configurator.ts:2394`, the configurator UI connector at `src/configurator/business-logic/sdk-connector-configurator.ts:380`, and the shared callback/output types. A second chat window is unnecessary.

## Target shape in roomle-ui

```text
example page
  optional @roomle/embedding-lib/configurator entry
  shared browser agent loop ── model request ──> chosen provider
       │ tools/list equivalent          │ tool call
       └──────── existing embedding messages ─────────┐
                                                     ▼
configurator iframe / planner's native isolation configurator
  RoomleConfigurator agent methods
       └─ dynamic import: configurator agent tools and prompts
            └─ queryConfigurationOperation / executeConfigurationOperation
                 └─ existing SDK discovery, configuration history and kernel

chat prompt/output: host <── existing embedding messages ──> existing window
```

### SDK tool set, prompts and public methods

Add the following on `RoomleConfigurator`, mirroring the HI boundary without using HI names:

| Proposed method | Contract |
|---|---|
| `getConfiguratorAgentTools()` | Detached definitions: `name`, `description`, JSON `inputSchema`, and optional annotations. No executable functions cross the frame boundary. |
| `callConfiguratorAgentTool(name, input)` | Execute against this configurator; return MCP-shaped `content` and optional `isError`. Unknown names, invalid inputs and execution failures become readable tool errors. Use own-property lookup, as the HI dispatcher does. |
| `getConfiguratorAgentPrompts()` | Product-configuration system prompt and an image-only fallback prompt if images are enabled. Instructions ship with the tool implementation. |

Place the configurator-specific implementation in a new `packages/web-sdk/packages/configurator-core/src/configurator-mcp/` domain folder: the registry/factory, schemas/executors and prompts. Call the existing operations directly on the SDK instance; remove the WebSocket-shaped `ConfiguratorApi` dependency and duplicate operation-name/type declarations in favor of SDK types. Consolidate the current `INSTRUCTIONS` and `SYSTEM_PROMPT` into one maintained source, while tool descriptions retain their individual guidance.

Extract only the already reusable primitives from `homag-intelligence/src/hi-mcp/mcp-tool.ts` and `mcp-tool-types.ts` into a neutral `common-core/src/agent-tools/` module. Both concrete tool sets use them. Keep existing exported HI type names as aliases/re-exports through `packages/web-sdk/packages/index.ts`; do not make the configurator import the HI registry or planning skills. Extend the neutral definition with optional annotations so the configurator's read-only/destructive metadata is not silently lost. The existing HI definition carries no annotations.

Keep the current 16 tools and their operation mappings:

| Tools | Existing SDK operation |
|---|---|
| `get-configurator-capabilities` | query `capabilities`, unwrapping `.capabilities` as today |
| `get-configuration`, `get-component-parameters`, `get-global-parameters` | query `configuration`, `componentParameters`, `globalParameters` |
| `get-possible-children`, `get-docking-positions`, `get-component-docking-positions`, `get-delete-impact` | query `possibleChildren`, `dockingPositions`, `componentDockingPositions`, `deleteImpact` |
| `change-component-parameter`, `change-global-parameter` | execute `changeComponentParameter`, `changeGlobalParameter` |
| `dock-component`, `drag-component`, `delete-component`, `load-configuration` | execute `dockComponent`, `dragComponent`, `deleteComponent`, `loadConfiguration` |
| `undo`, `redo` | execute `undo`, `redo`, with their existing tool result envelopes |

Preserve schema normalization: in particular, the tool accepts a pasted dock pair and strips fields that the stricter SDK operation does not take (`MCP configurator-mcp/configurator-mcp-server/tool-executors.ts:59`). Preserve numeric runtime ids versus catalog ids, kernel-serialized parameter strings, partial capability reads, and failures as `isError`. Do not transplant HI authoring rules, geometry conventions, attribute filters, result stripping or agent-only history into native configuration tools.

### Loading on demand is an end-to-end requirement

Use a cached promise **per `RoomleConfigurator` instance**, initialized only by an agent-method call, matching `RoomlePlanner._getHiAgentTools`. Clear a failed initialization so the next explicit request can retry. Discovery must work without a loaded product; operations report the existing actionable lifecycle error until a native configuration is ready.

Ordinary viewer/configurator startup and SDK method enumeration must not import the registry or prompts, or pull in zod/AI providers through the agent feature. Merely enabling the chat-window feature flag must not initialize an agent. Starting the assistant is an explicit demand point and may load the tool set before the first prompt. Use type-only imports in SDK/public barrels. Agent prompts must also be behind an optional import; a top-level import of their module can otherwise pull the registry into the initial bundle. Keep the existing query/execute collectors lazy as well.

The embedding entry is optional, and the AI SDK/provider imports occur only when the assistant starts. A tools-only consumer must be able to call `createConfiguratorMcpTools` without loading any model SDK. Verify emitted chunks and browser requests, not just the presence of `import()` in source. Reuse of the neutral helper must not introduce a static edge back into HI.

Cache tool code, not configuration state. Product loads, resets, isolation entry/exit and configurator cleanup (`roomle-configurator.ts:2102`) must not retain stale target ids or history. Any callback installed by the lazy module must preserve the UI/host handlers and be removed with its owner. Repeated discovery must not stack listeners.

### History and operation completion require an SDK change

Simply copying `HistoryState` into the browser is the wrong boundary. Its operation counters, one-second event wait and `ConfiguratorCallTimedOutError` handling compensate for a remote page bridge (`MCP configurator-mcp/configurator-mcp-server/history-state.ts:9`, the adjacent `tool-executors.ts:121,145,156`). The SDK already serializes operations. A second global queue would duplicate that mechanism.

The underlying history is `UI packages/web-sdk/packages/configurator-core/src/utils/configurator-history.ts`: `push` at `:69` ignores an unchanged hash; `undo`/`redo` return no configuration when no step is available. `configurator-scene-manager.ts:1742` pushes or updates history on `planObjectUpdated`; `:2296` awaits the configuration reload for undo/redo. Therefore a resolved SDK call alone does not prove a new undo step, and a hash alone does not say whether redo is available.

Recommended change: expose an internal authoritative history snapshot from the scene manager/history service to the operation implementation. Capture completion and post-operation undo/redo availability **inside the existing serialized operation**, before the next operation can run. Add that outcome to the SDK result, or to an internal result consumed by the agent executor, and retain the established tool fields:

- Mutations: SDK payload plus `confirmed`, `canUndo`, `canRedo`, and a factual hint for a no-op or unconfirmed change.
- History: `{ undone | redone, canUndo, canRedo, hint? }`; no available step remains a successful negative result.
- Confirm a reported history change, not merely receipt of the request. An unchanged parameter must not claim a new step. Keep failures distinguishable from successful no-ops; do not fabricate history availability from a changed hash.

The exact completion hook is a point to verify with native-operation tests: the operation result must follow the existing history update/reload completion. Do not replace that verification with a new timer, polling loop, event generation counter or mutex. The migration must cover loading a different configuration and automatic calculation updates as well as parameter edits.

Preserve ordinary configurator undo semantics. Adopting HI's `PlanHistory` would change which actions can be undone and requires a separate product decision. Preserve the existing native target/freshness checks; this migration adds no new rule that rejects otherwise legitimate configuration requests.

## What the embedding-lib needs

### Shared implementation with two domain adapters

`startPlanningAssistant` is currently HI-specific despite its general name: its API type requires `getExternalObjectAgentPrompts` and its body calls `createHiMcpTools`. Passing a configurator instance to it will not work.

Extract the common model loader and turn loop from `src/homag-intelligence/hi-planning-assistant.ts` into a neutral assistant module. Its concrete inputs are the window callbacks/output, the tool set, prompts, model configuration and abort signal. Keep the current HI public function and import path as a small adapter with its existing signature. Add a configurator adapter, proposed as `startConfiguratorPlanningAssistant`, that obtains configurator prompts/tools and uses the same loop. There should be one provider implementation, one step-budget policy and one message/output conversion, not a copied HI runner or a mode switch scattered through it.

Likewise, share the schema/result conversion in `src/homag-intelligence/hi-mcp-tools.ts`; add `createConfiguratorMcpTools` that lists and forwards the new configurator methods. SDK-side validation remains authoritative; the host supplies the schema to the model and forwards input. Preserve `isError`, text/image conversion and forwarding errors. Detect missing methods and send an unavailable message naming the required UI update.

Publish these through a new optional `@roomle/embedding-lib/configurator` entry (`src/configurator.ts`), with `configurator.js`, a minified export and declarations. Update `config/vite.config.embedding.mts:67`, `packages/embedding-lib/public/package.json`, and source aliases in `config/vite.config.ui.mts:62`, root `tsconfig.json:10` and `packages/embedding-lib/tsconfig.dts.json:32`. Update `packages/embedding-lib/src/hi.ts` to re-export the shared implementation through its existing adapters. Preserve `@roomle/embedding-lib/hi`, `createHiMcpTools`, `startPlanningAssistant`, `loadChatModel` and existing types. Keep the main embedding entry free of AI dependencies; its existing size check covers only the main minified output, so it is not sufficient evidence for the optional entry's dependency graph.

### Standalone versus planner isolation

| Host | Tools and configurator prompts | Chat callback and output |
|---|---|---|
| `createConfigurator` | `instance.extended` | `instance.extended` |
| `createPlanner`, native object in isolation | `instance.configurator` | `instance.extended` (the planner) |

This split is already explicit in `UI packages/embedding-lib/docs/configuration-operations.md:3` and `planning-assistant-embedding.md:17`. `PlanningAssistantChat.vue:223` chooses the planner API whenever a planner is present. Wrapping `instance.configurator` as `extended` for everything would miss the actual prompt callback.

The shared runner must accept the window endpoint separately from the tools endpoint. The configurator adapter can expose these two concrete inputs for an isolation host; the standalone example passes the same endpoint for both. Do not start both HI and configurator assistants on one window callback: both also contain `undo`/`redo`, and the last callback assignment wins. This migration supports an explicitly selected configurator assistant in native isolation. Automatic switching between HI room planning and native object configuration is a separate feature, requiring conversation and in-flight-turn lifecycle design.

### Preserve or explicitly decide chat behavior

The current configurator chat has failure recovery summaries and a five-minute turn budget (`MCP configurator-mcp/configurator-mcp-chat/chat-recovery.ts:81`, the adjacent `chat-config.ts:5` and `chat-stream.ts`). The HI runner displays an error and keeps only completed turns; it has an abort signal and a 16-step limit but no own turn deadline. Blind reuse would lose the configurator's recovery information.

Recommended: carry configurator outcome summarization into the shared runner's error handling with concrete tool metadata/result interpretation, and test failed reads separately from completed, pending or unconfirmed writes. Keep the existing configurator deadline in its adapter/host policy; it bounds a model turn, not SDK operation correctness. Do not automatically replay a pending mutation. If exact HI error behavior is preferred instead, record removal of the summary/deadline as an intentional compatibility change before implementation. Avoid sending malformed partial assistant/tool message pairs into a subsequent turn.

Use the shared provider support rather than keeping the two-model Node backend. The new example can retain `mistral-medium` and `mistral-large` aliases while supplying a normal `PlanningAssistantConfig`. Initially keep `readsImages: false` to preserve the configurator's text-only scope; enabling photos needs a product-configuration image prompt and tests, not HI's kitchen-image prompt. Images of the current configuration are not a tool in the present 16-tool set.

## What changes in roomle-configurator-mcp

| Current location | Required outcome |
|---|---|
| `minimal-configurator-example/index.html:33` | Retain creation, URL init options and `ui.loadObject`; replace `startAssistant`/`startChat` with the optional configurator embedding entry, config fetch and assistant startup. Remove WebSocket reconnect, client ids, method allow-list, relayed history and `[tool]`/`[error]` stream parsing. |
| `minimal-configurator-example/start.mjs:28` | One static process plus the local model-config response, following HI `start.mjs:210–253`. Remove workspace install/typecheck boot gate, MCP/chat subprocesses, ports and origin coordination. Retain dev UI override, custom page port, `--no-open`, shutdown and model validation. |
| `configurator-mcp/configurator-mcp-server/configurator-mcp-server.ts`, `tool-executors.ts` | Move the tool contracts and useful tests to roomle-ui; replace MCP registration with the browser tool factory. Remove these local implementations after parity is verified. |
| `configurator-mcp/configurator-mcp-server/configurator-api.ts`, `history-state.ts`, `page-bridge.ts`, `types.ts`, `server.ts` | Remove bridge-only interfaces, event correlation, timeouts, HTTP transport and process entrypoint. SDK history outcome replaces transport confirmation. |
| `configurator-mcp/configurator-mcp-chat/{chat-config,chat-stream,chat-recovery,chat-steps,chat-handler,chat-server}.ts` | Move domain prompt and relevant recovery/turn behavior to roomle-ui; keep only launcher-specific model configuration locally. Delete HTTP chat, MCP client and server-only diagnostics/transport after tests are migrated. |
| Root/workspace/package manifests, `package-lock.json`, `configurator-mcp/tsconfig.base.json`, package tsconfigs and `vitest.config.ts` | Remove obsolete workspaces, scripts and production dependencies (`ws`, MCP SDK, server AI SDK/provider packages, `vite-node`). Retain/rehome test tooling needed by launcher and example tests; do not leave `npm test` pointing into a deleted workspace. |
| `configurator-mcp/configurator-mcp-server/tests/example-launcher.test.ts` | Rehome launcher tests outside the removed workspace and test static/config serving with no MCP or chat process. |
| `minimal-configurator-example/package.json`, root/package READMEs | Keep entry commands valid and describe the browser assistant and required UI/embedding versions. The repository name need not change. |

The local configuration endpoint must follow HI's loopback peer and Host checks and `Cache-Control: no-store`. Keep keys out of URLs and logs. Serving the key locally still means it is visible in the browser; this is a documented change from the current server-held key, not a claim of production secret isolation. A production provider proxy can keep model credentials server-side without moving configurator tools out of the iframe, but building it is outside this migration.

Removing `/mcp` also removes Claude Code/Cursor/Copilot connections documented today. If those clients must remain supported, retain a separately selected relay that lists and calls **the iframe-owned tools**, with no duplicate schemas, prompts or history logic. A browser iframe cannot itself host the old inbound HTTP endpoint. The default recommendation matches HI and removes the transport stack completely.

## Tests and verification required for the refactoring

| Existing coverage | Destination and required assertions |
|---|---|
| `MCP configurator-mcp/configurator-mcp-server/tests/configurator-mcp-server.test.ts:53` | New SDK tool tests: all 16 names, schemas, descriptions, annotations, result envelopes, capability unwrapping, partial reads, invalid inputs and unknown names. Replace in-memory MCP transport with direct tool execution. |
| `MCP configurator-mcp/configurator-mcp-server/tests/tool-executors.test.ts` | Migrate operation mapping and dock-pair normalization tests. Replace fake-page/event-timeout tests with native completion/history tests; retain no-op, empty history, failed write, undo/redo and concurrent operation coverage. |
| `UI packages/web-sdk/packages/common-core/__tests__/mcp-api/configuration-operations.ts` and `configurator-capabilities.ts` | Keep discovery/query/write guarantees. Add authoritative post-operation history, unchanged hash, load/reset, manual edits, fresh target, isolation exit and correct completion of asynchronous reloads. No query/selection mutation or preview geometry. |
| `UI packages/web-sdk/packages/configurator-core/__tests__/roomle-configurator.ts:355`; planner counterpart `:4892` as reference | Verify no agent import on ordinary creation, first discovery/call imports once, concurrent discovery shares initialization, failed initialization retries, instances do not share state, cleanup/reload does not retain stale listeners or product state. |
| `UI tests/unit/configurator/embedding/exposed-api.spec.ts:183,248`; `tests/unit/embedding-lib/connector.spec.ts:62,103` | Announce and forward all three agent methods under `extended` for standalone and `configurator` for planner isolation; return serializable definitions/results and preserve failures. |
| `UI tests/unit/embedding-lib/homag-intelligence/hi-mcp/{hi-mcp-tools,hi-mcp-stream-text}.spec.ts` | Retain HI regression coverage; add configurator forwarding and a real AI SDK mock-model turn to check JSON Schema closure, normalization and `isError` delivery. No provider dependency for tools-only use. |
| `UI tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts`; MCP `chat-stream`, `chat-recovery`, `chat-steps` tests | One common loop: domain prompts, providers, full successful tool history, 16-step final-answer behavior, availability failures, interruption/abort, deadline policy and outcome summaries. Test the separate window/tools endpoints in isolation. |
| Existing window/store and configurator/planner connector tests | Preserve callback chaining, UI-only output filtering and one active handler. Standalone and planner-isolation prompts must reach the intended agent. |
| MCP launcher/bridge/chat-handler tests | Rehome launcher tests, replace endpoint assertions with local model-config/no-store/host checks, and remove tests exclusively for deleted protocols only when their replacement behavior is covered. |

Live verification must use the UI branch and a compatible built embedding-lib together: read a native product, change a parameter, dock/drag/delete, undo/redo, mix in a manual edit, then repeat through native planner isolation. Check a failed/partial capability read and an interrupted turn after a write. Run two separate embedded instances to prove each call stays with its own configuration. A normal configurator without the assistant must make no requests for agent-tool or model chunks; first assistant startup should load them, and subsequent tool calls should reuse them. Re-run one HI tool/assistant scenario to guard the shared extraction. No live model, UI build or deployment is claimed by this analysis.

Use the repository npm scripts during implementation: roomle-ui SDK/unit tests, type/lint checks, and the embedding build when the API change is ready; this repository's remaining tests, lint, formatting and Markdown link check. Inspect generated exports/declarations and the production chunk graph. Deploy the UI agent methods before changing the example's pinned embedding version; older UIs must yield an unavailable message, while existing HI consumers retain their signatures.

## Expected changes, alternatives and unresolved decisions

Expected result: a tool/prompt correction ships with roomle-ui, a tool call takes one embedding round trip, and starting the example needs one process. Tool names, native operation choices and ordinary configurator undo remain stable. Tool logs move from the server terminal to the iframe console. Successful conversation history can include tool messages as in HI, rather than the current page's text-only turn history. No numerical speedup is claimed.

For the loading/performance acceptance check, record initial JS/chunk requests with the assistant off, first-discovery latency and transferred bytes, repeat-discovery requests, and warm read/write latency before/after on the same product and UI build. Report model time separately; removing local bridge hops does not measure provider performance. This is an ownership refactoring, not a measured performance optimization.

| Alternative | Assessment |
|---|---|
| Put the whole MCP server in the embedding-lib | Reject: tools would still ship separately from the SDK they operate on, and every host would carry protocol/server dependencies. |
| Put the model loop and credentials inside the iframe | Reject for this task: contradicts the HI host/provider ownership and is unnecessary for on-demand SDK tools. |
| Copy the HI assistant into a second configurator runner | Reject: duplicates provider, stream, error and step-limit behavior; two concrete adapters can share it. |
| Reuse HI tool logic and agent-only undo | Reject: native product definitions, docking and undo contracts differ. Share transport-neutral primitives only. |
| Keep a thin external MCP relay | Valid only if external clients are required; do not preserve the old server as a second source of tool behavior. |
| Use the existing SDK operation APIs without moving tools | Useful lower-level integration, but does not meet the requested ownership/deployment or on-demand agent-tool boundary. |

The implementation review must settle three behavioral choices explicitly: whether external MCP access is still a requirement, whether configurator interruption summaries/deadline are retained as recommended, and whether native isolation is explicitly selected or a later automatic HI/configurator switch is desired. None blocks this analysis; no destructive migration is performed here.

Documentation belongs with the new owners: add roomle-ui's configurator agent architecture/tool contract beside its SDK documentation; update `packages/embedding-lib/docs/{configuration-operations,configurator-capabilities,planning-assistant-embedding,planning-assistant-overview}.md`, its README, and the HI architecture/behavior references for shared code moves. In this repository update `README.md`, `AGENTS.md`, `docs/{README,configurator-mcp-server}.md`, the example README, `.agents/context/{configurator-example-with-planning-assistant-chat,get-configurator-capabilities}.md`, `.agents/wiki/roomle-configurator-api-for-mcp.md`, the MCP skill and indexes. Refine ADR 0001's transport wording when the implementation changes, retaining its SDK-owned discovery decision; record the new tool ownership decision then. Do not rewrite living reference to describe an unimplemented proposal.

## Validation of this analysis

- Compared the actual source and tests at the three revisions above, including the requested planning-assistant overview and the HI agent architecture.
- roomle-configurator-mcp baseline: **157 tests passed across 10 files** with Node `22.23.3`; typecheck, lint and formatting checks passed. The default Node `20.10.0` failed to load the installed Vite/Vitest configuration; the installed Node 22 runtime resolved that without dependency changes. HTTP/launcher tests require localhost binding outside the filesystem sandbox.
- Markdown links and whitespace checks pass. Only this report and its two index entries are changed. Productive code, roomle-ui and roomle-hi-example are unchanged. SDK/embedding implementation tests, browser behavior and bundle-size claims remain future verification work.

## Implementation finding: configuration replacement

The browser parity run found that the existing SDK `loadConfiguration` operation called the
public full-startup loader. In a standalone configurator this cleared history; in planner
isolation it did not complete within 45 seconds. The other native operations and undo/redo
completed in both contexts. The tool description's promised history step therefore did not
match the full-startup path.

The operation should replace the active configuration through the scene manager's existing
reload path, the same completion path used by native undo/redo. Its planner override already
updates the isolated plan object. This keeps the operation on its captured target and records
the replacement in native history without adding a timer, queue or readiness mechanism. The
public full-startup `RoomleConfigurator.loadConfiguration` API stays unchanged. Unit tests must
verify the selected path and awaited completion; browser checks must replace and undo/redo in
standalone and isolation contexts before publication.

## Refactoring report

The implementation is on roomle-ui `feat/configurator-mcp-api`, this repository's
`feat/configurator-agent-in-roomle-ui`, and roomle-hi-example `chore/embedding-lib-alpha`.
The analysis is retained until the implementation reaches every affected default branch.

### Changes and ownership

- roomle-ui extracted the neutral validation, tool adapter, model loader and browser turn loop,
  preserving the public HI adapters. Its configurator SDK now owns the sixteen tools, schemas,
  descriptions, annotations and prompts, cached on demand per instance with retry after failed
  initialization. Native operations report authoritative history outcomes inside the existing
  operation chain. Configuration replacement uses the active scene's reload completion, including
  the planner isolation override, and retains normal undo history.
- The optional embedding entry exports `createConfiguratorMcpTools` and
  `startConfiguratorPlanningAssistant`, with separate tool/window endpoints. The configurator
  retains recovery summaries and its five-minute deadline, with no automatic replay of uncertain
  writes. The shared loop keeps completed tool messages and a sixteen-step budget.
- This repository replaced the browser bridge and Node agent with the embedding assistant and a
  static launcher. It removed the MCP/chat workspace, HTTP/WebSocket transport, duplicate history
  correlation, child-process startup, stream parser, transport tests and their dependencies. Its
  clean lockfile contains only the example workspace and development formatting/lint tooling.
- roomle-hi-example pins both browser imports to the verified published alpha `9.0.0-alpha.5` in
  commit `2392d87`. The configurator example pins the dev build `0.0.0-dev-9d077e2` from roomle-ui
  `9d077e222fb59ac4c6f8b4ee248431a88b575c9c`. The [dev release workflow](https://github.com/roomle-dev/roomle-ui/actions/runs/39996201679)
  published with the `dev` tag, verified in npm metadata; it did not deploy the UI or change
  `alpha`/`latest`. The example uses the exact published files on jsDelivr.

The principal new files in roomle-ui are `common-core/src/agent-tools/`,
`configurator-core/src/configurator-mcp/`, embedding-lib `src/planning-assistant/`,
`src/configurator-agent/` and `src/configurator.ts`, with adjacent SDK and embedding tests. Public
methods are on `RoomleConfigurator`; existing embedding message namespaces forward them. Build
entries, package exports, declarations and aliases include the optional configurator entry.
This repository's remaining runtime files are `minimal-configurator-example/index.html` and
`start.mjs`, with Node launcher tests under `minimal-configurator-example/tests/`.

### Before and after

| Boundary | Before | After |
|---|---|---|
| Agent | Node chat process and MCP client | Shared browser loop in the embedding-lib |
| Tool ownership | Separate MCP server registrations and executors | Lazy native SDK registry and prompts |
| Tool transport | HTTP MCP, WebSocket bridge, embedding messages | Existing embedding messages |
| History confirmation | Relayed events and remote timeout/counter state | Authoritative native history snapshot after operation completion |
| Configuration replacement | Full-startup loader reset standalone history and stalled in isolation | Active scene reload, with native undo and isolation preserved |
| Example startup | Static page, MCP and chat processes, build gate | One static process and local model config |
| External MCP applications | Inbound `/mcp` endpoint | No external endpoint; a separately requested relay would be a separate integration |

### Verification and test adaptations

- The full SDK suite passed **3,312 tests**, with 24 skipped, using four workers. Migrated direct
  tool tests cover all sixteen mappings, schemas, metadata, normalization, partial capabilities,
  failures and native history. New SDK tests cover per-instance lazy initialization/retry,
  unchanged writes, committed hashes, asynchronous completion and configuration replacement.
- The embedding/bridge/HI suite passed **109 tests**, with one skipped. It includes a real AI SDK
  mock-model turn, error feedback delivered to the next model step, both namespaces, separate
  isolation endpoints, complete history, interruption recovery, the deadline and final step policy.
- Launcher tests passed in both example repositories (**three each**). A clean configurator
  `npm ci`, lint, formatting and the repository-wide Markdown link check passed.
- Chromium checked actual USM configuration reads, component/global changes, no-ops, dock, drag,
  delete, configuration replacement, undo/redo and non-agent edits. The same mutation sequence
  completed in planner isolation, including undo after replacement. Two simultaneous browser
  instances retained separate configurations. Before discovery, the ordinary configurator made no
  requests for the native agent registry or its zod dependency through this feature.
- A final Chromium run loaded the example's actual published CDN imports without rewriting them,
  discovered all sixteen tools through `createConfiguratorMcpTools`, read the configuration and
  parameters, confirmed a global edit and undid it. Tools-only use loaded no AI/provider SDK.
- The embedding production build passed, including `configurator.js`, its minified entry and
  declarations. The main minified bundle remains **15.84 kB**, below its 16 kB limit. Formatting,
  UI/SDK/embedding types and code lint passed. TypeDoc still reports **22 existing warnings** and
  exits unsuccessfully; the same warnings were reproduced on the untouched branch base with the
  same installed dependencies.

### Durable documentation and limits

The ownership decision is [ADR 0002](../decisions/0002-configurator-tools-run-in-the-sdk.md).
The [implementation context](../context/configurator-example-with-planning-assistant-chat.md),
[capability contract](../context/get-configurator-capabilities.md),
[API map](../wiki/roomle-configurator-api-for-mcp.md),
[integration skill](../skills/configurator-assistant.md) and
[external guide](../../docs/configurator-assistant.md) describe the result. roomle-ui owns the
native agent guideline and embedding integration guide; its HI architecture references name the
shared implementation. Detailed capability and API tables remain available here.

The iframe still requires a deployment containing the new SDK methods. Use the local
`feat/configurator-mcp-api` UI with the dev embedding version until that deployment exists.
Provider calls with a real API key were not run; model behavior is covered by mock-model tests.
There is no automatic HI/native conversation switching, external MCP relay, or production
credential proxy. Browser-held provider keys remain visible to the host. No before/after latency
benchmark or provider speed improvement is claimed.
