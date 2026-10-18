# The roomle-ui configurator API for the MCP server

The configurator MCP server is restricted to the public API of roomle-ui's `RoomleConfigurator`: its
tools call configurator methods through the example page's bridge, and the page executes them on
`instance.extended`. Today the bridge allow-lists exactly four methods — `undo`, `redo`,
`getConfiguratorCapabilities` and `queryConfigurationOperation`
(`configurator-mcp/configurator-mcp-server/configurator-api.ts`,
`minimal-configurator-example/index.html:40`). The agent-facing surface is two generic APIs
— `queryConfigurationOperation(type, payload)` for everything the agent reads,
`executeConfigurationOperation(name, payload)` for everything it does — because the agent may do
everything slightly differently from a user in the UI and may have more options and tools available
than the UI offers. This page is the map between what an AI agent needs to configure a Roomle object
— the information it must be able to query at any time and the operations it must be able to perform
— and the API that exists today: which parts the existing methods already cover, and which parts are
missing and have to be implemented. The query half of the proposal is implemented end to end
(RoomleCore `getDockPairs` → roomle-ui `queryConfigurationOperation` → the eight MCP read tools); the
execute half and its catalog remain a proposal — where this page describes them, it says so.

Paths under `packages/web-sdk/packages/` are relative to that folder of the roomle-ui repository
(`configurator-core/`, `common-core/`, `planner-core/`, `typings/`). Paths of the MCP server are relative
to this repository. Line numbers describe the examined revisions: roomle-ui `bef234caf` (the branch
that added `getConfiguratorCapabilities`) and this repository at `0b13f9c`.

## How an MCP tool reaches the configurator

Today:

1. A tool executor in `configurator-mcp/configurator-mcp-server/tool-executors.ts` calls a method of
   `configurator-api.ts` — `undo`, `redo`, `getConfiguratorCapabilities` or
   `queryConfigurationOperation` — which relays the call over the `/bridge` WebSocket to the connected page.
2. The page executes the call on `instance.extended` — but only for methods in its `CONFIGURATOR_METHODS`
   allow-list (`minimal-configurator-example/index.html:40`). The server names the same methods in
   `configurator-mcp/configurator-mcp-server/configurator-api.ts`.
3. `instance.extended` is the embedding-lib proxy of the SDK
   (`packages/embedding-lib/src/connector.ts:46`). The Rubens UI announces every public prototype method
   of `RoomleConfigurator` to the embedding host automatically
   (`src/configurator/embedding/exposed-api.ts:387`), so a new public method needs no handwritten
   exposure list in the SDK — only the two MCP-side allow-lists above.
4. In the planner's isolation mode the same methods run on the planner's inner configurator
   (`planner-core/src/roomle-planner.ts:711`, `getConfiguratorApi`), exposed as `instance.configurator`.

Implemented for the query half — every read tool is one `queryConfigurationOperation` call (see the
query catalog below); the `get-configurator-capabilities` tool routes through
`queryConfigurationOperation('capabilities', …)`, preserving its `include` argument and result
contract. `undo`, `redo` and `getConfiguratorCapabilities` stay on the allow-list until the execute
half lands; with it, the allow-list is restricted to exactly the two generic names.

Adding a tool whose configurator method the page does not expose yet: add the method to
`configurator-api.ts` and to `CONFIGURATOR_METHODS` in `minimal-configurator-example/index.html`
([AGENTS.md](../../AGENTS.md#adding-new-tools), "Adding New Tools", step 3).

## Where new API lives in roomle-ui

- **Interface** — public methods on `RoomleConfigurator`
  (`configurator-core/src/roomle-configurator.ts`).
- **Implementation** — the heavy lifting is dynamically imported from `common-core/src/mcp-api/`:
  `getConfiguratorCapabilities` (`roomle-configurator.ts:1546`) imports
  `common-core/src/mcp-api/configurator-capabilities.ts` on first call. The dynamic import keeps the
  collector out of the main bundle; every agent-facing collector belongs there.
- **Pattern for section-selectable reads** — `getExternalObjectPlanContext(include?, options?)`
  (`planner-core/src/roomle-planner.ts:3185`): what is returned is configurable through the input
  arguments; an omitted or empty `include` returns everything.
- **Contract documentation** — `packages/embedding-lib/docs/configurator-capabilities.md` documents the
  capabilities read for embedders; every new agent-facing method needs the same kind of document.

## Queries the MCP server must run at any time

| # | Required information | Existing API | Status |
|---|---|---|---|
| 1 | Current configuration JSON | `getCurrentConfiguration()` (`roomle-configurator.ts:1627`); `getCurrentConfigurationHash()` (`roomle-configurator.ts:2130`) for change detection; `getHashOfSerializedConfiguration()` (`roomle-configurator.ts:2353`); `getConfiguratorCapabilities(['configuration'])` (`roomle-configurator.ts:1546`) | Covered |
| 2 | Current parameters of a component | `getParametersOfComponent(runtimeId)` (`roomle-configurator.ts:2365`), with `getParameterGroups()` (`roomle-configurator.ts:2252`) | Covered |
| 3 | Current global parameters of the configuration | `getParametersOfPlanObject()` (`roomle-configurator.ts:1563`), `getParametersOfRootComponent()` (`roomle-configurator.ts:1599`) | Covered |
| 4 | Possible children that can be docked to the configuration | `getChildrenOfPlanComponent(runtimeId, onlyPossible, onlyVisible)` (`roomle-configurator.ts:2503`), `getChildrenOfPlanObject(onlyPossible, onlyVisible)` (`roomle-configurator.ts:2525`) — possible children enriched with catalog data plus the default child; the capabilities `docking` section lists the currently offered children | Covered |
| 5 | Possible docking positions for a given set of possible children, including insert positions | None that is a pure read. The kernel computes dock pairs only inside the dock-preview machinery: `requestComponentDockPreview` / `requestItemDockPreview` (`typings/kernel.ts:738`, `:746`) start a docking process — they create a preview component, a ghost in the scene (`Editor3dAddDockPreview`, `common-core/src/configurator-kernel-access.ts:101`), are driven by a `DragEvent` and the pointer position, cancel the current selection, and report the pairs through the preview callbacks (`Editor3dSetPreviewAssociations`, `configurator-kernel-access.ts:108`, `:1383`). That is the mouse-drag UX (`previewDockings`, `roomle-configurator.ts:968`; `requestDockingsPreview`, `configurator-scene-manager.ts:1491`). Using it to query would draw previews in the scene — not wanted; the agent needs no preview ghost. The kernel's `getDockPairs(targetObjectId, dockingEntity, allowInsertInBetween)` (embind) is the pure read: it runs `DockPreview::evaluate` without constructing a preview, drawing points or lines, or changing configuration, selection or history; roomle-ui types it in `typings/kernel.ts` and wraps it in `configurator-kernel-access.ts` | Covered — the kernel's `getDockPairs` computes the dock pairs without constructing a preview; `queryConfigurationOperation('dockingPositions', …)` and the `get-docking-positions` tool wrap it |
| 6 | Components that can be deleted, including which child components are deleted with re-dock enabled and disabled | The kernel already answers the impact: `determinePlanComponentsThatWillBeDeleted(planComponentId, tryDockChildrenToParent)` returns exactly the components deleted in each re-dock case (RoomleCore `interfaces/emscripten/definition/configurator.json:3105` → `ConfiguratorKernel::determinePlanComponentsThatWillBeDeleted`, `src/configurator/configurator-kernel.h:396`). Deletability is on the component DTO: `permissionToDelete`, `permissionToDeleteInIsolation` (`typings/kernel.ts:443`), readable through `getComponent(runtimeId)` (`roomle-configurator.ts:2761`). The query is typed in roomle-ui's `typings/kernel.ts` and wrapped in `configurator-kernel-access.ts` (`determineComponentsThatWillBeDeleted`, `isComponentDeletable`), public through `queryConfigurationOperation('deleteImpact', …)` | Covered — typed and wrapped in the SDK (`isComponentDeletable`, `determineComponentsThatWillBeDeleted`); `queryConfigurationOperation('deleteImpact', …)` and the `get-delete-impact` tool wrap it |
| 7 | How a component can be dragged inside the configuration | `requestPreviewGeometry` (`typings/kernel.ts:776`) is the mouse-drag UX for an existing component: drag it with the pointer, preview ghosts show the drop positions (`previewDockingsWithDrag`, `configurator-kernel-access.ts:675`). For the agent, "how a component can be dragged" means which dock positions an existing component can be moved to — the same pure dock-pair query as #5, addressed at an existing component (the `{ runtimeId }` source of `getDockPairs`) | Covered — same kernel query as #5, addressed at an existing component (`componentDockingPositions`, `get-component-docking-positions`) |

Also covered: defining a complete configuration from a configuration JSON — `loadConfiguration` (`roomle-configurator.ts:1214`), `loadConfigurationById` (`roomle-configurator.ts:1234`), `loadConfigurableItemById` (`roomle-configurator.ts:1252`); undo and redo — `undo()` / `redo()` (`roomle-configurator.ts:2318` / `:2327`), already MCP tools; `saveCurrentConfiguration()` (`roomle-configurator.ts:1051`) and `getShortUrlOfCurrentConfiguration()` (`roomle-configurator.ts:1679`) for persisting and sharing; `getConfiguratorSettings()` (`roomle-configurator.ts:2259`) for configurator-level settings.

## Operations the MCP server must perform

| # | Required operation | Existing API | Status |
|---|---|---|---|
| 1 | Change a global parameter of the configuration | `setParameterOfRootComponent(parameter, value)` (`roomle-configurator.ts:1578`), `setParameterOfPlanObject(parameter, value)` (`roomle-configurator.ts:1443`); `setParameter(parameter, value, isRaw)` (`roomle-configurator.ts:1366`) targets the selected component or the plan object | Covered — the methods take a `KernelParameter`; the MCP payload needs key and type, both available from `getParametersOfComponent` / `getParametersOfPlanObject` |
| 2 | Change a component parameter | `setComponentParameter(runtimeId, parameter, value)` (`roomle-configurator.ts:2287`), `updateComponentParameter(runtimeId, key, value)` (`roomle-configurator.ts:2931`) | Covered |
| 3 | Dock or insert a component | Not as the UI does it. `dockComponent` (`typings/kernel.ts:824`; SDK `configurator-kernel-access.ts:570`) only docks a component that is already loaded free-flying — in the UI that is the preview component created by the drag; it does not create a component. The kernel's create-and-dock primitive exists but is unwrapped: `loadPlainComponent(conversationId, componentId, serializedComponent)` (RoomleCore `configurator.json:2887`) → `ConfiguratorKernel::loadComponentAndDockNewPlanComponents` (`src/configurator/configurator-kernel.cpp:1120`) creates a new plan component from a definition and docks it; `dockComponentWithPosition` (`configurator.json:3073`) docks an existing component at a dock pair with insert enabled. The MCP operation creates a new component from an item id / component definition / configuration JSON and docks it at a position queried before — no preview ghost, no mouse drag | **Gap** — type and wrap the kernel primitives; compose create + dock |
| 4 | Delete a component with re-dock enabled or disabled | Kernel: `deleteComponent(planComponentId, redockChildrenToParent)` — "Deletes a single PlanComponent and all its children or tries to dock its children back to the parent" (RoomleCore `configurator.json`; `typings/kernel.ts:762`). The SDK wraps only `deleteMultipleComponents` without the flag (`configurator-kernel-access.ts:934` → `typings/kernel.ts:764`); `RoomleConfigurator.requestDeleteComponent()` (`roomle-configurator.ts:998`) deletes the selected component only | **Gap** — wrap the flagged kernel delete |
| 5 | Drag a component inside the configuration | For the agent this is a move: re-dock an existing component at a queried position. Kernel: `dockComponent` / `dockComponentWithPosition` (`typings/kernel.ts:824`; RoomleCore `configurator.json:3073`), `cancelDocking(componentId, undoDrag)` to abort (`typings/kernel.ts:784`). The UI's drag preview (`requestPreviewGeometry`) is not used — the positions come from the pure query #7 | **Gap** — wrap dock-with-position for existing components |

## The design: two generic APIs

The agent may do everything slightly differently from a user in the UI, and it may have more options
and tools available than the UI offers. The UI's interaction model — selecting a possible child,
dragging it with the mouse, watching preview ghosts, dropping it — cannot be replayed by tools: the
agent needs no preview ghost and does not drag with the mouse; it performs operations through tools.
roomle-ui therefore proposed two generic APIs that carry everything the MCP tools need:

- `queryConfigurationOperation(type, payload)` — a read. `type` selects the query, `payload` carries
  the arguments (e.g. a component runtime id), the result is the requested information as JSON.
  **Implemented** — thin and typed on `RoomleConfigurator` (`roomle-configurator.ts`), dynamically
  imported from `common-core/src/mcp-api/configuration-operations.ts`, with the eight MCP read tools
  on top.
- `executeConfigurationOperation(name, payload)` — a write. `name` selects the operation, `payload`
  carries its arguments (e.g. component id, parameter key, new value), the result confirms the
  operation. **Proposed** — not implemented yet.

Both are thin, typed methods on `RoomleConfigurator` (`roomle-configurator.ts`); the
implementations are dynamically imported from `common-core/src/mcp-api/`, following
`getConfiguratorCapabilities` (`:1546`) and the `getExternalObjectPlanContext` pattern
(`planner-core/src/roomle-planner.ts:3185`). With the execute half implemented, the MCP server is
restricted to these two methods: every tool is one `queryConfigurationOperation` or
`executeConfigurationOperation` call relayed through the page bridge, and the page allow-list names
exactly these two. Today the allow-list carries `undo`, `redo`, `getConfiguratorCapabilities` and
`queryConfigurationOperation`. The `capabilities` query preserves the existing
`get-configurator-capabilities` tool — same `include` argument, same result contract with `complete`
and `unresolved`.

### Query catalog

All eight rows are implemented end to end: RoomleCore `getDockPairs` → roomle-ui
`queryConfigurationOperation` (dynamically imported from `common-core/src/mcp-api/configuration-operations.ts`)
→ one MCP read tool per row. The operation catalog below remains a proposal.

| `type` | Payload | Returns | Implementation basis | Status |
|---|---|---|---|---|
| `capabilities` | `{ include? }` | the capabilities JSON: `context`, `complete`, `unresolved` and the requested sections — recursive component definitions, item presets, declared alternatives, parameter declarations, material metadata, docking constraints | existing `getConfiguratorCapabilities()` (`roomle-configurator.ts:1546`) and its collector (`common-core/src/mcp-api/configurator-capabilities.ts`) — preserves the `include` argument and the result contract (`docs/configurator-mcp-server.md`) | Implemented — the `get-configurator-capabilities` tool routes through it |
| `configuration` | — | current configuration JSON + hash | `getCurrentConfiguration()` (`roomle-configurator.ts:1627`), `getCurrentConfigurationHash()` (`:2130`) — synchronous, no wait | Implemented — `get-configuration` |
| `componentParameters` | `{ runtimeId }` | current parameters incl. groups | `getParametersOfComponent()` (`:2365`) | Implemented — `get-component-parameters` |
| `globalParameters` | — | current global parameters | `getParametersOfPlanObject()` (`:1563`), `getParametersOfRootComponent()` (`:1599`) | Implemented — `get-global-parameters` |
| `possibleChildren` | `{ runtimeId? }` | possible children incl. default child | `getChildrenOfPlanComponent()` (`:2503`), `getChildrenOfPlanObject()` (`:2525`) | Implemented — `get-possible-children` |
| `dockingPositions` | `{ child: { componentId \| itemId \| configuration }, allowInsertInBetween? }` | dock pairs (parent/child dock ids, position, rotation, `insertInBetween`, `displacedComponents`) without touching the scene | the kernel's `getDockPairs(targetObjectId, dockingEntity, allowInsertInBetween)` (RoomleCore embind) runs `DockPreview::evaluate` without constructing a preview | Implemented — `get-docking-positions` |
| `deleteImpact` | `{ runtimeId, redockChildrenToParent }` | `{ deletable, componentsDeleted }` | kernel `determinePlanComponentsThatWillBeDeleted` (RoomleCore `configurator.json:3105`) + `permissionToDelete` (`typings/kernel.ts:443`) — typed and wrapped in the SDK | Implemented — `get-delete-impact` |
| `componentDockingPositions` | `{ runtimeId, allowInsertInBetween? }` | dock pairs an existing component can be moved to | same kernel query as `dockingPositions`, addressed at an existing component | Implemented — `get-component-docking-positions` |

### Operation catalog

Proposed — no operation is implemented yet; `undo` and `redo` remain the only configuration-changing
tools, and the allow-list restriction to the two generic names happens with this catalog.

| `name` | Payload | Does | Implementation basis |
|---|---|---|---|
| `changeGlobalParameter` | `{ key, type, value }` | changes a global parameter of the configuration | `setParameterOfRootComponent()` / `setParameterOfPlanObject()` (`roomle-configurator.ts:1578`, `:1443`) |
| `changeComponentParameter` | `{ runtimeId, key, type, value }` | changes a component parameter | `setComponentParameter()` (`:2287`), `updateComponentParameter()` (`:2931`) |
| `dockComponent` | `{ child: { componentId \| itemId \| configuration }, parentRuntimeId, parentDockId, childDockId, position?, insertInBetween? }` | creates the component and docks it at a queried position — no preview, no drag | kernel `loadPlainComponent` (RoomleCore `configurator.json:2887`) + `dockComponent` / `dockComponentWithPosition` (`typings/kernel.ts:824`, RoomleCore `configurator.json:3073`) — type, wrap, compose |
| `deleteComponent` | `{ runtimeId, redockChildrenToParent }` | deletes the component; children re-docked to the parent or deleted with it | kernel `deleteComponent(planComponentId, redockChildrenToParent)` (`typings/kernel.ts:762`) — wrap |
| `dragComponent` | `{ runtimeId, parentRuntimeId, parentDockId, childDockId, position? }` | moves an existing component to a queried position | `dockComponentWithPosition` (RoomleCore `configurator.json:3073`); `cancelDocking` aborts (`typings/kernel.ts:784`) |

Also available through the operations: `loadConfiguration` (define a complete configuration from a
JSON, `roomle-configurator.ts:1214`) and `undo` / `redo` (`:2318` / `:2327`, already MCP tools).

### Why the existing typed methods are not the MCP-facing surface

The existing typed methods stay — they drive the UI. But several of them are bound to the UI
interaction model (`previewDockings` needs a `DragEvent` and the UI-selected possible child,
`requestDeleteComponent` acts on the selection, `dockComponent` needs a free-flying preview
component), and the agent's operation set is different and larger (create-and-dock, delete impact,
re-dock/move, pure docking-position reads). The proposed pair keeps the MCP tool surface stable while
the SDK internals — and the kernel underneath — evolve, and it lets one allow-list entry carry every
tool. Where a typed method already fits, the implementation behind the generic API reuses it.

### Kernel work

- The pure dock-pair query is implemented: `getDockPairs(targetObjectId, dockingEntity,
  allowInsertInBetween)` (embind) runs `DockPreview::evaluate`
  (`src/configurator/internal/docking/dock-preview.cpp`) for a possible child — component
  definition or assembly configuration — or an existing component, and returns the existing
  `DockPairPreviewArray` DTO without constructing a preview, drawing points or lines, or changing
  configuration, selection or history. The transient docking component for a possible child is
  created through the same path as the preview flow and removed after the evaluation.
- Proposed for the execute half: `loadPlainComponent` passes no dock target (parentId 0); either
  expose `loadComponentAndDockNewPlanComponents` with a parent/dock pair, or compose it with
  `dockComponent` in the SDK — the component is briefly free-flying between the two calls.
- `determinePlanComponentsThatWillBeDeleted` is typed and wrapped in the SDK for the `deleteImpact`
  query; `dockComponentWithPosition` and `loadPlainComponent` are still exposed by the kernel but
  missing from roomle-ui's `typings/kernel.ts` — type them with the execute half.

**Simplified docking for the agent.** Docking by dock ids and positions is the UI-level primitive;
the agent needs a simpler relation-based docking, as the HI MCP server provides with its group
relations tool. That simplification is a possible later tool layer on top of the `dockingPositions`
query + the `dockComponent` operation — pick the valid dock pair from the query result instead of
making the agent compute it — and can draw on the docking logic in RoomleCore
(`src/configurator/internal/docking/dock-configurator.cpp`).

The full analysis of the two generic APIs:
[Query and execute configuration operation](../feature-analysis/query-and-execute-configuration-operation.md).

## Files and documents the implementation touches

roomle-ui:

- `configurator-core/src/roomle-configurator.ts` — the query method (thin, typed); the operation
  method remains to be added with the execute half
- `common-core/src/mcp-api/` — the dynamically imported query implementation and its types
  (`configuration-operations.ts`, `configuration-operations-types.ts`); the operation implementation
  remains to be added
- `packages/web-sdk/packages/typings/kernel.ts` — `getDockPairs` and
  `determinePlanComponentsThatWillBeDeleted` typed; `dockComponentWithPosition` and
  `loadPlainComponent` remain to be typed with the execute half
- tests under `packages/web-sdk/packages/*/__tests__/` and `tests/unit/`
- `packages/embedding-lib/docs/` — the contract document for the query API
  (`configuration-operations.md`); the operation API needs its half of the document

RoomleCore:

- the pure dock-pair query `getDockPairs` (implemented; the computation lives in
  `src/configurator/internal/docking/dock-preview.cpp` and runs today only when a preview is
  constructed) with Catch2 tests in `test/configurator/internal/docking/dock-pair-query-test.cpp`
- possibly `loadComponentAndDockNewPlanComponents` with a dock target, if composing
  `loadPlainComponent` + `dockComponent` proves insufficient (execute half)

roomle-configurator-mcp:

- `configurator-mcp/configurator-mcp-server/configurator-api.ts` and `tool-executors.ts` — the
  eight read tools for the query catalog above
- `minimal-configurator-example/index.html` — the page allow-list (`undo`, `redo`,
  `getConfiguratorCapabilities`, `queryConfigurationOperation`; the restriction to the two generic
  method names happens with the execute half)
- [`docs/configurator-mcp-server.md`](../../docs/configurator-mcp-server.md) and
  [`.agents/skills/configurator-mcp-server.md`](../skills/configurator-mcp-server.md) — the tool
  reference
- one tool per query row, registered in `configurator-mcp-server.ts`, named in the server
  instructions and the chat system prompt; the operation rows get their tools with the execute half

## Verification

- web-sdk unit tests for every implemented query, including the pure dock-pair read (done); the
  create-and-dock composition belongs to the execute half
- MCP tool tests against the fake page socket (`configurator-mcp/configurator-mcp-server/tests/`)
  and the chat recovery tests (`configurator-mcp/configurator-mcp-chat/tests/`)
- a live Chromium run against a local UI and MCP with `usm:frame`, as for the capabilities tool:
  query the docking positions and the delete impact and read back — correct current values, and no
  preview ghosts left in the scene; dock, delete and undo/redo join the run with the execute half
- the repository gates: `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `node .agents/scripts/check-markdown-links.js` on changed markdown, and roomle-ui's SDK and UI type
  checks and builds
