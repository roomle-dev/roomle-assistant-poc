# Backlog

What is still to be done in and around roomle-configurator-mcp: defects, hardening and follow-ups,
one row per item. The backlog holds open work only. An item leaves it when its fix is in the code.

Each item carries the problem as the code is **today** with `file:line` references, its cause where
it is known, the proposed change and the test that guards it. It never carries status history,
"found while …" notes, investigation narratives or the record of a failed attempt.

## Open items

| Item | To do | Priority |
|---|---|---|
| The drawer's collapse arrow covers the corner of the chat input | roomle-ui `InteractionsContainer.vue` places `.down-trigger` at 90% of the drawer height on its left edge (desktop); it covers the top left corner of the AI Planning Assistant input (`PlanningAssistantChat.vue`) and of the AI image chat input, in the planner and the configurator. Give the inputs room for the arrow, or place the arrow above them | low |
| The AI chat fullscreen button covers the selection buttons | roomle-ui `ConfiguratorMain.vue`: the `AiChatButton` in fullscreen is positioned on its own (`ai-chat-button--fullscreen`, 1rem from the bottom right) and covers the `SelectionButtons` stack (start configuring, the planning assistant) 11 px above it. Make it one of the selection buttons, as the planning assistant button is | low |
