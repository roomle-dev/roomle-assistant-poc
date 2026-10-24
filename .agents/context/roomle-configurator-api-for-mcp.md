# The roomle-ui configurator API for agent tools

The native configurator exposes two operation APIs on `RoomleConfigurator`:
[queryConfigurationOperation](query-configuration-operation.md) reads the active configuration;
[executeConfigurationOperation](execute-configuration-operation.md) edits it and reports committed
history. The configurator's SDK-owned agent tools call these methods directly.

roomle-ui owns the implementation, types, tool schemas and tests. These references are kept in
roomle-configurator-mcp alongside the example integration.

## Documentation map

Each contract has one home; the other documents link to it.

| Document | Owns |
|---|---|
| This overview | Embedding access, shared lifecycle, context, ownership and source locations |
| [queryConfigurationOperation](query-configuration-operation.md) | Query names, payloads, results, docking sources and read errors |
| [executeConfigurationOperation](execute-configuration-operation.md) | Operation names, payloads, results, history outcomes and write errors |
| [Configurator capabilities](get-configurator-capabilities.md) | Capability sections, discovery, declared/current choices and partial catalog results |
| [Example integration](configurator-example-with-planning-assistant-chat.md) | Static launcher, host page and assistant startup |
| [Assistant guide](../../docs/configurator-assistant.md) | Running the example, model configuration and deployment compatibility |

## Embedding access and tool calls

For a native configurator embedding, call either operation API through `instance.extended`.
In a planner editing a native object in isolation, use `instance.configurator`, which addresses the
planner's inner configurator. The embedding handshake announces SDK prototype methods and builds
the host proxies automatically.

The browser assistant takes this path:

```text
Host embedding assistant
  → getConfiguratorAgentTools / callConfiguratorAgentTool
  → configurator SDK tool registry
  → queryConfigurationOperation / executeConfigurationOperation
  → dynamically imported common-core/src/mcp-api/configuration-operations.ts
  → kernel access, RAPI and native scene/history services
```

The registry exposes eight reads, six writes, undo and redo. Each API catalog gives the
corresponding tool name. Tools validate their inputs and return JSON text in MCP-shaped content.
Tool result adaptations are specified in the
[query catalog](query-configuration-operation.md#query-catalog) and the
[execution reference](execute-configuration-operation.md#history-and-completion).

The example forwards tool discovery and calls through the embedding channel. SDK tool definitions
ship with roomle-ui; adding a tool updates its registry, schemas, descriptions and SDK tests.
The embedding integration needs no page-maintained method list or server allow-list.
See [ADR 0002](../decisions/0002-configurator-tools-run-in-the-sdk.md) for the ownership decision.

## Native operation boundary

The two generic methods provide an operation surface independent of UI selection and pointer
interaction. Existing typed SDK methods continue to serve the UI and provide reusable internal
operations. Agent reads and writes do not replay mouse-drag gestures.

RoomleCore supplies the pure `getDockPairs` read and the `dockNewComponent` create-and-dock
primitive. Kernel access wraps those APIs alongside existing parameter, deletion and docking
operations. Scene management owns configuration replacement and history. The API references
specify the payloads and results for each path.

## Shared lifecycle and serialization

Both APIs require an active native configuration with a kernel root component. A planner must be
in isolation. An unloaded configurator, a planner outside isolation, an external HI object or a
missing root rejects with an actionable error. External objects use the HI external-object API.

The methods load their implementation on demand. Queries and executions join the same SDK
operation chain, so calls through these APIs run one at a time. A rejected call does not prevent
later calls from running. Direct user edits can still change the session during asynchronous
work; serialization does not freeze the UI.

A session captures the active object, root, selection and configuration hash. Freshness checks
also account for the root-parameter scope. A stale read rejects; executions that read parameters
or resolve a docking child check freshness before applying the mutation. The API references
describe the respective errors and recovery.

## Shared context and JSON data

Every query and execution result includes `type` and `context`.
`type` echoes the query or operation name. `context` has these fields:

| Field | Meaning |
|---|---|
| `configurationRuntimeId` | Active plan-object runtime ID |
| `rootRuntimeId` | Root component runtime ID |
| `rootComponentId` | Root catalog component ID |
| `selectedRuntimeIds` | Captured selected component runtime IDs |
| `configurationHash` | Hash of the captured configuration |

Runtime IDs address instances in the live session; catalog IDs identify definitions or item
presets. They are not interchangeable. Query context describes the read snapshot; execution
context describes the state before the operation. Executions also return the resulting
configuration hash.

Returned data is detached JSON without live kernel handles or mutable cache references.
Changing a returned object cannot update the configurator. Parameter values retain the kernel's
serialization and units.

## Source map

Paths below belong to roomle-ui. The links point to its configuration-assistant branch.

| Area | Source |
|---|---|
| Thin public SDK methods | [configurator-core/src/roomle-configurator.ts](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts) |
| Validation, shared chain, query and execution dispatch | [common-core/src/mcp-api/configuration-operations.ts](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/packages/web-sdk/packages/common-core/src/mcp-api/configuration-operations.ts) |
| Payload and result unions, exported type-only from the web-sdk index | [common-core/src/mcp-api/configuration-operations-types.ts](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/packages/web-sdk/packages/common-core/src/mcp-api/configuration-operations-types.ts) |
| Tool registration, result adaptation and input schemas | [configurator-core/src/configurator-mcp/](https://github.com/roomle-dev/roomle-ui/tree/feat/configuration-assistant/packages/web-sdk/packages/configurator-core/src/configurator-mcp) |
| Kernel wrappers and DTOs | [common-core/src/configurator-kernel-access.ts](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/packages/web-sdk/packages/common-core/src/configurator-kernel-access.ts), [typings/kernel.ts](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/packages/web-sdk/packages/typings/kernel.ts) |
| SDK method announcement and host proxy construction | [src/configurator/embedding/exposed-api.ts](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/src/configurator/embedding/exposed-api.ts), [packages/embedding-lib/src/connector.ts](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/packages/embedding-lib/src/connector.ts) |

The SDK [operation tests](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/packages/web-sdk/packages/common-core/__tests__/mcp-api/configuration-operations.ts)
cover payload validation, active targets, detached reads, docking sources, stale sessions,
serialization, mutations and committed history.
The [registry tests](https://github.com/roomle-dev/roomle-ui/blob/feat/configuration-assistant/packages/web-sdk/packages/configurator-core/__tests__/configurator-mcp/configurator-mcp-tools.ts)
cover tool discovery, forwarding and result adaptation. This repository tests the example and
launcher; it does not duplicate SDK tool tests.
