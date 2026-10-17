# Configurator capabilities for the configurator MCP

> **Type:** Feature analysis
>
> **Ticket:** [RML-18085 — research roomle configurator mcp](https://roomle.atlassian.net/browse/RML-18085)
>
> **Date:** 2026-10-17
>
> **Author:** AI Assistant
>
> **Status:** Open — proposed contract, no implementation
>
> **Scope:** `getConfiguratorCapabilities` in roomle-ui and its read-only MCP tool

Affected repositories:

- **roomle-ui:** the public SDK method, a dynamically imported capabilities collector in `common-core/src/mcp-api`, public types, embedding verification and documentation.
- **roomle-configurator-mcp:** the `get-configurator-capabilities` tool, its API relay and page allow-list, agent instructions, tests and documentation.

## HI and Roomle configurator comparison

| Aspect | HI MCP | Roomle configurator MCP |
|---|---|---|
| Target products | Library-defined articles, such as cabinets and kitchens | Any product described by Roomle component definitions |
| Data defining the possibilities | Master data and an article catalog supplied by the HI library | A graph of component definitions, items with configuration JSON, parameter declarations, and RAPI material-group membership |
| Discovering the product family | Read the loaded library data | Follow component and item references recursively, including options absent from the current configuration |
| Parameters | Library attributes and selections | Literal values, conditional value objects, material groups, scripted ranges, current values and shared-parameter intersections |
| Materials | Attributes and library data | Material IDs need RAPI labels, thumbnails and colour metadata |
| Current state | Calculated groups and root modules | Current serialized configuration and kernel component instances, addressed separately from catalog IDs |
| Docking | Article relations translated into library docking rules | Conditional docking points/lines, assignments and collision rules; a possible child alone does not identify a valid placement |
| Read API | `RoomlePlanner.getExternalObjectPlanContext(include, options)` | Proposed `RoomleConfigurator.getConfiguratorCapabilities(include)` |
| MCP read tool | `get-plan-context` | Proposed `get-configurator-capabilities` |
| Implementation boundary | Planner delegates to HI glue logic and its context collector | Configurator delegates to a lazy-loaded shared SDK collector; MCP only calls the public configurator API |

## Question and conclusion

The ticket asks for an agent-readable JSON object containing the information needed to understand a configurator, with selectable sections like `getExternalObjectPlanContext`. It explicitly places the public entry point in `packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts` and the dynamically loaded implementation in `packages/web-sdk/packages/common-core/src/mcp-api`.

**Add one SDK read method and one MCP read tool.** The SDK collects and shapes the data in the live session. The MCP server forwards the request and returns that JSON. It does not fetch RAPI independently or interpret RoomleScript.

The result must distinguish **declared possibilities** from **currently evaluated choices**. Reading only the current parameters misses unloaded components and conditional alternatives. Reading only component JSON misses evaluated conditions, shared-parameter intersections and material-group contents. Neither source alone answers the ticket.

This analysis covers discovery and inspection. Configuration creation, parameter mutation, deletion and simplified docking commands remain subsequent work. Undo and redo already exist. The prior three Jira comments concern the chat/undo/redo foundation; their restriction to two tools describes that earlier step. Model selection and hosting are outside this analysis.

## Evidence and current data flow

Paths below are relative to the named repository. SDK paths beginning `common-core/`, `configurator-core/`, `planner-core/`, `homag-intelligence/` or `typings/` are relative to `packages/web-sdk/packages/`.

Examined revisions: roomle-configurator-mcp `8253090ae5bfe1b457bca8cac076a82d4dc93c71` (`master`); roomle-ui `67baffd7f5438a37763d80b618be8420bb260435` (`feat/configurator-planning-assistant-RML-18085`). The analysis branch is `docs/configurator-capabilities-RML-18085` in roomle-configurator-mcp. RoomleCore `608916a69325e7cb927d23ee6cea46fb07da5613` was read to verify content semantics; no kernel change is proposed. These are source findings, not a live prototype or performance measurement.

### Existing pattern and integration boundary

- `planner-core/src/roomle-planner.ts:3185` delegates `getExternalObjectPlanContext` to HI glue logic. The section and option types are in `homag-intelligence/src/external-object-api.ts:192`; its public contract at line 476 specifies JSON ready for an agent.
- `homag-intelligence/src/hi-plan-context.ts:963` selects sections and collects their dependencies. Omitted or empty `include` means all sections. This is the useful contract pattern; the configurator does not need HI glue logic.
- No `getConfiguratorCapabilities` implementation or `common-core/src/mcp-api` collector exists in the examined roomle-ui tree. `configurator-core/src/roomle-configurator.ts:2824` already demonstrates a method-local dynamic import for another feature.
- `common-core/src/webgl/configurator-context.ts:7` holds the active configuration/root IDs and selected runtime component IDs. It is session state, not the destination for a catalog crawler. `getCurrentSelection` at `roomle-configurator.ts:2113` maps runtime IDs to catalog component IDs, so it cannot uniquely identify two instances of the same component.
- `src/configurator/embedding/exposed-api.ts:387` enumerates the SDK prototype methods; line 396 does the same for a planner's inner configurator. `packages/embedding-lib/src/connector.ts:69` builds proxies from that announcement. A new public method is therefore exposed automatically; there is no handwritten method list to extend in embedding-lib.
- The actual namespaces are `extended` and `configurator` (`packages/embedding-lib/src/roomle-embedding-lib.ts:38`). Standalone callers use `instance.extended.getConfiguratorCapabilities(...)`; planner hosts use `instance.configurator.getConfiguratorCapabilities(...)`. `configuratorSdk` is an internal variable description, not the host namespace.

### Existing data readers

| Required data | Existing origin | What the collector must do |
|---|---|---|
| Active configuration | `roomle-configurator.ts:1604`; `common-core/src/configurator-kernel-access.ts:1535` | Capture the current serialized configuration without saving it to RAPI; parse a detached JSON value |
| Runtime root, hierarchy and selection | `configurator-context.ts:7`; kernel `getComponent`; `typings/kernel.ts:437` | Return runtime IDs, catalog IDs and parent/child relationships as plain JSON; avoid exposing kernel handles or view models |
| Component definition | `common-core/src/rapi-access.ts:489` | Fetch `RapiComponent`; parse its `configuration` string. `common-core/src/services/common-kernel-access.ts:481` confirms this is the definition sent to the kernel |
| Possible-child items | `rapi-access.ts:549`; `roomle-configurator.ts:2598` | Preserve item identity and its configuration tree, then discover every referenced component |
| Declared parameters | Component definition `parameters` | Preserve types, defaults, grouping, global/superseding relationships, candidate declarations and relevant expressions |
| Evaluated parameters | `roomle-configurator.ts:1540`, `:1576`, `:2342`; `configurator-kernel-access.ts:208` | Read global/root/component scopes distinctly; return plain values, ranges, enabled state and current choices |
| Evaluated possible children | Kernel component DTO `possibleChildren`, `typings/kernel.ts:95` | Preserve the owning runtime component, component/item ID, `possible`, group and default; carry visibility fields from the actual DTO where available |
| Group members | `rapi-access.ts:840` | Resolve material groups through the session's RAPI access and retain membership |
| Material metadata | `rapi-access.ts:773`, `:795`; `typings/rapi-types.ts:112` | Project IDs, labels/names, thumbnail URLs, colour and useful group/tag metadata; do not load texture images |
| Docking declarations | Component `parentDockings`, `childDockings`, `siblings` | Preserve identifiers, conditions, assignments and point/line declarations as constraints, not validated placements |

`getParametersOfComponent` is not itself the transport result: its `UiKernelParameter.groups` is a Promise (`typings/kernel.ts:191`), and its grouping helper obtains root groups (`configurator-kernel-access.ts:1514`). The collector should build its own small JSON projection from the kernel reads and the RAPI records, using each component's own parameter groups. It must not select components or call UI update methods merely to inspect them.

### Why recursive discovery is necessary

RoomleCore's `src/configurator/internal/deserializer/component-serializer.cpp:91` reads `possibleChildren`, legacy `validChildren` and `subComponents`; line 197 reads a subcomponent's `componentId`, assignments and supersedings. `component-definition.cpp:215` turns legacy `validChildren` into possible children. `possible-child-serializer.cpp:26` reads literal component/item IDs separately from the condition, visibility, grouping and default expressions.

An item's configuration is an assembly, not a component definition. `src/configurator/internal/deserializer/configuration-deserializer.cpp:13` reads `componentId`, `parameters`, `children`, `dockParent`, `dockChild` and `dockPosition`. Discovering only its root would miss components present in its preconfigured children.

The existing UI helper at `roomle-configurator.ts:2598` enriches one supplied list of possible children and normally filters out entries with `possible: false`. It does not discover the recursively reachable product family. Preloads and caches likewise describe what was fetched, not proof that every reachable definition was visited.

### Parameter semantics the JSON must preserve

The ticket's [Parameter Value Sources reference](https://github.com/roomle-internal/RoomleCore/blob/608916a69325e7cb927d23ee6cea46fb07da5613/documentation/features/script/parameter-value-sources.md) and the serializers establish these requirements:

- Read **all** candidate sources: `validValues`, `valueObjects`, `localizedValues`, `conditionalValues`, `validGroups`, `conditionalGroups`, and `validRange`. Value-object values are literals; conditions and label expressions are scripts. The four value lists are merged, not alternatives (`parameter-serializer.cpp:130`, `parameter-definition.cpp:95`).
- Group expansion applies to Material parameters. Resolve conditional groups too when describing the declared family, even when their condition is currently false. Preserve their conditions so the agent does not confuse membership with current availability.
- In evaluated Material parameters, known groups have already been expanded into `validValues` and removed from `validGroups` (`src/configurator/internal/assembler/parameter-assembler.cpp:139`). A collector that fetches only the DTO's remaining `validGroups` loses material metadata. Resolve IDs from explicit values, group members and the current material value.
- Unlike the existing UI helper's either/or branch at `roomle-configurator.ts:639`, collection must account for explicit values **and** unresolved groups when both exist. Keep source provenance and deduplicate material records by ID.
- No values/groups/range does not mean unrestricted input. The DTO offers the current value when no candidates remain (`parameter-assembler.cpp:48`). Preserve the current evaluated value; do not invent an unlimited choice list.
- A global parameter may be the intersection of several components, not the root's declaration. Read the kernel's global result separately. Conditions, range bounds/steps, visibility, enabled state and supersedings remain kernel responsibilities.
- Keep numeric/Boolean/Object parameter values in the kernel's established serialized representation, together with their type and unit. Do not blindly parse all strings into numbers or infer millimetres for every parameter.

## Proposed roomle-ui contract

The following is a proposed public shape, not code already available:

```ts
type ConfiguratorCapabilitySection =
  | 'configuration'
  | 'components'
  | 'items'
  | 'parameters'
  | 'materials'
  | 'docking';

getConfiguratorCapabilities(
  include?: ConfiguratorCapabilitySection[],
): Promise<ConfiguratorCapabilities>;
```

Use the HI method's section semantics: omitted or empty `include` requests all six sections; otherwise return only those sections plus a small shared context/completeness envelope. Section selection is sufficient for the first contract. Targeted ID selectors can be added when a measured payload requires them; an unused options object is unnecessary.

Always include `context` with the configuration runtime ID, root runtime ID, root catalog component ID, selected runtime IDs and the snapshot's configuration hash. Runtime IDs address this session; catalog IDs address definitions; neither substitutes for the other. Include `complete` and `unresolved` for the requested data, where an unresolved entry identifies the resource/section and reason. `complete` means that the requested declared graph and metadata were collected, not that every hypothetical configuration or docking combination has been evaluated.

| Section | Proposed contents |
|---|---|
| `configuration` | Parsed current configuration JSON plus a runtime instance tree with parent/child IDs and catalog IDs. Keep the authorable configuration separate from runtime inspection data |
| `components` | One compact record per definition: ID, localized label, metadata, parameter-group metadata, possible-child references with conditions/visibility/default/group expressions, subcomponent assignments and supersedings, and configuration-relevant update expressions. Geometry/export/rendering source and asset payloads are omitted |
| `items` | One record per referenced item: ID, label, thumbnail URL, root ID and parsed configuration including its preset parameters and children |
| `parameters` | `declaredByComponent` for candidate declarations, conditions and default/range expressions; `current` for the kernel-evaluated global parameters and per-runtime-component parameters. Explicitly label declared and evaluated data |
| `materials` | A deduplicated ID-indexed material dictionary and group-to-material membership. Labels, thumbnails and colour metadata enrich IDs used by parameters; source membership does not imply a parameter currently permits the material |
| `docking` | Definition-level parent/child/sibling docking constraints and per-runtime-component evaluated possible children. Distinguish a selectable child from a validated dock pair; this section does not promise a ready-to-apply placement |

All sections are plain JSON. Never return a Promise, `Map`, Emscripten container, Three.js object or a reference to a mutable cached DTO. Material colour is the supplied metadata (`color`, and `shading.basecolor` where useful), not a guessed perceived colour of a textured surface. Image fields are URLs, not downloads.

### Collector responsibilities

The public method should only dynamically import `../../common-core/src/mcp-api/configurator-capabilities`, then delegate with the current configurator context, kernel access and RAPI access. Public types can live beside the collector and be exported with `export type` from `packages/web-sdk/packages/index.ts`, keeping runtime imports out of the initial SDK bundle. No new DI service or algorithm in `ConfiguratorContext` is needed.

The collector must establish the active target from `configurationRuntimeId` and the actual kernel root, not `lastLoadedRapiId`: the loaded URL is not the current configuration after edits. In planner isolation it uses the same inner configurator context. Outside an active configurator/isolation session, return an actionable error instead of reading a stale previously selected plan object. The planner sets and clears these IDs around isolation (`planner-core/src/webgl/planner-scene-manager.ts:1213`, `:1401`, `:1575`); no new method on `RoomlePlanner` is required.

For requested catalog-related sections, use a worklist with visited component and item ID sets:

1. Seed discovery from the active root and all components in the captured configuration. This includes already docked components even when a current possible-child condition no longer offers them.
2. Parse each fetched component's definition, follow every `possibleChildren.componentId`, `possibleChildren.itemId`, legacy `validChildren` ID and `subComponents.componentId`. Keep conditional/inactive declarations in the declared graph.
3. Parse each item's configuration and traverse every node's `componentId` and `children`; preserve the item as a separate choice even when multiple items share a root component.
4. Expand the declared Material groups and collect explicit/current Material IDs when requested. Reuse existing RAPI access, batching and caches; maintain one projected record per resource, with relationships referencing IDs. Repeated IDs and cycles terminate by visited sets.
5. Shape only requested sections. A `configuration`-only read must not crawl the catalog or fetch materials. Dependency reads are allowed without emitting their sections; a `materials` read needs parameter declarations to discover the groups.

Use the loaded session's access layer so API environment, tenant, language and content routing remain consistent. Do not invoke the asset-loading path (`requestAssets`, `loadComponent`, `assetsLoaded`) for discovery: that path constructs kernel data and requests meshes/material assets. No save, history step, selection change, dock preview, trial load or script execution belongs in this read method.

Capture runtime state into detached data **before** awaiting remote enrichment. Recheck the active configuration ID/hash before returning; if the configuration changed, report that the caller must repeat the read. Do not mix an old hierarchy with new parameter values, silently return a stale result as current, or introduce an automatic polling/retry loop. Use existing identity/hash information rather than inventing an event generation counter.

Failures must remain visible. `RapiAccess.getMaterials` currently catches failures and returns `[]` (`rapi-access.ts:795`), and group reads may use cached data offline (`:859`). Compare requested IDs with returned records, report missing metadata, and do not declare empty groups authoritative after an offline fallback. Invalid/missing component or item configuration must identify the affected resource. Useful partial catalog data can be returned with `complete: false`; no active target, a failed runtime capture, or a changed target invalidates the snapshot and should reject the call. An inline/local component with no retrievable definition must be reported as such, not substituted with an unrelated remote record.

No arbitrary recursion depth or silent truncation should masquerade as complete discovery. Measure the full response before adding pagination. The current bridge deadline is 30 seconds (`configurator-mcp-server/page-bridge.ts:5`); the relay already accepts a per-call timeout. A deep catalog may require an explicit larger read timeout or later targeted reads, based on measurements, while undo/redo retain their behavior.

### Docking boundary

The kernel determines compatibility from evaluated docking definitions and the actual assemblies. `RoomleCore/src/configurator/internal/docking/dock-configurator.cpp:607` enumerates `PossibleDockPairs` and ranks concrete candidates by their transforms. Matching component names or deriving left/right from a static list would bypass this behavior.

For this feature, provide discoverable children and docking constraints, explicitly marked as declarations/current eligibility. A later mutation API should ask the kernel for valid candidates and translate an agent's target/relation into a concrete docking operation. The agent should not calculate dock IDs, rotations, line positions or displacement. An independent “valid placements for any future product” solver is neither delivered by this read tool nor justified by the existing read APIs. RoomleCore and the HI MCP need no changes for the scoped collector.

## Proposed MCP tool

Register **`get-configurator-capabilities`** with a Zod `include` array of the six section names. Omitted/empty means all, matching the SDK. Mark it read-only and non-destructive; its description should say that it reads the connected configurator, explains declared versus currently valid choices, and does not change the product. It can request RAPI data, so it is not an offline-only tool.

Example call:

```json
{
  "name": "get-configurator-capabilities",
  "arguments": { "include": ["configuration", "parameters", "materials"] }
}
```

The call chain is:

```text
MCP tool -> ConfiguratorApi.extended.getConfiguratorCapabilities(include)
         -> PageBridge call -> example instance.extended
         -> iframe RoomleConfigurator -> dynamic import -> collector
         -> JSON result over the same route
```

Required MCP changes:

- `configurator-mcp/configurator-mcp-server/configurator-api.ts:6`: add the method to the interface and allow-list. The current helper at line 19 always sends `[]` and discards `bridge.call`'s result. The new method must forward the arguments **and return the JSON**, preserving `clientId`. Keep undo/redo's existing void contract.
- `minimal-configurator-example/index.html:40`: extend `CONFIGURATOR_METHODS`. The executor at line 113 already forwards arguments and awaits/returns the result. A UI build missing the method should produce an explicit “use a Rubens UI build with getConfiguratorCapabilities” error, not an empty capabilities object.
- `configurator-mcp-server.ts:44` and `tool-executors.ts`: register and execute the read, returning the JSON text using the existing result convention. Preserve structured data unchanged; translate SDK/bridge failures into tool errors. There is no history event to wait for and no undo step to record for this tool.
- Update `INSTRUCTIONS` (`configurator-mcp-server.ts:6`) and `SYSTEM_PROMPT` (`configurator-mcp-chat/chat-config.ts:16`): currently both prohibit reading or doing anything beyond undo/redo. Tell the agent to inspect capabilities for product questions, use current options for current choices, and state that edits beyond undo/redo remain unavailable.
- `configurator-mcp-chat/chat-recovery.ts:3`: add the tool label; interrupted read calls should be described as incomplete reads rather than possible unconfirmed changes. Do not print a full capabilities payload in recovery output or routine server logs.

The existing bridge protocol already carries arbitrary arguments and results (`page-bridge.ts:91`); it needs no new message kind. No raw RAPI tool, generic method-execution tool, new endpoint, or second MCP server is needed.

**Planner isolation:** the SDK method works through the existing inner configurator API. The current example creates a standalone configurator, so adding its allow-list entry does not by itself make an arbitrary planner page an MCP client. A planner host must bind its bridge target to `instance.configurator`, including the matching history callbacks. Verify that route in a planner embedding test; a planner launcher/example is separate integration work, not a reason to duplicate the collector or add a planner facade.

## Alternatives and scope decisions

| Alternative | Reason not to choose it for this feature |
|---|---|
| Return only current kernel parameters/possible children | Omits dormant choices, item presets and recursively reachable definitions |
| Dump raw component JSON as the only result | Leaves the agent to resolve IDs, groups, conditions and identity; includes irrelevant rendering scripts and does not establish current validity |
| Implement recursive RAPI discovery in the MCP server | Violates the ticket's configurator API boundary and duplicates session-specific API/content behavior |
| Evaluate RoomleScript in TypeScript or infer docking by ID/name | Creates a second interpretation of kernel rules and cannot establish valid placements |
| Trial-load every candidate into the live configurator | Changes the inspected state, can trigger geometry/history work and still does not enumerate all future combinations |
| Put the algorithm in RoomleConfigurator or ConfiguratorContext | Conflicts with the specified shared, dynamically imported implementation and mixes data collection with session state |
| Add many resource-specific MCP tools now | One selectable read tool covers the requested capability discovery; extra tools and pagination need a demonstrated usage/payload problem |

These are analysis recommendations, not implemented architectural decisions. If accepted during implementation, promote the resulting contract and durable decisions into living documentation and ADRs as appropriate.

## Verification needed when implemented

No production code is changed by this analysis. The implementation should be accepted on the following behavior:

- **SDK contract:** omitted/empty/selected sections; plain JSON round-trip; public method is announced in standalone and planner-inner-configurator namespaces; dynamic collector is absent from the initial runtime import path.
- **Discovery:** direct components, item configurations with nested children, conditional children, subcomponents, legacy valid children, repeated references, cycles, two item presets with one root, and an existing child no longer offered by a condition. Missing/malformed resources remain explicit.
- **Parameters/materials:** all four value declaration lists, Material group and conditional-group expansion, explicit values plus unresolved groups, known groups already expanded by the kernel, current-value fallback, scripted ranges, disabled/hidden cases, global intersections, repeated runtime instances with the same catalog ID, and superseded parameters. Material enrichment never broadens the kernel's current valid set.
- **Read behavior:** configuration/selection/history unchanged; no meshes/textures requested by the collector; a configuration-only call performs no catalog crawl; cached/offline/missing data is not reported as complete; a concurrent edit or isolation exit invalidates the read.
- **MCP:** tools/list exposes the third tool and schema; include and client identity survive the bridge; the result arrives intact; missing page, old UI, timeout and SDK errors are tool errors; a read does not wait for history; undo/redo still behave identically; chat instructions and interrupted-read wording agree with the available tools.
- **Live acceptance:** ask what parameters, finishes and additions are possible, compare the result with the current UI and definitions, then change a parameter or undo and confirm a fresh read reflects the new state. Check the same SDK read inside planner isolation and record cold/warm response size and duration. This validates discovery, not future docking mutations.

Relevant existing tests are `common-core/__tests__/configurator-kernel-access.ts`, `common-core/__tests__/rapi-access.ts`, `configurator-core/__tests__/roomle-configurator.ts` (possible-child filtering around line 3033; parameter grouping around line 3090), and `tests/unit/configurator/embedding/exposed-api.spec.ts` in roomle-ui; `configurator-api.test.ts`, `configurator-mcp-server.test.ts`, `tool-executors.test.ts` and the chat tests in roomle-configurator-mcp. Add focused collector tests under `common-core/__tests__/mcp-api/` rather than embedding the graph algorithm in public-method tests.

## Files and documentation affected by implementation

| Repository | Files/area | Purpose |
|---|---|---|
| roomle-ui | `configurator-core/src/roomle-configurator.ts` | Thin public method and method-local dynamic import |
| roomle-ui | New `common-core/src/mcp-api/configurator-capabilities.ts` and public types beside it; `packages/web-sdk/packages/index.ts` | Collection, projection, section contract and type-only exports |
| roomle-ui | Corresponding SDK tests; embedding announcement/round-trip tests | Collector semantics and both host namespaces |
| roomle-ui | New `packages/embedding-lib/docs/configurator-capabilities.md`, linked from the embedding-lib README | Public sections, identity, completeness, current/declared distinction, standalone and isolation examples |
| roomle-configurator-mcp | `configurator-mcp/configurator-mcp-server/{configurator-api,configurator-mcp-server,tool-executors}.ts`; `minimal-configurator-example/index.html` | Tool registration, result-returning relay and page permission |
| roomle-configurator-mcp | `configurator-mcp/configurator-mcp-chat/{chat-config,chat-recovery}.ts` and corresponding tests | Agent instructions and read-result/recovery wording |
| roomle-configurator-mcp | `docs/configurator-mcp-server.md`, `.agents/skills/configurator-mcp-server.md`, root/workspace READMEs and tool-count descriptions in `AGENTS.md`/Copilot instructions | Accurate three-tool reference and SDK requirement |

This document is indexed in `.agents/README.md` and `.agents/feature-analysis/README.md`. At implementation close-out, promote the accepted API contract and collector invariants into the living references; close this analysis according to the repository lifecycle.
