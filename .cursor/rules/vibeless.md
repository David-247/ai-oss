<!-- vibeless-managed-start v=1 project=5cba2e8531e299403acbb9708121d496 -->
# Vibeless integration rules

This file is managed by the Vibeless app for project `5cba2e8531e299403acbb9708121d496`. Cursor has no first-class hook system; these rules are how Vibeless approximates the hook behavior available on Claude Code and Codex. Hook fidelity for Cursor is lower than on other agents — this is a known platform limitation.

## When to call Vibeless tools

- **At the start of a new agent session** — call the `vibeless_get_project_context` MCP tool (loads project context and the active ticket).
- **Each time the user submits a new message** — call the `vibeless_declare_intent` MCP tool (captures the user's stated goal for this turn).

Treat these tools as part of your standard workflow. The Vibeless app uses the resulting MCP calls to track session state, capture user intent, validate actions against project constraints, and coordinate with the IDE.
<!-- vibeless-managed-end -->
