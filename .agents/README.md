# Digital Brain Index

## Purpose

The Roomle configurator MCP server enables interactive configuration of Roomle objects in the standalone configurator or the isolation mode of the planner, directly in the browser session. An AI agent reads what a configurator can be — its component definitions, the items in their possible children, the parameter values and the material properties — and configures the object through MCP tools: a complete configuration from a configuration JSON, and manipulations such as docking components, deleting components, changing parameters, undo and redo. The pattern is the HI MCP server of [roomle-hi-example](https://github.com/roomle-dev/roomle-hi-example). Today the server offers `undo` and `redo`, and the example's AI Planning Assistant window runs a Mistral chat that calls them.

Every markdown document in this folder, in one place. Add a line here whenever you add a document —
see **Where Documentation Goes** in [`../AGENTS.md`](../AGENTS.md#where-documentation-goes).

The split below matters when you are using these documents as context:

- **Living reference** — describes how the code works *now*. Keep it accurate; update it when the behaviour it
  describes changes.
- **Historical records** — point-in-time write-ups (a bug as it was analysed, a feature as it was studied, a
  refactoring as it was carried out). They are deliberately *not* updated. **Treat them as evidence of what was
  true on the date shown, not as a description of current behaviour** — always confirm against the code before
  acting on one.

Decisions about *why* the code is shaped the way it is live in `.agents/decisions/` (created with the first ADR).

---

## Decisions

Architecture Decision Records — why the code is shaped the way it is, and which approaches were
deliberately rejected. Read these before proposing a change to an area they cover. Create numbered
ADR documents in `.agents/decisions/` as needed, following the
[RoomleCore pattern](https://github.com/roomle-internal/RoomleCore/blob/master/documentation/decisions/README.md).

| ADR | Status |
|---|---|

---

## Living Reference

### Skills (On-Demand Domain Knowledge)

Skills provide deep domain knowledge for AI agents. Load them when the task matches their domain.

| Skill | Description | Load When |
|---|---|---|
| [configurator-mcp-server.md](./skills/configurator-mcp-server.md) | The MCP server and its tools, the page bridge and its protocol, the chat backend, how a tool is added and tested | MCP server or chat development, adding a tool, the example page's MCP and chat code |
| [roomle-pr-resolution.md](./skills/roomle-pr-resolution.md) | Resolving a pull request: verifying suggested changes, applying them, replying to every review comment, resolving threads | Resolving a PR; never merge it |

### Scripts

| Script | Description |
|---|---|
| [check-markdown-links.js](./scripts/check-markdown-links.js) | Checks the relative links of markdown files: `node .agents/scripts/check-markdown-links.js <file.md> …` |

### User-Facing Documentation

Living reference documentation for end users and developers is maintained in the `docs/` folder,
indexed by [docs/README.md](../docs/README.md):

- [configurator-mcp-server.md](../docs/configurator-mcp-server.md) — The page, the MCP server and its tools, the chat backend, running and connecting them

---

## Historical Records

**Point-in-time. May not reflect current behaviour.**

### Bug Analyses

One document per bug: root-cause analysis written **before** the fix, closed out **after** it.

| Document | Status | Last touched |
|---|---|---|

### Feature Analyses

One document per feature question: a proposed feature, a change to an existing one, or *why* a
feature behaves the way it does. Written **before** the work, closed out **after** it.

| Document | Status | Last touched |
|---|---|---|
| [Configurator capabilities for the configurator MCP](feature-analysis/get-configurator-capabilities.md) | Open — lazy-loaded SDK capability discovery and the get-configurator-capabilities MCP tool | 2026-10-17 |
| [The configurator example with the AI Planning Assistant chat and a first configurator MCP server](feature-analysis/configurator-example-with-planning-assistant-chat.md) | Implemented — the chat API on the shared callback base and the window in the configurator (roomle-ui), the page as host with a Mistral chat backend, the MCP server with undo and redo; branches not merged | 2026-10-16 |

### Refactoring Analyses

One document per refactoring, written **before** the work and carrying the report once the work is
done. The analysis and the report are the same document — the report is appended at close-out.

| Document | Status | Last touched |
|---|---|---|

### Backlog

Outstanding defects, optimizations and follow-ups for roomle-configurator-mcp.

| Document | Last touched |
|---|---|
| [Backlog](backlog/README.md) — the open work | 2026-10-16 |

---

## Analysis Workflow

### Trigger Phrases

The following phrases trigger the analysis workflow automatically:

- **"analyse the bug"** / **"analyze the bug"** / **"bug analysis"** → Creates document in `.agents/bug-analysis/`
- **"analyse the feature"** / **"analyze the feature"** / **"feature analysis"** → Creates document in `.agents/feature-analysis/`
- **"analyse the refactoring"** / **"analyze the refactoring"** / **"refactoring analysis"** → Creates document in `.agents/refactoring-analysis/`

### Document Lifecycle

1. **Write analysis** — Before any code changes, write the complete analysis document
2. **Do the work** — Implement the fix, feature, or refactoring
3. **Close out** — Update the document with the results, set status, promote durable knowledge
4. **Delete once landed** — when the work is on `master`, promote the durable outcome into the living reference and delete the document; git history, the Jira comment and the pull request keep the record. A solved bug keeps no analysis

### Status Values

| Analysis Type | Status Values |
|---|---|
| Bug Analysis | `Open`, `Fixed` |
| Feature Analysis | `Open`, `Implemented`, `Rejected` |
| Refactoring Analysis | `Open`, `Done` |

### Naming Convention

Use kebab-case for document filenames:
- `stale-parameter-after-undo.md`
- `tool-executor-split.md`
- `simplified-docking-for-agents.md`

### Document Structure

Every analysis document should include:

**Bug Analysis:**
- Symptom and reproduction
- Investigation trace with file:line references
- Exact root cause
- Why current code is wrong
- Proposed clean fix

**Feature Analysis:**
- What was asked and why
- How the area works today with code references
- The gap or question answered
- Proposed design or change
- Alternatives considered and rejected
- Code and documents the work would touch

**Refactoring Analysis:**
- What current code does and why it's a problem
- Full scope with file:line references
- Proposed target shape
- Tests covering affected behaviour
- Output changes to expect
- For performance: benchmark to run before/after

---

## Where Documentation Goes

| What you produced | Where it goes | Lifecycle |
|---|---|---|
| **Living reference** — how things work now | `.agents/skills/` or `docs/` | Updated when behaviour changes; says what holds today — never what was wrong, when something was solved, or a ticket number |
| **Historical record** — analysis, benchmark, refactoring | `.agents/<analysis-type>/` | Never updated after close-out; deleted once the work has landed |
| **Decision** — why code is shaped this way | `.agents/decisions/` (create folder if needed) | Living reference |
| **Open work** | `.agents/backlog/README.md` | Removed when the fix is in the code |

## Adding New Documentation

### For AI Agents (Digital Brain)

1. **Skills**: Add to `.agents/skills/` for on-demand domain knowledge
2. **Bug Analysis**: Add to `.agents/bug-analysis/` before fixing
3. **Feature Analysis**: Add to `.agents/feature-analysis/` before implementing
4. **Refactoring Analysis**: Add to `.agents/refactoring-analysis/` before refactoring
5. **Update this index**: Add a line to the appropriate table

### For End Users

Add to the `docs/` folder and its [index](../docs/README.md), and update the main README.md if appropriate.

## See Also

- [AGENTS.md](../AGENTS.md) — AI assistant instructions and workflow
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) — GitHub Copilot specific guidance
