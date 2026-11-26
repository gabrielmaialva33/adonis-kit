# Claude Code guidance

Read [AGENTS.md](AGENTS.md) for repository instructions and [README.md](README.md) for setup and API behavior. This is the **adonis-kit API-only** repository, with `main` as its default branch.

Keep domain code under `app/modules/<domain>/`, cross-cutting code under `app/shared/` and typed errors under `app/exceptions/`. Follow controller → service → repository → model with `@inject()`. Use modular aliases; Ace generators need relocation and import correction.

Run Ace through `pnpm ace <command>`. Read the pinned toolchain and scripts from `.nvmrc` and `package.json`; TypeScript 6 and 7 coexist. Validate with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and `pnpm build` as applicable. Test suites are Japa unit and functional; there is no frontend or browser suite.

Preserve API documentation, Edge email templates, tenant isolation, global RBAC, private file access, Bearer/cookie authentication, CSRF and credential invalidation. Follow the pre-1.0 migration policy in [AGENTS.md](AGENTS.md). For changes from the old API implementation, consult [MIGRATION.md](MIGRATION.md).
