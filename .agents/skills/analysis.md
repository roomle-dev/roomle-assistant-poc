# Analysis Skill

**Trigger:** The user says "analyse the bug" (also "analyze the bug", "bug analysis"), "analyse the feature" (also "analyze the feature", "feature analysis"), or "analyse the refactoring" (also "analyze the refactoring", "refactoring analysis"). The trigger phrase alone means *execute the whole procedure* — without asking for the details defined here.

**Goal:** Produce a complete, written analysis of a bug, feature question, or refactoring — tracing the behaviour to its origin in the code — before any productive code is changed.

## Procedure

### Step 1 — Determine the analysis type

| Trigger phrase | Analysis type | Destination folder |
|---|---|---|
| "analyse the bug" / "analyze the bug" / "bug analysis" | Bug analysis | `.agents/bug-analysis/` |
| "analyse the feature" / "analyze the feature" / "feature analysis" | Feature analysis | `.agents/feature-analysis/` |
| "analyse the refactoring" / "analyze the refactoring" / "refactoring analysis" | Refactoring analysis | `.agents/refactoring-analysis/` |

### Step 2 — Trace the behaviour to its origin

- Follow the execution path from the symptom or question through to the point where the code makes the decision that produces the result.
- Use trial-and-error, temporary logging, reading callers and callees, and any other investigation technique needed.
- No symptom-level conclusions. No hacks. No workarounds.
- Record the investigation trace with `file:line` references at every step.

### Step 3 — Write the analysis document

Create a new markdown file in the matching folder with a descriptive kebab-case slug (e.g. `stale-data-after-undo.md`, `export-button-overlaps-toolbar.md`, `split-loader-into-modules.md`).

The document must begin with a header block, immediately followed by the **affected repositories**: a short list, one line per repository the work changes, saying what changes there.

#### Bug analysis document shape

1. **Symptom and reproduction** — what goes wrong and how to reproduce it.
2. **Investigation trace** — the path through the code, with `file:line` references.
3. **Root cause** — the exact location and the exact mismatch. The deepest point where the bug originates.
4. **Why the current code is wrong** — the reasoning, not just the location.
5. **Proposed clean fix** — what should change and why it addresses the root cause. Never a symptom-level fix or workaround.

Status: `Open`.

#### Feature analysis document shape

1. **What was asked and why** — the request and its motivation.
2. **How the area works today** — the entities involved, the data flow, the code that drives it, with `file:line` references.
3. **The gap or question** — what is missing or unclear.
4. **Proposed design or change** — the approach.
5. **Alternatives considered and why they were rejected** — each alternative with the reason for rejection.
6. **Code and documents the work would touch** — files that change, documents that need updating.

Status: `Open`.

Note: A description of how a feature works *today* is living reference and does not belong here — it belongs in `.agents/context/`.

#### Refactoring analysis document shape

1. **What the current code does and why it is a problem** — the motivation.
2. **Full scope of the change** — every affected location with `file:line` references.
3. **Proposed target shape** — the structure after the refactoring.
4. **Tests covering the affected behaviour** — which tests guard this area.
5. **Output changes to expect** — fewer vertices, different hashes, changed ordering, etc.
6. **Benchmark plan** — for a performance refactoring, the benchmark to run before and after.

Status: `Open`.

### Step 4 — Register the document

1. Add a row to the folder's `README.md` with the document name, status, and a one-line summary.
2. Add a row to the matching table in `.agents/README.md`.

### Step 5 — Post to Jira (if applicable)

If the task relates to an Atlassian Jira ticket, post the analysis as a comment on the ticket — same content as the markdown document. Use `PAGER=cat jira issue comment add <KEY> --template <file> --no-input`.

## Hard Rules

- **Do not modify productive code.** Analysis is analysis-only unless the user also asks for the change.
- **No hacks, no workarounds, no symptom-level conclusions.** Trace to the deepest origin.
- **The analysis is written before the fix or feature work.** The agent does not jump straight to code changes.
- **Name the affected repositories first**, right after the header block.
- **Every analysis produces a document.** "Analyse X" always means *and write the analysis down*.
- **Potential improvements or refactoring discovered during a bug analysis go to the backlog**, never into the analysis as a fix proposal. Add a backlog item in `.agents/backlog/`.

## Completion Checklist

- [ ] Analysis type determined (bug / feature / refactoring)
- [ ] Behaviour traced to its origin in the code with `file:line` references
- [ ] Analysis document written in the correct folder with a kebab-case slug
- [ ] Affected repositories named first, right after the header block
- [ ] Document registered in the folder's `README.md`
- [ ] Document registered in `.agents/README.md`
- [ ] Posted as a Jira comment if the task relates to a ticket
- [ ] No productive code modified
