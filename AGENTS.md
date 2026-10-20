# AGENTS.md — roomle-configurator-mcp

> Open-standard "README for AI" — structured context for GitHub Copilot, Copilot Workspace, coding agents, and LLM-based dev tools.

## Always Do This First

1. **Load matching skills.** Check the [On-Demand Skills](#on-demand-skills) catalog and read every skill file whose domain matches the task *before* taking action. Multiple skills may apply to one task.
2. **Read [`docs/README.md`](./docs/README.md)** before answering architecture or domain questions. It is the index of the living reference: how the example page, the MCP server and its tools work today.
3. **Read [`.agents/README.md`](./.agents/README.md)** for the complete digital brain index, separating living reference from historical records.
4. **Treat documentation as part of the task, not a follow-up.** Every analysis produces a document, and every change to productive code updates one — see [Where Documentation Goes](#where-documentation-goes).

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Identity

- **Project**: roomle-configurator-mcp
- **Repository**: `roomle-dev/roomle-configurator-mcp`
- **Default branch**: `master`
- **Language**: JavaScript/TypeScript (Node.js 20+), HTML
- **Purpose**: Standalone Roomle configurator example with an MCP server for configuring Roomle objects in the standalone configurator or the isolation mode of the planner

## Project Overview

roomle-configurator-mcp is a demonstration and development environment for:

1. **Minimal Configurator Example** — A standalone HTML page (`minimal-configurator-example/index.html`) that initialises a default Roomle configurator with the embedding-lib, served by the launcher `minimal-configurator-example/start.mjs`
2. **Configurator MCP Server** — The TypeScript MCP server (`configurator-mcp/configurator-mcp-server`) that lets AI agents change a Roomle configuration in a live configurator session. Its tools call the `RoomleConfigurator` API through the page: eight reads of the configuration and its product options, six writes, and `undo` and `redo`
3. **AI Chat** — The chat backend (`configurator-mcp/configurator-mcp-chat`, Vercel AI SDK, the Mistral models `mistral-medium-latest` and `mistral-large-latest`) behind roomle-ui's AI Planning Assistant window in the configurator; an MCP client of the server

The pattern for this repository is [roomle-hi-example](https://github.com/roomle-dev/roomle-hi-example): the HI MCP server there plans HOMAG Intelligence object groups in a live Roomle room-planner session, from two JSON files (master data and the articles of a library) that describe every configuration option. A Roomle configurator has no such single data set:

- Its scope is defined by all the component definitions that can be assembled, and by the items named in the possible children of the components. Collecting them means reading and interpreting the component definitions recursively.
- The possible values of a parameter come from the component definition and from the `validGroups` that have to be requested ([parameter value sources](https://github.com/roomle-internal/RoomleCore/blob/master/documentation/features/script/parameter-value-sources.md#parameter-value-sources) in RoomleCore).
- Materials are ids; name, thumbnail and colour come from the material definition, fetched per material.
- The product is whatever the component definitions define — not only cabinets and kitchens.
- The docking logic of Roomle components is more complicated than the docking of HI articles and has to be simplified for the agent, as the HI MCP server does with relations between articles.

The start script (`npm start`) provides:
- A build gate: `npm install` (first run) and the typecheck of the `configurator-mcp` workspace
- Static file serving for the example HTML page on port 3000
- The MCP server on port 3100: `POST /mcp` (Streamable HTTP) and the page bridge (WebSocket `/bridge`)
- With `npm start mistral-medium <api-key>` or `npm start mistral-large <api-key>`: the chat backend on port 3200 and the page opened with the AI Planning Assistant window
- Browser auto-open at the example URL

## Repository Structure

```
.
├── minimal-configurator-example/   # Minimal standalone configurator example
│   ├── index.html                  # The example page (single file, inline JS)
│   ├── start.mjs                   # Launcher: build gate, static serving (:3000), MCP server, chat backend
│   └── README.md                   # How to run the page, its URL parameters
├── configurator-mcp/               # TypeScript workspace (npm workspaces, vitest)
│   ├── package.json                # Workspace root: start/test/typecheck scripts
│   ├── tsconfig.base.json          # Strict ES2022 compiler options for Node
│   ├── vitest.config.ts            # Unit tests of both packages
│   ├── configurator-mcp-server/    # The MCP server: /mcp + /bridge on :3100, the read and write tools, undo and redo
│   │   ├── server.ts               # Entry point
│   │   ├── configurator-mcp-server.ts # McpServer: instructions, tool registrations
│   │   ├── tool-executors.ts       # The read and write executors, confirmed history steps
│   │   ├── history-state.ts        # The configurator's undo history state from the page's events
│   │   ├── configurator-api.ts     # The configurator methods the tools call, relayed to the page
│   │   ├── page-bridge.ts          # Connected page, call correlation, timeouts
│   │   ├── types.ts                # WebSocket message protocol
│   │   └── tests/                  # Unit tests, the fake page socket, the launcher test
│   ├── configurator-mcp-chat/      # The chat backend: POST /chat on :3200, Mistral, MCP client of the server
│   │   ├── chat-server.ts          # Entry point
│   │   ├── chat-config.ts          # The two models, the system prompt, the environment, message parsing
│   │   ├── chat-handler.ts         # /health, /chat, CORS
│   │   ├── chat-stream.ts          # MCP client, streamText, the [tool] and [error] lines
│   │   ├── chat-steps.ts           # Step loop, step log, turn timeout
│   │   ├── chat-recovery.ts        # What an interrupted reply says about the tool calls
│   │   └── tests/                  # Unit tests
│   └── README.md                   # The workspace, file by file
├── docs/                           # Living reference for users and developers
│   ├── README.md                   # Index of every document in docs/
│   └── configurator-mcp-server.md  # Reference: the page, the MCP server, its tools, the chat
├── package.json                    # Repository root: start/dev/mcp-server/test/typecheck/format/lint scripts
├── README.md                       # Quickstart and usage guide
├── AGENTS.md                       # This file - AI assistant instructions
├── CLAUDE.md                       # Redirect to AGENTS.md (for Claude Code)
├── .agents/                        # Digital Brain - AI agent knowledge base
│   ├── README.md                   # Digital brain index
│   ├── backlog/                    # Open work only
│   │   └── README.md
│   ├── benchmarks/                 # Performance measurements
│   │   └── README.md
│   ├── bug-analysis/               # Bug root-cause analyses
│   │   └── README.md
│   ├── context/                    # Living reference: how the implemented features work today
│   │   └── README.md               # Feature index
│   ├── decisions/                  # Architecture Decision Records (ADRs)
│   │   ├── README.md
│   │   └── 0001-sdk-owned-configurator-capabilities.md
│   ├── feature-analysis/           # Feature investigations
│   │   └── README.md
│   ├── images/                     # Images referenced by documents
│   │   └── README.md
│   ├── refactoring-analysis/       # Refactoring analyses with reports
│   │   └── README.md
│   ├── scripts/                    # Utility scripts (JavaScript only)
│   │   ├── README.md
│   │   └── check-markdown-links.js # Checks the relative links of markdown files
│   ├── skills/                     # On-demand domain knowledge
│   │   ├── README.md
│   │   ├── analysis.md             # Analyse the bug, feature, or refactoring
│   │   ├── analysis-cleanup.md     # Closing out landed analyses into .agents/context
│   │   ├── analysis-closeout.md    # Close out a single analysis at commit time
│   │   ├── cleanup-backlog.md      # Sweep the backlog, verify every item
│   │   ├── configurator-mcp-server.md # The MCP server, the bridge, the chat, adding a tool
│   │   ├── github-workflow.md      # Git staging, commits, pre-commit checklist
│   │   ├── plan-implementation.md  # Plan an implementation with unit tests
│   │   └── roomle-pr-resolution.md # Resolving a pull request's review
│   └── wiki/                       # Wiki pages: durable living-reference answers
│       ├── README.md
│       └── roomle-configurator-api-for-mcp.md # The roomle-ui API the MCP server needs
├── .temp/                          # Scratch space, git-ignored
├── .oxlintrc.json                  # Oxlint settings
├── .prettierrc.json                # Prettier settings
└── .prettierignore                 # Paths Prettier does not format
```

## On-Demand Skills

Skills provide deep domain knowledge. Load them by reading the file when the task matches their domain. Skill files are located in `.agents/skills/`.

**Skills belong in `.agents/skills/`.** Every skill of this repository is a Markdown file there with a row in the table below. **Never create a `.claude/` folder in this repository** — no `.claude/skills/`, no `SKILL.md` wrappers and no other tool-specific copy of a skill.

| Skill | Load when the task involves |
|---|---|
| [`.agents/skills/analysis.md`](./.agents/skills/analysis.md) | "analyse the bug", "analyze the bug", "bug analysis", "analyse the feature", "analyze the feature", "feature analysis", "analyse the refactoring", "analyze the refactoring", "refactoring analysis" |
| [`.agents/skills/plan-implementation.md`](./.agents/skills/plan-implementation.md) | Planning a task or implementation — the plan must include unit tests |
| [`.agents/skills/cleanup-backlog.md`](./.agents/skills/cleanup-backlog.md) | "cleanup backlog", "clean up the backlog", "backlog cleanup" |
| [`.agents/skills/analysis-cleanup.md`](./.agents/skills/analysis-cleanup.md) | Cleaning up the analysis folders: closing out landed bug, feature and refactoring analyses into `.agents/context`, living reference and decisions | "cleanup analyses", "clean up the analyses", "analysis cleanup", reviewing or tidying the analysis folders |
| [`.agents/skills/roomle-pr-resolution.md`](./.agents/skills/roomle-pr-resolution.md) | Resolving a pull request: verifying suggested changes, applying them, replying to every review comment, resolving threads. Never merge the PR |
| [`.agents/skills/analysis-closeout.md`](./.agents/skills/analysis-closeout.md) | Closing out a single analysis document once its work has landed |
| [`.agents/skills/github-workflow.md`](./.agents/skills/github-workflow.md) | Before every commit, push, or pull request |
| [`.agents/skills/configurator-mcp-server.md`](./.agents/skills/configurator-mcp-server.md) | The MCP server, its tools, the page bridge, the chat backend, the example page's MCP and chat code; adding a tool |

## Key Architecture Patterns

### The Example Page

1. **One file, no build step** — `minimal-configurator-example/index.html` imports `@roomle/embedding-lib` from unpkg (pinned version) and runs plain JavaScript
2. **A default configurator** — `RoomleConfiguratorApi.createConfigurator('demoConfigurator', …)`, then `instance.ui.loadObject(id)` with the item or configuration from the `id` URL parameter (default `usm:frame`)
3. **URL parameters are init options** — every query-string parameter except `id` is passed to `createConfigurator`; `overrideServerUrl` points the page at another Rubens UI, which `npm run dev` uses for the local dev server on :5173
4. **The launcher** — `start.mjs` serves the folder on port 3000 (`EXAMPLE_PORT`) and opens the browser (`--no-open` skips that)

### The MCP Server

1. **Tools in the server, configurator calls in the page** — The tools run in `configurator-mcp-server` (`@modelcontextprotocol/sdk`, `ws`, run via `vite-node`); the configurator methods they call (`configurator-api.ts`) go over the `/bridge` WebSocket to the page, which executes them on `instance.extended` — only the methods of its `CONFIGURATOR_METHODS` allow-list, the same list the server names
2. **Streamable HTTP** — `POST /mcp`, JSON response mode, stateless (a new server and transport per request); `?client=<clientId>` binds a request to its page
3. **The undo history from the configurator** — The page relays the configurator's `onHistoryChange` as `historyChange` events and its last state on connection; the server answers "nothing to undo" from that state and confirms each step by its event
4. **The bridge protocol of roomle-hi-example** — protocol 2: `hello`, `ready`, `call`, `result`, `event`
5. **The chat is an MCP client beside the server** — `configurator-mcp-chat` holds the Mistral key and the system prompt and connects to `/mcp` per turn; the page keeps the conversation and feeds the AI Planning Assistant window through `onPlanningAssistantPrompt` and `planningAssistantOutput` of the configurator (roomle-ui)
6. **Local only** — every process runs on localhost; nothing is deployed

The SDK owns capability discovery: component definitions, item presets, declared and current parameter choices, material metadata and docking constraints, and it calculates the docking placements (the kernel's `getDockPairs`) and performs the editing operations (`executeConfigurationOperation`). The MCP server relays the SDK result and confirms every write with the configurator's history event.

## Hard Rules

### Code Style

- **Prettier** — Format with `npm run format` before committing; `npm run format:check` checks it. The settings are in `.prettierrc.json`, the excluded paths in `.prettierignore` (Markdown is not formatted)
- **Oxlint** — `npm run lint` checks the JavaScript and TypeScript files for correctness errors, `npm run lint:fix` fixes what it can. The settings are in `.oxlintrc.json`; the inline script of `minimal-configurator-example/index.html` is not linted
- **TypeScript** — `npm run typecheck` type-checks the `configurator-mcp` workspace with `tsc --noEmit`; it must pass before committing
- **ES Modules** — Use `import/export` syntax, not CommonJS `require`
- **Async/Await** — Prefer async/await over Promise chains
- **Error Handling** — Use try/catch for synchronous errors, .catch() for promises
- **No new dependencies without reason** — The MCP server is the `configurator-mcp` workspace package with its own locked dependencies; do not add dependencies to it or to the launcher without need

### Naming Conventions

- **Variables**: camelCase (`componentDefinition`, `dockingVector`)
- **Constants**: UPPER_SNAKE_CASE (`PORT`, `DEFAULT_CALL_TIMEOUT_MS`)
- **Functions**: camelCase (`getConfiguration`, `dockComponent`)
- **Files**: kebab-case (`minimal-configurator-example/start.mjs`, `docs/README.md`)

### Comments

> "Every time you write a comment, you should grimace and feel the failure of your ability of expression." — Robert C. Martin (Uncle Bob)

- **Minimal comments** — Code must express its intent through naming and structure
- **JSDoc for public APIs** — Functions exposed via MCP should have JSDoc
- **No header comments** — No file-level author/license headers
- **No section dividers** — No `// ===` or `// ---` lines

## MCP Server Specific Rules

### Protocol Compliance

- Support multiple MCP protocol versions as needed
- Implement the required MCP endpoint: `POST /mcp` (Streamable HTTP, JSON response mode)
- Validate tool call parameters before processing
- Return proper error responses for invalid inputs

### Tool Implementation

- Each tool must have a clear description and parameter schema
- Tools should handle errors gracefully and return meaningful error messages
- Tool timeouts should be configurable
- Tools should log their operations for debugging
- Tools correct agent input whose intent is clear rather than reject it — see [Guards Are a Last Resort](#guards-are-a-last-resort)

### Guards Are a Last Resort

A **guard** is a check in the MCP server that refuses an agent's input because it identifies the
input as wrong: the call fails and nothing is created. A guard fights the symptom, not the cause,
and it hinders the agent from creating the configuration: every refusal costs the agent a step of
its turn.

When an agent creates wrong content, the root cause is the MCP instructions: a rule, a tool
description or an example misleads the agent, asks it to combine more than it can, or the tool
API makes the wrong payload easy to write. That is where the fix belongs.

**Guards are always treated as a last resort.** Take the first step that works:

1. **Clarify the instructions.** Find the rule sentence, tool description or example that led the
   agent to the wrong content, and make it say the right thing plainly — shorter, not longer.
2. **Simplify the tool API.** When the agent has to compute or encode something the server can
   derive — a position, a docking entry, a partner vector — let the server derive it, so the wrong
   payload cannot be written in the first place.
3. **Correct the input and inform the agent.** Whenever the server can, it corrects the input,
   applies the change, and says in the tool result what it corrected, so the agent learns from the
   note without losing a step.
4. **Give feedback and ask for the correction.** When the server cannot correct the input, it
   still applies what it can, and the result says what was not applied, why, and what to send
   instead.
5. **Reject only as a last resort** — when nothing in the call can be applied, or its intent
   cannot be told. The error says what to send instead.

Rules:

- A new guard needs a written reason in its analysis why steps 1–4 do not work.
- An error message that names the one fix is a sign that the server can apply that fix itself.
- Never refuse what the user may legitimately want. The server cannot tell such a request from a
  mistake.
- The served rules and tool descriptions describe how to succeed, not which payloads are rejected.
- A bug analysis of wrong content an agent created names the instruction or the part of the tool
  API that led the agent there. "The server accepted it" is not a root cause.

## General-Purpose Policy

The MCP server is for **general purposes**. There is one MCP server for every
configurator; it must not contain information about a specific configurator.

This policy exists so that bugs in the MCP server can be fixed from specific bug
reports. A bug fix must **never** involve adding specific information about the
malfunctioning configurator to resolve the issue — that is a hack and is
absolutely forbidden.

If a configurator behaves specially and this needs to be communicated to the AI
agent, the information must come from the configurator's own components and
items. In future, it may be necessary to add descriptions for the MCP server to
the components of a configurator.

## Where Documentation Goes

Documentation lives in markdown files under `docs/` and `.agents/`, never in code comments.

### Digital Brain Structure

The `.agents/` folder serves as the "digital brain" for roomle-configurator-mcp, containing:

```
.agents/
├── README.md                     # Digital brain index
├── backlog/                      # Open work only
├── benchmarks/                   # Performance measurements
├── bug-analysis/                 # Bug root-cause analyses (written before fix)
├── context/                      # Living reference of the implemented features
├── decisions/                    # Architecture Decision Records (ADRs)
├── feature-analysis/             # Feature investigations and decisions
├── images/                       # Images referenced by documents
├── refactoring-analysis/         # Refactoring analyses with reports
├── scripts/                      # Utility scripts (JavaScript only)
├── skills/                       # On-demand domain knowledge (skills)
└── wiki/                         # Wiki pages (living reference, no lifecycle)
```

**IMPORTANT**: All scripts in `.agents/scripts/` MUST be JavaScript (Node.js), not Python. This ensures consistency with the repository's primary language and tooling.

### Analysis Documents

Every change to productive code should be accompanied by analysis documents:

| Analysis Type | Folder | When to Create | Status Values |
|---|---|---|---|
| Bug Analysis | `.agents/bug-analysis/` | "analyse the bug", "analyze the bug", "bug analysis" | Open, Fixed |
| Feature Analysis | `.agents/feature-analysis/` | "analyse the feature", "analyze the feature", "feature analysis" | Open, Implemented, Rejected |
| Refactoring Analysis | `.agents/refactoring-analysis/` | "analyse the refactoring", "analyze the refactoring", "refactoring analysis" | Open, Done |

Each analysis document follows the same lifecycle: written **before** the work, closed out **after** the work.

**Every analysis names the affected repositories first.** A bug, feature or refactoring analysis
starts, right after its header block, with a short list of the repositories the work changes, one
line each saying what changes there (for example roomle-ui, roomle-configurator-mcp, RoomleCore).
A repository the work leaves unchanged is named only where a reader would expect a change.

| What you produced | Where it goes |
|---|---|
| Bug analysis | new file in `.agents/bug-analysis/` with kebab-case slug |
| Feature analysis | new file in `.agents/feature-analysis/` with kebab-case slug |
| Refactoring analysis | new file in `.agents/refactoring-analysis/` with kebab-case slug — the report goes into the PR description |
| Any other analysis — architecture, data flow, algorithm, test tooling | new file in the folder matching the domain |
| New feature capability | new file in `docs/`, or an update of the document that covers the area, with a line in `docs/README.md` |
| Bug fix | update the existing document that covers the affected area, and close out the bug analysis |
| Change to productive code that needs no new document | update the living-reference document covering the touched area, in the same branch |
| Architecture decisions — chosen **or** rejected | numbered ADR in `.agents/decisions/` |
| Benchmark / performance analysis | `.agents/benchmarks/` |
| Wiki page — a durable answer to a recurring question | `.agents/wiki/` with kebab-case slug |
| Open work | `.agents/backlog/README.md` |
| Living reference | `docs/` for user-facing documentation, `.agents/skills/` for agent-facing domain knowledge, `.agents/context/` for the living reference of an implemented feature |
| Image referenced by a document | `.agents/images/` with a descriptive kebab-case name |

**Important**: Analysis documents in `.agents/bug-analysis/`, `.agents/feature-analysis/`, and `.agents/refactoring-analysis/` are **historical records** — they document the analysis process and decisions, but the durable knowledge should be promoted to living-reference documentation in `docs/` or the skill files.

**The living reference describes today.** Everything outside the analyses and the backlog —
`docs/`, `.agents/skills/`, the READMEs — says how the code works now:

- When an analysis is deleted, its valuable content goes there first: the invariants, the decisions
  and the rejected approaches someone could re-propose, the guarding tests, and how the configurator
  behaves as the investigation found it.
- It never says what was wrong in the past: no defect, no earlier behaviour, no "found in" or
  "found with", no "previously", "no longer" or "was fixed".
- It does not record when something was solved, fixed, verified or confirmed.
- It carries no ticket numbers. They belong to the analyses, the backlog items, the pull requests
  and the Jira comments.

**A solved bug keeps no analysis.** Once its fix has landed on `master`, the valuable content is
promoted and the document deleted, and the bug's item leaves the backlog.

### Analysis Triggers

These phrases are shorthand for a full, mandatory workflow. When the user's message contains one, load the skill and execute it in full, without asking for the details it defines.

- **"analyse the bug"** / **"analyze the bug"** / **"bug analysis"** → [`.agents/skills/analysis.md`](./.agents/skills/analysis.md): deep root-cause analysis, written before the fix, in `.agents/bug-analysis/`.
- **"analyse the feature"** / **"analyze the feature"** / **"feature analysis"** → [`.agents/skills/analysis.md`](./.agents/skills/analysis.md): feature investigation, written before the work, in `.agents/feature-analysis/`.
- **"analyse the refactoring"** / **"analyze the refactoring"** / **"refactoring analysis"** → [`.agents/skills/analysis.md`](./.agents/skills/analysis.md): refactoring analysis, written before the work, in `.agents/refactoring-analysis/`.
- **"cleanup backlog"** / **"clean up the backlog"** / **"backlog cleanup"** → [`.agents/skills/cleanup-backlog.md`](./.agents/skills/cleanup-backlog.md).
- **"cleanup analyses"** / **"clean up the analyses"** / **"analysis cleanup"** → [`.agents/skills/analysis-cleanup.md`](./.agents/skills/analysis-cleanup.md).

Analysis is analysis-only: do not modify productive code unless the user also asks for the change.

### Living Reference vs Historical Records

Everything in `.agents/` is one of two kinds:

- **Living reference** describes how the code works *now*. Present tense. No "was fixed", "previously", "no longer", "the old code". No ticket numbers. Updated in the same commit that changes the behaviour it describes. This includes: `.agents/context/`, `.agents/wiki/`, `.agents/skills/`, `.agents/decisions/` (ADRs), all README indexes, and `docs/`.
- **Historical record** is a point-in-time write-up. Written at one moment and never updated after close-out. Analysis documents (`.agents/bug-analysis/`, `.agents/feature-analysis/`, `.agents/refactoring-analysis/`) and backlog items (`.agents/backlog/`) are deleted when the work they describe has landed and the durable outcome has been promoted. Benchmarks (`.agents/benchmarks/`) are historical records but are **never deleted** — they are the permanent baseline for future performance comparisons.

### Architecture Decision Records (ADRs)

Decisions about *why* the code is shaped the way it is live in `.agents/decisions/`. They are numbered sequentially, starting at `0001`. Each ADR carries:

- A title in the form `NNNN — short description`
- Status: `Accepted`, `Superseded by NNNN`, `Rejected`
- Date
- Context — the situation and the forces at play
- Decision — what was decided
- Alternatives — the approaches considered and why they were rejected
- Consequences — the positive and negative outcomes of the decision

ADRs are living reference. They are read before proposing a change to an area they cover. A superseded ADR is kept with its superseding reference — never deleted.

### Refactoring Rules

1. Execute aggressively — do not revert when tests fail; adapt tests instead.
2. Changed outputs are typically the desired result.
3. Apply completely — no mix of old and new patterns in the same code path.
4. Every refactoring produces a report — in the pull request description.

### Testing

- Every new feature implementation, bug fix, or change in productive code requires unit tests.
- Every implementation plan has to include the unit tests.
- Tests use descriptive names and cover both the happy path and edge cases.
- A bug fix is not complete until a test reproduces the bug and the fix makes it pass.
- Run the full test suite after changes to ensure no regressions.
- Use vitest for unit tests: `npm test` runs the MCP server and chat backend tests.

### Infrastructure

- `.agents/skills/` is the only place for skills. Never create a `.claude/` folder, no `SKILL.md` wrappers outside `.agents/skills/`, no tool-specific copies of a skill.
- Every skill is a single markdown file in `.agents/skills/` with a row in the skills table of this file.
- Scripts in `.agents/scripts/` must be written in JavaScript (Node.js) — the repository's primary scripting language.
- The `.agents/` folder is managed by the agent. The agent adds potentially useful information proactively, without asking for permission.
- Temporary and scratch files go in a git-ignored `.temp/` folder, never in `.agents/`.

### Jira / Ticketing

When the repository uses Atlassian Jira:

- **The `jira` CLI is the primary and always-available way to read and write Jira.** Never conclude that Jira is unavailable because an MCP connector needs authorization — the CLI is the source of truth. Always prefix commands with `PAGER=cat`.
- **Never declare Jira unavailable** without first trying the CLI: `PAGER=cat jira issue view <KEY> --plain` and `PAGER=cat jira issue comment add <KEY> --template <file> --no-input`.
- **Never delete a Jira ticket.** No exception.
- **Create a ticket only when the user explicitly asks for it to be created in Jira.** "Write a ticket" or "draft a ticket" asks for the ticket text in the chat.
- **Ticket preflight:** Analyse the ticket before changing code. Tickets often contain only IDs or URLs instead of the actual data. Download the data automatically before investigating. If the ticket is missing required information, add a Jira comment explaining what is missing instead of starting implementation.
- **What must be written back to the ticket:** Analyses (bug, feature, refactoring) and implementation plans. Everything else lives in the repository.
- **Never comment these:** What was implemented (that belongs in the PR description). That a pull request was created. Progress, status, or completion notes.

## Development Workflow

### Starting the Example

```bash
npm install
npm start                            # page :3000 and MCP server :3100
npm start mistral-medium <api-key>   # plus the chat backend :3200 and the AI Planning Assistant window
npm start mistral-large <api-key>
npm run mcp-server                   # the MCP server alone
```

The launcher opens <http://localhost:3000/> (`?chat=true` with a model). `npm run dev`
opens the page against the local Rubens UI dev server (:5173) instead; `npm start -- --no-open`
skips the browser. The chat needs a Rubens UI whose configurator has the AI Planning Assistant
window. Details: [`docs/configurator-mcp-server.md`](./docs/configurator-mcp-server.md).

### Checks Before Committing

```bash
npm test               # vitest: the MCP server and the chat backend
npm run typecheck      # tsc --noEmit on both packages
npm run lint           # Oxlint
npm run format:check   # Prettier
node .agents/scripts/check-markdown-links.js <changed .md files>
```

## MCP Client Connection

The server provides its MCP endpoint at `http://localhost:3100/mcp` while it runs; the tools work
while the example page is open.

| Client | Connection |
|---|---|
| Claude Code | `claude mcp add --transport http --scope user configurator-mcp http://localhost:3100/mcp` |
| GitHub Copilot VS Code | MCP: Open User Configuration → add an HTTP server with that URL |
| Cursor | Add an HTTP MCP server with that URL |

**Note**: a browser-hosted client cannot reach a localhost server.

## Adding New Tools

1. Register the tool in `configurator-mcp/configurator-mcp-server/configurator-mcp-server.ts` (zod schema, description of how to succeed and what it returns)
2. Implement its executor in `tool-executors.ts`; a tool that changes the configuration runs one at a time
3. A configurator method the page does not expose yet: add it to `configurator-api.ts` and to `CONFIGURATOR_METHODS` in `minimal-configurator-example/index.html` — a public method of roomle-ui's `RoomleConfigurator`
4. Name the tool in the server's instructions and the chat's system prompt when the agent needs to know when to use it
5. Add or extend the unit tests in the matching `tests/` folder
6. Update `docs/configurator-mcp-server.md` and `.agents/skills/configurator-mcp-server.md`

Details: [`.agents/skills/configurator-mcp-server.md`](./.agents/skills/configurator-mcp-server.md).

## Suggested Change Workflow

This workflow is a suggestion and a guideline, not a requirement. It describes how a feature, a bug
fix, or a refactoring moves from an idea to a merged pull request when a human and an agent work on
it together. Small changes may skip steps; large or risky changes benefit from every one of them.
The steps alternate between agent work and human review, and every step builds on the reviewed
result of the step before it.

| # | Step | Who | Result |
|---|---|---|---|
| 1 | Describe the feature, bug, or refactoring and its definition of done | human, supported by the agent | a ticket with a clear problem statement and acceptance criteria |
| 2 | Analyse the feature, bug, or refactoring | agent | the analysis document in the matching folder and the same content as a ticket comment — see [Analysis Documents](#analysis-documents) |
| 3 | Review the analysis | human | the root cause, the gap, or the scope is confirmed |
| 4 | Plan the implementation and the unit tests | agent | the implementation plan as a ticket comment |
| 5 | Review the plan | human | the approach is approved before any code changes |
| 6 | Implement the plan | agent | code, tests, and documentation on a purpose branch, opened as a pull request only when the human asks for it — see [Hard Rule: NO Automatic Pull Requests](#hard-rule-no-automatic-pull-requests) |
| 7 | Review the code | human | review comments on the pull request |
| 8 | Apply the review suggestions | agent | new commits, every review thread replied to or resolved — see [Pull Request Resolution](#pull-request-resolution) |
| 9 | Review the code again | agent, preferably a different one than the implementer | review comments on the pull request |
| 10 | Apply the review suggestions | agent or human | new commits, every review thread replied to or resolved |
| 11 | Final review and merge | human | the merged pull request — an agent never merges |

**Every review gates the next step.** Each step trusts the reviewed result of the step before it:
the plan builds on the analysis, the implementation on the plan, the code review on the
implementation. Every review therefore has to be done very carefully — a flaw that passes a review
is carried into every later step.

**A review can send the work back.** If a review identifies a fundamental problem — the analysis
missed the real root cause, the plan does not cover the definition of done, the implementation
contradicts the plan — the work goes back one or more steps instead of being patched at the current
step.

## Git Workflow Rules

### Hard Rule: NO Force Pushes

**NEVER use `git push --force` or `git push -f` on any branch, especially master.** Force pushing rewrites history and is absolutely forbidden. If you need to undo commits, create a new revert commit instead.

### Hard Rule: NO Automatic Pull Requests

**NEVER create a pull request on your own.** Not with `gh pr create`, not through the GitHub API or any other tool, not as the last step of a finished task. A pull request is created only when the user explicitly asks for one in the current conversation. When the work is finished, commit it on a purpose branch and say that a pull request can be opened on request.

**You are only allowed to create a pull request when the user requests it.** The rule holds in every repository the work touches — roomle-configurator-mcp, roomle-hi-example, roomle-ui, RoomleCore and any other — not only in this one. No saved note, memory, earlier habit or other repository's workflow makes an exception. A request covers only the pull request it names: a later branch, a follow-up change or a change in another repository needs a request of its own.

### Commit Message Format

Use conventional commits: `type: lowercase description` — no trailing period.

Examples:
- `feat: add new MCP tool for parameter lookup`
- `fix: correct docking vector resolution`
- `docs: update example prompts`
- `refactor: simplify tool executor error handling`

**Do not put ticket numbers in commit messages or PR titles.** Reference the ticket in the PR body if needed.

### Pull Requests

- Create a PR only when the user requests it — see [Hard Rule: NO Automatic Pull Requests](#hard-rule-no-automatic-pull-requests)
- Keep PRs focused and small
- Include clear description of changes
- Reference related documentation
- Ensure all tests pass (if applicable)
- Update documentation in same PR as code changes

### Pull Request Resolution

**NEVER merge a PR.** Not with `gh pr merge`, not by enabling auto-merge. Merging is always a human decision performed by maintainers — finish the review resolution and stop.

**Load the skill** [`.agents/skills/roomle-pr-resolution.md`](./.agents/skills/roomle-pr-resolution.md) when resolving a PR.

**Hard Rules:**
- **Never rewrite history.** No `git commit --amend`, no `git push --force`. Every review fix is a **new** conventional commit.
- **Never silently ignore or resolve a comment.** Every handled thread gets a reply comment first, then is marked resolved.
- **Verify before implementing.** A reviewer suggestion is a hypothesis, not an instruction. Confirm it against the actual code before changing anything.

**Workflow:**
1. **Identify the PR** — Check out the PR branch explicitly, do not rely on current branch
2. **Fetch unresolved review threads** — Use GitHub API to get all unresolved threads
3. **Verify each suggestion** — Read the code, classify as valid/invalid/valid-intent-wrong-form
4. **Implement and validate** — Apply changes, test, commit as new conventional commits, push
5. **Reply to every comment** — State applied/applied-differently/not-applied with reasoning
6. **Resolve each thread** — Mark threads as resolved via GitHub API
7. **Final verification** — Confirm all threads are resolved. Stop. Do not merge.

**Completion Checklist:**
- [ ] Every unresolved thread was verified against the actual code
- [ ] Confirmed-valid suggestions are implemented, tested, and formatted
- [ ] Fixes are pushed as new commits (no amend, no force push)
- [ ] Every handled thread has a reply stating applied/applied differently/not applied
- [ ] Every handled thread is marked resolved
- [ ] The PR was **not** merged

## Bug Fixing Guidelines

### Core Principles

- **Never revert the user's intended changes.** The goal is to make the new code work, not to undo it.
- **Bug fixes require a purpose branch.** Create a feature/bug-fix branch unless the current branch was already created for this specific bug fix.
- **Bug fixes are minimal and surgical.** Find the root cause and fix it there. No hacks, no workarounds, no unrelated cleanups.
- **Refactoring found during a bug fix goes to the backlog, never into the fix.** Create a backlog item in `.agents/backlog/`. Never start the refactoring automatically.
- **Root cause analysis is mandatory.** Before proposing the final code change, fully understand *why* the current code produces wrong results.
- **The path to a fix can be dirty.** Trial-and-error, temporary hacks, excessive logging on feature branches are acceptable to locate the root cause. The final result must be clean and tested.
- **No point fixes or workarounds in the final result.** A final fix that hides a deeper problem is not acceptable.
- **Workarounds come back as boomerangs.** If a function produces incorrect results for certain inputs, fix that function — don't avoid calling it.
- **Wrong content from an agent is an instruction problem** — Find the misleading or too complex
  instruction and clarify it, or simplify the tool API; correct the input automatically before
  rejecting it. A guard is a last resort — see [Guards Are a Last Resort](#guards-are-a-last-resort)

### Process

1. **Reproduce** — Identify steps to reproduce the issue
2. **Investigate** — Trace the data flow and identify the root cause
3. **Implement** — Write clean, focused fix
4. **Validate** — Test the fix thoroughly
5. **Document** — Update documentation if needed
