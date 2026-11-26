# Repository instructions

Follow [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

Adonis Kit is an AdonisJS 7 API. Use `app/modules/<domain>/`, `app/shared/` and `app/exceptions/`, modular aliases, controller → service → repository → model, and `@inject()`. Run Ace through `pnpm ace`. Preserve Edge email templates and API documentation. Tests are Japa unit and functional.

Preserve tenant-scoped private files, global RBAC, ROOT permission assignment, hierarchical delegation, safe integer IDs, Bearer/cookie authentication, CSRF, credential invalidation and refresh rotation. Follow the pre-1.0 original-migration policy; never recreate valuable databases. Read the pinned versions and validation scripts from `package.json`.
