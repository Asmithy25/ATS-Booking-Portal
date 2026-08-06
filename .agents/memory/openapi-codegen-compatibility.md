---
name: OpenAPI codegen compatibility
description: Compatibility constraint between the workspace Zod runtime and generated API validation code.
---

The workspace currently resolves Zod 3, while the installed Orval generator can emit Zod 4-style helpers such as `zod.int()` and `zod.email()`.

**Why:** Regenerating the OpenAPI clients without normalization causes the shared library typecheck to fail even though the OpenAPI contract and generated TypeScript client are valid.

**How to apply:** Keep the post-generation compatibility normalization in the API-spec codegen command, and rerun the full library typecheck after every OpenAPI change.