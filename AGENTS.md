# Repository Guidelines

## Scope and layout

Adonis Kit is an AdonisJS 7 API with Node 24.21.0, pnpm 11 and TypeScript. Backend domains live in `app/modules/<domain>/`, each owning controllers, services, repositories, models, validators, interfaces and `routes.ts`. Use `app/shared/` for cross-cutting middleware, JWT support and shared repositories/services, and `app/exceptions/` for typed errors.

Follow controller → service → repository → model; inject dependencies with `@inject()`. Register module routes from `start/routes.ts`. Imports use `#modules/*`, `#shared/*`, `#exceptions/*` and other aliases declared in `package.json`. Do not restore legacy per-layer aliases or the default `app/controllers`/`app/models` layout.

This is an API-only repository. Preserve Edge email templates in `resources/views/emails/`, translations, `/docs`, OpenAPI and HTTP examples. There is no application frontend, asset build or browser test suite.

## Commands and validation

- `pnpm install --frozen-lockfile`: install the locked graph.
- `pnpm dev`: start the API with HMR.
- `pnpm ace <command>`: execute Ace through the TypeScript loader; do not use `node ace`.
- `pnpm ace migration:run` and `pnpm ace db:seed`: initialize a development database.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`: lint, typecheck, Japa unit, all Japa unit/functional suites and production build.
- `pnpm format`: format files with Prettier.

Use `.nvmrc` and `package.json` for exact toolchain versions and scripts. TypeScript 6 and 7 coexist; preserve their package aliases. Configure local development from `.env.example`; never commit credentials. Functional tests migrate and seed their configured database, so use dedicated disposable test data. PostgreSQL and Redis are integration dependencies. Record actual test results and unrun limits.

Ace `make:*` generators target the framework's default layout. Move generated code into the owning module and replace default aliases before using it. Japa tests use `*.spec.ts` under `tests/{unit,functional}/`. Add regression coverage near changed behavior.

## Security and domain boundaries

Preserve Bearer and explicit HttpOnly cookie authentication with CSRF protection. Credential generations, refresh rotation/replay handling and single-use recovery tokens are security boundaries. Do not expose secrets or internal user metadata.

Users, roles, permissions and audit records are global. Tenant memberships are N:N; tenant-owned entities must scope reads and writes to verified active membership. Files are private and download authorization is enforced on every request. ROOT permission assignment, role hierarchy, account-management protections and safe integer IDs must remain enforced by application services as well as route guards.

## Migration policy before 1.0

For unshipped schema changes, edit the original `create_*` migration and recreate disposable development/test databases. Add a migration only for a genuinely new schema object. Never treat this policy as permission to destroy an existing application's data. After the first stable release, use append-only forward migrations.

## Style and review

Use strict TypeScript, two-space indentation, LF, snake_case filenames, PascalCase classes and camelCase members. Follow neighboring modules and preserve architectural boundaries. Conventional Commits use focused scopes, for example `fix(auth): ...` or `chore(ci): ...`.

Pull requests explain behavior, migration/environment changes, relevant issues and validation. Keep API docs and examples synchronized with route/payload changes. Review [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
