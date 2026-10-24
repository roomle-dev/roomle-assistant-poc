# queryConfigurationOperation

Reads the active native configuration without changing its configuration, selection, scene or
undo history.

```ts
queryConfigurationOperation(
  type: ConfigurationOperationQueryType,
  payload?: ConfigurationOperationQueryPayload,
): Promise<ConfigurationOperationQueryResult>
```

Use `instance.extended` in a configurator embedding or `instance.configurator` in planner isolation.
The [API overview](roomle-configurator-api-for-mcp.md) defines the shared lifecycle, serialization,
context fields and source locations.

## Example

```js
const api = instance.extended;
const snapshot = await api.queryConfigurationOperation('configuration');
const rootParameters = await api.queryConfigurationOperation('componentParameters', {
  runtimeId: snapshot.context.rootRuntimeId,
});
const globalParameters = await api.queryConfigurationOperation('globalParameters');
```

The configuration read returns a parsed object. The
[replacement operation](execute-configuration-operation.md#deletion-and-replacement) describes how
to load it again.

## Query catalog

Payloads are objects; `?` marks optional fields. A dash means the payload can be omitted.
Every result also contains the shared `type` and
[context](roomle-configurator-api-for-mcp.md#shared-context-and-json-data).

| `type` | Payload fields | Additional result fields | Agent tool |
|---|---|---|---|
| `capabilities` | `include?: ConfiguratorCapabilitySection[]` | `capabilities` | `get-configurator-capabilities` |
| `configuration` | — | `configuration` (parsed JSON), `configurationHash: string` | `get-configuration` |
| `componentParameters` | `runtimeId: number` | `runtimeId`, `componentId`, `groups`, `parameters` | `get-component-parameters` |
| `globalParameters` | — | `scope: 'planObject' \| 'rootComponent'`, `groups`, `parameters` | `get-global-parameters` |
| `possibleChildren` | `runtimeId?: number` | `runtimeId`, `tags`, `defaultChild` when available | `get-possible-children` |
| `dockingPositions` | `child: ConfigurationOperationDockingChild`, `allowInsertInBetween?: boolean` | `allowInsertInBetween`, `dockPairs` | `get-docking-positions` |
| `componentDockingPositions` | `runtimeId: number`, `allowInsertInBetween?: boolean` | `runtimeId`, `allowInsertInBetween`, `dockPairs` | `get-component-docking-positions` |
| `deleteImpact` | `runtimeId: number`, `redockChildrenToParent: boolean` | `runtimeId`, `redockChildrenToParent`, `deletable: boolean`, `componentsDeleted: number[]` | `get-delete-impact` |

The six allowed `include` values and the nested `capabilities` result are documented in the
[capability reference](get-configurator-capabilities.md#the-result). Omitted or empty `include`
requests all sections. A partial capability collection is a successful result with
`capabilities.complete: false` and `capabilities.unresolved`; the agent tool returns that nested
payload directly.

## Parameters, children and delete impact

`componentParameters` returns current kernel-evaluated parameters and their groups.
`globalParameters` reads the root component when `rootComponentParametersAsGlobal` is enabled,
or the plan object otherwise; `scope` reports that choice. The corresponding
[parameter writes](execute-configuration-operation.md#parameter-changes) use the same routing.
The kernel's non-enumerable `viewType` enum is projected to `{ value }` in parameter results.

`possibleChildren` with no `runtimeId` reads the active plan object's children; with one, it reads
that component's children. Both paths request currently possible and visible children and return
their tags and optional default child. These are eligible choices; use the docking queries for
calculated placements.

`deleteImpact` reports whether the component can be deleted and the runtime IDs a deletion with
the supplied `redockChildrenToParent` flag would remove. The flag is required: `true` attempts to
dock children back to the parent; `false` deletes them with the component. Deletability follows
the SDK's `isComponentDeletable` permission/`reDock` feature-flag logic. An unknown component
returns `deletable: false` and `componentsDeleted: []`. A locked component reports
`deletable: false`; the query itself performs no deletion.

## Docking child sources

`ConfigurationOperationDockingChild` is an object containing exactly one of:

| Field | Value and resolution |
|---|---|
| `componentId: string` | Catalog component ID; the SDK fetches its definition through RAPI |
| `itemId: string` | Catalog item ID; the SDK fetches its preset assembly configuration through RAPI |
| `configuration: string` | Serialized assembly JSON; supply a string with a root `componentId` |

For an item or assembly, the SDK preloads its root component definition into the kernel's
definition cache once. This definition load does not replace the active configuration.
A missing or invalid assembly root fails during source resolution or kernel evaluation.
The [dockComponent operation](execute-configuration-operation.md#docking-and-moving) uses the same
child-source contract.

## Docking results

`dockingPositions` evaluates a possible child against the active plan object.
`componentDockingPositions` evaluates an existing component in that configuration.
Both call the kernel's pure `getDockPairs` evaluation, including collisions.
`allowInsertInBetween` defaults to `false`; `true` additionally evaluates positions between
existing siblings. Neither query starts a drag/docking process or draws preview geometry.

Each `dockPairs` entry is a detached `KernelDockPairPreview`:

| Fields | Meaning |
|---|---|
| `parentId`, `parentDockId`, `childId`, `childDockId`, `type` | Component/dock identities and dock-pair type |
| `position`, `rotation`, `insertInBetween` | Evaluated placement and insertion mode |
| `displacedChildId`, `displacedChildTransform`, `displacedComponents`, `displacementVector`, `displacementRotation` | Displacement caused by insertion |
| `positionFrom`, `positionTo`, `lineFrom`, `lineTo`, `lineSegments`, `areaWidth` | Line-docking geometry, where applicable |

Use the chosen pair's placement fields for a
[dock or move](execute-configuration-operation.md#docking-and-moving); the write reference defines
which fields each operation accepts and provides a query-to-write example.

## Errors and freshness

Unknown types reject with `Unknown configuration operation query type '…'` and the supported
names. Invalid payloads reject with `Invalid payload for query '…': …`. Both validations happen
before a kernel call. Required runtime IDs must be finite numbers; required flags must be booleans.

`componentParameters`, `componentDockingPositions` and `possibleChildren` with a runtime ID reject
unknown components and components belonging to another plan object. The unknown-component
result for `deleteImpact` is described above. Lifecycle failures follow the
[shared prerequisites](roomle-configurator-api-for-mcp.md#shared-lifecycle-and-serialization).

If the captured target, selection, configuration or parameter scope changes during the read, the
call rejects with `Configuration or selection changed while reading capabilities; read again`.
Read again after the edit completes. A successful result describes one captured snapshot;
compare `context.configurationHash` across reads to detect configuration changes.
