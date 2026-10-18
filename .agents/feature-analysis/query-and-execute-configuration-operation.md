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
  changes); Catch2 kernel tests.
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
  `determinePlanComponentsThatWillBeDeleted` (the `deleteImpact` query) and `deleteComponent` with
  its re-dock flag. The operation catalog (create-and-dock, re-dock/move) is planned separately and
  must not compose `loadPlainComponent` / `loadFreeFlyingConfiguration` (see the implementation
  requirements below).
- The dock-pair queries need exactly one new RoomleCore embind entry point — a synchronous
  `getDockPairs(targetObjectId, dockingEntity, allowInsertInBetween)` returning the existing
  `DockPairPreviewArray` DTO — that runs `DockPreview::evaluate` and the DTO conversion without
  constructing the preview; for a possible child the kernel creates the docking component
  transiently inside the query, without the deprecated load entry points. Composing possible
  children plus docking declarations in the SDK would miss collision and insert evaluation and is
  not enough. The design is in the implementation plan below.
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

- `getDockPairs(targetObjectId, dockingEntity, allowInsertInBetween)` returning the existing
  `DockPairPreviewArray` DTO: `configurator.json`, `ConfiguratorKernelEmc`
  (`configuratorEmscriptenInterface.h`), kernel implementation reusing `DockPreview::evaluate` and
  `assembler::newDockPairToPointDto` / `newDockPairToLineDto` without preview construction; a
  possible child is created transiently inside the kernel (no deprecated load entry points, no
  scene callbacks); the insert case's undock/restore mirrors `requestPreviewGeometry` +
  `cancelDocking`
- Catch2 kernel tests for the query
- no new callback, no new DTO, no runtime-id returns, no dock target for
  `loadComponentAndDockNewPlanComponents`

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

## Implementation requirements

Stated by the ticket owner on 2026-10-18. The first implementation plan violated these constraints
(it reactivated the deprecated load APIs and relied on AsyncHelper waits and timeouts) and was
reverted. These requirements are binding for the implementation:

- **No `loadFreeFlyingConfiguration` and no `loadPlainComponent`.** These kernel entry points are
  deprecated and must not be reactivated by this feature. In particular, the SDK must not
  orchestrate load → wait → query → delete around them to answer a docking-positions query.
- **AsyncHelper only if it cannot be avoided, with an explanation.** The roomle-ui implementation of
  the two generic APIs must not use `AsyncHelper` waiters. If a wait turns out to be absolutely
  necessary, the implementation must explain why it is unavoidable.
- **No timeouts.** No `setTimeout`-based waiting anywhere in the roomle-ui implementation.
- **Calculate the possible docking positions without the old load APIs.** `DockPreviewConstructor`
  (`src/configurator/internal/docking/dock-preview-constructor.h` in RoomleCore) handles the docking
  preview process. The docking process does not need `loadFreeFlyingConfiguration` or
  `loadPlainComponent`; therefore the calculation of the possible docking positions must also be
  possible without that old API — either by reusing `DockPreviewConstructor` / `DockPreview` /
  `PossibleDockPairs` for the pure calculation, or by writing a similar class for it.
- **One clean RoomleCore API that generates the possible docking positions.** The kernel gets a new,
  clean entry point that computes the possible docking positions (the dock pairs) — for a possible
  child and for an existing component — without drawing previews and without changing configuration,
  selection or history.

## Implementation plan — `queryConfigurationOperation`

Scope: the query half of the feature only — the read-only `queryConfigurationOperation(type,
payload)` end to end (RoomleCore → roomle-ui SDK → MCP read tools). `executeConfigurationOperation`
and the write tools are planned separately. This plan is written under the binding
[Implementation requirements](#implementation-requirements) above: no `loadFreeFlyingConfiguration` /
`loadPlainComponent`, no AsyncHelper (none is needed — see section 2), no timeouts, and one clean
RoomleCore API that generates the possible docking positions.

### 1. The one new RoomleCore API: `getDockPairs`

**Signature** (embind, kernel object):

```
getDockPairs(
  targetObjectId: number,
  dockingEntity: DockPairQuerySource,
  allowInsertInBetween: boolean,
): DockPairPreviewArray
```

`DockPairQuerySource` (typed in the SDK's `typings/kernel.ts`):

- `{ runtimeId: number }` — an existing component of the target configuration (the
  `componentDockingPositions` query);
- `{ componentId: string, configuration: string }` — a possible child given as a component
  definition, `configuration` being the component definition JSON (the `dockingPositions` query,
  component source);
- `{ configuration: string }` — a possible child given as an assembly/item configuration (the
  `dockingPositions` query, item source).

The `dockingEntity` parameter is an `emscripten::val` (precedent: `evaluateJsScript`'s
`argumentObject`); the generated TS types it `any`, the hand-written `typings/kernel.ts` types it as
the union. The C++ wrapper reads the descriptor with `isUndefined` / `isNumber` / `isString` checks
and throws an actionable `KernelException` for an invalid source. The return reuses the existing
`DockPairPreviewArray` DTO vector type (`configurator.json:666`; the synchronous DTO-vector
precedent is `getAddOnSpotsForPlanObject`).

**Why one synchronous function covers both sources.** The calculation the preview flow uses is
`DockPreview::evaluate` (`src/configurator/internal/docking/dock-preview.cpp:17`):
`PossibleDockPairs::fill` + collision evaluation + insert evaluation. It runs synchronously inside
`DockConfigurator::requestPreviewGeometry` (`dock-configurator.cpp:836-841`) *before* the
geometry-ready check; the geometry wait only defers the preview emission (`pendingPreview`,
`dock-configurator.cpp:841-849`) and triggers a re-evaluation. `DockPreviewConstructor`
(`dock-preview-constructor.cpp`) only renders and sends the already-evaluated pairs; the
calculation needs neither it nor any preview construction. So the query reuses
`DockPreview::evaluate` and the DTO conversion (`assembler::newDockPairToPointDto` /
`newDockPairToLineDto`, `configuration-assembler.h:27-28`) and skips the whole preview machinery: no
`add_dock_preview`, no `set_preview_associations`, no `preview_construction_done`.

**Transient child (possible-child sources).** The kernel creates the docking component through the
same creation path as `loadComponentAndCreatePlanComponents` (`configurator-kernel.cpp:1183`) —
component definition via `getOrCreateComponentAndHandleErrors`, PlanComponent creation, update
cycle (parameter values, dockings), bounding-geometry construction
(`UpdateComponentGeometry::initBoundingGeometry`, the `boundingGeometry` script — synchronous
RoomleScript, no external-mesh requests) — but attached to a temporary plan object
(`makeTemporaryObject`) that is never announced: no `addPlanObjectCreated`, no
`addPlanComponentChanged`, no `objectChangedFromComponent`, no `checkObjectForLoadingDone`.
`UpdateManager::sendComponentCreated` (`update-manager.cpp:546`) fires only through those queues
(`addPlanComponentChanged`, `update-manager.cpp:205`), so no `Editor3dComponentCreated` reaches the
SDK. The plan object and component are destroyed at the end of the call. The SDK therefore performs
no load, no wait, no listener, no cleanup — the deprecated `loadPlainComponent` /
`loadFreeFlyingConfiguration` are not touched.

**Existing-component source.** Resolve via `getInternalPlanComponentFromComponentOrObjectId` (the
same guards as `requestPreviewGeometry`, `dock-configurator.cpp:810-824`). Insert case
(`allowInsertInBetween` and the component belongs to the target object): the same wrap as
`requestPreviewGeometry` plus the `cancelDocking` restore — `setTemporaryModifiedObject(true)` + one
`ConfiguratorChangeAggregator` spanning backup (`createNewAndEmptyDockBackup`) + undock
(`DockHelper::undockAndCreatFreeFlyingPlanComponent`) + evaluate + restore
(`removePlanComponentDockBackup` + `DockBackup::restoreDocking`), restoring the original sibling
order and the cached configuration afterwards, rethrowing after restoring on error. The aggregator
suppresses `planobject_configuration_updated` (`update-manager.cpp:637`).

**Evaluation fidelity.** Dock pair positions derive from docking declarations and are exact.
Collision line clipping and insert preview boxes use the docking component's bounding geometry
(`ComponentConstructor::calcBoundingGeometryBounds`, `component-constructor.cpp:1063`;
`boundingBoxInScriptSpace`, `possible-dock-pairs.cpp:585-590`), which the transient child gets from
the synchronous `boundingGeometry` script / `setBoxForMeasurement`. The query never requests or
awaits external meshes (binding requirement); a child whose bounds depend solely on uncached
external meshes is evaluated with the bounds available synchronously. The query returns *all*
evaluated pairs — points and lines, including insert-in-between points — the union of what the
preview flow emits across its point, line and insert emissions (`DockPreviewConstructor::
sendDockPreviewPoints` filters insert points that carry a preview box; the query deliberately does
not), so the agent sees every dockable position.

**Files:** one method entry in `interfaces/emscripten/definition/configurator.json`, one static
wrapper in `ConfiguratorKernelEmc` (`configuratorEmscriptenInterface.h`, try/catch `KernelException`
→ `throw_js`), the implementation in `src/configurator/internal/docking/dock-configurator.{h,cpp}`
with a delegate in `src/configurator/configurator-kernel.{h,cpp}`, then `npm run build:embind` in
`node/` (generated files are never edited manually).

### 2. roomle-ui — the query API

1. **`packages/web-sdk/packages/typings/kernel.ts`** — type
   `getDockPairs(targetObjectId: number, dockingEntity: KernelDockPairQuerySource,
   allowInsertInBetween: boolean): KernelDockPairPreview[]` plus the `KernelDockPairQuerySource`
   union, and type `determinePlanComponentsThatWillBeDeleted(planComponentId: number,
   tryDockChildrenToParent: boolean): number[]` (for `deleteImpact`). No other kernel typings are
   added.
2. **`packages/web-sdk/packages/common-core/src/configurator-kernel-access.ts`** — wrappers:
   `getDockPairs(...)` (EmsArray conversion of the vector return), `determineComponentsThatWillBeDeleted(...)`,
   and `isComponentDeletable(runtimeId)` mirroring the scene manager's
   `_permissionToDeleteComponent(id, false)` (`configurator-scene-manager.ts:1650`:
   `permissionToDelete` vs `CORE_PERMISSION_TO_DELETE`, modulated by the `reDock` feature flag;
   undefined permission → deletable; missing component info → not deletable).
3. **`packages/web-sdk/packages/common-core/src/mcp-api/configuration-operations-types.ts`** — the
   query catalog types: `ConfigurationOperationQueryType` (the 8 literals), the per-row payload
   types, the per-row result types (every result carries `context` of the existing
   `ConfiguratorCapabilityContext` shape), the `ConfigurationOperationQueryResult` union, and the
   structural `ConfigurationOperationHost` (a type-only import of the `RoomleConfigurator` shape;
   only `getChildrenOfPlanComponent` / `getChildrenOfPlanObject` are needed — everything else goes
   through the kernel access).
4. **`packages/web-sdk/packages/common-core/src/mcp-api/configuration-operations.ts`** — the
   dispatcher and the 8 query implementations:
   - Context capture / assert-freshness mirrors the capabilities collector (same shape, same
     stale-read rule); the two tiny detach helpers are duplicated deliberately so the capabilities
     collector stays untouched.
   - **No AsyncHelper, no timeouts.** The `configuration` query reads
     `access.getSerializedConfiguration(runtimeId)` + `access.getCurrentConfigurationHash(runtimeId)`
     — both synchronous, the same reads the capabilities collector performs — instead of
     `RoomleConfigurator.getCurrentConfiguration()` (`roomle-configurator.ts:1627`), which is
     AsyncHelper-based. This is the one place the analysis table's implementation basis changes,
     forced by the binding requirement. `access.getComponentParameters` (reused for
     `componentParameters` / `globalParameters`, exactly as the capabilities collector does) is
     async only for external-object validation and uses no AsyncHelper.
   - **Validation before any kernel/RAPI/scene call:** catalog membership (an unknown type is
     rejected with the valid catalog), then the payload shape per row (missing/invalid fields
     named; `child.configuration` must be valid JSON; the source is limited to the three kinds the
     kernel accepts).
   - The docking queries call `access.getDockPairs(...)` directly — synchronous — and detach the
     result. No load, no listener, no wait, no cleanup.
   - Queries serialize on a plain promise chain (module-level; one query at a time). No AsyncHelper,
     no timers.
   - Errors: the same actionable messages as the capabilities read for a missing configuration, a
     planner outside isolation, and an HI external-object target.
5. **`packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts`** — the thin public
   method beside `getConfiguratorCapabilities` (`roomle-configurator.ts:1546`), dynamically
   importing the implementation (the same pattern).
6. **`packages/web-sdk/packages/index.ts`** — type-only exports.
7. **`packages/embedding-lib/docs/configuration-operations.md`** — the query half of the contract
   document (catalog, payload/result shapes, the context envelope, stale reads, the read-only
   guarantee, the dock-pair query's semantics), linked from the embedding-lib README.

### 3. roomle-configurator-mcp — the read tools

- **`configurator-api.ts`**: `ConfiguratorApi.extended.queryConfigurationOperation(type, payload?)`
  — typed forwarding through the page bridge. The server and page allow-lists gain
  `queryConfigurationOperation`; `undo`, `redo` and `getConfiguratorCapabilities` stay until the
  operation API lands (the restriction of the allow-list to exactly the two generic names happens
  with `executeConfigurationOperation`).
- **Eight read tools, one per query row:** `get-configurator-capabilities` (rerouted through
  `queryConfigurationOperation('capabilities', …)`, same `include` schema and result contract),
  `get-configuration`, `get-component-parameters`, `get-global-parameters`,
  `get-possible-children`, `get-docking-positions`, `get-component-docking-positions`,
  `get-delete-impact`. Each executor validates its payload with zod before any page call and relays
  its fixed type/name; every tool is `readOnlyHint: true` + `idempotentHint: true` and never enters
  the history queue.
- **Docs:** `docs/configurator-mcp-server.md`, the MCP-server skill, the wiki page
  `roomle-configurator-api-for-mcp.md` (the proposal becomes the implemented surface for the query
  half).

### 4. Unit-test plan

**RoomleCore (Catch2)** — `test/configurator/internal/docking/dock-pair-query-test.cpp` (registered
in `test/CMakeLists.txt`), mirroring the neighbouring `dock-preview-request-test.cpp`:

- possible child, component-definition source: the pairs match the preview flow's own result for the
  same fixture (drive `requestComponentDockPreview`, capture `set_preview_associations`, compare
  sets); no preview emissions (`add_dock_preview`, `set_preview_associations`,
  `preview_construction_done`, `planobject_configuration_updated`); no `component_created`;
  serialized configuration + hash byte-identical; undo stack unchanged; component count unchanged;
- possible child, configuration (item) source: the same guarantees;
- possible child, insert on/off: insert pairs present (`displacedChildId` set) / absent;
- existing component: pairs match `requestPreviewGeometry`; the insert case restores docking,
  sibling order and cached configuration (byte-identical configuration + hash);
- unknown target / unknown entity / invalid source descriptor / invalid child JSON → actionable
  `KernelException` messages;
- run the neighbouring `[docking]` suite as regression coverage.

**roomle-ui (Vitest)** —
`packages/web-sdk/packages/common-core/__tests__/mcp-api/configuration-operations.ts` (mirrors the
capabilities suite):

- **Q1 validation:** unknown type rejected with the valid catalog; missing `runtimeId`, malformed
  `child`, invalid JSON, wrong value types rejected before any kernel/RAPI/scene call (mocks assert
  zero calls);
- **Q2 configuration:** parsed JSON + hash + context; matches `getSerializedConfiguration`;
  detached (frozen inputs);
- **Q3 componentParameters:** parameters + groups detached; view-type enum values preserved;
  unknown runtime id → actionable error;
- **Q4 globalParameters:** scope routing on `rootComponentParametersAsGlobal`;
- **Q5 possibleChildren:** omitted `runtimeId` reads the plan object, given reads the component;
  default child included; detached;
- **Q6 dockingPositions / componentDockingPositions:** `getDockPairs` called with
  `(targetObjectId, source, allowInsertInBetween)`; source mapping per child kind; pairs detached;
  a changed context mid-read rejects; and the requirement assertions — no load calls
  (`loadPlainComponent` / `loadFreeFlyingConfiguration` never called), no `addConfiguratorListener`,
  no `AsyncHelper.waitFor`, no timers (`vi.useFakeTimers`, none scheduled);
- **Q7 deleteImpact:** both re-dock cases; `deletable` follows the permission/`reDock` logic;
  `componentIds` resolve from the runtime ids;
- **Q8 read-only:** no setter/selection/history/save calls; results JSON-round-trip; two overlapping
  reads keep independent state;
- **Q9 capabilities:** `include` forwarded; the `complete`/`unresolved`/sections contract preserved;
- **lifecycle:** no active target, planner outside isolation, HI external-object target → the
  actionable errors.

**Boundary tests:**

- `packages/web-sdk/packages/configurator-core/__tests__/roomle-configurator.ts` — the public
  `queryConfigurationOperation` delegates `(type, payload)` and the session dependencies, unchanged
  result, propagated errors (mirrors the capabilities public-method test);
- `packages/web-sdk/packages/common-core/__tests__/configurator-kernel-access.ts` — `getDockPairs`
  (EmsArray conversion, argument order), `determineComponentsThatWillBeDeleted`,
  `isComponentDeletable` (permission matrix incl. the `reDock` flag);
- `tests/unit/configurator/embedding/exposed-api.spec.ts` — `queryConfigurationOperation` announced
  and dispatched in standalone and planner-inner setups;
- `tests/unit/embedding-lib/connector.spec.ts` — the generated proxy forwards the method with its
  arguments and the resolved JSON.

**roomle-configurator-mcp (vitest):**

- `configurator-api.test.ts` — the allow-list carries `queryConfigurationOperation`; arguments
  forwarded; JSON result and client identity preserved;
- `tool-executors.test.ts` — each read executor validates its payload (zod) and calls the generic
  API with its fixed type; no history events for reads;
- `configurator-mcp-server.test.ts` — `tools/list` contains the eight read tools with schemas and
  `readOnlyHint`/`idempotentHint`; an invalid payload is rejected before any page call; a read
  result is successful JSON; an SDK error is `isError`;
- `page-bridge.test.ts` — structured query results round-trip through the fake page; SDK error,
  disconnection and timeout propagate.

### 5. Validation gates

- **RoomleCore:** build the test target (`scripts/buildCore.sh test debug` or the existing
  `build-test`), run the new Catch2 file and the `[docking]` suite; `npm run format:c++` before
  committing.
- **roomle-ui** (Node 24.12.0 pinned): the Vitest files above with `--run`, `npm run lint`,
  `npm run format:push`, `npm run build:sdk`, `npm run build`; inspect that the mcp-api
  implementation stays behind the dynamic import and the built declarations expose the new types.
- **roomle-configurator-mcp:** `npm test`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `node .agents/scripts/check-markdown-links.js` on changed markdown.
- Commits per repository on the existing feature branches; no push, no pull request.
