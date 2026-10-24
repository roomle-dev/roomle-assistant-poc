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

This example covers fence planning and exports. For the native product assistant,
see the separate [configurator example](../minimal-configurator-example/README.md).

`npm test` from the repository root runs both examples' tests; `npm test` here runs
the fence page and launcher tests.
