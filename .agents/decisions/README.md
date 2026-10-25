# Decisions (ADRs)

Architecture Decision Records: numbered documents that record *why* the code is shaped the way it is, and which approaches were deliberately rejected. ADRs stop an agent from re-proposing something the team already ruled out.

ADRs are living reference. They are read before proposing a change to an area they cover. A superseded ADR is kept with its superseding reference — never deleted.

## ADR Format

Each ADR carries:

- A title in the form `NNNN — short description`
- Status: `Accepted`, `Superseded by NNNN`, `Rejected`
- Date
- Context — the situation and the forces at play
- Decision — what was decided
- Alternatives — the approaches considered and why they were rejected
- Consequences — the positive and negative outcomes of the decision

## Current ADRs

| ADR | Title | Status |
|---|---|---|
| [0001 — SDK-owned configurator capabilities](0001-sdk-owned-configurator-capabilities.md) | The SDK owns capability discovery and its agent tool returns the result | Accepted |
| [0002 — Configurator tools run in the SDK](0002-configurator-tools-run-in-the-sdk.md) | Lazy iframe tools, shared host assistant and a static example | Accepted |
| [0003 — Fence authoring runs in lazy SDK modules](0003-fence-authoring-runs-in-lazy-sdk-modules.md) | Native interaction boundary, shared ownership and truthful completion | Accepted |

## Adding an ADR

1. Write the ADR in this folder with the next sequential number (e.g. `0002-next-decision.md`).
2. Add a row to the table above.
3. Add a row to the Decisions table in `.agents/README.md`.
