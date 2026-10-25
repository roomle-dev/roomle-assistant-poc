# Fence Assistant: fence generation and manipulation

**Status:** Implemented on feature branches — awaiting landing in all affected default branches

**Date:** 2026-10-24

**Ticket:** [RML-18302 — research fence assistant](https://roomle.atlassian.net/browse/RML-18302)

**Scope:** Feature analysis of adding native fence authoring to the implemented terrain tools. The investigation below records the pre-implementation design; the implemented outcome is recorded at the end. The completed terrain analysis is removed at the user's explicit request; durable terrain behavior remains in the existing context and guides.

## Affected repositories

- **roomle-ui:** extend the existing lazy fence operation contracts, context, schemas, registry and prompts; reuse planner product loading, parameter access, interaction/history, exports and the existing fence embedding adapter/chat.
- **RoomleCore:** add a small drawing-mode-independent construction-contour interaction and thin reads of existing construction state; add a targeted placement interaction if the SDK promises a specific edge. Retain the existing distributor, attachment, terrain and configuration algorithms.
- **roomle-configurator-mcp:** this analysis and its indexes, terrain-analysis closeout, and later the example guide describing the combined tool set. The host needs no fence algorithms, tool schemas or second agent.

roomle-hi-example is a reference for the shared agent architecture. Neither the HI library nor an HI backend is needed for native fences.

## 1. Request and conclusions

The assistant should generate and manipulate fences alongside terrain: discover a suitable fence product, create an open or closed path, extend or reshape it, change dimensions and product parameters, place/move/remove gates or external elements, remove a complete fence, and inspect the resulting construction and bill of materials. The same assistant must be able to change terrain and then explain the effects on those fences.

The feature extends the five existing RoomlePlanner methods. It does not need another public facade, assistant flag, chat window, model loop, MCP transport or host integration. Activation remains `planningAssistant === true`, `fence === true` and a non-empty trimmed `apiKey`.

The main conclusions are:

1. **Fence geometry already exists in Core.** A construction contour carries a product-driven distribution of connectors/posts, modules/panels and split objects such as doors. The assistant describes the intended contour and configuration; it must not calculate post counts or distribute panels itself.
2. **The principal work belongs in lazy roomle-ui modules.** Add fence context, catalog/product discovery, scoped parameter queries, complete operations, schemas, tool descriptions and truthful results beside the terrain tools.
3. **A complete fence can already be demonstrated with existing calls.** In the local browser, item insertion followed by explicit construction drawing generated a real Biohort fence. The existing `runToolCall` interaction grouped creation into one undo step; undo, redo, extension, a parameter change and whole-fence removal worked.
4. **Interactive drawing is not a general polyline API.** The same begin/force/end sequence produced the requested path in desktop click mode, only one edge with continuous mode alone, and a second edge ending at Y=3350 instead of Y=2000 under mobile continuous/feedback settings. A small native construction-contour primitive is justified for a stable API that works independently of desktop/mobile drawing state. Changing the user's drawing mode around a tool call is not the recommended design.
5. **Product placement and group completion are different promises.** Insertion waits for the actual replacement construction object, but that does not prove every generated object, geometry and BOM update completed. Reuse producer promises and extend the native-object loading lifecycle in the SDK; preserve `pending` until a real completion contract exists.
6. **Object IDs must be mapped explicitly.** Planner object IDs, configurator configuration runtime IDs, root component runtime IDs, RAPI IDs and XML UIDs are distinct. A parameter read using a planner object ID returned no parameters; using its configuration runtime ID returned the native parameter list.
7. **Fence-wide and part-specific parameters have different semantics.** Whole-fence changes must use the merged native parameter's target IDs, not one arbitrary panel or every object indiscriminately. Panel height is not a generic fence-height setter.

This is a design and evidence document, not an implementation-plan document. The verification section defines acceptance coverage for later implementation.

## 2. Examined code, downloaded data and runtime evidence

### 2.1 Revisions

| Repository | Examined revision |
|---|---|
| roomle-configurator-mcp | `1d83cdb` on master, including merged terrain example PR 15; analysis branch `docs/fence-assistant-authoring-analysis` |
| roomle-ui | `7dd765ceb` on `feat/fence-assistant-terrain`, derived from `feat/configuration-assistant` at `d8a3693a0e2548602aefde42ca6596cbe89de3cb` |
| RoomleCore | `2e0d27a25` on `feat/fence-assistant-terrain`, including the per-floor-height dependency |

Merging the MCP example does not establish that its matching UI/Core changes are deployed. The browser probes below use the matching local UI and WASM.

### 2.2 Ticket and content

The ticket and its latest comments were read through the Jira CLI. The ticket snapshot was refreshed through `npm run rapi:plan -- ps_mpzobaibjtz9034jbpurb6t98fab0w8`. It contains the 10,000 × 7,500 mm flat terrain and no fence products. Therefore the snapshot alone cannot supply the product catalog or the rules needed to create a fence.

Actual RAPI content was downloaded with `npm run rapi:configuration -- ITEM_ID` for:

- `biohort_fence:biohort_fence_connector`: two components and three meshes;
- `biohort_fence:biohort_fence_door`: three components and eleven meshes;
- `biohort_fence:external_fence_element`: one component and no meshes.

Downloads live in ignored `RoomleCore/test/resources/configurations/__*` directories; the snapshot is under ignored `test/resources/plans/__*`. No downloaded data is committed.

The fetched connector's `planInteraction.construction` declares connector/module assembly parts, `distributedAlongContour`, distribution type, a distance range, step-height range, slope/deflection limits and connector dimensions. Some values are expressions such as `self.maxModuleLength` and `self.fencePostHeight`. Its valid parameter choices depend on other parameters. For example, available post heights depend on orientation, board spacing and fall protection. These Biohort facts are evidence, not rules to hard-code in general tools.

### 2.3 Browser probe

Temporary Playwright scripts exercised the actual local planner/WASM through existing APIs, with no model or AI requests. Source and JSON/log output are in ignored MCP `.temp/fence-authoring-probe.*` and `.temp/fence-authoring-mobile-drawing-probe.*`.

| Probe | Observation |
|---|---|
| Load ticket snapshot | One terrain patch and empty object list; history starts at position 0 |
| Insert connector at kernel XY (0, 0) | Public insertion returns the replacement construction object, planner ID 32 in this run; its configuration ID is 7 |
| Draw (0,0) → (3000,0) → (3000,2000) in click mode | Two `CONSTRUCTION` edges and seven initial construction objects; terrain edges remain separate |
| Insert and draw separately, or wrap public insertion/drawing in `executeWithInteraction` | History contains two steps; the nested insertion/drawing boundaries matter |
| Execute creation through the existing manager `runToolCall` | One history step; undo removes both edges and all objects, redo restores them |
| Extend from the last construction node | A third edge appears; one additional undo step |
| Read parameters with configuration IDs | Whole-fence list includes fence type, post height, spacing, fall protection and distribution; individual part lists differ |
| Set merged post-height parameter to an offered 885 mm value | Native read returns `885.00`; one additional history step |
| Insert a door near the first span | A door construction object attaches to the intended edge in this unambiguous flat example |
| Remove the complete generated fence | Zero construction objects/edges, the terrain patch remains; undo restores the fence |
| Repeat the two-segment path with continuous drawing type | Only the first edge (0,0) → (3000,0) exists, despite one committed history step |
| Mobile viewport with continuous drawing and snap feedback enabled | Two edges exist, but the final endpoint is (3000,3350), not the requested (3000,2000); the interactive snap/corridor behavior remains observable |

The probe recorded no browser page errors. These are concrete feasibility observations on this revision, not proof of the unimplemented API's complete behavior. Seven objects is an observed intermediate composition, not a universal fence count or certified final BOM. Waiting on a snapshot of existing view-model init promises does not prove a later redistribution cannot create more objects.

## 3. How fence generation works today

Paths below are relative to the named repository. Line references identify the examined revisions.

### 3.1 Native entities and distribution ownership

Construction nodes and edges are a separate domain: `NodeType::CONSTRUCTION` and `EdgeType::CONSTRUCTION`. They must enter the plan with their final types and do not create room/terrain floors. Drawing on or crossing a terrain boundary must not convert or share its ordinary nodes by accident.

The construction object records a main wall, additional walls and a normalized station on the main wall (`RoomleCore/src/planner/model/construction-object.h:46`, `:121`, `:136`). Its category identifies generated construction, door or external construction. Connectors/modules/doors/external roles and evaluated limits come from `ConstructionRules` (`src/shared/core/construction-rules.h:15`, `:36`). Native classification also handles cached rules and assembly-part stamps while configurations load (`src/planner/geometry/plan-geometry.cpp:4114`).

`ConstructionObjectEdgeDistributor` calculates spacing from the evaluated connector rules, including fixed distance/ranges, connector width, slope and step limits (`src/planner/geometry/construction-object-edge-distributor.cpp:82`). The pattern connector is resolved natively from the edge's connector placements (`src/planner/geometry/construction-object-constructor.cpp:466`). A module's unrelated distance range is not a replacement for the connector's distribution rules.

The SDK must retain this division: native contour and product rules produce actual stations, component scripts produce geometry, and SDK context describes the result. It must not copy these algorithms into TypeScript or ask the language model to calculate post counts.

### 3.2 Product loading and conversion

`RoomlePlanner.insertObject` fetches an item/configuration and delegates native insertion (`roomle-ui/packages/web-sdk/packages/planner-core/src/roomle-planner.ts:1058`). Its public coordinates are Three.js metres with Y up, whereas the fence/terrain operation API uses kernel millimetres with Z up. `convertToKernel` also negates the Three.js Z axis (`packages/web-sdk/packages/common-core/src/utils/kernel-utils.ts:25`). Reusing this method requires the inverse conversion exactly once, or an internal insertion adapter accepting kernel coordinates.

On configuration load, `Plan::configurationLoaded` calls `convertToConstructionObject` (`RoomleCore/src/planner/model/plan.cpp:1024`, `:1037`). A distributed item becomes a construction start connected to a typed construction node; doors/external elements become split objects and try to attach to a suitable wall (`src/planner/geometry/construction-object-constructor.cpp:1285`, `:1304`, `:1348`). The original plan object is removed and stores its replacement ID.

The existing SDK insertion path already waits for the original object's init, follows `getReplacementConstructionId`, waits for the replacement and returns its final planner ID (`roomle-ui/packages/web-sdk/packages/planner-core/src/services/planner-kernel-access.ts:1313`, `:1352`). Reuse it. Do not return the pre-conversion ID or infer the replacement from the last object added.

Generated assembly parts may have no catalog item ID: the browser probe found an item ID on the initial seed but empty item IDs on generated parts. Preserve native configuration/component provenance; do not discard those parts or invent item IDs.

### 3.3 Drawing and the need for a programmatic path

The ordinary UI starts contour drawing in fence mode (`roomle-ui/packages/web-sdk/packages/planner-core/src/webgl/planner-scene-event-handler.ts:1741`). Core auto-detects a construction start from an existing construction node/edge (`RoomleCore/src/planner/drawing/drawing-manager.cpp:361`). Explicit construction mode also exists.

Permanent drawing calls the constructor's distribution entry point for each new edge, then finalizes the seed connection when drawing ends (`src/planner/drawing/drawing-manager.cpp:290`, `:329`; `src/planner/geometry/construction-object-constructor.cpp:1752`, `:1844`). Existing fences therefore can be extended from their own nodes without inserting a second product seed.

However, `beginDrawing`, `forceNode` and `endDrawing` dispatch to the current drawing manager (`src/planner/interaction/plan-interaction-handler.cpp:2365`). Click mode creates the start node and explicitly forces vertices (`src/planner/drawing/click-drawing-manager.cpp:42`). Continuous mode uses a corridor, sampled points and a drawing angle (`src/planner/drawing/continuous-drawing-manager.cpp:19`, `:52`, `:120`, `:254`). Mobile selects continuous drawing (`roomle-ui/packages/web-sdk/packages/planner-core/src/webgl/planner-scene-event-handler.ts:1771`).

The mobile probe additionally enables snap feedback exactly as the UI does and produces a final Y of 3350 rather than 2000. Thus these calls are reusable implementation evidence but are not a drawing-mode-independent, camera-independent polyline contract. `setDrawingType` cancels/replaces the drawing manager (`RoomleCore/src/planner/interaction/plan-interaction-handler.cpp:2430`); temporarily changing that global setting risks the active gesture and configured behavior. A scoped native construction-contour operation should reuse the existing typed add/snap/cleanup/distribution services without driving the user's interactive drawing session.

Preserve the corner invariant in ADR 0096: one construction node at a fence corner, no tiny stub edge between near-coincident nodes, no later BOM filtering to hide a bad contour. See `RoomleCore/.agents/decisions/0096-a-fence-corner-is-one-construction-node.md` and `test/planner/drawing/construction-contour-draw-mode-test.cpp:21`.

### 3.4 Moving and resizing

The native handler already exposes `moveElementToIn2d`, `setLengthOfEdge2D` and `setLengthOfSlopingEdge` (`RoomleCore/src/planner/interaction/plan-interaction-handler.cpp:890`, `:2289`, `:2317`). Moving construction nodes registers their incident construction edges for final redistribution (`src/planner/interaction/move-element.cpp:72`). The SDK already classifies movement and length methods in its interaction table (`roomle-ui/packages/web-sdk/packages/planner-core/src/services/plan-interaction-manager/undo-redo/undo-redo-steps.ts:9`, `:33`).

Use contour node/edge edits to change fence shape or length. Generated modules/posts are derived state; moving one as if it were independent furniture does not express an edit to the whole fence. The operation must specify which endpoint stays fixed and distinguish projected XY length from sloping length. Return actual geometry and any snapping/corrections.

### 3.5 Whole-fence versus part parameters

The existing parameter APIs already distinguish these views:

- `getCommonPlanObjectParameters(configurationIds)` merges object/global parameters for a fence selection.
- `getPlanObjectParameters(configurationId)` returns the visible root-component parameter view for a generated construction part, and the ordinary object view for a door/external element.

The native routing is in `RoomleCore/src/configurator/configurator-kernel.cpp:581`, `:604`, `:776`. A generated part's non-global key is routed to its root component; global keys remain object parameters. `visible`, `visibleAsGlobal`, `visibleInPlanner`, `enabled`, current values, ranges and valid choices have distinct meanings.

SDK access is already available (`roomle-ui/packages/web-sdk/packages/common-core/src/configurator-kernel-access.ts:230`, `:248`). A merged parameter includes `objectIds` naming only the configurator objects that carry that parameter. In the probe, fence type targeted seven configurations while post height targeted four. Native batch writing exists through `changePlanObjectsParameter` and `setPlanObjectsParameter` (`packages/web-sdk/packages/planner-core/src/services/planner-kernel-access.ts:1771`; `packages/web-sdk/packages/common-core/src/configurator-kernel-access.ts:901`).

Map the public planner IDs to configurator IDs before reads/writes. Do not pass all planner IDs as parameter targets. Do not assume a single panel's parameter list is the fence-wide parameter list. Re-read dependent choices after changing an upstream parameter; fetch material/group metadata through existing RAPI services when required. Declared expressions are not evaluated choices.

Contour changes originate at the pattern connector. A generic fence-height tool should select a live offered parameter and its authoritative target list, rather than hard-code `fenceHeight`, change object Z or scale panel meshes. The native module/post ownership is documented in `RoomleCore/.agents/context/fence/fence-generation.md:725` and `:781`.

### 3.6 Doors, external elements and attachment

Doors and external construction objects split distribution; they are not arbitrary panels to distribute. Native placement searches for suitable walls and free spans (`RoomleCore/src/planner/geometry/construction-object-constructor.cpp:2027`, `:2051`). Door/window placement cuts out terrain slopes before choosing a free position (`:2075`). A door added to an existing fence takes matching contour global parameters (`:690`, `:1342`). Report its effective configuration after that inheritance.

When terrain changes, a door on a slope is relocated to a flat section before removal is considered. External construction objects can remain on slopes. Preserve ADR 0053 and the existing distinction; do not delete every sloped gate in SDK code or simulate a gate as a missing panel.

Existing insertion/movement chooses an attachment through native proximity/free-space rules. It does not accept an authoritative target edge ID. At a corner or among nearby parallel edges, deriving a world point does not guarantee the named edge will win. A strict `edgeId + distanceFromStart` operation therefore needs a small interaction wrapper around the existing native `attachConstructionObjectToWall` service, with history/dependency registration. Calling raw model setters from the SDK would bypass that lifecycle. A first version using only proximity placement must explicitly advertise best-fit semantics and return the actual edge/station rather than promise exact targeting.

Joining two doors through compatible fittings is a further native docking behavior, not basic placement. Its fitting compatibility, occupied docks and undo semantics need a separate explicit contract before exposing a join tool; dragging near a door is not a universal join API.

### 3.7 Deletion, grouping and exports

`PlanModelViewHelper::getGroupedObjects` obtains construction group membership from connected native edges (`RoomleCore/src/planner/view/plan-model-view-helper.cpp:1375`). Group membership is not a persistent fence ID and may include doors. An unattached seed and an empty construction edge need explicit treatment because object-based grouping alone cannot describe them.

`isDeletableInIsolation` rejects generated posts/modules, while doors and external elements can stand alone (`src/planner/geometry/plan-geometry.cpp:1201`). The UI composes that predicate with the complete selected group (`roomle-ui/packages/web-sdk/packages/planner-core/src/webgl/planner-scene-manager.ts:1095`). A removed generated post can be recreated by redistribution. Removing the last connector of an edge can remove that edge (`RoomleCore/src/planner/interaction/remove-element.cpp:87`, `:104`). Therefore a remove-fence operation must resolve its whole intended scope first, remove it in one interaction and inspect the resulting topology; it must not repeatedly delete posts until none happen to be visible.

Existing exports are usable: `RoomlePlanner.getConstructionOverview` and `create2DElevationPlan` (`roomle-ui/packages/web-sdk/packages/planner-core/src/roomle-planner.ts:1281`, `:549`). The native overview includes multiple construction categories and excludes external construction elements from the parts list (`RoomleCore/src/planner/view/plan-model-view-helper.cpp:1189`). It is not automatically fence-only in a mixed plan. Reuse its quantities/packaging; do not equate object count with purchased package quantity or include an external obstacle's geometry as fence material.

## 4. Gap in the existing Fence Assistant

The five facade methods and lazy registry are present (`roomle-ui/packages/web-sdk/packages/planner-core/src/roomle-planner.ts:3299`). Their four queries and eleven writes describe terrain only (`fence-api/fence-operation-types.ts:83`, `:107`). Context contains construction IDs but no fence paths, product/configuration provenance, roles, stations, parameter targets, gate placement or readiness.

The domain prompt explicitly says fence product authoring is outside the tool set (`fence-mcp/fence-agent-prompts.ts:1`). The result compares terrain state and returns terrain affected IDs (`fence-api/fence-operations.ts:540`, `:591`). Copying this comparison for a fence parameter change could miss a construction-only change. The hard-coded read-tool recovery list contains only the four terrain reads (`packages/embedding-lib/src/fence-agent/fence-planning-assistant.ts:29`); extend it with new reads so a failed catalog/parameter read is never described as an uncertain write.

The operation context currently supplies only manager access, plan loading and the feature gate (`fence-api/fence-native.ts:83`). Fence authoring needs internal access to native product loading, catalog/RAPI services, configurator parameters, view-model readiness and exports. Supply those existing services through the lazy operation boundary; avoid extra host methods or an import of the HI registry.

## 5. Proposed roomle-ui API and tools

### 5.1 Keep the existing public facade and one registry

Extend `FenceQueryPayloads`, `FenceQueryResults`, `FenceOperationPayloads` and `FenceOperationResult` behind:

- `queryFenceOperation(type, payload)`;
- `executeFenceOperation(type, payload)`;
- `getFenceAgentTools()`, `callFenceAgentTool(name, input)` and `getFenceAgentPrompts()`.

Keep current terrain tool names and contracts usable. Register new tools beside them in `fence-mcp-tools.ts`. The optional embedding fence adapter discovers definitions dynamically, so it needs no local product implementation. Ordinary startup, method enumeration and opening chat must still import no fence implementation/provider through this feature. Direct operations must remain usable without a model key; the key activates the assistant, not the SDK's editing capability.

A separate lazy `construction-operations.ts`/context module is reasonable for the new domain inside the existing operation boundary; it should not become another public dispatcher or duplicate the native lifecycle.

### 5.2 Proposed reads

Names are proposed SDK keys and tool names, not shipped APIs.

| Query / tool | Input | Required result |
|---|---|---|
| Existing `capabilities` / `get-fence-capabilities` | Existing empty payload | Advertised terrain and fence operations, native dependency availability, placement semantics, units and readiness limits; no implicit catalog download |
| `fences` / `get-fence-context` | Optional live representative object/edge IDs | Detached construction nodes/edges, connected groups, seed-only objects, actual placements, provenance, history and completeness |
| `fenceProducts` / `get-fence-products` | Optional tag/search/continuation within the configured catalog roots | Available item/configuration IDs, labels, thumbnails and declared construction role/source, pagination and unresolved metadata |
| `fenceParameters` / `get-fence-parameters` | Either whole-fence reference or one part/object ID | Native live parameter DTOs, values/choices, exact scope and mapped target IDs; a single generated part uses its part view |
| `fenceEditImpact` / `get-fence-edit-impact` | Explicit edit kind and object/node/edge scope | Native group/attachment scope, potentially changed/removed gates, shared junction consequences and deletion alternatives; estimates distinguished from actual results |
| `constructionOverview` / `get-fence-construction-overview` | Optional scope if supported | Existing native construction/BOM result and explicit plan/group scope, completion and pricing availability |

Catalog discovery should follow the configured catalog/tag relations using existing `RapiAccess.getTag`, `getTagsOf`, `getItemsOf`, `getItem` and `getConfiguration` (`roomle-ui/packages/web-sdk/packages/common-core/src/rapi-access.ts:545`, `:561`, `:612`). The existing UI catalog builder shows tenant/root, visibility and sorting semantics (`src/configurator/business-logic/sdk-connector.ts:254`; `src/common/utils/catalog-builder.ts:432`). Do not make planner SDK depend on a Vue store or assume every returned item is a connector. Multiple catalog roots must retain their meaning.

A product's unevaluated component definition describes candidate capabilities. It does not prove an active configuration's valid values. A read must not insert a temporary product into the live plan to discover those values. Use existing metadata services for candidates and native evaluated parameters once a real seed/configuration is available; report unavailable live evaluation explicitly.

### 5.3 Proposed writes

| Operation / tool | Proposed payload | Semantics |
|---|---|---|
| `createFence` / `create-fence` | `{ productId, vertices: [{x,y}], closed?, parameters? }` | Load a real connector/pattern product, resolve its replacement seed, create the complete native path, apply supported initial configuration and return actual composition in one history step |
| `extendFence` / `extend-fence` | `{ fromNodeId, vertices: [{x,y}] }` | Extend an existing construction node using its native pattern; do not insert a second seed at the same corner |
| `moveFenceNode` / `move-fence-node` | `{ nodeId, position: {x,y} }` | Move a construction node; let native terrain anchoring and redistribution update incident edges |
| `setFenceEdgeLength` / `set-fence-edge-length` | `{ edgeId, length, measurement: 'projected' or 'sloping', fixedEndpoint }` | Use native length editing with an explicit stationary endpoint and report all affected geometry |
| `setFenceParameter` / `set-fence-parameter` | `{ scope, key, value }` | Read native parameter targets; change only configurations that carry that key; convert the typed scalar to the existing kernel string representation and re-read effective values |
| `placeFenceObject` / `place-fence-object` | `{ productId, edgeId, distanceFromStart, parameters? }` | Place a gate or external element using native fit/terrain rules; use an exact target only when the required interaction is supported; expose actual placement and corrections |
| `moveFenceObject` / `move-fence-object` | `{ objectId, edgeId, distanceFromStart }` | Move an independent gate/external element, not a generated module, then re-read attachment/affected distribution |
| `removeFence` / `remove-fence` | Explicit current group reference or edge scope | Remove the intended complete fence or supported contour section, protect terrain/unselected branches and report dependent removals |
| `removeFenceObject` / `remove-fence-object` | `{ objectId }` | Remove an independently deletable gate/external element; redistribute the opening |
| Existing `undo` / `redo` | Existing empty payload | One ordinary planner history for terrain, fences and manual edits; no new ledger |

Use the same coordinate metadata as terrain: mm, XY horizontal, Z upward. Fence Z follows native terrain; it is not a second relief surface. Define `distanceFromStart` as the requested object's geometry-anchor station measured from the directed edge start, not a mesh center, clear opening width or arbitrary normalized position. Return footprint/span and effective station. For initial straight-edge support, length/station semantics are straightforward; curved placement needs authoritative native arc-length behavior before it is advertised.

Whole-fence parameter scope is a current native connected group reference, not a saved synthetic UUID. Part scope names one planner object; the SDK resolves its configurator/root IDs. Do not expose internal target arrays as model-authored IDs. Order dependent initial parameter changes through live native state; recompute valid choices and report corrections rather than caching the product's default choices.

BOM/SVG/image delivery should use the existing export APIs and output channel. An export read can return structured content or existing artifact links; returning large SVGs/base64 files in a tool prompt is not required. Saving a plan to RAPI remains separate from authoring and exports.

## 6. Context, results and compatibility

A plain fence context needs:

- current native plan ID, shared coordinate metadata and ordinary history;
- construction nodes with positions and connected construction edge IDs;
- construction edges with directed endpoints, projected/sloping lengths, curves and attached object IDs;
- native connected groups, with explicit standalone seeds/empty edges and no claim of a permanent fence identity;
- each object's planner ID, configuration runtime ID and root component ID where available, category/known construction role, item/configuration/component provenance, main/additional edges, native station, anchor/footprint, current readiness and deletion capability;
- scoped native parameters in their dedicated query rather than every parameter of every generated part in each context read;
- `complete`/`unresolved` information for missing definitions, pending rules, attachment ambiguity and older kernels.

Derive additional edge incidence from the existing native `Wall.getAttachedObjects` and each object's main attached wall; a new additional-walls binding is not essential merely to duplicate that information. Use the existing native group helper. Do not infer connector/module roles from catalog-name substrings or item IDs, because generated parts can have empty item IDs.

Expand results additively with construction context and actual created/removed/changed node, edge and object IDs. Retain terrain data/history fields for current callers. A fence-only parameter or gate move must be detected through construction/configuration state and history, even when terrain JSON is unchanged. Re-query after topology changes, replacement, undo/redo and loading.

`applied` describes observed changes, `history.changed` describes history, and `confirmed` requires the promised completion. A failed operation can have applied part of its work. A one-step history boundary is not transactional rollback. Return partial state and preserve an undo path; never repeat an uncertain creation or placement automatically.

Capability results must distinguish missing native primitives, unresolved product state and temporarily pending construction. Missing optional metadata should not disable every operation. Never advertise strict targeted placement or curved authoring from the presence of a generic move method alone.

## 7. Minimal Core surface

### 7.1 Recommended construction-contour primitive

Add one handler interaction such as `addConstructionContour(startNode, points)`:

- the start node is an existing construction seed or a valid connected construction node;
- points describe the remaining requested path in kernel coordinates; a closed SDK path returns to its start;
- native typed node/edge creation, same-domain topology reconciliation, intersection cleanup, terrain anchoring, initial distribution and seed finalization run through existing services;
- supplied world points use defined geometry tolerances and explicit connection targets, independent of view-pixel snap radii/corridor state; any optional geometric snapping has an explicit contract and returned correction;
- it operates independently of the user's active click/continuous drawing manager and does not alter the configured drawing type;
- it participates in the existing interaction/history and returns actual edge IDs; asynchronous product completion stays a separate result;
- invalid/degenerate paths, missing pattern configuration and collisions with existing topology get explicit native outcomes, not half-visible preview state.

The primitive is justified by the observed continuous-mode and mobile endpoint mismatches. It adds no new distribution algorithm, fence DTO hierarchy, native registry, product catalog, model prompt or batch parameter API. It should reuse the same services used by drawing, particularly `AddElement`, cleanup and `ConstructionObjectConstructor`. Simply creating ordinary walls and retyping them afterwards violates the typed-add invariant.

### 7.2 Reads and targeted placement

Two small read bindings are useful for authoritative context:

| Existing native state | Current binding gap | Proposed use |
|---|---|---|
| `ConstructionObject::getConstructionRules` (`construction-object.h:121`, `.cpp:216`) | Rules are not exposed in the current planner JSON interface | Read evaluated/cached rules as plain data; preserve unknown/pending state; no JS expression evaluator |
| `ConstructionObject::getNormalizedPositionAtWall` (`construction-object.h:141`) | Main wall is exposed, exact station is not | Report native attachment station; avoid mesh-center projection as a substitute |

`planner::getConstructionObjectType` can be exposed through a thin wrapper only if context needs the authoritative assembly-part fallback while rules are pending; otherwise report role unknown until rules resolve. Do not recreate its fallback logic independently in TypeScript. Binding source is `RoomleCore/interfaces/emscripten/definition/planner.json:2280`; regenerate normal C++/TypeScript/reference outputs.

For strict edge-targeted gate/external placement, add a narrow handler interaction around existing `attachConstructionObjectToWall(object, wall, ...)`, registering old/new affected edges and the object for history. It must retain native free-span, terrain and configuration inheritance behavior and return actual placement/fit status. This is a missing interaction boundary, not a new placement algorithm. Best-fit XY placement can ship using current APIs if its weaker contract is explicit.

No additional Core contour-context assembler, product parser, group-history API, terrain setter or whole-fence parameter setter is needed. Existing native movement, length changes, batch configurator parameters, grouping, deletion and construction exports should be reused.

## 8. History, async lifecycle and completion

The existing manager already owns one native history. `runToolCall` reuses/resumes one interaction across helper work (`roomle-ui/packages/web-sdk/packages/planner-core/src/services/plan-interaction-manager.ts:365`, `:396`). The browser probe verifies one-step fence creation through it. `executeWithInteraction` delegates the generic transaction (`roomle-planner.ts:3658`); nested item insertion and drawing can release that hold, which the two-step probe exposes. Reuse/generalize the existing operation-level boundary, rather than introducing a new fence ledger or calling hidden native lifecycle methods.

There are three separate completion facts:

1. The requested plan topology/configuration mutation has been applied.
2. Native interaction/history and dependent redistribution have completed their relevant rounds.
3. Every affected product configuration, generated geometry and BOM input has settled successfully.

Current insertion can prove the returned seed's init, not all three for an arbitrary contour. `planObjectConfigurationLoaded` forwards a callback, and the scene manager then requests component construction (`planner-kernel-access.ts:1142`; `webgl/planner-scene-manager.ts:2977`). A view model's `isInitDone` represents its initialization, not a fresh promise for every later configuration wave (`common-core/src/view-model/plan-object-view-model.ts:283`). A removed/replaced object can settle its init waiter during cleanup (`:293`).

The HI `reportedPlanChanges` collector tracks external/HI callbacks (`planner-kernel-access.ts:1527`), not every native construction reload. `awaitPendingConfigurationSaves` flushes persistence (`webgl/planner-scene-manager.ts:6329`), which is not proof of geometry/BOM readiness. Neither is a fixed delay, one frame, visible mesh, first configuration-loaded event or `Promise.all` over a pre-edit snapshot of objects.

The recommended SDK work is a producer-owned native construction update promise/result, attached where the real native object load/update work starts and resolved/rejected by that producer. It must include replacement and newly generated objects, reloads requested by interaction completion, failures and relevant construction completion. Reuse existing per-object producers and operation ownership; do not add polling, synchronization queues or event-generation counters to the agent layer.

Until that contract is implemented and tested, retain the terrain adapter's conservative `completion.construction: pending` / `confirmed: false`. A fence tool can report topology and actual applied edits while explaining that final construction/BOM completion is unconfirmed. Do not promote intermediate object counts to a verified BOM. Native redistribution continues normally.

Async creation also requires plan identity checks after product/network waits and before subsequent mutation. Resolve live targets again after those waits; do not retain disposed native handles across replacement. Resolve affected state before mutation and return detached results. For synchronous node/length edits, preserve the terrain path's one-call-stack mutation/commit/result discipline.

`runToolCall` groups nested calls; it is not a mutex for independent calls. Concurrent model writes, a manual drag/slider, loading another plan and user undo during pending product work need a defined shared operation-ownership policy. Integrate with existing UI/SDK interaction ownership and producer promises. Do not silently coalesce two independent requests into one step, override user options, leave interactive drawing active, or disable only the canvas while unrelated mutation paths continue uncoordinated. This is implementation acceptance work, not something the browser feasibility probe established.

## 9. Catalog, product and scope rules

- Discover candidates within the configured tenant/root tags and use current RAPI data. Do not hard-code Biohort IDs, dimensions, parameter names, max spacing, post count or gate widths into general tools.
- Use evaluated native values for edits. Describe declarative/default catalog information as such. Unknown content should produce explicit unresolved information, not a fabricated role or parameter list.
- Selecting a connector/pattern product selects its assembly; the assistant does not independently insert one panel and one post per interval.
- Use offered current parameter choices for height, finish, spacing and distribution. If a request is ambiguous, ask for the relevant product/side/value. If the SDK can normalize or apply a legitimate correction, report that correction rather than rejecting useful intent.
- Resolve a perimeter request against explicit terrain patches/edges and a stated direction. The SDK can derive the contour from current terrain boundaries; a separate perimeter tool is unnecessary initially. Steps, multiple patches, gaps and requested gate openings still need explicit meaning.
- Preserve native gate relocation/removal and show the actual consequence. A terrain change may remove a gate even if the tool requested only a slope edit.
- Treat branch/intersection topology and group scope explicitly. Cutting a fence into two groups or deleting one branch invalidates old group references.
- Replacing an entire fence product family is broader than changing supported parameters. Existing `swapObject` removes/adds one object (`roomle-planner.ts:2171`), not the whole patterned contour. Do not advertise whole-fence product replacement until pattern propagation, existing gates, local overrides, part provenance and undo are defined.

## 10. Alternatives considered

| Alternative | Why it is not selected |
|---|---|
| Another public fence assistant API/registry/chat | The existing fence facade and adapter already supply the domain boundary; extend them |
| Put product discovery/rules in the MCP example | Every other host would miss the implementation and native context; conflicts with lazy SDK ownership |
| Route fence edits through HI tools/backend | Native construction is not an HI external furniture group; wrong ownership and lifecycle |
| Generate a fence by inserting posts/panels manually | Duplicates native spacing, slope, corner, gate and BOM rules and breaks derived-state ownership |
| Use `drawWalls` then retype edges | Adds ordinary walls first, bypasses final-type creation and the construction distribution contract |
| Use the user's interactive begin/force/end calls as the complete API | Demonstrated drawing-type dependence and partial path in continuous mode; safe only as a feasibility prototype |
| Temporarily force click mode or turn snapping/raster off | Alters user-configured behavior and can cancel an active drawing; use a scoped native primitive |
| Add a large native fence assistant/context DTO service | Tools, schemas, context and orchestration can remain lazy TypeScript; only missing geometry interactions/reads belong in Core |
| Treat one successful seed load/save/mesh as final completion | Omits further generated objects and configuration waves; use producer completion or report pending |
| Query every object with one ID namespace | Planner and configurator IDs differ; native parameter targeting requires explicit mapping |
| Delete or move individual generated posts for whole-fence edits | Distribution recreates derived objects; modify contour/parameters or resolve complete removal scope |
| Use a single-object swap for whole-fence product replacement | It does not define propagation across the pattern, gates and local overrides |

## 11. Code and documentation affected by future implementation

This is an impact map, not an implementation sequence.

| Repository / area | Expected change |
|---|---|
| roomle-ui `planner-core/src/fence-api/fence-operation-types.ts` | Add query/write payloads, plain construction context, explicit ID/parameter scopes and additive results |
| `fence-native.ts`, new construction context module if needed | Read existing native plan/group/attachment state, dispose owned handles and map planner/configurator IDs |
| `fence-operations.ts`, lazy construction operation module if needed | Product/seed orchestration, programmatic contour interaction, edits, actual outcomes and shared history |
| `fence-schemas.ts` | Complete-operation inputs, scalar parameter values, explicit length/station units and scopes |
| `fence-mcp/fence-mcp-tools.ts`, `fence-agent-prompts.ts` | Add tools beside terrain; remove terrain-only authoring disclaimer once implemented; describe current product-driven choices, pending outcomes and no replay |
| `roomle-planner.ts` | Internal operation-service access, existing lazy facade/registry and exports; no second assistant API |
| `services/plan-interaction-manager.ts` and its dispatch table | Reuse operation-level history, classify new native interactions and make lifecycle assumptions explicit |
| `services/planner-kernel-access.ts`, scene/view-model producers | Authoritative native construction completion and failure propagation; do not reuse HI/persistence as a substitute |
| `typings/planner.ts`, SDK exports/type QA | New bound methods and additive public contracts |
| Embedding `src/fence-agent/fence-planning-assistant.ts` | Update read-tool recovery classification; existing discovery/forwarding and startup remain shared |
| SDK/embedding tests and operation/integration guides | Combined terrain/fence tools, limits, scopes, async and history regressions |
| RoomleCore interaction and small construction service | Drawing-mode-independent contour call and, for strict placement, targeted attachment wrapper using existing services |
| RoomleCore binding source/generator outputs | Thin existing-state getters and new primitive bindings; no hand-edited generated files |
| RoomleCore native/WASM tests and `.agents/context/fence/` | New primitive behavior and native invariants, domain/corner handling, targeted placement and history |
| MCP example context, README and `docs/fence-assistant-overview.md` | Document actual combined capability after implementation; no duplicate tools or provider loop |

UI implementation should branch from the accepted terrain implementation while retaining its `feat/configuration-assistant` ancestry. Core work should retain the terrain/per-floor-height dependency. This analysis changes neither checkout's productive source.

## 12. Verification scope

The following are required tests for implementation, not claims that the proposed API is already tested.

| Area | Required evidence |
|---|---|
| Public contracts and lazy imports | Existing five methods and terrain payloads work; new definitions are serializable; discovery/caching/retry remains per planner; no eager constructor, schema/provider or HI dependency from normal startup |
| Catalog and products | Empty/multiple roots, nested tags, pagination, visibility, unavailable definitions, non-construction candidates, connector/door/external roles, no hard-coded Biohort assumptions and no live-plan mutation during reads |
| IDs and context | Planner/configurator/component/RAPI/XML identities remain distinct; generated parts with empty item IDs, unknown/pending rules, detached native handles, empty edges, standalone seeds, branches and disconnected groups |
| Creation | Open/closed/concave paths, reversed direction, duplicate endpoints, invalid/self-intersecting requests with defined native handling, no unexpected terrain floor, seed replacement and failed definition load |
| Drawing independence | Identical intended contour across viewport/zoom changes and desktop click/mobile continuous configurations; user drawing type/options unchanged; active manual drawing is respected; near-coincident terrain/construction corners create no stub |
| Extension | Reuse an existing end or defined junction, preserve current pattern/configuration, connect standalone posts, avoid duplicate seeds/corner posts and return actual snapped endpoints |
| Movement and length | Node/edge scope, fixed endpoint, projected versus sloping lengths, terrain-following height, snapping corrections, shared junction changes and no-op/no step |
| Parameters | Whole fence versus post/module/door scope; configuration ID mapping; exact merged target list; visible/enabled flags, materials/groups, dependent choices, unsupported keys and effect of pattern parameters on newly generated parts |
| Gate/external placement | Correct requested/actual edge/station, reversed edge direction, near corners/parallel edges, blocked/short spans, overlapping objects, contour parameter inheritance, flat-ground door restriction and sloped external objects |
| Terrain interaction | Slopes/steps under posts and gates, native gate rescue/removal, affected topology, actual construction pending/failure, undo/redo restoring native placement |
| Deletion | Whole group, one supported branch/section, standalone seed, gate/external alone, generated post/module alone, shared/unselected boundaries, terrain preserved and undo restoring edges/attachments |
| History | One operation/one step including seed load and draw; no-op/no step; two calls/two steps; manual edit then assistant undo; redo invalidation and capacity; partial failure retains a usable undo path |
| Async correctness | Native replacement, new objects generated after commit, repeated configuration waves, asset failure, cancel before/after mutation, new plan or undo during pending load and concurrent model/manual requests |
| Result truthfulness | Construction-only changes detected, actual new/removed IDs and effective values, distinct applied/history/confirmed facts, pending never represented as a verified BOM |
| Exports and BOM | Native packaged quantities, external-element exclusion, mixed-plan scope, loaded/partial assets, existing overview/SVG APIs and output links without recomputed article counts |
| Browser round trip | Actual prompt → new fence tool → real native fence, part/global parameter edit, gate placement, terrain effect, undo and export on desktop/mobile using a mock model before any paid-provider check |
| Compatibility | Matching WASM dependency, meaningful missing-capability response on an older kernel, no advertised exact/curved support without the required contract |

Existing native tests to extend include `test/planner/drawing/construction-contour-draw-mode-test.cpp`, `test/planner/interaction/plan-interaction-construction-object-test.cpp` (parameter views, distribution changes, edge splitting, door inheritance) and `test/planner/configurable/plan-construction-object-test.cpp` (generated composition, gate movement/slopes, complete deletion and restored posts). Keep related scenarios in `SECTION`s and use committed/embedded fixtures; never reference downloaded `__*` scratch data in committed tests.

SDK tests should extend existing `planner-core/__tests__/fence-operations.ts`, facade and interaction-manager tests. Embedding tests must cover new read tools during interrupted-turn recovery. No productive source is changed by this analysis, and the existing full terrain test totals are not substitutes for these new contracts.

## 13. Remaining scope decisions

The proposed first version covers straight native contours, extensions, node/length edits, live global/part parameters, gates/external elements, complete removal and existing exports. It retains existing curve data in reads.

Curved fence authoring, arbitrary junction splitting/merging, whole-fence family replacement, explicit multi-door fitting joins, fence-layout optimization, setbacks/obstacles/legal boundary constraints and structural/installation verification need their own precise contracts. They should not be inferred from the presence of a generic wall/object API.

The two material implementation questions are the producer-owned construction completion contract and strict targeted gate placement. The recommended contour primitive has direct runtime evidence behind it. Neither question justifies moving schemas, tools, context assembly or the assistant runtime into Core.

## Implementation outcome

Implemented on `feat/fence-assistant-authoring` in RoomleCore, roomle-ui and this
repository. The branches preserve the approved terrain bases. The 29-tool registry
contains the original 15 terrain tools plus five construction reads and nine writes.
SDK schemas, catalog/parameter metadata, scopes, prompts and orchestration stay lazy;
Core adds two domain interactions and thin cached-rule/station/iterable reads.

The native set binding has no JavaScript iterator. An additive object-array binding
provides attachment incidence without changing that API. The existing node collection
is exposed as an array so standalone construction anchors are discoverable.

Synchronous edits mutate/commit/capture in one stack. Async insertion and native
parameter callbacks use the existing tool-call history and scoped operation owner.
Undo/load invalidate late calls; overlapping writers reject. Native aggregate geometry/
BOM completion remains unavailable, so dependent outcomes stay explicitly pending.
No new polling, timer, queue or native batch completion API is introduced.

Validation includes native C++ and actual WASM tests, SDK/embedding recovery tests,
full UI/SDK suites, builds and a packed SDK consumer. Real desktop/mobile probes
exercise every new write, catalog metadata, native parameter dependencies, exact gate
placement, ordinary history and a 200 mm terrain translation of the complete fence.
The original 3000-by-2000 path remains exact on both layouts.

Known validation limits: the Core Node suite retains the two baseline attic enum
conversion failures. Current-code and packed SDK consumers compile, while the older UI
compatibility check encounters existing migration exceptions whose grace period expires
on 2026-10-25. UI documentation lint reproduces the same 22 warnings and two dependency/test type errors on the exact base branch. These unrelated policies, documentation findings and attic behavior are unchanged.

Durable reference: [Fence Assistant contracts](../../docs/fence-assistant-overview.md#fence-authoring),
[example context](../context/minimal-fence-example.md) and
[the architecture decision](../decisions/0003-fence-authoring-runs-in-lazy-sdk-modules.md).
The analysis remains until implementation is reachable from every affected default
branch, as required by the analysis closeout skill. No branch is pushed by this work.
