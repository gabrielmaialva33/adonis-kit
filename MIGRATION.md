# Migrating to the AdonisJS 7 API

This guide compares the previous `adonis-kit` implementation at `71ef888` with the modular AdonisJS 7 API. This is a breaking pre-1.0 template update, not an in-place production database upgrade. Existing API prefixes remain `/api/v1`, but credentials, authorization, file access and some payloads change.

## Runtime, layout and installation

Use Node 24.21.0 from `.nvmrc` and pnpm 11 pinned in `package.json`. Install with `pnpm install --frozen-lockfile`. TypeScript 6 and 7 coexist for tool compatibility; use the repository scripts instead of assuming a global compiler. Run Ace with `pnpm ace <command>` through the TypeScript loader.

Domain code moves from `app/controllers`, `app/services`, `app/repositories`, `app/models`, `app/routes` and `app/validators` into `app/modules/<domain>/`. Cross-cutting middleware, JWT support and shared repositories/services live in `app/shared/`; errors remain in `app/exceptions/`. Replace old per-layer import aliases with `#modules/*`, `#shared/*` and `#exceptions/*`. Follow controller → service → repository → model with injected dependencies and register module routes in `start/routes.ts`.

The repository ships API endpoints, ReDoc/OpenAPI and Edge email templates. There are no application pages or frontend build artifacts. Japa has unit and functional suites: `pnpm test` runs unit tests and `pnpm test:e2e` runs both. Applications importing UI code from the web starter must host that client separately.

Dependency versions follow compatibility constraints, not an unconditional latest-major upgrade. `@adonisjs/redis` stays on 10.0.2 for the `@adonisjs/cache` 2.1 peer range, and `@google-cloud/storage` stays on 8.4.x for FlyDrive compatibility. The lockfile records the actual resolved graph. Unused Ally/OAuth configuration and Bull Queue integration were removed; this API does not provide OAuth endpoints or a background job worker. Downstream applications using those integrations must port and validate them separately.

## Database and stored data

For a fresh installation, run the migrations and seeders. Disposable development/test databases must be recreated when adopting rewritten original migrations. Do not use `migration:fresh` against data you need to retain.

For an existing application, back up and rehearse a dedicated conversion before rollout. At minimum review:

- New `tenants` and `user_tenants` membership records, and non-null file `tenant_id` values. Assign existing files to explicitly authorized workspaces; do not infer all users belong to one tenant.
- New persisted opaque refresh credentials and password-reset credentials. Old JWT refresh values cannot be imported as valid opaque credentials.
- User `auth_version`, normalized unique emails/usernames, private verification metadata and verification token hashes. Resolve case-insensitive identifier collisions before importing accounts; invalidate outstanding verification/reset credentials.
- File storage keys, ownership, private object policies and removal of persisted public URL assumptions.
- Updated RBAC data, default permissions, contextual grants, foreign keys and constraints. Tenant membership roles are separate from global roles.

Before 1.0, unshipped changes belong in original `create_*` migrations; only genuinely new schema objects get new migrations. This template policy does not provide a production conversion script. After the first stable release, migration history becomes append-only.

## Previous route → current route

All 25 HTTP method/path pairs defined in `app/routes/` and `start/routes.ts` at `71ef888` remain at the same URL and method. “Unchanged” below means route identity only; the payload/authentication notes still apply. `{id}` represents the original `:id` parameter. Every protected route uses current credentials; cookie-bearing unsafe requests require CSRF. Newly added endpoints are described in the following sections.

| Previous method and path                          | Current route | Payload / authorization notes                                                                                              |
| ------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /version`                                    | Unchanged     | Package identity/version now describe Adonis Kit 0.9 and the API-only build.                                               |
| `GET /api/v1/health`                              | Unchanged     | Public dependency health response; no authentication added.                                                                |
| `POST /api/v1/sessions/sign-in`                   | Unchanged     | `uid`, `password`; new credential format and optional `auth_mode`.                                                         |
| `POST /api/v1/sessions/sign-up`                   | Unchanged     | Password minimum 8, normalized identifiers, optional `auth_mode`, `email_verification_sent` and workspace onboarding.      |
| `GET /api/v1/verify-email`                        | Unchanged     | `token` query input; old verification credentials must be replaced.                                                        |
| `POST /api/v1/resend-verification-email`          | Unchanged     | Authenticated current user; replacement hashed verification credential and rate limiting.                                  |
| `GET /api/v1/me`                                  | Unchanged     | Internal metadata removed from user JSON; public verification fields remain.                                               |
| `GET /api/v1/me/permissions`                      | Unchanged     | Current effective global permissions; tenant membership does not grant global permissions.                                 |
| `GET /api/v1/me/roles`                            | Unchanged     | Current user's global roles, separate from tenant membership roles.                                                        |
| `GET /api/v1/users`                               | Unchanged     | Global paginated users; `users.list`; sanitized public user JSON.                                                          |
| `POST /api/v1/users`                              | Unchanged     | `users.create`; minimum 8-character confirmed password and normalized identifiers.                                         |
| `GET /api/v1/users/{id}`                          | Unchanged     | `users.read`; safe positive ID and sanitized user JSON.                                                                    |
| `PUT /api/v1/users/{id}`                          | Unchanged     | `users.update` plus actor policy; only `full_name` and confirmed password are editable.                                    |
| `DELETE /api/v1/users/{id}`                       | Unchanged     | `users.delete` plus actor policy; protected equal/higher privileged accounts cannot be deleted by non-ROOT actors.         |
| `GET /api/v1/admin/roles`                         | Unchanged     | Global role listing still requires ADMIN or ROOT.                                                                          |
| `PUT /api/v1/admin/roles/attach`                  | Unchanged     | `user_id`, `role_ids`; additive assignment, safe IDs and lower-role delegation policy.                                     |
| `GET /api/v1/admin/permissions`                   | Unchanged     | Global permission definitions; `permissions.list`.                                                                         |
| `POST /api/v1/admin/permissions`                  | Unchanged     | Permission definition payload retained; `permissions.create`. Creating definitions is separate from assigning them.        |
| `PUT /api/v1/admin/roles/permissions/sync`        | Unchanged     | `role_id`, `permission_ids`; `permissions.update` plus persisted ROOT actor.                                               |
| `PUT /api/v1/admin/roles/permissions/attach`      | Unchanged     | `role_id`, `permission_ids`; `permissions.update` plus persisted ROOT actor.                                               |
| `PUT /api/v1/admin/roles/permissions/detach`      | Unchanged     | `role_id`, `permission_ids`; `permissions.update` plus persisted ROOT actor.                                               |
| `PUT /api/v1/admin/users/permissions/sync`        | Unchanged     | `user_id`, `permissions` grant records; `permissions.update` plus persisted ROOT actor.                                    |
| `GET /api/v1/admin/users/{id}/permissions`        | Unchanged     | `permissions.list`; safe positive user ID and current effective permissions.                                               |
| `POST /api/v1/admin/users/{id}/permissions/check` | Unchanged     | `permissions` strings retained; `permissions.list`; cookie requests require CSRF.                                          |
| `POST /api/v1/files/upload`                       | Unchanged     | Multipart `file` retained; `files.create` plus active tenant membership; returned URL now requires authenticated download. |

## Authentication and credentials

The previous implementation issued both `auth.access_token` and `auth.refresh_token` as JWTs signed with `APP_KEY`. Access is now a typed JWT with issuer, audience and credential-generation validation. Refresh is a random opaque credential persisted only as an HMAC hash and consumed transactionally.

All clients must sign in again during the upgrade. Configure the new `JWT_ISSUER`, `JWT_AUDIENCE` and dedicated token secrets for the deployment; do not attempt to preserve older access or refresh JWTs. Changing issuer/audience or the relevant secrets invalidates credentials.

Bearer sign-in and sign-up retain their JSON user plus `auth: { access_token, refresh_token }` shape. Sign-up also returns `email_verification_sent`; a mail-delivery failure can leave a successfully created account with this flag set to `false`. Access tokens last 15 minutes; refresh tokens last 3 days.

New endpoints:

| Endpoint                                | Request and behavior                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /api/v1/sessions/csrf`             | Bootstrap session/XSRF cookies and receive `csrf_token` for cookie clients                           |
| `POST /api/v1/sessions/refresh`         | `{ "refresh_token": "<opaque value>" }`; returns `{ "auth": { ... } }` with a replacement pair       |
| `POST /api/v1/sessions/logout`          | `{ "refresh_token": "<opaque value>" }`; revoke refresh, clear access cookie, respond 204            |
| `POST /api/v1/sessions/forgot-password` | `{ "email": "..." }`; generic accepted response independent of account existence                     |
| `POST /api/v1/sessions/reset-password`  | `token`, `password`, `password_confirmation`; consume reset credential and invalidate prior sessions |
| `DELETE /api/v1/me`                     | `current_password` and `confirmation: "DELETE"`; anonymize the account and invalidate credentials    |

Store every replacement refresh token and serialize refresh calls. Replaying an already consumed refresh token invalidates the current credential generation, including access JWTs. Password changes/reset and account deletion also invalidate earlier credentials. Logout revokes the submitted refresh token; existing Bearer access tokens can remain valid until expiry. Do not describe logout as universal immediate Bearer revocation.

### Cookie clients

Send `auth_mode: "cookie"` on sign-in, sign-up or refresh to opt into the signed HttpOnly access cookie. Omitting it, or sending `"bearer"`, uses the Bearer mode. Cookie mode still returns the token pair in JSON: it stores only the access JWT in the cookie, while the refresh credential remains an explicit JSON input to refresh/logout.

First call `GET /api/v1/sessions/csrf` with cookie credentials enabled. Preserve its session/XSRF cookies and send the corresponding CSRF token in `X-CSRF-TOKEN` with the unsafe request. Cookie-mode issuance requires CSRF even before an access cookie exists. Unsafe requests carrying an access cookie require CSRF even when an Authorization header is also present. Use a separate cookie-free client for Bearer requests if you want them to remain free of ambient-cookie state.

The access cookie uses a 15-minute lifetime, `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` in production. Tenant create/switch updates it for cookie-authenticated clients. Configure CORS and cookie policy for your client origins without disabling CSRF. Production clients must reach the API over HTTPS, typically terminated by a reverse proxy/load balancer. Set `APP_URL` to that public HTTPS origin. Configure trusted proxies in `config/app.ts` for the deployment topology and overwrite forwarded headers at the edge; do not trust untrusted client headers. Explicitly allow the client origin in `config/cors.ts` (empty by default), retain credential support and send browser requests with `credentials: 'include'`. CORS does not bypass `SameSite=Lax`; cross-site deployments need a reviewed access/session/XSRF cookie policy while preserving HTTPS and CSRF. Test these flows through the real proxy, not only direct localhost requests.

The JSON bootstrap `csrf_token` belongs in `X-CSRF-TOKEN`. The alternative `X-XSRF-TOKEN` header takes the `XSRF-TOKEN` cookie value, not the JSON token. Refresh must explicitly request `auth_mode: "cookie"` to replace the access cookie; its default Bearer mode does not write a new cookie.

### Verification and reset emails

Verification remains under `GET /api/v1/verify-email` and `POST /api/v1/resend-verification-email`. Verification credentials are single-use hashed values; old outstanding links need replacement.

Set optional `PASSWORD_RESET_URL` to your separately hosted reset page; the email preserves existing query parameters and sets the token query parameter. Without it, the email provides the opaque token and instructions to POST `token`, `password` and `password_confirmation` to the API reset endpoint. The API does not provide a `/reset-password` form. Edge HTML/text email templates are retained.

## User payloads and authorization

| Area                        | Previous API                                            | New API / client action                                                                                                                    |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Password creation/change    | Minimum 6 characters                                    | Minimum 8; send matching `password_confirmation`. Existing short-password accounts can still sign in until changing their password.        |
| Email and username          | Trimmed input                                           | Trimmed and lowercased, bounded lengths (email 254, username 3–80); resolve normalization collisions in existing data.                     |
| Generated username          | Model-specific implicit value                           | UUID-based generated username when omitted; never derive business meaning from it.                                                         |
| User update                 | Validator accepted email/username                       | `PUT /api/v1/users/{id}` accepts `full_name` and optional confirmed password; email and username are not editable through this endpoint.   |
| Public user JSON            | Internal metadata could be serialized                   | `metadata`, password, deletion state and credential generation stay private. Read `email_verified` and `email_verified_at` instead.        |
| Permission assignment       | Route permission checks                                 | Assignment additionally requires a persisted ROOT actor, including role permission sync/attach/detach and direct user grants.              |
| Role/account administration | Less restrictive delegation                             | Non-ROOT actors can delegate only lower permitted roles; protected equal/higher privileged accounts cannot be modified or deleted by them. |
| Resource IDs                | Numeric values and permissive coercion in several paths | Use positive safe integer IDs (at most `9007199254740991`); do not send zero, negatives, fractions, NaN or oversized values.               |

Existing role/permission endpoint paths remain under `/api/v1/admin`; a previous successful response does not imply the same actor is still authorized. Refresh application permissions and test negative cases. Global RBAC remains global: adding a tenant does not make user administration or role assignments tenant-local.

## Tenant context and private files

The old upload endpoint had no tenant context and returned a public storage URL. The new file API requires an active tenant membership and global file permissions.

| Endpoint                                     | Contract                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/tenants/me`                     | List the current user's memberships and membership roles                                                                  |
| `POST /api/v1/tenants`                       | Create a workspace (`name`; slug generated by the server), require `tenants.create`, return tenant and credentials        |
| `POST /api/v1/tenants/switch`                | Accept `tenant_id`, verify active membership, return tenant and new credentials                                           |
| `GET /api/v1/files`                          | Paginated list scoped to the active tenant; require `files.list`                                                          |
| `POST /api/v1/files/upload`                  | Existing multipart `file` input and camelCase upload fields; URL is now an authenticated API path; require `files.create` |
| `GET /api/v1/files/{tenantId}/{id}/download` | Require `files.read`, active membership in the URL tenant and a file scoped to that tenant                                |
| `DELETE /api/v1/files/{id}`                  | Require active tenant and either `files.delete` or uploader-scoped `files.delete.own`                                     |

For active-tenant operations, resolution prefers `x-tenant-id`, then the verified JWT `tenantId`, then the first active membership. Explicit inaccessible/inactive tenants are rejected, not silently replaced. Download URLs carry their own tenant identity and validate membership independently of the active tenant header/claim.

Sign-up creates a personal workspace when `REGISTRATION_WORKSPACE_MODE=personal`; use `none` when memberships are provisioned separately. Existing users imported without memberships cannot use tenant-required file operations until provisioned.

Treat returned file URLs as relative authenticated paths, for example `/api/v1/files/1/10/download`. Bearer clients must fetch with Authorization; cookie clients must send their credentials. Stop publishing these URLs as public CDN links. Making new uploads private does not revoke access to old cloud objects: migrate bucket/object policies separately and verify public links no longer expose data.

## Rollout checklist

1. Rehearse data conversion against a restored, isolated copy and verify tenant/file ownership.
2. Update environment configuration and invalidate existing sessions; deliver a client that understands opaque refresh rotation and the selected authentication mode.
3. Update payloads, private downloads and permission checks, including expected rejection cases.
4. Run lint, typecheck, Japa unit/functional suites and build against dedicated test resources.
5. Verify email delivery/reset destinations, private object policies and production cookie/CORS behavior in your deployment environment.

Use [docs/openapi.yaml](docs/openapi.yaml) and [docs/api.http](docs/api.http) as the API contract references. Report vulnerabilities through [SECURITY.md](SECURITY.md).
