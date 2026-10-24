# 0001 — SDK-owned configurator capabilities

Status: Accepted
Date: 2026-10-17

## Context

The agent needs both recursively declared product alternatives and current native configurator choices. Runtime state, RAPI access and kernel semantics belong to roomle-ui. The host reaches them through public RoomleConfigurator methods.

## Decision

Keep discovery in a dynamically imported SDK collector behind `RoomleConfigurator.getConfiguratorCapabilities(include?)`. Return detached JSON with six optional sections and a context/completeness envelope. Preserve catalog IDs separately from runtime IDs, and declarations separately from evaluated kernel choices. Reject reads whose target/state changes during collection; retain partial catalog results with unresolved resources.

The configurator-owned agent registry validates section names and calls the native operation API directly. The embedding adapter forwards discovery and execution through the existing message channel. Prompts and recovery distinguish inspection from changes. An older UI is reported as unavailable.

## Alternatives

A server-side product interpreter would duplicate kernel and SDK knowledge and could disagree with the active session. Returning only current parameters would omit dormant alternatives. Returning raw definitions would leave IDs/groups unresolved and include rendering source. Adding mutations or a docking solver is outside this read API.

## Consequences

A compatible UI is required for the read. Catalog discovery can be incomplete, particularly offline; agents must respect `unresolved`. The SDK owns authoritative material-group caching: arbitrary subsets cannot establish complete group membership. The native tool registry uses SDK completion and history outcomes.

The public contract is maintained in [the assistant guide](../../docs/configurator-assistant.md).
