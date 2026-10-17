# 0001 — SDK-owned configurator capabilities

Status: Accepted
Date: 2026-10-17

## Context

The MCP server needs both recursively declared product alternatives and current native configurator choices. Runtime state, RAPI access and kernel semantics already belong to roomle-ui. The page bridge is restricted to public RoomleConfigurator methods.

## Decision

Keep discovery in a dynamically imported SDK collector behind `RoomleConfigurator.getConfiguratorCapabilities(include?)`. Return detached JSON with six optional sections and a context/completeness envelope. Preserve catalog IDs separately from runtime IDs, and declarations separately from evaluated kernel choices. Reject reads whose target/state changes during collection; retain partial catalog results with unresolved resources.

The MCP server validates section names and relays the response through protocol 2. Reads do not join the history mutation queue. Prompts and recovery distinguish inspection from configuration changes. The example checks method availability and reports an upgrade message for an older UI.

## Alternatives

A server-side product interpreter would duplicate kernel and SDK knowledge and could disagree with the active session. Returning only current parameters would omit dormant alternatives. Returning raw definitions would leave IDs/groups unresolved and include rendering source. Adding mutations or a docking solver is outside this read API.

## Consequences

A compatible UI is required for the read. Catalog discovery can be incomplete, particularly offline; agents must respect `unresolved`. The SDK owns authoritative material-group caching: arbitrary subsets cannot establish complete group membership. Use the existing 30-second bridge deadline until measurements justify changing it.

The public contract and operation are maintained in [the server reference](../../docs/configurator-mcp-server.md#tools).
