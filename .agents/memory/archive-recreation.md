---
name: Archive recreation
description: Durable guidance for rebuilding an uploaded website archive faithfully before making requested improvements.
---

When a user asks for an exact recreation from an uploaded archive, treat the archive's source code, assets, routes, and API contracts as the source of truth. Restore them into the current app rather than redesigning from screenshots or inventing replacement content.

**Why:** Faithful recreation depends on preserving details that are easy to lose when rebuilding from visual inspection alone, including staff workflows, route behavior, generated client contracts, and original assets.

**How to apply:** Separate repository metadata from the actual app source, restore frontend and backend/shared contracts together, then verify the app renders and the API-backed routes start before presenting it.