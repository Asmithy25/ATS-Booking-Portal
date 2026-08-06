---
name: Message template icons
description: Durable convention for visual identifiers on reusable message templates.
---

Message template icons are stored as stable string keys, validated against a server-side allowlist, and rendered from the shared Lucide icon set. Custom templates use the same icon system as built-in templates.

**Why:** A bounded icon vocabulary prevents arbitrary component names from becoming persisted data while keeping the editor and Support experience visually consistent.

**How to apply:** Add new icon keys to both the server allowlist and the editor palette; keep persisted values as kebab-case keys rather than serialized SVG or component data.