# Adonis Kit

An API starter built with **AdonisJS 7**, **Node.js 24**, PostgreSQL and Redis. It includes JWT authentication, rotating refresh tokens, global RBAC, tenant workspaces, private files and account lifecycle endpoints.

[Português](README-pt.md) · [API specification](docs/openapi.yaml) · [HTTP examples](docs/api.http) · [Migration guide](MIGRATION.md) · [Contributing](CONTRIBUTING.md)

## Included

- JSON API under `/api/v1`, with validation, rate limiting and health checks.
- Bearer authentication and explicit HttpOnly cookie authentication with CSRF protection.
- Short-lived access JWTs, opaque refresh tokens rotated transactionally, email verification, password reset and account deletion.
- Global roles, inherited permissions, direct grants and actor-aware delegation.
- N:N user/tenant memberships, personal workspace onboarding and active tenant switching.
- Tenant-scoped private upload, listing, download and deletion; local filesystem, S3, Spaces, R2 and GCS storage configuration.
- Edge email templates, internationalization, audit records and Redis cache.
- Japa unit and functional suites, OpenAPI documentation and production build tooling.

This repository provides the API and email templates. Connect your own web, mobile or service client. The API reference is served at `/docs`, with its specification at `/docs/openapi.yaml`.

## Get started

Use Node **24.21.0** from [.nvmrc](.nvmrc) and pnpm **11.22.0**, pinned by `packageManager` in [package.json](package.json). TypeScript 6 and 7 coexist for tooling compatibility; the scripts in `package.json` are authoritative.

```sh
git clone https://github.com/gabrielmaialva33/adonis-kit.git
cd adonis-kit
pnpm install --frozen-lockfile
cp .env.example .env
pnpm ace generate:key
```

Configure your PostgreSQL database, Redis, mail and storage in `.env` using [.env.example](.env.example). Use a local mail capture service for development. Then initialize your development database:

```sh
pnpm ace migration:run
pnpm ace db:seed
pnpm dev
```

The default API address is `http://localhost:3333`. Test `/api/v1/health` or open `/docs`. Set `APP_URL` to the public API origin and configure password-reset delivery for your client as described in the environment example. Use independent production secrets and private storage policies; never reuse example credentials.

## Authentication

Bearer mode is the default. Send `uid` (email or username) and `password` to `POST /api/v1/sessions/sign-in`. Sign-up uses `full_name`, `email`, optional `username`, `password` and `password_confirmation`.

```sh
curl http://localhost:3333/api/v1/sessions/sign-in \
  -H 'Content-Type: application/json' \
  -d '{"uid":"person@example.com","password":"development-password"}'

curl http://localhost:3333/api/v1/me \
  -H 'Authorization: Bearer <auth.access_token>'
```

Bearer responses expose `auth.access_token` and `auth.refresh_token`. Access tokens expire after 15 minutes. Refresh tokens last 3 days and are **opaque credentials**, not JWTs. Send `refresh_token` to `POST /api/v1/sessions/refresh`, then replace both saved credentials with the returned pair. Serialize refresh requests: replaying a consumed refresh token invalidates the current credential generation. `POST /api/v1/sessions/logout` revokes the submitted refresh token; an already-issued bearer access token can remain valid until expiry.

Cookie clients must use the explicit cookie mode and CSRF bootstrap described in [the HTTP examples](docs/api.http). Cookie mutation requests require a matching CSRF header; never implement a browser client by disabling CSRF. Configure CORS and cookie settings for the actual client/API origins.

Passwords require at least 8 characters on creation and change. Password changes, reset and account deletion invalidate earlier credentials. User JSON exposes `email_verified` and `email_verified_at`, while internal verification metadata remains private.

## Production cookie clients

Terminate HTTPS at your reverse proxy or load balancer and set `APP_URL` to the public HTTPS API origin, not an internal container address. Production access/session cookies are `Secure`; a plain HTTP deployment is not a working production cookie-authentication setup. Configure the HTTP server's trusted-proxy policy in [config/app.ts](config/app.ts) for your actual proxy addresses/hops, and have the proxy overwrite forwarded headers. Do not trust arbitrary client-supplied forwarding headers. Verify the public scheme, host and client address through the deployed proxy.

For a client on another origin, explicitly allow its origin in [config/cors.ts](config/cors.ts); the default origin list is empty. Retain credential support, use `credentials: 'include'` in browser requests and allow the CSRF header in preflight responses. Bootstrap with `GET /api/v1/sessions/csrf`, then send its `csrf_token` as `X-CSRF-TOKEN`. Alternatively, a client that reads the `XSRF-TOKEN` cookie sends that cookie value as `X-XSRF-TOKEN`; the two header values are not interchangeable. CORS permission does not override the default `SameSite=Lax` cookie policy. A truly cross-site client needs a deliberately reviewed cookie policy across the access and session/XSRF cookies, with HTTPS and CSRF retained.

Set optional `PASSWORD_RESET_URL` to your separately hosted reset page. Its existing query parameters are preserved and the token parameter is set. When omitted, the email supplies the token and API POST instructions instead of linking to an application page. Validate this flow, CSRF bootstrap, login, refresh, tenant switching and logout through the production proxy before release.

## Tenants and authorization

`GET /api/v1/tenants/me` lists memberships. `POST /api/v1/tenants` creates a workspace for callers with `tenants.create`; `POST /api/v1/tenants/switch` accepts `tenant_id` and issues credentials for that active workspace. Public sign-up creates a personal workspace when `REGISTRATION_WORKSPACE_MODE=personal`; use `none` to provision memberships separately.

Tenant middleware resolves an explicit `x-tenant-id` header, then the verified JWT `tenantId`, then the user's first active membership. It always verifies active membership. File operations require a resolved tenant; new tenant-owned entities must explicitly scope repository reads and writes by the verified tenant.

Users, roles, permissions and audit records are global. A tenant membership role is separate from global RBAC and does not grant global administrative authority. Permission assignment requires ROOT; non-ROOT actors can delegate only permitted lower roles and cannot modify protected equal/higher privileged accounts.

File URLs are authenticated API paths such as `/api/v1/files/1/10/download`. Downloads require `files.read` and active membership in the URL's tenant. A URL alone does not grant access. Existing public cloud objects need their own access-policy migration.

## Development

```text
app/modules/<domain>/  controllers, services, repositories, models, validators, routes
app/shared/            middleware, JWT, shared repositories and services
app/exceptions/        typed exceptions
start/                 bootstrapping and route registration
config/                framework and integration configuration
database/              migrations, factories and seeders
resources/             Edge email templates and translations
tests/unit/            Japa unit tests
tests/functional/      Japa HTTP and integration tests
docs/                  OpenAPI, ReDoc and HTTP examples
```

Follow controller → service → repository → model and use `@inject()` for dependencies. Import application code through `#modules/*`, `#shared/*` and `#exceptions/*`. Ace generators use framework-default locations: move generated files into their domain and correct imports before using them.

| Command              | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `pnpm dev`           | Start API development server with HMR           |
| `pnpm ace <command>` | Run an Ace command                              |
| `pnpm lint`          | Check ESLint rules                              |
| `pnpm typecheck`     | Check backend TypeScript                        |
| `pnpm test`          | Run Japa unit tests                             |
| `pnpm test:e2e`      | Run Japa unit and functional suites             |
| `pnpm build`         | Build the production API                        |
| `pnpm start`         | Start the compiled API from the build directory |
| `pnpm format`        | Format repository files                         |

Functional tests migrate and seed the database configured for testing. Use a dedicated disposable test database and Redis namespace, never production data. See [CONTRIBUTING.md](CONTRIBUTING.md) for validation and migration conventions.

This is a pre-1.0 template. Update original `create_*` migrations for unshipped schema changes and recreate disposable development/test databases. Add a migration for a genuinely new schema object. Existing applications require a reviewed data migration; see [MIGRATION.md](MIGRATION.md).

## Community and license

The default branch is `main`. Use [issues](https://github.com/gabrielmaialva33/adonis-kit/issues) for reproducible bugs and proposals, and [private vulnerability reporting](https://github.com/gabrielmaialva33/adonis-kit/security/advisories/new) for security reports. Read [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for private reporting guidance.

Licensed under [MIT](LICENSE).
