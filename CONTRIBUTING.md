# Contributing to Adonis Kit

Contributions should improve a reusable AdonisJS API template. Read [AGENTS.md](AGENTS.md) for implementation conventions and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.

## Getting started

Fork the repository and branch from `main`. Follow [README.md](README.md) to install the pinned Node and pnpm toolchain, configure PostgreSQL, Redis, mail and storage, and initialize a disposable development database. Never commit `.env` files, real credentials, private data or logs containing tokens.

Report reproducible ordinary bugs through [issues](https://github.com/gabrielmaialva33/adonis-kit/issues), including the commit, environment, synthetic reproduction and expected/actual behavior. Use [private vulnerability reporting](https://github.com/gabrielmaialva33/adonis-kit/security/advisories/new) for security defects; see [SECURITY.md](SECURITY.md).

## Implementation conventions

- Domain code belongs in `app/modules/<domain>/`; shared middleware/JWT/repositories/services belong in `app/shared/`; typed errors belong in `app/exceptions/`.
- Follow controller → service → repository → model and use `@inject()` for dependencies. Preserve aliases such as `#modules/*`, `#shared/*` and `#exceptions/*`.
- Run Ace as `pnpm ace <command>`. Move generated code out of framework-default locations into its module and fix imports.
- Keep OpenAPI and HTTP examples consistent with route, payload, authorization and response changes.
- Preserve Edge email templates. The project contains API services and documentation, without an application frontend.
- Follow existing strict TypeScript, snake_case files, two-space indentation and Prettier formatting.

## Migrations and compatibility

Before 1.0, change original `create_*` migrations for unshipped tables/constraints and recreate disposable development/test databases. Add a new migration only for a genuinely new schema object. Existing application data needs a separate reviewed conversion plan; do not apply `migration:fresh` to valuable data. After the first stable release, migrations become append-only.

Explain environment changes, schema recreation and API incompatibilities in the PR. Update [MIGRATION.md](MIGRATION.md) when behavior changes for existing clients.

## Security-sensitive behavior

Keep global RBAC distinct from tenant membership. Tenant-owned repository operations must use verified active tenant context; test inaccessible/inactive memberships and cross-tenant IDs. Permission mutation requires ROOT, while role delegation and account management follow the persisted actor's hierarchy.

Retain private file access, cookie CSRF, Bearer separation, credential-generation invalidation, single-use reset/verification credentials and refresh replay handling. Use safe integer IDs at authorization/data boundaries. Include adverse-case regression coverage for changed security behavior using synthetic data.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Japa unit tests are in `tests/unit/`; functional tests are in `tests/functional/`. The latter run migrations and seeders against the test database. Configure isolated disposable database and Redis resources before running them. Use `pnpm exec prettier --check <changed-files>` to check formatting or format the changed files explicitly. `pnpm format` formats the entire repository.

Use bounded parallelism for resource-intensive checks. Record each command's result and any environment limitation; do not present an unrun check as passing.

## Pull requests

Keep commits focused and use Conventional Commits, for example `fix(auth): invalidate stale credentials`. Target `main`. Explain the concrete problem, resulting API behavior, tests, migration/configuration changes and security impact. Use the PR template, link relevant public issues and leave private security details in the private report. Do not include unrelated generated files or changes to local configuration.
