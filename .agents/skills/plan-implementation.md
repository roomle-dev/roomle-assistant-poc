# Plan the Implementation

**Trigger:** The user asks to plan a task or an implementation.

**Goal:** Produce an implementation plan that covers the steps, the files to change, the tests to write, and the documentation to update — before any code is written.

## Procedure

### Step 1 — Understand the task

- Read the task description carefully.
- If the task references a ticket, read the ticket first.
- If the task references data by id (plan, configuration, item), download the data before planning.
- If anything is unclear, ask before planning.

### Step 2 — Identify the changes

- List every file that needs to change.
- For each file, state what changes and why.
- Identify the tests that guard the affected behaviour.
- Identify the documentation that needs updating (living reference in `.agents/context/` or `docs/`).

### Step 3 — Write the plan

The plan must include:

1. **Steps** — the ordered list of changes, each with the files it touches.
2. **Unit tests** — the tests to write or update, with what each test verifies. A plan without tests is not a complete plan.
3. **Documentation** — the documents to update or create, and where they go (see "Where Documentation Goes" in `AGENTS.md`).
4. **Verification** — how to confirm each step is done correctly.

### Step 4 — Deliver the plan

- The plan is a **comment on the ticket** (if the task relates to a Jira ticket) or a **message in the conversation**.
- **Never write an implementation plan as a document** in `.agents/` or `docs/`. Plans do not belong in the documentation folders.

## Hard Rules

- **The implementation plan must include the unit tests.** A plan without tests is not a complete plan.
- **Never write an implementation plan as a document.** Plans do not belong in `.agents/` or `docs/`. A plan is a comment on a ticket or a message in the conversation.
- **If the task relates to a Jira ticket, post the plan as a comment on the ticket.**
- **The plan is reviewed by a human before code changes begin.** Do not start implementing until the plan is approved.

## Completion Checklist

- [ ] Task understood (ticket read, data downloaded if referenced by id)
- [ ] All files to change listed with what changes and why
- [ ] Unit tests identified — what each test verifies
- [ ] Documentation updates identified
- [ ] Verification steps defined
- [ ] Plan delivered as a ticket comment or conversation message (not as a document)
