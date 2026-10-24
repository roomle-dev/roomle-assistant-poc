# Digital Brain Index

## Purpose

The native configurator example runs the browser assistant of roomle-ui. The iframe owns sixteen on-demand tools, product discovery, editing and prompts; the embedding library runs the host agent. The static launcher serves the page and local model configuration. The architecture follows [roomle-hi-example](https://github.com/roomle-dev/roomle-hi-example).

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
| [0001 — SDK-owned configurator capabilities](decisions/0001-sdk-owned-configurator-capabilities.md) | Accepted |
| [0002 — Configurator tools run in the SDK](decisions/0002-configurator-tools-run-in-the-sdk.md) | Accepted |

---

## Living Reference

### Skills (On-Demand Domain Knowledge)

Skills provide deep domain knowledge for AI agents. Load them when the task matches their domain.

| Skill | Description | Load When |
|---|---|---|
| [analysis.md](./skills/analysis.md) | Analyse the bug, feature, or refactoring: trace to the origin, write the analysis document before any code change | "analyse the bug/feature/refactoring", "analyze...", "bug/feature/refactoring analysis" |
| [plan-implementation.md](./skills/plan-implementation.md) | Plan an implementation with unit tests — the plan is a ticket comment or a message, never a document | Planning a task or implementation |
| [cleanup-backlog.md](./skills/cleanup-backlog.md) | Sweep the backlog: verify every item against the code, remove what landed, strip history, refresh references | "cleanup backlog", "clean up the backlog", "backlog cleanup" |
| [analysis-cleanup.md](./skills/analysis-cleanup.md) | Closing out landed bug, feature and refactoring analyses: promoting the durable outcome into `.agents/context`, living reference and decisions, then deleting the analysis | "cleanup analyses", "clean up the analyses", "analysis cleanup", reviewing or tidying the analysis folders |
| [roomle-pr-resolution.md](./skills/roomle-pr-resolution.md) | Resolving a pull request: verifying suggested changes, applying them, replying to every review comment, resolving threads | Resolving a PR; never merge it |
| [analysis-closeout.md](./skills/analysis-closeout.md) | Close out a single analysis document at commit time: verify it landed, promote the durable outcome, delete the document | Work with an analysis document is being committed |
| [github-workflow.md](./skills/github-workflow.md) | Git staging, conventional commits, pre-commit checklist, PR guidelines | Before every commit, push, or pull request |
| [configurator-assistant.md](./skills/configurator-assistant.md) | Browser assistant, SDK integration and static launcher | Assistant integration and launcher development |

### Scripts

| Script | Description |
|---|---|
| [check-markdown-links.js](./scripts/check-markdown-links.js) | Checks the relative links of markdown files: `node .agents/scripts/check-markdown-links.js <file.md> …` |

### Context

Living reference of the implemented features, promoted from the feature analyses at close-out: how
each feature works today. The index is [the feature index](context/README.md).

| Feature | Covers |
|---|---|
| [Fence Assistant](../docs/fence-assistant-overview.md) | Lazy terrain tools, automatic activation, native dependency and completion limits |
| [Configuration Assistant architecture](context/configurator-assistant-architecture.md) | Components, roles, channels, startup, prompt round trip, messages, recovery, state and tests |
| [Minimal fence example](context/minimal-fence-example.md) | Biohort planner defaults, UI-managed Fence Assistant, exports, launcher and tests |
| [The configurator example with the AI Configuration Assistant chat](context/configurator-example-with-planning-assistant-chat.md) | Browser host, on-demand SDK tools, embedding assistant and static launcher |
| [The roomle-ui configurator API for agent tools](context/roomle-configurator-api-for-mcp.md) | Native operation API overview, shared lifecycle, context and source map |
| [queryConfigurationOperation](context/query-configuration-operation.md) | Read API: query catalog, payloads, results, docking sources and errors |
| [executeConfigurationOperation](context/execute-configuration-operation.md) | Write API: operation catalog, payloads, results, history and errors |
| [Configurator capabilities for the configurator MCP](context/get-configurator-capabilities.md) | The SDK capability collector and its six sections, the read-only `get-configurator-capabilities` tool, the declared/current and runtime/catalog distinctions |

### Wiki

Living-reference answers to recurring questions are indexed in [the wiki](wiki/README.md).
Source-code architecture and API contracts belong to [Context](#context). There are no wiki pages.

### User-Facing Documentation

Living reference documentation for end users and developers is maintained in the `docs/` folder,
indexed by [docs/README.md](../docs/README.md):

- [configuration-assistant-overview.md](../docs/configuration-assistant-overview.md) — Components, diagram, request walkthrough, native undo, privacy and limits
- [configurator-assistant.md](../docs/configurator-assistant.md) — Browser assistant, tools, providers and compatibility
- [Minimal fence example](../minimla-fence-example/README.md) — Run the Biohort planner and download construction JSON and SVG plans

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
| [Fence Assistant: terrain generation, loading and manipulation](feature-analysis/fence-assistant-terrain.md) | Implemented — lazy terrain tools, minimal native primitives and exact activation; awaiting cross-repository landing | 2026-10-24 |
| [Roomle UI entry points and a native configurator assistant](feature-analysis/roomle-ui-entry-points-and-native-assistant.md) | Open — direct UI startup remains unimplemented; configuration flag/title and OpenAI example are implemented | 2026-10-24 |
| [Query and execute configuration operation for the configurator MCP](feature-analysis/query-and-execute-configuration-operation.md) | Implemented — the two generic roomle-ui APIs the MCP tools are built on | 2026-10-19 |

### Refactoring Analyses

One document per refactoring, written **before** the work and carrying the report once the work is
done. The analysis and the report are the same document — the report is appended at close-out.

| Document | Status | Last touched |
|---|---|---|
| [Move the configurator agent tools into roomle-ui](refactoring-analysis/configurator-agent-tools-in-roomle-ui.md) | Done — implemented and verified on feature branches; awaiting default-branch landing | 2026-10-23 |

### Benchmarks

Performance measurements. Each document keeps its benchmark data in a folder of the same name.
Benchmarks are historical records — they measure a point in time and are never updated.

| Document | Date | Summary |
|---|---|---|
| — | — | No benchmarks |

### Backlog

Outstanding defects, optimizations and follow-ups for roomle-configurator-mcp.

| Document | Last touched |
|---|---|
| [Backlog](backlog/README.md) — the open work | 2026-10-16 |

---

## Analysis Workflow

### Trigger Phrases

The following phrases trigger the workflow automatically — the phrase alone means *execute the whole procedure*:

| Trigger phrase | Skill | Folder |
|---|---|---|
| "analyse the bug" / "analyze the bug" / "bug analysis" | [`analysis`](skills/analysis.md) | `.agents/bug-analysis/` |
| "analyse the feature" / "analyze the feature" / "feature analysis" | [`analysis`](skills/analysis.md) | `.agents/feature-analysis/` |
| "analyse the refactoring" / "analyze the refactoring" / "refactoring analysis" | [`analysis`](skills/analysis.md) | `.agents/refactoring-analysis/` |
| "cleanup backlog" / "clean up the backlog" / "backlog cleanup" | [`cleanup-backlog`](skills/cleanup-backlog.md) | `.agents/backlog/` |
| "cleanup analyses" / "clean up the analyses" / "analysis cleanup" | [`analysis-cleanup`](skills/analysis-cleanup.md) | all three analysis folders |

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

Every analysis document names the **affected repositories first**, right after its header block: a
short list of the repositories the work changes, one line each saying what changes there (for
example roomle-ui, roomle-configurator-mcp, RoomleCore). A repository the work leaves unchanged is
named only where a reader would expect a change. Beyond that, the document should include:

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
| **Living reference** — how things work now | `.agents/skills/`, `.agents/context/` or `docs/` | Updated when behaviour changes; says what holds today — never what was wrong, when something was solved, or a ticket number |
| **Wiki page** — a durable answer to a recurring question | `.agents/wiki/` | Living reference; not an analysis, no lifecycle |
| **Bug analysis** | `.agents/bug-analysis/` | Historical record; deleted once the fix has landed |
| **Feature analysis** | `.agents/feature-analysis/` | Historical record; deleted once the work has landed |
| **Refactoring analysis** | `.agents/refactoring-analysis/` | Historical record; deleted once the work has landed |
| **Benchmark** — performance measurement | `.agents/benchmarks/` | Historical record; never updated and never deleted — permanent baseline for future comparisons |
| **Decision** — why code is shaped this way | `.agents/decisions/` | Living reference |
| **Image** — referenced by a document | `.agents/images/` | Kept as long as the referencing document exists |
| **Open work** | `.agents/backlog/README.md` | Removed when the fix is in the code |

## Adding New Documentation

### For AI Agents (Digital Brain)

1. **Skills**: Add to `.agents/skills/` for on-demand domain knowledge
2. **Bug Analysis**: Add to `.agents/bug-analysis/` before fixing
3. **Feature Analysis**: Add to `.agents/feature-analysis/` before implementing
4. **Refactoring Analysis**: Add to `.agents/refactoring-analysis/` before refactoring
5. **ADR**: Add to `.agents/decisions/` with the next sequential number
6. **Benchmark**: Add to `.agents/benchmarks/` with a data folder of the same name
7. **Image**: Add to `.agents/images/` with a descriptive kebab-case name
8. **Update this index**: Add a line to the appropriate table

### For End Users

Add to the `docs/` folder and its [index](../docs/README.md), and update the main README.md if appropriate.

## See Also

- [AGENTS.md](../AGENTS.md) — AI assistant instructions and workflow
