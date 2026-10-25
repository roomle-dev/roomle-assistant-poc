# Minimal fence example

`minimla-fence-example/index.html` embeds a native construction planner through
`RoomleConfiguratorApi.createPlanner`. It imports the same pinned embedding library
as the configurator example, with no build step or HI context.

The default embedding ID is `biohort_fence`, the catalog root is `biohort_fence_root`,
and `ui.loadObject` loads `ps_mpzobaibjtz9034jbpurb6t98fab0w8`, an empty outdoor plot.
URL parameters override these defaults. `configuratorId` supplies the first factory
argument and `id` supplies the snapshot; both are removed from planner init options.
All remaining parameters are forwarded. The ready instance is exposed as `window.instance`.

Three buttons download the construction overview, its `parts.fullList` bill of materials,
and the SVGs returned by `create2DElevationPlan`. Floor plans are identified by
`viewType.value === 0`; elevations receive sequential filenames independent of result order.
Each download uses a Blob URL that is revoked after the click. The export fieldset is
disabled until loading completes, and loading/export failures appear in the status element.
The planner UI owns construction data and export generation.

`start.mjs` is a dependency-free, loopback-only launcher. It serves the page at `/` and
`/index.html`, uses port 3001 (`EXAMPLE_PORT` overrides it), and opens the page unless
`--no-open` is passed. `--dev` sets `overrideServerUrl` to localhost:5173;
`EXAMPLE_SERVER_URL` takes precedence. With model/key arguments it adds chat=true and serves a Host-checked, loopback-only,
no-store model endpoint. The page fetches that configuration before creating the planner,
sets both planningAssistant and fence flags, and supplies apiKey/planningAiModel through
init data. The planner UI owns assistant startup; the page runs no second agent.
The model key never appears in the generated URL. OPENAI_API_KEY supplies an optional
environment fallback when a model is explicitly selected.
The root scripts are `start:fence` and `dev:fence`; the workspace also supports
`npm start` and `npm run dev` directly.

The page tests execute the inline module with mocked embedding and DOM APIs. They
cover default/overridden initialization, readiness and load failures, JSON content,
SVG types/order, empty plans, export failures and Blob URL cleanup. Launcher tests
exercise HTTP serving, inaccessible paths, shutdown and UI deployment selection.
`npm test` at the root runs both workspaces.

See the [example guide](../../minimla-fence-example/README.md) and roomle-ui's
[minimum fence example](https://github.com/roomle-dev/roomle-ui/tree/master/packages/embedding-lib/docs/minimum-fence-example).

The [Fence Assistant overview](../../docs/fence-assistant-overview.md) describes lazy SDK ownership, native dependencies, terrain units/history and conservative pending construction results.

The assistant discovers 29 SDK tools: the existing terrain tools plus construction
context/products/parameters/impact/overview reads and nine fence authoring writes.
Product roots follow `catalogRootTag`; native distribution and exact edge placement
run in Core, while validation and orchestration load dynamically in the UI. See
[authoring contracts](../../docs/fence-assistant-overview.md#fence-authoring).
