# Analysis Closeout

**Trigger:** Work that has an analysis document is being committed. The agent closes out the analysis in the same branch as the work.

**Goal:** Close out a single analysis document once its work has landed: verify it landed, promote the durable outcome into its permanent home, and delete the analysis document.

The full sweep over all three analysis folders is the **analysis-cleanup** skill. This skill handles the single-document close-out at commit time, while the context is hot.

## Procedure

### Step 1 — Identify the analysis document

- Determine which analysis document covers the work being committed (bug, feature, or refactoring).
- Read the analysis document in full.

### Step 2 — Verify the work landed

Never guess. Check:

- The commit is reachable from the default branch (or will be, once the branch is merged).
- The behaviour described in the analysis is in the code.
- The guarding test exists and passes.

### Step 3 — Promote the durable outcome

Identify what in the analysis is durable — what a future reader needs to know — and promote it to its permanent home:

| Durable outcome | Permanent home |
|---|---|
| An invariant or rule about the code | Living reference: `.agents/context/` or `.agents/wiki/` |
| A design decision (chosen or rejected) | ADR in `.agents/decisions/` |
| A debugging recipe or procedure | Skill in `.agents/skills/` |
| An open remainder or follow-up | Backlog item in `.agents/backlog/` |
| A refactoring report | Pull request description |

Drop the rest: symptom, reproduction, investigation trace, verification logs, alternative fixes nobody would re-propose.

### Step 4 — Update the analysis document status

- Bug analysis: set status to `Fixed`.
- Feature analysis: set status to `Implemented` (or `Rejected` if the approach was rejected).
- Refactoring analysis: set status to `Done`. Append the report (summary of changes, changed files, before/after comparison, test adaptations, risks and open items, performance measurements if applicable).

### Step 5 — Delete the analysis document

Once the work is on the default branch:

- Delete the analysis document file.
- Remove its row from the folder's `README.md`.
- Remove its row from `.agents/README.md`.
- Fix any links that pointed to it.

Git history, the Jira comment, and the pull request description remain the archive.

### Step 6 — Commit

- Include the close-out in the same branch as the work.
- Conventional commit for the deletion: `docs: close out <analysis-slug>`.

## Hard Rules

- **Verify the work landed — never guess.** Check the commit, the behaviour, and the guarding test.
- **Promote before deleting.** The durable outcome must be in its permanent home before the analysis document is deleted.
- **A solved bug keeps no analysis.** Once its fix has landed on the default branch, the valuable content is promoted and the document is deleted.
- **Do not delete the analysis if the work has not landed.** Open analyses stay.
- **Fix all links** that pointed to the deleted document.

## Completion Checklist

- [ ] Analysis document identified and read
- [ ] Work verified as landed (commit reachable, behaviour in code, guarding test exists)
- [ ] Durable outcome identified and promoted to its permanent home
- [ ] Analysis status updated (Fixed / Implemented / Rejected / Done)
- [ ] Refactoring report appended (if applicable)
- [ ] Analysis document deleted
- [ ] Folder README updated
- [ ] `.agents/README.md` updated
- [ ] All broken links fixed
- [ ] Committed in the same branch as the work
