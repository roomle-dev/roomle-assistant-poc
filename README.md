# Roomle configurator assistant example

A native product configurator with the browser assistant of roomle-ui. The iframe owns the tools; the embedding library runs the host agent.

## Run

Use Node.js 22+ for development.

```sh
npm install
npm start
npm start mistral-medium <api-key>
npm start mistral-large <api-key>
```

For SDK development start roomle-ui on localhost:5173 and use `npm run dev mistral-medium <api-key>`. `EXAMPLE_PORT` overrides the page port, `EXAMPLE_SERVER_URL` selects a UI and `--no-open` skips opening the browser. The UI must expose native agent methods; until deployed use roomle-ui's `feat/configurator-mcp-api` branch locally.

The key is served only to the local page and remains visible in the browser. It stays out of URLs/logs. There is no external MCP endpoint. The sixteen tools inspect/edit configurations and undo/redo through the UI history. Images are disabled. See [the guide](docs/configurator-assistant.md).

## Development

`npm test` runs Node launcher tests. `npm run lint` and `npm run format:check` check source. Tool and assistant tests live in roomle-ui. See [agent context](.agents/README.md).
