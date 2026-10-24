# Configurator assistant

Load for the example, launcher, browser chat or native tool integration. Read
[the user guide](../../docs/configurator-assistant.md) and
[the implementation reference](../context/configurator-example-with-planning-assistant-chat.md).

## Ownership

- roomle-ui owns the native agent registry, prompts, validation, discovery, execution and history.
- The optional embedding entry runs the host agent and forwards tool discovery/calls.
- This repository owns the static page, model configuration and launcher tests.
- Do not add local tool schemas, product interpretation, a history queue, an MCP server or a chat backend.

## Changing the integration

`index.html` imports the main embedding library and `configurator.js` at one exact npm dev version.
The SDK instance is exposed as `window.instance` after `ui.loadObject` resolves. With `chat=true`,
the page enables `featureFlags.configurationAssistant`, fetches the local model config and starts the assistant with the same extended API as
the tool and window endpoint. The pagehide signal aborts the assistant.

The native configurator window is **AI Configuration Assistant**. Its flag is separate from
`planningAssistant`, which enables the planner's window. The compatible UI must support the new
flag as well as the three native tool methods. Embedded UIs leave agent startup to this host.
With a model selected, the launcher rejects missing or blank API keys; the page validates the key before starting the agent.

The launcher accepts the model/key on the command line, never in the URL. Its config route checks
loopback peer and Host and sends `Cache-Control: no-store`. It starts no child servers. Keep
`EXAMPLE_PORT`, `EXAMPLE_SERVER_URL`, `--dev`, `--no-open` and graceful signal shutdown working.

For native planner isolation the tools endpoint is `instance.configurator`, while the chat
callback and output remain `instance.extended`. Automatic HI/native switching is outside this
integration. The browser needs a UI with the three configurator agent methods; the page can
report that an older deployment needs an update.

## Tests

`npm test` runs the Node launcher tests under `minimal-configurator-example/tests/`. Tool and
assistant tests live in roomle-ui. `npm run lint`, `npm run format:check` and the Markdown link
checker cover this repository. A browser smoke check uses the compatible UI and verifies
discovery, a real edit, an unchanged edit, undo/redo and a direct SDK edit followed by agent undo.

Build/publish the embedding library only when the user authorizes it. Pin the exact dev version;
the dev dist-tag moves. Update the page and living reference together. Keep builds and test output
in `.temp/`, never committed.
