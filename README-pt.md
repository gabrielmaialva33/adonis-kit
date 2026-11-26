# Adonis Kit

Template de API com **AdonisJS 7**, **Node.js 24**, PostgreSQL e Redis. Inclui autenticação JWT, refresh tokens rotativos, RBAC global, workspaces por tenant, arquivos privados e ciclo de vida de contas.

[English](README.md) · [Especificação da API](docs/openapi.yaml) · [Exemplos HTTP](docs/api.http) · [Guia de migração](MIGRATION.md) · [Contribuição](CONTRIBUTING.md)

## Recursos

- API JSON em `/api/v1`, com validação, rate limiting e verificações de saúde.
- Autenticação Bearer e modo explícito por cookies HttpOnly com proteção CSRF.
- JWTs de acesso curtos, refresh tokens opacos com rotação transacional, verificação de email, recuperação de senha e exclusão de conta.
- Roles globais, permissões herdadas, concessões diretas e delegação autorizada pelo ator.
- Relação N:N entre usuários e tenants, criação de workspace pessoal e troca de tenant ativo.
- Upload, listagem, download e exclusão de arquivos privados por tenant; configuração para filesystem, S3, Spaces, R2 e GCS.
- Templates Edge de email, internacionalização, auditoria e cache Redis.
- Testes Japa unitários e funcionais, documentação OpenAPI e build de produção.

O repositório entrega a API e os templates de email. Conecte seu cliente web, mobile ou serviço. A referência é servida em `/docs` e a especificação em `/docs/openapi.yaml`.

## Início rápido

Use Node **24.21.0**, definido em [.nvmrc](.nvmrc), e pnpm **11.22.0**, fixado em `packageManager` no [package.json](package.json). TypeScript 6 e 7 coexistem por compatibilidade das ferramentas; os scripts do pacote são a referência.

```sh
git clone https://github.com/gabrielmaialva33/adonis-kit.git
cd adonis-kit
pnpm install --frozen-lockfile
cp .env.example .env
pnpm ace generate:key
```

Configure PostgreSQL, Redis, email e armazenamento no `.env`, seguindo [.env.example](.env.example). Use um capturador local de email durante o desenvolvimento. Inicialize o banco de desenvolvimento:

```sh
pnpm ace migration:run
pnpm ace db:seed
pnpm dev
```

O endereço padrão é `http://localhost:3333`. Teste `/api/v1/health` ou abra `/docs`. Defina `APP_URL` com a origem pública da API e configure o destino da recuperação de senha conforme o exemplo de ambiente. Em produção, use segredos independentes e políticas de armazenamento privado; não reutilize credenciais de exemplo.

## Autenticação

Bearer é o modo padrão. Envie `uid` (email ou username) e `password` para `POST /api/v1/sessions/sign-in`. O cadastro recebe `full_name`, `email`, `username` opcional, `password` e `password_confirmation`.

```sh
curl http://localhost:3333/api/v1/sessions/sign-in \
  -H 'Content-Type: application/json' \
  -d '{"uid":"person@example.com","password":"development-password"}'

curl http://localhost:3333/api/v1/me \
  -H 'Authorization: Bearer <auth.access_token>'
```

As respostas Bearer contêm `auth.access_token` e `auth.refresh_token`. O acesso expira em 15 minutos. O refresh dura 3 dias e é uma **credencial opaca**, não um JWT. Envie `refresh_token` para `POST /api/v1/sessions/refresh` e substitua as duas credenciais pelo novo par. Serialize as renovações: reutilizar um refresh já consumido invalida a geração atual de credenciais. `POST /api/v1/sessions/logout` revoga o refresh informado; um JWT Bearer já emitido pode continuar válido até expirar.

Clientes por cookie devem seguir o modo explícito e o bootstrap de CSRF dos [exemplos HTTP](docs/api.http). Mutações autenticadas por cookie exigem o header CSRF correspondente. Configure CORS e cookies para as origens reais do cliente e da API.

Criação e alteração de senha exigem pelo menos 8 caracteres. Mudança de senha, recuperação e exclusão de conta invalidam credenciais anteriores. O JSON público expõe `email_verified` e `email_verified_at`; os metadados internos de verificação permanecem privados.

## Clientes por cookie em produção

Termine HTTPS no proxy reverso ou balanceador e defina `APP_URL` com a origem HTTPS pública da API, não o endereço interno do container. Cookies de acesso e sessão usam `Secure` em produção; uma implantação HTTP simples não atende esse fluxo. Configure a política de proxies confiáveis do servidor HTTP em [config/app.ts](config/app.ts) para os endereços/saltos reais da sua infraestrutura e faça o proxy sobrescrever os headers de encaminhamento. Não confie em headers arbitrários enviados pelo cliente. Verifique protocolo, host público e endereço do cliente através do proxy implantado.

Para um cliente em outra origem, autorize essa origem explicitamente em [config/cors.ts](config/cors.ts); a lista padrão está vazia. Preserve suporte a credenciais, use `credentials: 'include'` no navegador e permita o header CSRF no preflight. Faça bootstrap em `GET /api/v1/sessions/csrf` e envie o `csrf_token` retornado como `X-CSRF-TOKEN`. Como alternativa, um cliente que lê o cookie `XSRF-TOKEN` envia o valor desse cookie como `X-XSRF-TOKEN`; os dois valores não são intercambiáveis. CORS não substitui a política padrão `SameSite=Lax`. Um cliente realmente cross-site exige revisão deliberada dos cookies de acesso e sessão/XSRF, mantendo HTTPS e CSRF.

Defina `PASSWORD_RESET_URL` opcionalmente com a página de recuperação hospedada no seu cliente. Os parâmetros de consulta existentes são preservados e o parâmetro do token é definido. Sem essa variável, o email entrega o token e instruções de POST para a API. Valide recuperação, bootstrap CSRF, login, refresh, troca de tenant e logout através do proxy de produção antes da publicação.

## Tenants e autorização

`GET /api/v1/tenants/me` lista os vínculos. `POST /api/v1/tenants` cria um workspace para quem possui `tenants.create`; `POST /api/v1/tenants/switch` recebe `tenant_id` e emite credenciais para esse workspace ativo. O cadastro público cria um workspace pessoal com `REGISTRATION_WORKSPACE_MODE=personal`; use `none` para provisionar os vínculos separadamente.

O middleware resolve primeiro `x-tenant-id`, depois o claim `tenantId` do JWT verificado e, por fim, o primeiro vínculo ativo do usuário. A participação ativa é sempre verificada. Operações de arquivos exigem um tenant resolvido. Novas entidades pertencentes a tenants devem filtrar leituras e escritas no repositório pelo tenant verificado.

Usuários, roles, permissões e auditoria são globais. A role do vínculo ao tenant é separada do RBAC e não concede administração global. Atribuição de permissões exige ROOT; outros atores só delegam roles inferiores permitidas e não podem modificar contas protegidas com privilégio igual ou superior.

URLs de arquivos são rotas autenticadas, como `/api/v1/files/1/10/download`. Downloads exigem `files.read` e vínculo ativo ao tenant da URL. Conhecer a URL não concede acesso. Objetos públicos existentes na nuvem precisam de migração própria de política de acesso.

## Desenvolvimento

```text
app/modules/<domínio>/  controllers, services, repositories, models, validators, routes
app/shared/            middleware, JWT, repositórios e serviços compartilhados
app/exceptions/        exceções tipadas
start/                 inicialização e registro de rotas
config/                configuração do framework e integrações
database/              migrations, factories e seeders
resources/             templates Edge de email e traduções
tests/unit/            testes unitários Japa
tests/functional/      testes HTTP e de integração Japa
docs/                  OpenAPI, ReDoc e exemplos HTTP
```

Siga controller → service → repository → model e injete dependências com `@inject()`. Use os aliases `#modules/*`, `#shared/*` e `#exceptions/*`. Os geradores Ace usam o layout padrão do framework: mova os arquivos para o domínio responsável e ajuste os imports.

| Comando              | Finalidade                                             |
| -------------------- | ------------------------------------------------------ |
| `pnpm dev`           | Iniciar a API com HMR                                  |
| `pnpm ace <comando>` | Executar um comando Ace                                |
| `pnpm lint`          | Verificar ESLint                                       |
| `pnpm typecheck`     | Verificar TypeScript do backend                        |
| `pnpm test`          | Executar testes unitários Japa                         |
| `pnpm test:e2e`      | Executar suites unitária e funcional Japa              |
| `pnpm build`         | Gerar o build de produção da API                       |
| `pnpm start`         | Iniciar a API compilada a partir do diretório de build |
| `pnpm format`        | Formatar arquivos do repositório                       |

Testes funcionais executam migrations e seeders no banco de testes. Use banco descartável e namespace Redis dedicados, nunca dados de produção. Consulte [CONTRIBUTING.md](CONTRIBUTING.md).

Este template está antes da versão 1.0. Altere as migrations `create_*` originais para mudanças ainda não publicadas e recrie os bancos descartáveis de desenvolvimento/teste. Crie migration apenas para um objeto de schema novo. Aplicações existentes precisam de migração de dados revisada; veja [MIGRATION.md](MIGRATION.md).

## Comunidade e licença

A branch padrão é `main`. Use [issues](https://github.com/gabrielmaialva33/adonis-kit/issues) para bugs reproduzíveis e propostas, e o [canal privado](https://github.com/gabrielmaialva33/adonis-kit/security/advisories/new) para vulnerabilidades. Consulte [SECURITY.md](SECURITY.md) e [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) para orientações de relatos privados.

Licenciado sob [MIT](LICENSE).
