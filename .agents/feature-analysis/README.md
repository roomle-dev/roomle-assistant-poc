# Feature Analyses

One document per feature question: a proposed feature, a change to an existing one, or *why* a
feature behaves the way it does. Written **before** the work, closed out **after** it.

Triggered by **"analyse the feature"** / **"analyze the feature"** / **"feature analysis"** — see
**Analysis Documents** in [`../../AGENTS.md`](../../AGENTS.md#analysis-documents).

## What belongs here

Point-in-time, decision-driving write-ups. The document must cover:

- what was asked and why
- how the area works today, with code/file references
- the gap or question the analysis answers
- the proposed design or change
- the alternatives considered and why they were rejected
- the code and documents the work would touch

## What does not belong here

**A description of how a feature works today.** That is living reference and belongs in
[`../../docs/`](../../docs/README.md) or the skill files under `.agents/skills/`. Everything in
this folder is a historical, point-in-time record.

## Close-out

When the feature is implemented, the description of how it works is promoted into the
appropriate living-reference document, and this document is set to `Implemented`.
When the approach is rejected, the reasoning is documented here and the document is set to `Rejected`.

Once the work is on `master`, the durable outcome is promoted and the document deleted.

## Current Documents

| Document | Status | Description |
|---|---|---|
| [get-configurator-capabilities.md](get-configurator-capabilities.md) | Implemented, branches not merged | The SDK capability collector, recursive component/item discovery, parameter and material data, and the read-only MCP tool |
| [configurator-example-with-planning-assistant-chat.md](configurator-example-with-planning-assistant-chat.md) | Implemented, branches not merged | The configurator example as host of roomle-ui's AI Planning Assistant window: the chat API moves to the shared callback base, the example gets a Mistral chat backend and a bridge, the first MCP server offers undo and redo, local only |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `simplified-docking-for-agents.md`).
