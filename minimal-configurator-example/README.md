# Minimal Configurator Example

A minimal, copy-paste starting point for embedding the Roomle configurator. It is a single
[`index.html`](./index.html) — plain JavaScript, no build step — that loads
`@roomle/embedding-lib` from a CDN, calls `createConfigurator` with init options taken from the URL
query string and loads a default item. It is the configurator counterpart of the
[minimum-fence-example](https://github.com/roomle-dev/roomle-ui/tree/master/packages/embedding-lib/docs/minimum-fence-example)
of roomle-ui: the same page skeleton, a configurator instead of a planner, and no buttons. It is
the page of the configurator MCP server, with `chat=true` also the host of the AI Planning
Assistant window — see [the reference](../docs/configurator-mcp-server.md#the-page).

The page relays `getConfiguratorCapabilities`, `undo` and `redo`. The read requires a Rubens UI that exposes `getConfiguratorCapabilities`; an older UI receives an actionable update error for that method. The MCP tool accepts optional section names and returns the SDK's JSON without changing the product or its history. See [the tools reference](../docs/configurator-mcp-server.md#tools) for the contract and partial-result handling.

## Run it

The example must be served over HTTP (ES module imports don't work from `file://`). The launcher
[`start.mjs`](./start.mjs) serves this folder on port 3000, starts the MCP server on port 3100 and
opens the browser at <http://localhost:3000/>:

```bash
npm start                            # from the repository root or this folder
npm start mistral-medium <api-key>   # plus the chat backend and the AI Planning Assistant window
npm start mistral-large <api-key>
npm start -- --no-open               # without opening the browser
EXAMPLE_PORT=3001 npm start
```

Any static server works for the page alone; without the MCP server it keeps trying to connect.

To develop against a local Rubens UI dev server (start it first on <http://localhost:5173/>), run
`npm run dev` instead — it opens the example with `overrideServerUrl=http://localhost:5173/` so the
configurator loads from the local UI instead of `https://www.roomle.com/t/cp/`. Another UI:
`EXAMPLE_SERVER_URL=<url> npm start`.

## URL parameters

All query-string parameters are passed to `createConfigurator` as init options, e.g.
`?locale=de&overrideServerUrl=https://www.roomle.com/t/bo-dev/`, except the page's own:

- **`id`** — the item or configuration to load on start. Defaults to `usm:frame`.
- **`chat=true`** — show the AI Planning Assistant window (`featureFlags.planningAssistant`) and
  run its turns through the chat backend.
- **`mcp_port`**, **`chat_port`** — the ports of the MCP server (3100) and the chat backend (3200).

## Make it yours

Edit the values in [`index.html`](./index.html):

- **`createConfigurator('demoConfigurator', …)`** — the embedding ID (configuratorId).
- **`options.id ?? 'usm:frame'`** — the default item or configuration to load on start.
- **`@roomle/embedding-lib@8.1.0`** — the pinned embedding-lib version.
- **`CONFIGURATOR_METHODS`** — the configurator methods the MCP server may call; the server's
  `configurator-api.ts` names the same.
