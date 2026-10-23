# Feature Context

Living-reference documentation of the features of this repository: how each feature works today —
its architecture, its data flow, the files that carry it. A feature's context document is promoted
from its feature analysis when the work lands. From then on the document is living reference, not a
record: no lifecycle, no ticket numbers, no history of how the feature came to be. Update it when
the behaviour it describes changes.

Feature questions whose work has not landed keep their analysis in
[feature-analysis](../feature-analysis/README.md); this folder holds the features as they are.

## Feature Index

| Feature | Document | Covers |
|---|---|---|
| The configurator example with the AI Planning Assistant chat | [configurator-example-with-planning-assistant-chat.md](configurator-example-with-planning-assistant-chat.md) | Browser host, on-demand SDK tools, embedding assistant and static launcher |
| Configurator capabilities for the configurator MCP | [get-configurator-capabilities.md](get-configurator-capabilities.md) | The SDK capability collector and its six sections, the read-only `get-configurator-capabilities` tool, the declared/current and runtime/catalog distinctions |
