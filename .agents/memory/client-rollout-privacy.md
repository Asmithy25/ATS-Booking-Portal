---
name: Client rollout privacy
description: Durable boundary for client-facing notifications, opt-in updates, and staff rollouts.
---

Client rollouts must remain separate from broad announcements and Support conversations. A rollout targets one client or only clients who explicitly opted into practice updates; each recipient gets a scoped notification record that the client can read in the portal.

**Why:** Care-team updates need a clear audience, client privacy, and an auditable delivery boundary without turning operational messaging into a support thread or exposing one client’s information to another.

**How to apply:** Preserve client ownership checks on reads and read-state mutations, keep opt-in enforcement server-side, and record rollout actions in audit history.