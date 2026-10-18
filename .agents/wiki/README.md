# Wiki

Living-reference pages that answer a recurring question once, in one place: how an area works today,
which API covers which need, which decision was taken and why. A wiki page is **not** an analysis —
analysis documents in [bug-analysis](../bug-analysis/README.md),
[feature-analysis](../feature-analysis/README.md) and
[refactoring-analysis](../refactoring-analysis/README.md) are point-in-time records with a lifecycle;
a wiki page has none. It says what holds today and is updated when the behaviour it describes changes.
It carries no ticket numbers — those belong to the analyses, the backlog items, the pull requests and
the Jira comments.

## What belongs here

- A durable answer to a question that comes up again: an API map, a data-flow summary, a contract
  between this repository and another one, a decision record that is not an ADR.
- Current `file:line` references, checked against the code when the page is written or updated.

## What does not belong here

- Investigation narratives, status history or the record of a failed attempt — those are analysis
  documents.
- Open work — that is the [backlog](../backlog/README.md).
- On-demand domain knowledge for a task — that is a [skill](../skills/configurator-mcp-server.md).
- End-user documentation — that is [`docs/`](../../docs/README.md).

## Current Documents

| Document | Covers |
|---|---|
| [The roomle-ui configurator API for the MCP server](roomle-configurator-api-for-mcp.md) | The queries and operations the MCP server needs, which parts of roomle-ui's `RoomleConfigurator` public API already cover them, and which parts are missing |

Add wiki pages as needed following the naming convention: `kebab-case-description.md`
(e.g., `page-bridge-protocol.md`).
