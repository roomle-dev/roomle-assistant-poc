# Query and execute configuration operation for the configurator MCP

> **Type:** Feature analysis
>
> **Ticket:** [RML-18085 — research roomle configurator mcp](https://roomle.atlassian.net/browse/RML-18085)
>
> **Date:** 2026-10-18
>
> **Author:** AI Assistant
>
> **Status:** Open
>
> **Scope:** the two generic roomle-ui APIs the MCP server's tools are built on

Affected repositories:

- **roomle-ui:** the two generic methods on `RoomleConfigurator`, their dynamically imported
  implementations in `common-core/src/mcp-api`, kernel typings, tests and embedding documentation.
- **RoomleCore:** exactly one new embind entry point — a synchronous, side-effect-free dock-pair query
  returning the existing `DockPairPreviewArray` DTO (no new callback, no new DTO, no signature
  changes); Catch2 kernel tests. Loading, waiting and cleanup around the query are composed in
  roomle-ui from existing kernel primitives — see the implementation plan at the end of this
  document.
- **roomle-configurator-mcp:** the MCP tools built on the two calls, the page allow-list, the tool
  reference and the skill.

## What was asked and why

The MCP server configures Roomle objects in the standalone configurator or the planner's isolation
mode. The agent is not a user in the UI: it has no mouse, it needs no preview ghosts, it may do
everything slightly differently, and it may have more options and tools available than the UI offers.
The UI's interaction model — selecting a possible child, dragging it with the mouse, watching the
docking previews, dropping it — cannot be replayed by tools. Therefore this analysis proposes two generic
APIs that carry all information and all operations the tools of the MCP server need:

- `queryConfigurationOperation(type, payload)` — specifies the type of query (e.g.
  `componentParameters`) and provides additional data in the payload (e.g. a component runtime id),
  returning the requested information.
- `executeConfigurationOperation(name, payload)` — manipulates a configuration by naming the
  operation (e.g. `changeComponentParameter`) and the necessary payload (e.g. component id, parameter
  key, new parameter value).

The interface lives in `packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts`; the
implementation lives in `packages/web-sdk/packages/common-core/src/mcp-api` and is dynamically
loaded, following the pattern of `getExternalObjectPlanContext` and of the already implemented
`getConfiguratorCapabilities`. The wiki page
[The roomle-ui configurator API for the MCP server](../wiki/roomle-configurator-api-for-mcp.md) maps
every query and operation to the existing API and names the gaps this analysis fills.

## How the area works today

Paths under `packages/web-sdk/packages/` are relative to that folder of roomle-ui
(`configurator-core/`, `common-core/`, `planner-core/`, `typings/`). RoomleCore paths are relative to
its repository root. Examined revisions: roomle-ui `bef234caf`, RoomleCore `master`, this repository
`0b13f9c`.

- The MCP server is restricted to the public API of `RoomleConfigurator`. Tools relay calls through
  the page bridge (`configurator-mcp/configurator-mcp-server/configurator-api.ts`), and the example
  page executes them on `instance.extended` within its `CONFIGURATOR_METHODS` allow-list
  (`minimal-configurator-example/index.html:40`). The Rubens UI announces every public prototype
  method automatically (`src/configurator/embedding/exposed-api.ts:387`); in planner isolation the
  same methods run on the inner configurator (`planner-core/src/roomle-planner.ts:711`).
- Today the server offers `get-configurator-capabilities`, `undo` and `redo`
  (`docs/configurator-mcp-server.md`). The capabilities read is a thin method on
  `RoomleConfigurator` (`roomle-configurator.ts:1546`) that dynamically imports the collector from
  `common-core/src/mcp-api/configurator-capabilities.ts` — the placement pattern for this work.
- The UI's docking flow is bound to the mouse: `previewDockings(dragEvent, dragIn)`
  (`roomle-configurator.ts:968`) → `requestDockingsPreview` (`configurator-scene-manager.ts:1491`) →
  `webGlPreviewDockingsForPlanObject` (`configurator-kernel-access.ts:632`) → kernel
  `requestComponentDockPreview` / `requestItemDockPreview` (`typings/kernel.ts:738`, `:746`). These
  calls start a docking process: the kernel constructs a preview component — a ghost in the scene
  (`Editor3dAddDockPreview`, `configurator-kernel-access.ts:101`) — computes dock pairs inside
  `DockPreviewRequest` (`src/configurator/internal/docking/dock-preview-request.*`,
  `possible-dock-pairs.*`), and reports them through `Editor3dSetPreviewAssociations`
  (`configurator-kernel-access.ts:108`, `:1383`). The drop docks that preview component: SDK
  `dockComponent` (`configurator-kernel-access.ts:570`) → kernel `dockComponent(id, dockId, parentId,
  parentDockId, position?)` (`typings/kernel.ts:824`), which only works because the preview component
  is already loaded free-flying. Dragging an existing component uses `requestPreviewGeometry`
  (`typings/kernel.ts:776`) with the same preview machinery.
- Delete: the kernel exposes `deleteComponent(planComponentId, redockChildrenToParent)` ("Deletes a
  single PlanComponent and all its children or tries to dock its children back to the parent",
  `interfaces/emscripten/definition/configurator.json`) and
  `determinePlanComponentsThatWillBeDeleted(planComponentId, tryDockChildrenToParent)`
  (`configurator.json:3105` → `ConfiguratorKernelEmc::determinePlanComponentsThatWillBeDeleted`,
  `interfaces/emscripten/configurator/configuratorEmscriptenInterface.h:699` →
  `ConfiguratorKernel::determinePlanComponentsThatWillBeDeleted`,
  `src/configurator/configurator-kernel.h:396`). The SDK wraps only `deleteMultipleComponents`
  without the flag (`configurator-kernel-access.ts:934` → `typings/kernel.ts:764`), and
  `RoomleConfigurator.requestDeleteComponent()` (`roomle-configurator.ts:998`) acts on the selection.
- Create-and-dock: the kernel exposes `loadPlainComponent(conversationId, componentId,
  serializedComponent)` (`configurator.json:2887` → `ConfiguratorKernelEmc::loadPlainComponent`,
  `configuratorEmscriptenInterface.h:497` → `ConfiguratorKernel::loadComponentAndDockNewPlanComponents`,
  `src/configurator/configurator-kernel.cpp:1120`), which creates a new plan component from a
  definition and docks it. It is unused and untyped in roomle-ui.
- roomle-ui's `typings/kernel.ts` does not type `determinePlanComponentsThatWillBeDeleted`,
  `dockComponentWithPosition` (`configurator.json:3073`) or `loadPlainComponent`, although the kernel
  exposes them.

## The gap

- **No pure docking-positions query.** Dock pairs exist only inside the preview machinery, which
  mutates the scene (preview ghost), cancels the selection and is driven by pointer events. A query
  must not start a docking process or draw previews. Neither kernel exposes a side-effect-free
  dock-pair read (the planner kernel's only docking-adjacent function is
  `createPreviewGeometryForAddOn`).
- **`dockComponent` docks only an already-loaded free-flying component** (the preview component in
  the UI). There is no public operation that creates a component and docks it at a chosen position.
- **The delete-impact query and the flagged delete exist in the kernel** but are not reachable from
  the SDK's public API; the SDK's delete wrapper has no re-dock flag.
- **The agent's operation set differs from the UI's** (create-and-dock, delete impact, re-dock/move,
  pure reads), so the UI's typed methods are not the MCP-facing surface.

## Proposed design

Two thin, typed methods on `RoomleConfigurator`, implementations dynamically imported from
`common-core/src/mcp-api/` (new files, e.g. `configuration-operations.ts` plus a types file):

- `queryConfigurationOperation(type, payload)` — read-only; rejects when the target or the state
  changes during the read (as the capabilities read does); never changes selection, configuration or
  history. Catalog: `capabilities`, `configuration`, `componentParameters`, `globalParameters`,
  `possibleChildren`, `dockingPositions`, `deleteImpact`, `componentDockingPositions`. The
  `capabilities` query delegates to the existing `getConfiguratorCapabilities()`
  (`roomle-configurator.ts:1546`) and its collector (`common-core/src/mcp-api/configurator-capabilities.ts`),
  preserving its `include` argument and its result contract (`complete`, `unresolved` and the requested
  sections, `docs/configurator-mcp-server.md:104`), so the existing `get-configurator-capabilities`
  tool keeps its product discovery once the bridge is restricted to the two generic methods.
- `executeConfigurationOperation(name, payload)` — mutating; one operation at a time; lands in the
  undo history; resolves after the kernel processed the operation. Catalog: `changeGlobalParameter`,
  `changeComponentParameter`, `dockComponent`, `deleteComponent`, `dragComponent`, plus
  `loadConfiguration`, `undo`, `redo`.

Implementation notes:

- Reuse the existing typed methods where they fit: configuration JSON and hash
  (`roomle-configurator.ts:1627`, `:2130`), component and global parameters (`:2365`, `:1563`,
  `:1599`), possible children (`:2503`, `:2525`), parameter changes (`:1578`, `:1443`, `:2287`,
  `:2931`), `loadConfiguration` (`:1214`), `undo`/`redo` (`:2318`, `:2327`).
- Type and wrap the exposed kernel primitives in `typings/kernel.ts` and the mcp-api implementation:
  `determinePlanComponentsThatWillBeDeleted`, `dockComponentWithPosition`, `loadPlainComponent`,
  `loadFreeFlyingConfiguration`, and `deleteComponent` with its re-dock flag. The create-and-dock
  operation composes `loadPlainComponent` / `loadFreeFlyingConfiguration` + `dockComponentWithPosition`
  in the SDK (the new runtime id is captured from the existing `Editor3dComponentCreated` callback,
  so no kernel signature changes); the move operation is `dockComponentWithPosition` on the existing
  component — the kernel's `DockOperator::dock` undocks a docked child when re-docking
  (`src/configurator/internal/docking/dock-operator.cpp:146`).
- The pure dock-pair query needs exactly one new RoomleCore embind entry point — a synchronous
  `getDockPairsForDockingEntity(targetObjectId, dockingEntityId, allowInsertInBetween)` returning the
  existing `DockPairPreviewArray` DTO — that runs `DockPreview::evaluate` and the DTO conversion
  without constructing the preview. Everything around it (the transient free-flying load, the
  geometry wait, the cleanup) is composed in the SDK from existing kernel primitives and callbacks.
  Composing possible children plus docking declarations in the SDK would miss collision and insert
  evaluation and is not enough. The full design and the reasons are in the implementation plan at the
  end of this document.
- Payloads and results are detached JSON without kernel handles, like the capabilities contract
  (`packages/embedding-lib/docs/configurator-capabilities.md`).
- The MCP server: every tool relays one of the two calls; the page allow-list carries the two method
  names; tool executors validate `type` / `name` and the payload before calling the page. Bridge
  migration: today the allow-list carries `undo`, `redo` and `getConfiguratorCapabilities`
  (`minimal-configurator-example/index.html:40`, `configurator-api.ts:6`) and the executors call
  those methods directly (`tool-executors.ts:12`); with the pair implemented, the allow-list carries
  the two generic names, and the `get-configurator-capabilities` tool routes through
  `queryConfigurationOperation('capabilities', …)` instead of its own method.

## Alternatives considered and rejected

- **Expose the existing typed methods to the MCP bridge.** Rejected as the MCP-facing surface:
  several are bound to the UI interaction model (`previewDockings` needs a `DragEvent` and the
  UI-selected possible child, `requestDeleteComponent` acts on the selection, `dockComponent` needs a
  free-flying preview component), and the agent's operation set is different and larger. The typed
  methods remain the internal implementation basis behind the generic pair.
- **Drive the docking UX from the MCP server** — call `requestComponentDockPreview`, collect
  `Editor3dSetPreviewAssociations`, then `dockComponent`. Rejected: it starts a docking process,
  creates a preview ghost in the scene, cancels the selection and depends on pointer state — side
  effects a query must not have, and an interaction the agent cannot perform without the mouse.
- **Per-operation typed public methods only** (e.g. `getDockingPositions`, `dockComponent`, …) without
  the generic pair. Rejected for the MCP-facing surface: the agent may do everything slightly
  differently and may have more options and tools than the UI, so one stable pair keeps the MCP tool
  surface and the page allow-list small while the SDK internals evolve. The typed methods stay as the
  implementation layer.
- **HI MCP pattern** (relations between articles, the group-relations tool of roomle-hi-example): the
  Roomle docking logic is more complicated than HI article relations. A relation-based docking for the
  agent remains a possible later tool layer on top of the `dockingPositions` query + the
  `dockComponent` operation, drawing on `src/configurator/internal/docking/dock-configurator.cpp` —
  not part of this API.

## Code and documents the work would touch

roomle-ui:

- `configurator-core/src/roomle-configurator.ts` — the two generic methods
- `common-core/src/mcp-api/` — new `configuration-operations` implementation and types, dynamically
  imported
- `packages/web-sdk/packages/typings/kernel.ts` — type the exposed kernel methods
- tests under `packages/web-sdk/packages/*/__tests__/`
- `packages/embedding-lib/docs/` — contract document for the two APIs

RoomleCore (kept at a minimum — one new embind function, nothing else):

- `getDockPairsForDockingEntity(targetObjectId, dockingEntityId, allowInsertInBetween)` returning the
  existing `DockPairPreviewArray` DTO: `configurator.json`, `ConfiguratorKernelEmc`
  (`configuratorEmscriptenInterface.h`), kernel implementation reusing `DockPreview::evaluate` and
  `assembler::newDockPairToPointDto` / `newDockPairToLineDto` without preview construction, with the
  insert case's undock/restore mirroring `requestPreviewGeometry` + `cancelDocking`
- Catch2 kernel tests for the query
- no new callback, no new DTO, no runtime-id returns, no dock target for
  `loadComponentAndDockNewPlanComponents` — the SDK composes all of that from existing primitives

roomle-configurator-mcp:

- `configurator-api.ts`, `tool-executors.ts`, `configurator-mcp-server.ts` — the tools built on the
  two calls
- `minimal-configurator-example/index.html` — the page allow-list
- `docs/configurator-mcp-server.md`, `.agents/skills/configurator-mcp-server.md` — the tool reference

## Verification

- roomle-ui unit tests for both APIs and every catalog entry; RoomleCore Catch2 tests for the new
  dock-pair query
- MCP tool tests against the fake page socket (`configurator-mcp/configurator-mcp-server/tests/`)
- a live Chromium run against a local UI and MCP with `usm:frame`: query docking positions, dock,
  read back, delete with both re-dock cases, undo, redo — correct current values, and no preview
  ghosts left in the scene
- gates: `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `node .agents/scripts/check-markdown-links.js` on changed markdown; roomle-ui SDK/UI type checks
  and builds

