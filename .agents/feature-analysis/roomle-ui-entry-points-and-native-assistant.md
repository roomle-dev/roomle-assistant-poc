# Roomle UI entry points and a native configurator assistant

Status: Open — feasibility established; direct UI integration is not implemented
Date: 2026-10-24
Ticket: None supplied

## Affected repositories

- **roomle-ui** — proposed standalone assistant startup using the existing configurator SDK and chat window; deployment must include the native agent API.
- **roomle-configurator-mcp** — this analysis and its indexes; the example remains the reference for embedded integration.

RoomleCore requires no kernel change for this integration.

## What was asked and why

Identify the HTML loaded by `npm run dev` at `http://localhost:5173/` and by
`https://www.roomle.com/t/bo-test`, and determine whether the configurator assistant from
`minimal-configurator-example/index.html` can run there directly.

## How the area works today

Code references beginning with `roomle-ui:` refer to the sibling repository. Current-checkout
references describe branch `feat/attic-camera-facing-visibility-RML-14443`. Native agent references
describe the locally available remote-tracking ref `origin/feat/configurator-mcp-api` at
`9d077e222fb59ac4c6f8b4ee248431a88b575c9c`. The local branch of the same name is older
(`34ab763f3`); its name alone does not identify the compatible implementation.

### Local and deployed HTML

| Entry | Trace |
|---|---|
| Local `/` | `roomle-ui:package.json:7` runs Vite with `config/vite.config.ui.mts`. The root `index.html:210` supplies `#app` and loads `/src/main.ts` at line 211. |
| Vue application | `roomle-ui:src/main.ts:68` creates the app with `App.vue`; line 215 mounts it. `src/App.vue:7` selects configurator, planner or viewer content according to UI state. |
| Production build | `roomle-ui:package.json:15` runs `vite build`; `config/vite.config.ui.mts:20` explicitly includes root `index.html`. Vite emits `dist/index.html` with compiled asset references. |
| BO test deployment | `roomle-ui:.github/workflows/cd-gcp-bo.yaml:7` triggers on `release/bo-test`; line 73 selects `t/bo-test`; line 130 runs `npm run build`; lines 149–151 move `dist` contents into that directory; lines 160–167 upload to `roomle-configurator-live`. |

Direct HTTP verification on 2026-10-24 confirms:

- Local `/` returns the `Roomle Rubens` page, Vite's `/@vite/client`, and `/src/main.ts`.
- [BO test](https://www.roomle.com/t/bo-test) responds with a 301 redirect to
  `/t/bo-test/index.html`, then 200. Its HTML contains `#app` and
  `./assets/main-B-KndOrM.js`; it contains no iframe element.
- The [deployed version page](https://www.roomle.com/t/bo-test/version.html) reports SHA
  `1d9adf5` and build date `23-10-2026 08:17:04`. That commit is available locally as
  `1d9adf51e` and lacks the three native configurator agent methods and the optional assistant entry.

`embedding.html` is another build input (`roomle-ui:config/vite.config.ui.mts:22`), not the
page selected for `/`. Its script explicitly requires Playwright
(`roomle-ui:embedding.html:23`) and otherwise throws at line 30.

### Example and assistant ownership

The [example HTML](../../minimal-configurator-example/index.html#L30) imports the main embedding
library and optional `configurator.js` entry at the same exact dev version. It enables
`featureFlags.planningAssistant` when `chat=true`, calls `createConfigurator`, loads the object,
and starts `startConfiguratorPlanningAssistant` with
`{ configurator: instance.extended, window: instance.extended }` (lines 38–60).

The example is an outer host page. Its embedding instance creates the iframe containing the UI.
The host runs the model loop; the live SDK inside the iframe owns tools, prompts and mutations.
There is no inbound MCP HTTP endpoint or WebSocket bridge.

The feature implementation accepts structural endpoints rather than requiring an iframe:

- `roomle-ui@9d077e222:packages/embedding-lib/src/configurator-agent/configurator-planning-assistant.ts:12`
  takes `{ configurator, window }` and delegates to the shared assistant.
- `roomle-ui@9d077e222:packages/embedding-lib/src/planning-assistant/planning-assistant.ts:8`
  requires a window endpoint with `planningAssistantOutput` and `callbacks`. Line 49 installs
  `onPlanningAssistantPrompt`; line 122 marks the assistant available.
- `roomle-ui@9d077e222:packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts:1556`,
  `:1569` and `:1588` expose `getConfiguratorAgentTools`, `callConfiguratorAgentTool` and
  `getConfiguratorAgentPrompts`. The registry is imported lazily at line 1599.

The existing UI already supplies the other side: `roomle-ui:src/common/components/PlanningAssistantChat.vue:223`
obtains the SDK and sends prompts to its callback at line 230. The SDK's
`planningAssistantOutput` forwards output at `packages/web-sdk/packages/configurator-core/src/roomle-configurator.ts:2313`.
The chat store starts unavailable (`src/common/store/planning-assistant-store.ts:36`). Showing
the window alone does not start an agent.

## The gap

Both the current UI checkout and deployed BO commit lack the native agent implementation.
The pinned embedding package cannot add methods to an older UI. Neither standalone UI boot nor
the BO deployment starts the native model loop or supplies the example's local model-config route.

## Proposed design

Reuse the feature branch's native tools and shared assistant loop inside the standalone UI.
After initialization, obtain the existing configurator through
`roomle-ui:src/configurator/business-logic/sdk-connector.ts:174` and supply that SDK object as both
the configurator and window endpoints. Load the assistant module only when the assistant is enabled
and a model configuration is available. Its lifecycle follows the active UI session.

This is the same tool/model interaction as the example, with direct SDK calls in place of the
embedding proxy. Startup belongs in TypeScript application lifecycle code, where the SDK and
initialization state are available. Root HTML can remain a Vite entry shell.

Standalone startup must respect embedded operation: an embedding host may already own
`onPlanningAssistantPrompt`. Native configurator mode is the scope of this proposal. Planner
isolation needs a native configurator tool endpoint and the planner's chat endpoint; automatic
switching between HI planning and native configuration is a separate decision.

The local launcher serves `/planning-assistant-config.json` with model credentials
([start.mjs](../../minimal-configurator-example/start.mjs#L100)); Vite and the static BO build do
not inherit that route. Local integration needs a development configuration source. Deployment
needs a model endpoint and authentication policy, such as an authenticated provider proxy. Private
provider credentials must not be bundled in public HTML or Vite client assets.

## Alternatives considered

- **A separate embedding host page** is valid and most closely matches the example. Its
  `overrideServerUrl` can point to local Vite or BO test once the UI is compatible. It retains an
  outer page and iframe rather than adding assistant startup to the directly opened application.
- **Pasting `createConfigurator` into root UI HTML** creates another embedded application instead
  of attaching to the app already mounted in `#app`. It is not the suitable integration point for
  direct UI operation.
- **Using root `embedding.html`** selects a Playwright fixture, not a reusable production host.
- **Copying tool implementations into this example or adding an MCP server** duplicates SDK
  ownership and is unnecessary for browser chat; see [ADR 0002](../decisions/0002-configurator-tools-run-in-the-sdk.md).

## Code, documentation and verification affected by future work

The application needs a standalone startup connection to the existing assistant, a model config
source, and the compatible SDK feature code. Relevant areas are `src/main.ts`, the configurator
SDK connector, chat lifecycle, and the optional embedding assistant modules. Update the
roomle-ui assistant integration documentation and this repository's
[assistant guide](../../docs/configurator-assistant.md) with any new standalone usage.

Acceptance checks should establish one live configurator instance, lazy loading when enabled,
prompt/output delivery, unchanged embedded-host callback ownership, and shared UI/agent undo
history. A browser check should cover local Vite and a built subdirectory deployment. No
application code or running server was changed in this analysis; HTTP and source inspection
establish feasibility, not a completed runtime integration.
