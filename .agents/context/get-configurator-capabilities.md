# Configurator capabilities for the configurator MCP

`get-configurator-capabilities` is a read-only tool of the configurator's on-demand SDK registry: an AI
agent reads what the connected configurator can be — the recursively declared product options — and
what is currently valid in the live session. The result distinguishes **declared possibilities** from
**currently evaluated choices**: reading only the current parameters misses dormant components and
conditional alternatives; reading only component definitions misses evaluated conditions,
shared-parameter intersections and material-group contents. The contract is one SDK read —
`RoomleConfigurator.queryConfigurationOperation('capabilities', { include })`, built on
`getConfiguratorCapabilities(include?)` — and one SDK-owned agent tool
that returns it. The design decision is [ADR 0001 — SDK-owned configurator
capabilities](../decisions/0001-sdk-owned-configurator-capabilities.md); the user-facing reference is
[the assistant guide](../../docs/configurator-assistant.md).

## The call chain

```text
MCP tool get-configurator-capabilities
  → embedding callConfiguratorAgentTool through the normal message channel
  → configurator SDK tool registry
  → queryConfigurationOperation('capabilities', { include })
  → iframe RoomleConfigurator: dynamic import of the operation implementation
  → getConfiguratorCapabilities(include?): dynamic import of the collector
  → collector in roomle-ui common-core/src/mcp-api/configurator-capabilities.ts
  → JSON result over the same route
```

The SDK methods are thin: they dynamically import the collector on first call — keeping the
collector out of the initial SDK bundle — and delegate with the current configurator context,
kernel access and RAPI access. The embedding-lib announces every public prototype method
automatically, so the generic API reaches a configurator page as
`instance.extended.queryConfigurationOperation` and, in the planner's isolation mode, the planner's
inner configurator as `instance.configurator…`. The public
types are exported type-only from the web-sdk index, and the contract for embedders is documented in
roomle-ui's `packages/embedding-lib/docs/configurator-capabilities.md`.

## The result

The result is plain JSON — never a Promise, `Map`, Emscripten container or a reference to a mutable
cached DTO. It always carries a small envelope plus the requested sections:

| Part | Content |
|---|---|
| `context` | The configuration runtime ID, the root runtime ID, the root catalog component ID, the selected runtime IDs and the snapshot's configuration hash |
| `complete` | Whether the requested declared graph and metadata were collected — not whether every hypothetical configuration or docking combination has been evaluated |
| `unresolved` | Entries identifying a resource/section and the reason it is missing |

`include` selects sections; omitted or empty requests all six. Invalid names are rejected before
the SDK operation is called.

| Section | Contents |
|---|---|
| `configuration` | The parsed current configuration JSON plus a runtime instance tree with parent/child IDs and catalog IDs — the authorable configuration kept separate from runtime inspection data |
| `components` | One compact record per definition: ID, localized label, metadata, parameter-group metadata, possible-child references with conditions/visibility/default/group expressions, subcomponent assignments and supersedings, and configuration-relevant update expressions. Geometry/export/rendering source and asset payloads are omitted |
| `items` | One record per referenced item: ID, label, thumbnail URL, root ID and the parsed configuration including its preset parameters and children |
| `parameters` | `declaredByComponent` for candidate declarations, conditions and default/range expressions; `current` for the kernel-evaluated global parameters and per-runtime-component parameters — declared and evaluated data are labelled separately |
| `materials` | A deduplicated ID-indexed material dictionary and group-to-material membership. Labels, thumbnails and colour metadata enrich the IDs used by parameters; source membership does not imply a parameter currently permits the material |
| `docking` | Definition-level parent/child/sibling docking constraints and per-runtime-component evaluated possible children. A selectable child is distinguished from a validated dock pair; the section does not promise a ready-to-apply placement |

Two identity systems run side by side and neither substitutes for the other: **runtime IDs** address
instances of this session, **catalog IDs** address definitions and presets.

## Discovery

For the catalog-related sections the collector runs a worklist with visited component and item ID
sets, seeded from the active root and every component in the captured configuration — including
already docked components a current possible-child condition no longer offers. It follows every
`possibleChildren.componentId` / `possibleChildren.itemId`, legacy `validChildren` ID and
`subComponents.componentId`, keeping conditional and inactive declarations in the declared graph; it
parses each item's configuration and traverses every node's `componentId` and `children`, preserving
each item as a separate choice even when several items share a root component; it expands declared
Material groups — including conditional groups whose condition is currently false, with their
conditions preserved — and collects explicit and current Material IDs. Repeated IDs and cycles
terminate by the visited sets. A `configuration`-only read does not crawl the catalog or fetch
materials; a `materials` read needs the parameter declarations to discover the groups.

Parameter semantics the JSON preserves:

- All candidate sources are read — `validValues`, `valueObjects`, `localizedValues`,
  `conditionalValues`, `validGroups`, `conditionalGroups` and `validRange`; the four value lists are
  merged, not alternatives.
- In evaluated Material parameters, known groups are already expanded into `validValues` and
  removed from `validGroups`; the collector resolves IDs from explicit values, group members and
  the current material value, keeps source provenance and deduplicates material records by ID. No
  values/groups/range does not mean unrestricted input: the kernel's current value is preserved
  instead of inventing an unlimited choice list.
- A global parameter may be the intersection of several components, not the root's declaration; the
  kernel's global result is read separately. Conditions, range bounds/steps, visibility, enabled
  state and supersedings remain kernel responsibilities.
- Numeric/Boolean/Object parameter values stay in the kernel's established serialized representation,
  with their type and unit.

## Read semantics

- The read changes no configuration, selection or history and does not wait for a history event.
  It joins the SDK operation chain with other reads and writes. It may fetch catalog metadata, so it is not an offline-only
  tool.
- The active target is established from the configuration runtime ID and the actual kernel root —
  not from the last loaded RAPI ID. Outside an active configurator or isolation session the read
  rejects with an actionable error instead of reading a stale selection.
- Runtime state is captured into detached data before any remote enrichment, and the active
  configuration ID/hash is rechecked before returning: a concurrent edit or an isolation exit
  invalidates the snapshot and rejects the call. The caller reads again after an edit completes.
- Failures stay visible: requested material IDs are compared with the returned records, missing
  metadata is reported, and cached/offline group data is never declared authoritative. Useful
  partial catalog data returns with `complete: false`; an invalid or missing component or item
  configuration identifies the affected resource.

## The agent tool

- The tool is registered in roomle-ui's `configurator-mcp-tools.ts` with a Zod `include` array of the six
  section names, annotated read-only, non-destructive, idempotent and open-world. Its description
  says that it reads the connected configurator, explains declared versus currently valid choices,
  and does not change the product.
- The embedding adapter lists the iframe's definitions and forwards each call. The result passes
  through as JSON text. A UI without the agent methods produces an explicit upgrade message.
- The SDK-owned prompt tells the agent to inspect capabilities for
  product questions, to use current kernel choices for what is available now, and to acknowledge
  unresolved information when `complete` is false. Chat recovery describes an interrupted read as
  an incomplete read — never as a possible unconfirmed change — and never prints a full
  capabilities payload.

## Docking boundary

The kernel determines compatibility from evaluated docking definitions and the actual assemblies;
the read provides discoverable children and docking constraints, explicitly marked as declarations
or current eligibility. It does not calculate dock IDs, rotations, line positions or displacement,
and it is not a "valid placements for any future product" solver. The docking reads
(`get-docking-positions`, `get-component-docking-positions`) ask the kernel for the valid
candidates, and the write tools (`dock-component`, `drag-component`) perform the concrete docking
operation at a queried pair.

## Where things live

| Area | Files |
|---|---|
| Agent tool and schema | roomle-ui `configurator-core/src/configurator-mcp/` |
| Example host | `minimal-configurator-example/index.html` |
| Prompts and recovery | roomle-ui `configurator-core/src/configurator-mcp/agent-prompts.ts`, embedding-lib `src/configurator-agent/chat-recovery.ts` |
| SDK method (thin, dynamic import) | roomle-ui `configurator-core/src/roomle-configurator.ts` (`getConfiguratorCapabilities`) |
| Collector and public types | roomle-ui `common-core/src/mcp-api/configurator-capabilities.ts`, exported type-only from `packages/web-sdk/packages/index.ts` |
| Embedder contract | roomle-ui `packages/embedding-lib/docs/configurator-capabilities.md` |

## See also

- [The feature index](README.md) — every feature context document
- [ADR 0001 — SDK-owned configurator capabilities](../decisions/0001-sdk-owned-configurator-capabilities.md)
- [Configurator assistant](../../docs/configurator-assistant.md) — the user-facing
  reference: the tools, their results, running and connecting them
- [The configurator assistant skill](../skills/configurator-assistant.md) — the capabilities
  read, adding a tool, tests
- [The roomle-ui configurator API for agent tools](../wiki/roomle-configurator-api-for-mcp.md) —
  the API map, including the implemented query and operation catalogs
- [The configurator example with the AI Planning Assistant chat](configurator-example-with-planning-assistant-chat.md)
  — the chat that asks the product questions
