---------------------------------
project: Pixally API
description: Backend do TCC - sistema de gerenciamento de comprovantes PIX que permite ao usuário cadastrar clientes, processar comprovantes, controlar contas a receber e avaliar a qualidade da extração via experimento pareado
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
- Auth: JWT, token no header Authorization Bearer
- IA: OpenAI GPT-4o via SDK oficial (extração de comprovantes)
- OCR: Tesseract.js (pré-processamento de texto antes do GPT)
- WhatsApp: Zapfy (recebimento de comprovantes via webhook)
- Email: Nodemailer (recuperação de senha)
- Testes: Jest com @nestjs/testing e Supertest para e2e
- Docs: Swagger (@nestjs/swagger) em /api/docs
- Infra: Docker + docker-compose (app + postgres)

---------------------------------
ESTRUTURA DE PASTAS
---------------------------------

```
src/
├── auth/                 # Login, register, forgot/reset-password, guard JWT, decorator @CurrentUser
├── accounts-receivable/  # CRUD de contas a receber com parcelas, cancelamento e baixa
├── clients/              # CRUD de clientes com paginação, filtros e soft delete
├── dashboard/            # Resumo financeiro e dados para gráficos
├── email/                # Serviço de envio de email (Nodemailer)
├── pix-receipts/         # Upload, processamento (OCR + GPT-4o), reconciliação e avaliação
├── prisma/               # PrismaService (singleton global)
├── users/                # Perfil do usuário autenticado
├── utils/                # Helpers (ex: phone-validation.ts)
├── warnings/             # Alertas gerados pelo sistema (ex: duplicata detectada)
└── zapfy/                # Integração WhatsApp: webhook + cliente HTTP da API Zapfy
prisma/
├── schema.prisma         # Models: User, Client, PixReceipt, AccountReceivable, Warning, etc.
└── migrations/           # Histórico de migrations
```

**Scripts de avaliação (raiz do projeto):**
```
gerar_resultados_v2.py   # Processa avaliacao_*.csv + gabarito.csv → resultados_avaliacao_v2.csv
grafico_variantes.py     # Gera gráfico comparativo das 4 variantes (PNG)
gerar_tabelas_png.py     # Gera tabelas 1–4 do experimento como PNG
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

# Avaliação
python3 gerar_resultados_v2.py   # gera CSV de resultados
python3 grafico_variantes.py     # gera gráfico PNG
python3 gerar_tabelas_png.py     # gera tabelas PNG
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

OPENAI_API_KEY=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

ZAPFY_BASE_URL=
ZAPFY_WEBHOOK_SECRET=

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
- POST /zapfy/webhook          — recebe comprovantes via WhatsApp (validado por ZAPFY_WEBHOOK_SECRET)

**Protegidas (requerem Bearer token):**

*Clientes*
- GET    /clients               — lista paginada (filtros: nome, deletedAt)
- GET    /clients/:id
- POST   /clients
- PATCH  /clients/:id
- DELETE /clients/:id           — soft delete

*Comprovantes PIX*
- POST   /receipts/upload       — envia arquivo (imagem ou PDF, máx 5 MB)
- GET    /receipts              — lista paginada (filtros: status, origin, clientName)
- GET    /receipts/export/csv   — exporta todos os comprovantes em CSV
- GET    /receipts/evaluate/csv — experimento pareado: reprocessa pela variante escolhida (?variant=A|B|C|D&execucoes=N)
- GET    /receipts/:id
- PATCH  /receipts/:id
- PATCH  /receipts/:id/reconcile
- PATCH  /receipts/:id/unreconcile
- DELETE /receipts/:id

*Contas a receber*
- GET    /accounts-receivable
- GET    /accounts-receivable/:id
- POST   /accounts-receivable
- PATCH  /accounts-receivable/:id
- PATCH  /accounts-receivable/:id/installments/mark-all-paid
- PATCH  /accounts-receivable/:id/installments/:installmentId
- PATCH  /accounts-receivable/:id/installments/:installmentId/mark-paid
- PATCH  /accounts-receivable/:id/cancel

*Dashboard*
- GET    /dashboard/resumo
- GET    /dashboard/graphic

*Usuário*
- GET    /users/me
- PATCH  /users/me

*Alertas*
- GET    /warnings
- PATCH  /warnings/:id/resolve

---------------------------------
DECISÕES TÉCNICAS
---------------------------------

- O projeto usa ESM (`"type": "module"` no package.json) — imports precisam de extensão `.js` mesmo em arquivos `.ts`
- Prisma client gerado em `./generated/prisma` (não no padrão `node_modules`)
- Soft delete apenas em `Client` — outros models usam delete físico
- Paginação nos endpoints de listagem usa `page` e `limit` via query params
- Extração de comprovantes usa pipeline: OCR (Tesseract.js) e GPT-4o (imagem + texto OCR)
- O endpoint `/receipts/evaluate/csv` suporta 4 variantes para o experimento do TCC: A (só OCR), B (GPT-4o imagem+OCR), C (GPT-4o só texto OCR), D (GPT-4o só imagem)
- Arquivos CSV com dados de comprovantes reais estão no .gitignore