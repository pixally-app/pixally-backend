---------------------------------
project: Pixally API
description: Backend do TCC — sistema de gerenciamento de comprovantes PIX que permite ao usuário cadastrar clientes, processar comprovantes e controlar contas a receber
---------------------------------

<project_rules>
- Migrations: sempre usar `npx prisma migrate dev --name <nome>` para gerar migrations. Nunca editar arquivos de migration já aplicados.
- Swagger: toda rota deve ter @ApiOperation, @ApiResponse e @ApiTags. A doc fica disponível em /api/docs no ambiente de desenvolvimento.
- Validação: usar class-validator + class-transformer nos DTOs. Nunca validar manualmente em services ou controllers.
- Autenticação: rotas protegidas usam @UseGuards(JwtAuthGuard). O userId vem sempre do JWT via @CurrentUser() — nunca aceitar userId no body ou query.
- Multi-tenancy: cada usuário vê apenas seus próprios dados. Todo service method recebe userId como primeiro parâmetro e aplica filtro no Prisma.
- Soft delete: clientes usam deletedAt — nunca deletar fisicamente. Filtrar sempre `where: { deletedAt: null }` nas buscas.
</project_rules>

---------------------------------
STACK
---------------------------------

- Runtime: Node.js com TypeScript (ESM)
- Framework: NestJS 11
- ORM: Prisma 7 com PostgreSQL 16
- Auth: JWT (passport-jwt) com cookies httpOnly não — token no header Authorization Bearer
- Email: Nodemailer (recuperação de senha)
- Testes: Jest com @nestjs/testing e Supertest para e2e
- Docs: Swagger (@nestjs/swagger) em /api/docs
- Infra: Docker + docker-compose (app + postgres)

---------------------------------
ESTRUTURA DE PASTAS
---------------------------------

```
src/
├── auth/           # Login, register, forgot/reset-password, guard JWT, decorator @CurrentUser
├── clients/        # CRUD de clientes com paginação, filtros e soft delete
├── email/          # Serviço de envio de email (Nodemailer)
├── prisma/         # PrismaService (singleton global)
└── utils/          # Helpers (ex: phone-validation.ts)
prisma/
├── schema.prisma   # Models: User, Client, PixReceipt, AccountReceivable, Warning, etc.
└── migrations/     # Histórico de migrations
```

---------------------------------
COMANDOS
---------------------------------

```bash
# Desenvolvimento
npm run start:dev

# Testes
npm run test          # unit tests
npm run test:cov      # com cobertura
npm run test:e2e      # end-to-end

# Banco de dados
npx prisma migrate dev --name <nome>   # criar migration
npx prisma studio                      # interface visual do banco

# Docker
docker-compose up -d   # sobe app + postgres
docker-compose down    # derruba
```

---------------------------------
VARIÁVEIS DE AMBIENTE (.env)
---------------------------------

```
PORT=3000
NODE_ENV=development

DB_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_DB=

DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/DATABASE

JWT_SECRET=
JWT_EXPIRES_IN=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

APP_URL=http://localhost:3000
```

---------------------------------
ROTAS
---------------------------------

**Públicas (sem JWT):**
- POST /auth/login
- POST /auth/register
- POST /auth/forgot-password
- POST /auth/reset-password

**Protegidas (requerem Bearer token):**
- GET    /clients           — lista paginada dos clientes do usuário
- GET    /clients/:id       — busca cliente por ID
- POST   /clients           — cria cliente
- PATCH  /clients/:id       — atualiza cliente
- DELETE /clients/:id       — soft delete

---------------------------------
DECISÕES TÉCNICAS
---------------------------------

- O projeto usa ESM (`"type": "module"` no package.json) — imports precisam de extensão `.js` mesmo em arquivos `.ts`
- Prisma client gerado em `./generated/prisma` (não no padrão `node_modules`)
- Soft delete apenas em `Client` — outros models usam delete físico
- Paginação nos endpoints de listagem usa `page` e `limit` via query params