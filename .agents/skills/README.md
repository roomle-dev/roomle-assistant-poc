# Skills

On-demand domain knowledge — procedures an agent loads when the task matches the skill's domain. Skills live exclusively in this folder.

## Core Skills

| Skill | Description | Load when |
|---|---|---|
| [`analysis`](analysis.md) | Analyse the bug, feature, or refactoring | "analyse the bug/feature/refactoring", "analyze...", "bug/feature/refactoring analysis" |
| [`plan-implementation`](plan-implementation.md) | Plan an implementation with unit tests | Planning a task or implementation |
| [`cleanup-backlog`](cleanup-backlog.md) | Sweep the backlog, verify every item against the code | "cleanup backlog", "clean up the backlog", "backlog cleanup" |
| [`analysis-cleanup`](analysis-cleanup.md) | Close out finished analyses across all three folders | "cleanup analyses", "clean up the analyses", "analysis cleanup" |
| [`roomle-pr-resolution`](roomle-pr-resolution.md) | Resolve a PR's code review | Resolving a pull request's code review |
| [`analysis-closeout`](analysis-closeout.md) | Close out a single analysis document at commit time | Work with an analysis document is being committed |
| [`github-workflow`](github-workflow.md) | Git staging, conventional commits, pre-commit checklist, PR guidelines | Before every commit, push, or pull request |

## Repository-Specific Skills

| Skill | Description | Load when |
|---|---|---|
| [`configurator-mcp-server`](configurator-mcp-server.md) | The MCP server, its tools, the page bridge, the chat backend, how a tool is added and tested | MCP server or chat development, adding a tool, the example page's MCP and chat code |

## Adding a New Skill

1. Write the skill file in this folder with a kebab-case name.
2. The skill file must have: title, trigger statement, goal, procedure, hard rules, completion checklist.
3. Add a row to this table.
4. Add a row to the skills table in `AGENTS.md` and in `.agents/README.md`.

Never create a `.claude/skills/` folder, never create `SKILL.md` wrapper files outside this folder, and never make tool-specific copies of a skill.
