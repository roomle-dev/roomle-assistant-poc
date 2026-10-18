# The roomle-ui configurator API for the MCP server

The configurator MCP server is restricted to the public API of roomle-ui's `RoomleConfigurator`: its
tools call configurator methods through the example page's bridge, and the page executes them on
`instance.extended`. This page is the map between what an AI agent needs to configure a Roomle object —
the information it must be able to query at any time and the operations it must be able to perform —
and the API that exists today: which parts the existing methods already cover, and which parts are
missing in roomle-ui and have to be implemented there.

Paths under `packages/web-sdk/packages/` are relative to that folder of the roomle-ui repository
(`configurator-core/`, `common-core/`, `planner-core/`, `typings/`). Paths of the MCP server are relative
to this repository. Line numbers describe the examined revisions: roomle-ui `bef234caf` (the branch
that added `getConfiguratorCapabilities`) and this repository at `0b13f9c`.

## How an MCP tool reaches the configurator

1. A tool executor in `configurator-mcp/configurator-mcp-server/tool-executors.ts` calls a method of
   `configurator-api.ts`, which relays it over the `/bridge` WebSocket to the connected page.
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
| 5 | Possible docking positions for a given set of possible children, including insert positions | Kernel: `requestComponentDockPreview` / `requestItemDockPreview` (`typings/kernel.ts:738`, `:746`) answer with `KernelDockPairPreview[]` — parent/child dock ids, position, rotation, `insertInBetween`, `displacedComponents` (`typings/kernel.ts:567`) — delivered through the `Editor3dSetPreviewAssociations` callback (`common-core/src/configurator-kernel-access.ts:108`, `:1383`). SDK wrapper: `webGlPreviewDockingsForPlanObject` (`configurator-kernel-access.ts:632`). Public: only `previewDockings(dragEvent?, dragIn?)` (`roomle-configurator.ts:968`), which needs a DOM `DragEvent` and the UI-selected possible child (`common-core/src/webgl/configurator-context.ts:14`, `lastPossibleChild`) | **Gap** — no promise-based, component-addressed query |
| 6 | Components that can be deleted, including which child components are deleted with re-dock enabled and disabled | Deletability is on the kernel component DTO: `permissionToDelete`, `permissionToDeleteInIsolation` (`typings/kernel.ts:443`), readable through `getComponent(runtimeId)` (`roomle-configurator.ts:2761`); the subtree is `childIds` (`typings/kernel.ts:450`). The kernel delete carries the flag: `deleteComponent(componentId, redockChildrenToParent)` (`typings/kernel.ts:762`). Public: only `requestDeleteComponent()` (`roomle-configurator.ts:998`) — deletes the *selected* component, no flag, no impact information | **Gap** — no per-component delete information, no delete with an explicit re-dock flag |
| 7 | How a component can be dragged inside the configuration | Kernel: `requestPreviewGeometry(componentId, planObjectId, allowInsertInBetween)` (`typings/kernel.ts:776`), SDK wrapper `previewDockingsWithDrag` (`configurator-kernel-access.ts:675`). Public: `selectComponent(runtimeId)` (`roomle-configurator.ts:2272`) and `getCurrentSelection()` (`roomle-configurator.ts:2136`) only | **Gap** — no public drag query |

Also covered: defining a complete configuration from a configuration JSON — `loadConfiguration` (`roomle-configurator.ts:1214`), `loadConfigurationById` (`roomle-configurator.ts:1234`), `loadConfigurableItemById` (`roomle-configurator.ts:1252`); undo and redo — `undo()` / `redo()` (`roomle-configurator.ts:2318` / `:2327`), already MCP tools; `saveCurrentConfiguration()` (`roomle-configurator.ts:1051`) and `getShortUrlOfCurrentConfiguration()` (`roomle-configurator.ts:1679`) for persisting and sharing; `getConfiguratorSettings()` (`roomle-configurator.ts:2259`) for configurator-level settings.

## Operations the MCP server must perform

| # | Required operation | Existing API | Status |
|---|---|---|---|
| 1 | Change a global parameter of the configuration | `setParameterOfRootComponent(parameter, value)` (`roomle-configurator.ts:1578`), `setParameterOfPlanObject(parameter, value)` (`roomle-configurator.ts:1443`); `setParameter(parameter, value, isRaw)` (`roomle-configurator.ts:1366`) targets the selected component or the plan object | Covered — the methods take a `KernelParameter`; the MCP payload needs key and type, both available from `getParametersOfComponent` / `getParametersOfPlanObject` |
| 2 | Change a component parameter | `setComponentParameter(runtimeId, parameter, value)` (`roomle-configurator.ts:2287`), `updateComponentParameter(runtimeId, key, value)` (`roomle-configurator.ts:2931`) | Covered |
| 3 | Dock or insert a component | Not public. Kernel: `dockComponent(childId, childDockId, parentId, parentDockId, position?)` (`typings/kernel.ts:824`); SDK: `dockComponent(parentId, parentDockId, childId, childDockId, position?)` (`configurator-kernel-access.ts:570`). Insert is a dock-preview property (`insertInBetween`), gated by the `advancedDocking` feature flag (`configurator-kernel-access.ts:628`) | **Gap** — no public dock/insert on `RoomleConfigurator` |
| 4 | Delete a component with re-dock enabled or disabled | Not public with the flag. Kernel: `deleteComponent(componentId, redockChildrenToParent)` (`typings/kernel.ts:762`); the SDK's `requestDeleteComponents(ids)` (`configurator-kernel-access.ts:934`) calls `deleteMultipleComponents` without the flag (`typings/kernel.ts:764`) | **Gap** |
| 5 | Drag a component inside the configuration | Not public. Kernel: `requestPreviewGeometry` (`typings/kernel.ts:776`) for the possible drag dockings, `dockComponent` with a position for the drop, `cancelDocking(componentId, undoDrag)` to abort (`typings/kernel.ts:784`); SDK: `previewDockingsWithDrag` (`configurator-kernel-access.ts:675`), `cancelDocking` (`configurator-kernel-access.ts:683`) | **Gap** |

## Assessment: reuse the existing API, and whether two new APIs make sense

**Reuse.** Queries 1–4 and operations 1–2 are covered by existing typed methods; the MCP server calls
them through the bridge and adds them to the allow-lists — no roomle-ui change needed for those. The
same holds for loading a configuration JSON and for undo and redo.

**Fill the gaps with typed methods, not with two dispatchers.** Adding
`queryConfigurationOperation(type, payload)` and `executeConfigurationOperation(name, payload)` as two
string-dispatched entry points is not the right shape for the SDK:

- The SDK's public API is TypeScript-typed and self-documenting for every embedding host; a
  string-dispatched method loses the types, the payload validation and the discoverability.
- The dispatch already exists one level down: the page bridge calls methods by name with an argument
  array (`minimal-configurator-example/index.html:111`), so the MCP server gets a generic call mechanism
  without the SDK paying for an untyped layer.
- The established pattern for agent-facing reads is a typed method with section selection —
  `getExternalObjectPlanContext(include, options)` and, following it, `getConfiguratorCapabilities(include)`.
- The missing queries are heterogeneous: docking positions need the kernel's callback-driven dock
  preview (`Editor3dSetPreviewAssociations`) wrapped in a promise, delete information needs the
  component DTO projected per re-dock case, drag dockings need `requestPreviewGeometry`. One dispatcher
  would hide three different collectors behind a single stringly-typed entry point; typed methods keep
  each collector independently testable and independently tree-shaken through the dynamic import.

**Proposed new public methods** — interface in `roomle-configurator.ts`, implementation dynamically
imported from `common-core/src/mcp-api/`:

| Method | Payload | Returns |
|---|---|---|
| `getDockingPositions` | `{ child: { componentId \| configuration }, dragIn, allowInsertInBetween? }` | `KernelDockPairPreview`-shaped JSON: dock ids, position, rotation, `insertInBetween`, `displacedComponents` |
| `getComponentDeleteInfo` | `{ runtimeId }` | `{ deletable, permissionToDelete, childrenDeletedWithRedock, childrenDeletedWithoutRedock }` |
| `getDragDockings` | `{ runtimeId }` | possible drop dockings for an existing component (`requestPreviewGeometry`) |
| `dockComponent` | `{ child: { componentId \| configuration }, parentId, parentDockId, childDockId, position?, insertInBetween? }` | resolves when the kernel docked the component |
| `deleteComponent` | `{ runtimeId, redockChildrenToParent }` | resolves when the kernel deleted the component |
| `dragComponent` | `{ runtimeId, parentId, parentDockId, childDockId, position? }` | a dock of an existing component at a new position; `cancelDocking` aborts a drag |

The delete information follows from the component tree: with re-dock disabled the whole subtree
(`childIds`, `typings/kernel.ts:450`) is deleted; with re-dock enabled the children move to the parent
and only the component itself is deleted. `permissionToDelete` (`typings/kernel.ts:443`) gates both.

**Simplified docking for the agent.** Docking by dock ids and positions is the UI-level primitive; the
agent needs a simpler relation-based docking, as the HI MCP server provides with its group relations
tool. That simplification is a further API layer on top of `getDockingPositions` + `dockComponent` —
pick the valid dock pair from the query result instead of making the agent compute it — and can draw on
the docking logic in RoomleCore (`src/configurator/internal/docking/dock-configurator.cpp`).

## Files and documents the implementation touches

roomle-ui:

- `configurator-core/src/roomle-configurator.ts` — the new public methods (thin, typed)
- `common-core/src/mcp-api/` — the dynamically imported implementations and their types
- `packages/web-sdk/packages/typings/kernel.ts` — only if a kernel method is genuinely missing (today
  the kernel already has dock, delete-with-flag, preview and cancel)
- tests under `packages/web-sdk/packages/*/__tests__/`
- `packages/embedding-lib/docs/` — the contract document for the new methods

roomle-configurator-mcp:

- `configurator-mcp/configurator-mcp-server/configurator-api.ts` and `tool-executors.ts` — the new tools
- `minimal-configurator-example/index.html` — the page allow-list
- [`docs/configurator-mcp-server.md`](../../docs/configurator-mcp-server.md) and
  [`.agents/skills/configurator-mcp-server.md`](../skills/configurator-mcp-server.md) — the tool
  reference
- one tool per row above, registered in `configurator-mcp-server.ts`, named in the server instructions
  and the chat system prompt

## Verification

- web-sdk unit tests for every new method, including the promise wrapping of the dock-preview callbacks
- MCP tool tests against the fake page socket (`configurator-mcp/configurator-mcp-server/tests/`)
- a live Chromium run against a local UI and MCP with `usm:frame`, as for the capabilities tool:
  query, dock, read back, undo, redo must return the correct current values
- the repository gates: `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `node .agents/scripts/check-markdown-links.js` on changed markdown, and roomle-ui's SDK and UI type
  checks and builds
