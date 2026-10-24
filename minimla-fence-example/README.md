# Minimal fence example

A single HTML page with no build step, based on roomle-ui's
[minimum fence example](https://github.com/roomle-dev/roomle-ui/tree/master/packages/embedding-lib/docs/minimum-fence-example).
It embeds the planner with the Biohort fence catalog and a saved outdoor plot.

## Run

From the repository root:

```sh
npm install
npm run start:fence
```

Or run `npm start` in this folder. The launcher opens <http://localhost:3001/>.
Use `npm run dev:fence` from the root, or `npm run dev` here, with roomle-ui running
on port 5173. `EXAMPLE_PORT` selects another page port, `EXAMPLE_SERVER_URL` selects
another UI deployment, and `--no-open` skips opening the browser:

```sh
EXAMPLE_PORT=3101 npm run start:fence -- --no-open
```

Any static HTTP server can serve `index.html`; dependencies are loaded from the CDN.
The page pins the same embedding library version as the configurator example.

## Defaults and URL parameters

| Parameter | Default | Purpose |
|---|---|---|
| `configuratorId` | `biohort_fence` | First argument to `createPlanner` |
| `catalogRootTag` | `biohort_fence_root` | Fence catalog |
| `id` | `ps_mpzobaibjtz9034jbpurb6t98fab0w8` | Plan snapshot passed to `ui.loadObject` |

The snapshot contains an empty outdoor plot. Add fence elements from the Biohort catalog.
All other query parameters, such as `locale=de` and `overrideServerUrl`, pass through
as planner init options. `id` and `configuratorId` are removed from those options.
After loading, `window.instance` exposes the embedding API for browser experiments.

## Exports

- **Construction overview (JSON)** downloads `getConstructionOverview()` as `construction-overview.json`.
- **Bill of materials (JSON)** downloads the overview's `parts.fullList` as `construction-bom.json`.
- **2D plans (floor + elevations)** downloads every SVG from `create2DElevationPlan()`.
  A view type of `0` is named `roomle-floor-plan.svg`; elevations are numbered separately.

Exports become available after the snapshot loads. Loading and export errors appear
above the planner. Allow multiple downloads in the browser when exporting several SVGs.
The iframe UI must expose `getConstructionOverview` and `create2DElevationPlan`;
use the matching local roomle-ui build when a deployed UI lacks these methods.

This example covers terrain planning, the Fence Assistant and construction exports. For the native product assistant,
see the separate [configurator example](../minimal-configurator-example/README.md).

`npm test` from the repository root runs both examples' tests; `npm test` here runs
the fence page and launcher tests.

## Fence Assistant

Use a matching local roomle-ui and Core build, then select an OpenAI model:

```sh
npm run dev:fence -- gpt-6-luna YOUR_OPENAI_API_KEY
```

Run this command from the repository root. Alternatively set `OPENAI_API_KEY` and
pass just the model. The launcher adds `chat=true` without putting the key in the URL.
The page fetches local model configuration before creating the planner, enables
`planningAssistant` and `fence`, and supplies `apiKey` and `planningAiModel` through
init data. The planner UI starts the assistant; the page starts no second agent.

The assistant can load, generate and manipulate terrain with the lazy native planner
operation/tool APIs. Its coordinates use millimetres and ordinary planner history.
The shared chat appears as Fence Assistant. A matching UI/Core build is required;
this source change does not publish a package or update a deployed UI.

See [Fence Assistant architecture and limits](../docs/fence-assistant-overview.md).
