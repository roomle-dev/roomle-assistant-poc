# Minimal Configurator Example

A minimal, copy-paste starting point for embedding the Roomle configurator. It is a single
[`index.html`](./index.html) — plain JavaScript, no build step — that loads
`@roomle/embedding-lib` from a CDN, calls `createConfigurator` with init options taken from the URL
query string and loads a default item. It is the configurator counterpart of the
[minimum-fence-example](https://github.com/roomle-dev/roomle-ui/tree/master/packages/embedding-lib/docs/minimum-fence-example)
of roomle-ui: the same page skeleton, a configurator instead of a planner, and no buttons.

## Run it

The example must be served over HTTP (ES module imports don't work from `file://`). The launcher
[`start.mjs`](./start.mjs) serves this folder on port 3000 and opens the browser:

```bash
npm start                # from the repository root or this folder
npm start -- --no-open   # without opening the browser
EXAMPLE_PORT=3001 npm start
```

Then open <http://localhost:3000/>.

To develop against a local Rubens UI dev server (start it first on <http://localhost:5173/>), run
`npm run dev` instead — it opens the example with `overrideServerUrl=http://localhost:5173/` so the
configurator loads from the local UI instead of `https://www.roomle.com/t/cp/`. Another UI:
`EXAMPLE_SERVER_URL=<url> npm start`.

## URL parameters

All query-string parameters are passed to `createConfigurator` as init options, e.g.
`?locale=de&overrideServerUrl=https://www.roomle.com/t/bo-dev/`. One parameter gets special
treatment:

- **`id`** — the item or configuration to load on start; it is removed from the init options.
  Defaults to `usm:frame`.

## Make it yours

Edit the values in [`index.html`](./index.html):

- **`createConfigurator('demoConfigurator', …)`** — the embedding ID (configuratorId).
- **`options.id ?? 'usm:frame'`** — the default item or configuration to load on start.
- **`@roomle/embedding-lib@8.1.0`** — the pinned embedding-lib version.
