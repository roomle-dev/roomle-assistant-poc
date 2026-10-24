# Configurator example and browser assistant

The runtime is one static Node launcher and one HTML page. The iframe SDK owns native tools and prompts, loaded on demand. The optional embedding entry runs the host agent. The launcher serves model/key configuration only to the local page.

Both browser imports pin `@roomle/embedding-lib@0.0.0-dev-9d077e2` on jsDelivr, from roomle-ui `9d077e222`.
The iframe needs the matching agent API; use the `feat/configurator-mcp-api` UI branch locally.

`index.html` creates the configurator from query init options, awaits `ui.loadObject`, then exposes `window.instance`. With `chat=true` it fetches `/planning-assistant-config.json` and starts `startConfiguratorPlanningAssistant` with `instance.extended` for tools and window. `pagehide` aborts the signal; setup errors report unavailability. Images are disabled.

`start.mjs` serves port 3000 on loopback. `--dev` selects localhost:5173 through `overrideServerUrl`. `EXAMPLE_PORT`, `EXAMPLE_SERVER_URL` and `--no-open` are supported. The config route checks peer/Host and sends `no-store`. Keys stay out of URLs/logs. SIGINT/SIGTERM stop the one process; there are no child servers or build gates.

The UI needs `getConfiguratorAgentTools`, `callConfiguratorAgentTool` and `getConfiguratorAgentPrompts`. Native planner isolation uses `instance.configurator` for tools and `instance.extended` for the window. Native undo includes manual edits and configuration replacements. No-op writes add no step; uncertain writes are not replayed.

The sixteen tools are [roomle-ui code](https://github.com/roomle-dev/roomle-ui/blob/feat/configurator-mcp-api/.agents/configurator-agent-tools.md). Local Node tests cover config, no-store, foreign Hosts and shutdown. Browser checks cover discovery, edits, no-ops, undo/redo and non-agent SDK edits. See [the guide](../../docs/configurator-assistant.md).
