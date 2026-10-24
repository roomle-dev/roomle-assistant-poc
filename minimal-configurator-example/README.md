# Minimal native configurator example

Run `npm start` from here or the root. Add a model/key for the assistant, such as `npm start mistral-medium <api-key>`. `npm run dev` selects the local UI on port 5173.

The page pins one exact dev embedding version and exposes `window.instance` after loading. The default `id` is `usm:frame`; `id` selects another product and `chat=true` enables `featureFlags.configurationAssistant` and the **AI Configuration Assistant**. The planner's `planningAssistant` flag does not enable configurator chat. Other parameters are init options, including `overrideServerUrl`. The launcher serves model config only to the local page.

The SDK loads tools on demand. The host owns conversation and model choice. See [the guide](../docs/configurator-assistant.md).

Starting an agent requires a non-empty API key.
