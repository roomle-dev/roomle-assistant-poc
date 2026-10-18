# Cleanup Backlog

**Trigger:** The user says "cleanup backlog", "clean up the backlog", or "backlog cleanup". The trigger phrase alone means *execute the whole procedure*.

**Goal:** Sweep the backlog so it holds open todos only — verify every item against the code, remove what landed, strip history, refresh references.

## Procedure

### Step 1 — Read the current backlog

- Read `.agents/backlog/README.md` and every document it links to.
- List every item.

### Step 2 — Verify every item against the code

For each item:

- Grep for the symbols, functions, and `file:line` references the item names.
- Check git history (`git log --oneline -- <file>`) for landed work that addresses the item.
- Determine: is this item fully done, partially done, or still open?

### Step 3 — Process each item

| Finding | Action |
|---|---|
| Work has landed | Remove the item entirely. |
| Partially done | Shrink the item to the part that is still open. Remove the done part. |
| Still open | Keep the item. Strip any history ("found while...", "attempted...", "previously..."). Refresh `file:line` references to match HEAD. |

### Step 4 — Rebuild the index

- Update `.agents/backlog/README.md` so it lists only the remaining open items.
- Update the Backlog table in `.agents/README.md`.

### Step 5 — Commit

- Commit on a docs branch.
- Conventional commit: `docs: cleanup backlog`.

## Hard Rules

- **Verify every item against the code — never trust the document's status.**
- **The backlog holds open work only.** A backlog document says what is still to do, never what was done.
- **No status history.** No "found while...", no "already implemented" tables, no Jira status snapshots, no record of a failed attempt.
- **Refresh `file:line` references** so they match HEAD.
- **An item leaves the backlog when its fix is in the code.** Pending merges, releases, or deployments do not keep it in the backlog.

## Completion Checklist

- [ ] Every backlog item read and listed
- [ ] Every item verified against the code (grep, git history)
- [ ] Landed items removed
- [ ] Partially-done items shrunk to the open remainder
- [ ] Open items stripped of history, references refreshed
- [ ] `.agents/backlog/README.md` rebuilt
- [ ] `.agents/README.md` Backlog table updated
- [ ] Committed on a docs branch
