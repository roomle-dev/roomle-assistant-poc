# Analysis Cleanup Skill

Load this skill when the user says **"cleanup analyses"**, **"clean up the analyses"**, **"analysis
cleanup"** or **"cleanup analysis"**, or asks to review or tidy the analysis folders. The phrase
alone means *execute this whole procedure*, without asking for the details it defines.

## Goal

The analysis folders hold **only work that has not landed**:

- `.agents/feature-analysis/` — feature analyses with status `Open`
- `.agents/bug-analysis/` — bug analyses with status `Open`
- `.agents/refactoring-analysis/` — refactoring analyses with status `Open`

Every document whose work has landed on `master` is closed out: its durable outcome is promoted
into the living reference, and the document is deleted. Open work stays untouched. When work that
has an analysis is being committed, promote the durable outcome and set the analysis's status in the
same branch while the context is hot; the document itself is deleted once the work is on `master` —
this skill is the sweep that performs that deletion over all three folders.

The status values are the ones of [the digital brain index](../README.md): bug `Open` / `Fixed`,
feature `Open` / `Implemented` / `Rejected`, refactoring `Open` / `Done`. Close out `Implemented`
feature analyses, `Fixed` bug analyses and `Done` refactoring analyses. A `Rejected` feature
analysis closes out the same way once its rejected approach is recorded as an ADR.

## What counts as landed — never guess

An analysis always includes **which repositories are affected**, named first right after its header
block — one line per repository the work changes, saying what changes there (for example roomle-ui,
roomle-configurator-mcp, RoomleCore). The list is the verification map: the landed work is checked in
each named repository.

A document counts as landed only when all of these hold:

- The commit is reachable from `master` in each affected repository: `git fetch origin master`
  once, then `git merge-base --is-ancestor <sha> origin/master` — for roomle-ui, its own checkout's
  `origin/master`. Commits that are only on an unmerged branch do not count: the lifecycle deletes
  an analysis once its work is on `master`.
- The behaviour is in the code on `master`: the tool, method or feature the analysis names exists
  where the analysis said it would land (grep the tool registration, the page allow-list, the
  public method).
- The repository gates pass: `npm test`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`.

A document whose work cannot be established as landed stays.

## Procedure

### 1. Branch and inventory

```bash
git switch -c docs/<slug>
find .agents/bug-analysis .agents/feature-analysis .agents/refactoring-analysis -name '*.md' ! -name README.md
```

Collect the inbound links too:
`grep -rn "bug-analysis/\|feature-analysis/\|refactoring-analysis/" --include='*.md' .`

### 2. Close out each landed analysis

**Verify it landed** (above). If it did not, leave the document and note why.

**Promote the durable outcome.** The durable outcome is what must keep holding, or what the next
person needs to know. Add it only where its home does not state it yet:

| What | Where it goes |
|---|---|
| How a new feature works today | a new document in [`.agents/context/`](../context/README.md), with a row in the feature index and in the Context table of [`.agents/README.md`](../README.md) |
| Additional information about an existing feature, or a change of its behaviour | that feature's document in `.agents/context/` |
| The invariant or behaviour contract of an area | the living reference that covers it: `docs/`, a skill in `.agents/skills/`, or a wiki page in `.agents/wiki/` |
| A design decision, or a rejected approach someone could re-propose | a numbered ADR in `.agents/decisions/` |
| An open remainder or follow-up | a row in [`.agents/backlog/README.md`](../backlog/README.md) |
| The refactoring report (summary, changed files, test adaptations, risks) | the pull request description |

Drop the rest: symptom, reproduction, investigation trace, line-level narrative, verification
logs, alternative fixes nobody would re-propose.

The living reference describes how the code works **today**: present tense, no ticket numbers, no
"was fixed", "previously", or "the old code".

**Delete the analysis and fix its links.** Delete the document in the same branch. Point every
link to it at the living-reference location that now carries the outcome, and remove its row from
[`.agents/README.md`](../README.md) and the folder's README. No dangling links.

### 3. Rebuild the indexes

- `.agents/README.md`: remove the rows of the deleted documents; add rows for new context
  documents, ADRs and backlog items.
- The folder READMEs: their document tables list only what remains.
- [`.agents/context/README.md`](../context/README.md): the feature index lists the context
  documents as they are after the close-out.

### 4. Check

- Link check over every markdown file:
  `find . -name '*.md' -not -path './node_modules/*' -not -path './.temp/*' -not -path './configurator-mcp/*/node_modules/*' | sort | xargs node .agents/scripts/check-markdown-links.js`
  — the result is `bad 0`. Without file arguments the script checks nothing.
- No plain-text mention of a deleted path: `grep -rn "<analysis folder>/<deleted slug>"
  --include='*.md' .` (for example `feature-analysis/<deleted slug>`) — search the deleted folder
  plus filename, not the bare slug: the promoted context document keeps the same filename
  (`context/<deleted slug>.md`), and links to it are expected. The link check above catches a
  broken filename-only link.
- `npm run format:check` passes (Markdown is not formatted, but the check must).

### 5. Commit

One `docs: …` commit on the branch. Open a pull request only when the user asks.

## Hard rules

- **Never delete before promoting.** An analysis whose invariant is not in the living reference,
  an ADR or a test takes the only record of why the code is shaped that way with it.
- **Never guess.** A document whose work cannot be verified as landed stays.
- **Open work stays.** An analysis of an open bug, an undecided feature or a refactoring not yet
  carried out remains in its folder until the work lands or is abandoned.
- **The context folder holds features as they are.** An open feature question keeps its analysis in
  `.agents/feature-analysis/`; only landed work moves to `.agents/context/`.
