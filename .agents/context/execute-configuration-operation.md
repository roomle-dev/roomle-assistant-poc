# executeConfigurationOperation

Edits the active native configuration and reports the resulting configuration hash and committed
history outcome.

```ts
executeConfigurationOperation(
  name: ConfigurationOperationName,
  payload?: ConfigurationOperationExecutePayload,
): Promise<ConfigurationOperationResult>
```

Use `instance.extended` in a configurator embedding or `instance.configurator` in planner isolation.
The [API overview](roomle-configurator-api-for-mcp.md) defines shared lifecycle, serialization,
context fields and source locations. Use
[queryConfigurationOperation](query-configuration-operation.md) to inspect the current values,
placements and deletion impact before editing.

## Operation catalog

Payloads are objects; `?` marks optional fields. A dash means the payload can be omitted.
Every result also contains `type`, `context`, `configurationHash` and `history`, defined below.

| `name` | Payload fields | Additional result fields | Agent tool |
|---|---|---|---|
| `changeComponentParameter` | `runtimeId: number`, `key: string`, `value: string` | `runtimeId`, `key`, `value` | `change-component-parameter` |
| `changeGlobalParameter` | `key: string`, `value: string` | `scope: 'planObject' \| 'rootComponent'`, `key`, `value` | `change-global-parameter` |
| `dockComponent` | `child: ConfigurationOperationDockingChild`, `parentId: number`, `parentDockId: number`, `position?: { x: number, y: number, z: number }`, `insertInBetween?: boolean` | `runtimeId` of the new root component | `dock-component` |
| `dragComponent` | `runtimeId: number`, `parentId: number`, `parentDockId: number`, `childDockId: number`, `position?: { x: number, y: number, z: number }`, `insertInBetween?: boolean` | `runtimeId` | `drag-component` |
| `deleteComponent` | `runtimeId: number`, `redockChildrenToParent: boolean` | `runtimeId`, `redockChildrenToParent`, `componentsDeleted: number[]` | `delete-component` |
| `loadConfiguration` | `configuration: string` | — | `load-configuration` |
| `undo` | — | — | `undo` |
| `redo` | — | — | `redo` |

## Result contract

| Field | Meaning |
|---|---|
| `type` | Operation name |
| `context` | [Shared context](roomle-configurator-api-for-mcp.md#shared-context-and-json-data), captured before the operation |
| `configurationHash` | Hash of the resulting active configuration |
| `history` | `{ changed: boolean, canUndo: boolean, canRedo: boolean }` from native committed history |

Compare a later query's `context.configurationHash` with the resulting `configurationHash` to
check the current configuration against the operation result. For parameter writes, returned
`key` and `value` echo the request; read the parameters again for the kernel-evaluated value.

## Parameter changes

Choose a key from the current `componentParameters` or `globalParameters` query. Values must be
strings, including numeric, Boolean and object values in the kernel's serialization. Empty value
strings are accepted by payload validation; keys must be non-empty.

An unknown or disabled parameter rejects before changing it. `changeComponentParameter` also
rejects keys beginning with `animation:`, which belong to the UI animation system. The SDK
resolves the current parameter; the kernel validates or clamps its value.

`changeGlobalParameter` follows the scope reported by the
[globalParameters query](query-configuration-operation.md#parameters-children-and-delete-impact)
and includes that `scope` in its result.

## Docking and moving

`dockComponent` creates and docks a child in one kernel `dockNewComponent` call. The
[child-source contract](query-configuration-operation.md#docking-child-sources) is shared with the
`dockingPositions` query. Query placements for the same child, select a pair and pass its
`parentId`, `parentDockId`, optional `position` and `insertInBetween`. The insertion flag defaults
to `false`.

The operation accepts no `childDockId`; supplying it directly rejects. The kernel resolves the
child dock from the parent dock's mask. The agent tool's schema strips read-only pair fields
before forwarding, so its pasted-pair convenience differs from the direct SDK call.

```js
const api = instance.extended;
const child = { componentId: 'vendor:child' };
const placements = await api.queryConfigurationOperation('dockingPositions', { child });
if (placements.dockPairs.length === 0) {
  throw new Error('No docking position is available for this child');
}
const { parentId, parentDockId, position, insertInBetween } = placements.dockPairs[0];
const docked = await api.executeConfigurationOperation('dockComponent', {
  child,
  parentId,
  parentDockId,
  position,
  insertInBetween,
});
const parameters = await api.queryConfigurationOperation('componentParameters', {
  runtimeId: docked.runtimeId,
});
```

The kernel checks collisions during create-and-dock. A colliding placement rejects and removes
the created component. No preview ghost or free-flying intermediate is left in the configuration.
Use the returned `runtimeId` to address the new component.

`dragComponent` moves an existing component to a pair returned by `componentDockingPositions`.
It additionally requires `runtimeId` and `childDockId`. The SDK calls the same `dockComponent`
wrapper as a UI drop, including `onUserInitiatedDockDone`. The payload accepts and validates
`insertInBetween` (default `false`); the wrapper does not forward a separate insertion flag.
The kernel's UI-drop binding determines insertion at an occupied dock. Use the queried pair's
IDs and position.

## Deletion and replacement

Read `deleteImpact` with the intended `redockChildrenToParent` value before deleting.
`deleteComponent` uses the same SDK deletability check, rejects locked components and captures
`componentsDeleted` before deleting. The flag either attempts to re-dock children to the parent
or deletes them with the component.

`loadConfiguration` requires serialized configuration JSON with a non-empty root `componentId`.
For a configuration returned by a query, pass `JSON.stringify(result.configuration)`.
The operation uses the scene manager's `reloadConfiguration` path, retaining native history.
In planner isolation the scene manager updates the isolated plan object. The public full-startup
`loadConfiguration` method is a separate API.

## History and completion

The operation chain reads native history before and after execution. `history.changed` is true
only when the committed history hash changes and matches the resulting `configurationHash`.
`canUndo` and `canRedo` come from that history service, rather than being inferred from hash
differences.

A changed edit records one native history step. Setting an unchanged value adds no step and
preserves redo availability. A returned configuration hash that history has not committed is
reported as `changed: false`; inspect the current configuration before trying another write.

`undo` and `redo` await the existing native reload methods and navigate the same history as the
UI, including manual edits and configuration replacements. With no available step they resolve
with `changed: false`.

The SDK result above is distinct from the agent tool result:

| Tool | History adaptation |
|---|---|
| Six write tools | Replace `history` with `confirmed: history.changed`, `canUndo`, `canRedo`; keep the other operation fields |
| `undo` / `redo` | Return `undone` / `redone` from `history.changed`, with `canUndo` and `canRedo` |

Tools add a hint for an unconfirmed or empty-history outcome.

## Errors and recovery

Unknown names reject with `Unknown configuration operation '…'` and the supported names.
Invalid payloads reject with `Invalid payload for operation '…': …`. Both validations happen
before a kernel call. Numeric IDs and position coordinates must be finite numbers.

Component parameter changes, moves and deletions reject unknown components or components outside
the active configuration. Lifecycle failures follow the
[shared prerequisites](roomle-configurator-api-for-mcp.md#shared-lifecycle-and-serialization).
Parameter, deletion and docking errors follow the rules above.

If state changes during preparatory parameter reads or docking-source resolution, the freshness
check rejects with `Configuration or selection changed while executing the operation; the operation was not applied`.
Read the current state and recalculate the intended operation before retrying.
The shared chain orders API calls but does not reserve a dock pair between a query and a write.

Validation and pre-mutation freshness failures leave the requested edit unapplied. A transport
interruption or delegated reload failure does not itself establish whether a change landed.
Inspect configuration and history before repeating a write; interrupted assistant turns do not
automatically replay uncertain edits.
