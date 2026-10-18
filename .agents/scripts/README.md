# Scripts

Agent utility scripts for automating repository tasks: link checking, test running, data fetching, report generation, benchmark execution.

## Guidelines

- Scripts are written in the repository's primary scripting language (JavaScript/Node.js).
- Each script does one thing and does it well.
- Scripts are referenced from skills and `AGENTS.md` so the agent knows they exist and when to run them.
- Naming: kebab-case, descriptive verbs (`check-markdown-links.js`).
- No production code here. No one-off throwaway scripts (those go in `.temp/`).

## Current Scripts

| Script | Description |
|---|---|
| [check-markdown-links.js](check-markdown-links.js) | Checks the relative links of markdown files: `node .agents/scripts/check-markdown-links.js <file.md> …` |
