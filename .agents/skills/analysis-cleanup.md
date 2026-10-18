# Analysis Cleanup Skill

Load this skill when the user says **"cleanup analyses"**, **"clean up the analyses"**, **"analysis
cleanup"** or **"cleanup analysis"**, or asks to review or tidy the analysis folders. The phrase
alone means *execute this whole procedure*, without asking for the details it defines.

## Goal

The analysis folders hold **only work that has not landed**:

- `.agents/feature-analysis/` — feature analyses with status `Open`
- `.agents/bug-analysis/` — bug analyses with status `Open`
- `.agents/refactoring-analysis/` — refactoring analyses with status `Open`

Every document whose work has landed is closed out: its durable outcome is promoted into the
living reference, and the document is deleted. Open work stays untouched. When work that has an
analysis is being committed, close the analysis out in the same branch while the context is hot;
this skill is the sweep over all three folders.

The status values are the ones of [the digital brain index](../README.md): bug `Open` / `Fixed`,
feature `Open` / `Implemented` / `Rejected`, refactoring `Open` / `Done`. Close out `Implemented`
feature analyses, `Fixed` bug analyses and `Done` refactoring analyses. A `Rejected` feature
analysis closes out the same way once its rejected approach is recorded as an ADR.

## What counts as landed — never guess

A document counts as landed only when all of these hold:

- The commit is reachable: `git log --oneline --grep=<slug>`, `git merge-base --is-ancestor <sha>
  HEAD`. On the current branch, the branch's own commits count.
- The behaviour is in the code at HEAD: the tool, method or feature the analysis names exists
  where the analysis said it would land (grep the tool registration, the page allow-list, the
  public method).
- An analysis that spans roomle-ui counts as landed only when the roomle-ui side is on that
  repository's `master` — check the roomle-ui checkout, not only this repository.
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

- Link check over every markdown file: `node .agents/scripts/check-markdown-links.js` with the
  result `bad 0`.
- No plain-text mention of a deleted path: `grep -rn "<deleted slug>" --include='*.md' .`
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
