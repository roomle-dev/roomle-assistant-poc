# configurator-mcp

The workspace for the Roomle configurator MCP server, written in TypeScript. It is empty on
purpose: the server is implemented after the analysis of what it needs — the data that defines a
configurator (component definitions, items, parameter values, material properties), the tool set,
and the simplified docking for agents. Nothing in this folder is to be built speculatively.

What is here already:

- `package.json` — the workspace package with `typescript` and `@types/node`, and the
  `typecheck` script (`tsc --noEmit`)
- `tsconfig.base.json` — strict ES2022 compiler options for Node
- `tsconfig.json` — extends the base; every `.ts` file of this folder is
  type-checked, so `npm run typecheck` at the repository root passes before the first source file
  exists and covers each file as it is added

The example page the server will drive is
[`../minimal-configurator-example/`](../minimal-configurator-example/README.md).
