---
name: Workspace client declarations
description: Shared API client source and stale declaration output can diverge during frontend work.
---

When adding or changing custom hooks in `lib/api-client-react/src`, refresh the package's declaration-only TypeScript output before relying on the web project's typecheck.

**Why:** This workspace can resolve the shared package through its generated declaration output, so a valid source edit may initially appear missing to the therapy portal.

**How to apply:** Run the package's TypeScript project build with `pnpm exec tsc -p lib/api-client-react/tsconfig.json`, then rerun the API and web typechecks.