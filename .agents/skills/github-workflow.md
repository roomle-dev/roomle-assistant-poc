# GitHub Workflow

**Trigger:** Before every commit, push, or pull request. This skill is loaded proactively — the agent does not wait to be asked.

**Goal:** Enforce git discipline: stage only related changes, write conventional commit messages, verify documentation obligations, and never rewrite history.

## Procedure

### Step 1 — Review all changes

- Run `git status` and `git diff` to see every change.
- Confirm every change is intentional and related to the current task.
- Discard or stash anything unrelated.

### Step 2 — Stage only related changes

- Stage files explicitly: `git add <file1> <file2>`.
- For mixed changes, use `git add -p` to stage hunks selectively.
- **Never `git add .` without reviewing.**
- **Never commit:** build artifacts, dependencies (`node_modules/`), temporary files (`.temp/`), IDE configs, debug code, commented-out code, or `__`-prefixed files.

### Step 3 — Run the checks

Before committing, run the repository's checks:

```bash
npm test               # vitest: the MCP server and the chat backend
npm run typecheck      # tsc --noEmit on both packages
npm run lint           # Oxlint
npm run format:check   # Prettier
node .agents/scripts/check-markdown-links.js <changed .md files>
```

### Step 4 — Check documentation obligations

Before committing, verify:

- [ ] Every new markdown file in `.agents/` has a row in the relevant `README.md` index.
- [ ] Every new ADR is registered in `.agents/decisions/README.md` and `.agents/README.md`.
- [ ] Every analysis document that has landed is closed out (see [`analysis-closeout`](analysis-closeout.md)).
- [ ] Every change to productive code has updated the living-reference document that covers the affected area.
- [ ] Every new feature has a context document in `.agents/context/`.
- [ ] The `.agents/README.md` master index is up to date.

### Step 5 — Write the commit message

- Format: `type: lowercase description`
- No trailing period. No capitalization in the description. No ticket numbers in the subject.
- Allowed types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `perf`, `ci`, `build`, `revert`.
- Examples:
  - `fix: correct crash on empty input vector`
  - `feat: add export to CSV format`
  - `docs: add context document for the data pipeline`
  - `refactor: extract validation into a separate module`
- Do not put ticket numbers in the commit message. Reference the ticket in the PR body instead.

### Step 6 — Commit

- `git commit -m "<message>"`
- Verify the commit: `git log --oneline -1` and `git show --stat`.

### Step 7 — Before pushing

- Run the test suite to confirm no regressions.
- Verify the branch name follows the convention (e.g. `fix/crash-on-empty-input`, `feat/csv-export`).
- Push: `git push origin <branch>`.

### Step 8 — Before creating a PR

- **Never create a PR automatically.** A pull request is created only when the user explicitly asks for one.
- When the user asks: create the PR with a detailed description covering what changed, why, and how it was validated.
- Reference the Jira ticket in the PR body (not in the title).
- **Never merge a PR.** Merging is always a human decision.

## Hard Rules

- **Never rewrite history.** No `git commit --amend`, no `git push --force`, no `git push --force-with-lease`, no `git rebase` on commits that are part of the main workflow. Any change MUST be a new commit.
- **Conventional commits only.** Format: `type: lowercase description` — no trailing period, no ticket numbers.
- **Only commit related changes.** Every file in a commit MUST be directly related to the commit's purpose.
- **Never commit build artifacts, dependencies, temporary files, IDE configs, debug code, or commented-out code.**
- **Never create a PR automatically.** Only when the user explicitly asks.
- **Never merge a PR.** Not with `gh pr merge`, not by enabling auto-merge.
- **Every new document gets a line in the index.** Same commit.
- **Every change to productive code updates the documentation.** Same branch.

## Completion Checklist

- [ ] All changes reviewed (`git status`, `git diff`)
- [ ] Only related files staged (no `git add .` without review)
- [ ] No build artifacts, temp files, or debug code staged
- [ ] Checks pass (`npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`)
- [ ] Documentation obligations checked (indexes, ADRs, analysis close-outs, context docs)
- [ ] Commit message follows conventional format
- [ ] Commit created and verified
- [ ] Branch pushed
- [ ] No PR created (unless explicitly asked)
- [ ] No PR merged
