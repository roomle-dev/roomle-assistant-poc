# Configurator example and AI Configuration Assistant

The runtime is one static Node launcher and one HTML page. The iframe SDK owns native tools and prompts, loaded on demand. The optional embedding entry runs the host agent. The launcher serves model/key configuration only to the local page.

Both browser imports pin `@roomle/embedding-lib@0.0.0-dev-9d077e2` on jsDelivr, from roomle-ui `9d077e222`.
The iframe needs the matching agent API and `configurationAssistant` feature flag. Use the
roomle-ui integration branch locally until both are deployed.

`index.html` creates the configurator from query init options, awaits `ui.loadObject`, then exposes `window.instance`. With `chat=true` it sets `featureFlags.configurationAssistant=true`, fetches `/planning-assistant-config.json` and starts `startConfiguratorPlanningAssistant` with `instance.extended` for tools and window. The configurator window is titled **AI Configuration Assistant**. `planningAssistant` controls only the planner window. The embedding host starts the agent. `pagehide` aborts the signal; setup errors report unavailability. Images are disabled.

The launcher requires a non-empty API key when a model is specified. The page validates the key
before starting the agent.

`start.mjs` serves port 3000 on loopback. `--dev` selects localhost:5173 through `overrideServerUrl`. `EXAMPLE_PORT`, `EXAMPLE_SERVER_URL` and `--no-open` are supported. The config route checks peer/Host and sends `no-store`. Keys stay out of URLs/logs. SIGINT/SIGTERM stop the one process; there are no child servers or build gates.

OpenAI `gpt-*` and o-series model ids select provider `openai`. In dev mode the launcher also
passes `assistantModuleUrl` for the local public configurator entry. The page removes that option
before creating the configurator and uses the local helper for its agent. Non-dev mode retains
the pinned CDN helper. The OpenAI provider uses the Responses API.

The UI needs `getConfiguratorAgentTools`, `callConfiguratorAgentTool` and `getConfiguratorAgentPrompts`. Native planner isolation uses `instance.configurator` for tools and `instance.extended` for the window. Native undo includes manual edits and configuration replacements. No-op writes add no step; uncertain writes are not replayed.

The sixteen tools are [roomle-ui code](https://github.com/roomle-dev/roomle-ui/blob/feat/configurator-mcp-api/.agents/configurator-agent-tools.md). Local Node tests cover config, no-store, foreign Hosts and shutdown. Browser checks cover discovery, edits, no-ops, undo/redo and non-agent SDK edits. See [the guide](../../docs/configurator-assistant.md).
