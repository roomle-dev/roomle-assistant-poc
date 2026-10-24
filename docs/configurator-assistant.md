# The configurator assistant

This example embeds a native Roomle product configurator and uses the browser assistant from
`@roomle/embedding-lib/configurator`. The UI supplies the chat window and the tools. The host page
selects the model, keeps the conversation and runs the agent loop. The tools inspect and edit the
same live configuration that the user sees.

With `chat=true` the example sets `featureFlags.configurationAssistant=true`, which exposes the
**AI Configuration Assistant** in configurator mode. `planningAssistant` is reserved for planner
mode and does not enable configurator chat. The embedding host starts the agent; embedded UIs do
not start a second copy.

## Run

```sh
npm install
npm start
npm start mistral-medium <api-key>
npm start mistral-large <api-key>
npm run dev mistral-medium <api-key>
npm run dev gpt-6.1-sol "$OPENAI_ASSISTANT_API_KEY"
```

`npm start` serves the page on port 3000. With a model it opens `?chat=true` and serves the model
configuration to the local page at `/planning-assistant-config.json`. `npm run dev` points the
iframe at the roomle-ui dev server on port 5173. Set `EXAMPLE_PORT` for another page port and
`EXAMPLE_SERVER_URL` for another UI deployment. Pass `--no-open` to skip opening the browser.

The UI must support `featureFlags.configurationAssistant` and contain `getConfiguratorAgentTools`,
`callConfiguratorAgentTool` and `getConfiguratorAgentPrompts`. Use the roomle-ui integration branch
locally until the flag and methods are deployed. A compatible embedding library alone does not add methods to an
older iframe UI. An older UI is reported as unavailable.

The page pins `@roomle/embedding-lib@0.0.0-dev-9d077e2`, built from roomle-ui commit
`9d077e222fb59ac4c6f8b4ee248431a88b575c9c` with the optional configurator entry.

The launcher recognizes OpenAI model ids starting with `gpt-` or an o-series name such as `o3`.
Use a text model with function calling and an API key whose project has access to that model.
In dev mode the example loads the assistant helper from the local roomle-ui server on port 5173,
so local provider changes are available without publishing the embedding library. The normal
non-dev page uses its pinned CDN helper and requires a published version supporting OpenAI.

The launcher also accepts Mistral aliases and model ids, `claude`/`claude-*`, `gemini`/`gemini-*`, and
`azure`. For Azure set `AZURE_BASE_URL` to the deployment resource's OpenAI endpoint and
`CONFIGURATOR_CHAT_MODEL` to the deployment name. The same variable can override another
provider's model. Images are disabled in this example.

## What the agent can do

The sixteen tools read the current configuration, component/global parameters, possible children,
capabilities, docking positions and deletion impact. They change parameters, dock a new component,
move or delete an existing component, load a configuration, undo and redo. Product definitions,
current choices, materials and valid docking placements come from the SDK and kernel.

A partial capability result is successful and names unresolved resources. A write reports whether
the history recorded a change, with undo/redo availability. Setting an unchanged value creates no
step. Undo and redo follow the same history as the configurator UI, including manual edits.
The load tool replaces the active configuration and retains that undo history.
Interrupted turns report known tool outcomes and do not automatically retry uncertain edits.

Tools load on the first agent request. Ordinary configurator startup does not initialize them.
The assistant uses at most sixteen model steps, with the last reserved for its answer, and a
five-minute turn deadline. The tab must stay open while the agent works.

## Integration and credentials

The page calls `startConfiguratorPlanningAssistant` with
`{ configurator: instance.extended, window: instance.extended }`. In a planner explicitly editing
a native object in isolation, use `instance.configurator` for tools and `instance.extended` for
the window. One assistant owns that window callback.

The launcher exposes the provider key only to a loopback peer with a matching local Host and
marks the response `no-store`. The key is still visible in the browser. A production website
chooses its provider/proxy and authentication policy. Configuration data goes to that provider.

There is no `/mcp` endpoint or `/bridge` WebSocket. External MCP applications cannot connect to
this example. The runtime is one static process and the embedding messages between host and UI.

See the roomle-ui [integration guide](https://github.com/roomle-dev/roomle-ui/blob/feat/configurator-mcp-api/packages/embedding-lib/docs/configurator-assistant.md)
and this repository's [implementation reference](../.agents/context/configurator-example-with-planning-assistant-chat.md).
For SDK contracts, use the [API overview](../.agents/context/roomle-configurator-api-for-mcp.md),
which links to the query and execution references.
