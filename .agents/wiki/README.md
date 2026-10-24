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

- A durable answer to a recurring question that is not source-code documentation or an API
  contract. Source-code architecture, data flows and API contracts belong in
  [context](../context/README.md).
- Current `file:line` references, checked against the code when the page is written or updated.

## What does not belong here

- Investigation narratives, status history or the record of a failed attempt — those are analysis
  documents.
- Open work — that is the [backlog](../backlog/README.md).
- On-demand domain knowledge for a task — that is a [skill](../skills/configurator-assistant.md).
- End-user documentation — that is [`docs/`](../../docs/README.md).

## Current Documents

No wiki pages. The native configurator API references are indexed in
[context](../context/README.md).

Add wiki pages as needed following the naming convention: `kebab-case-description.md`
(e.g., `choosing-an-example.md`).
