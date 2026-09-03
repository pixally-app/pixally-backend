# Pixally - API

[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-red.svg)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Swagger](https://img.shields.io/badge/Swagger-Docs-brightgreen.svg)](https://swagger.io/)

API REST para gestão de comprovantes PIX e contas a receber, desenvolvida com NestJS, Prisma e PostgreSQL como Trabalho de Conclusão de Curso.

## Sobre o Projeto

O Pixally é um sistema que centraliza e automatiza o gerenciamento de comprovantes PIX recebidos por pequenos negócios. A API processa comprovantes via OCR e inteligência artificial, extrai os dados automaticamente e os organiza em contas a receber com controle de parcelas.

**Objetivos:**
- Automatizar a leitura de comprovantes PIX via OCR + IA
- Centralizar o controle financeiro de recebimentos
- Gerenciar clientes e contas a receber com parcelas
- Emitir alertas automáticos via WhatsApp (Zapfy)
- Gerar relatórios e exportações em CSV

## Funcionalidades

### Autenticação
- Cadastro e login com JWT
- Recuperação de senha via e-mail (Nodemailer)
- Rotas protegidas com guard JWT — token no header `Authorization: Bearer`

### Clientes
- CRUD completo com paginação e filtros
- Soft delete (os dados nunca são removidos fisicamente)
- Multi-tenancy: cada usuário vê apenas seus próprios clientes

### Comprovantes PIX
- Upload de imagem ou PDF do comprovante
- Extração automática de dados via OCR (Tesseract.js) e IA (OpenAI)
- Armazenamento de arquivos no Supabase Storage
- Reconciliação com contas a receber
- Exportação da listagem em CSV

### Contas a Receber
- CRUD com suporte a parcelamento
- Controle individual de parcelas (marcar paga/pendente)
- Cancelamento de contas
- Totalizadores: valor total, recebido e pendente por listagem

### Dashboard
- Resumo financeiro do período
- Dados para gráficos de recebimentos

### Alertas e WhatsApp
- Warnings automáticos para contas em atraso
- Integração com Zapfy para envio de notificações via WhatsApp

## Quick Start

### Pré-requisitos
- Docker e Docker Compose instalados
- Conta no Supabase (storage de arquivos)
- Chave de API da OpenAI
- Credenciais SMTP para envio de e-mail

### Subindo o ambiente

```bash
# 1. Clone o repositório
git clone https://github.com/Danielle1Melo/pixally-backend.git
cd pixally-backend

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 3. Suba os containers
docker-compose up -d

# 4. Execute as migrations
npx prisma migrate dev

# 5. Popule o banco com dados de teste
npx prisma db seed

# 6. Acesse a documentação
# http://localhost:3000/api/docs
```

### Desenvolvimento local (sem Docker)

```bash
docker-compose up -d postgres
npm install
# Caso seja a primeira vez rode as migrations
npx prisma migrate dev
# Popule o banco com dados de teste
npx prisma db seed
npm run start:dev
```

## Documentação da API

- **Swagger UI:** http://localhost:3000/api/docs

### Endpoints

#### Autenticação
```
POST   /auth/login              - Login
POST   /auth/register           - Cadastro
POST   /auth/forgot-password    - Solicitar redefinição de senha
POST   /auth/reset-password     - Redefinir senha
```

#### Usuários
```
GET    /users/me        - Dados do usuário autenticado
PATCH  /users/me        - Atualizar perfil
```

#### Clientes
```
GET    /clients         - Listar (paginado, com filtros)
GET    /clients/:id     - Buscar por ID
POST   /clients         - Criar
PATCH  /clients/:id     - Atualizar
DELETE /clients/:id     - Soft delete
```

#### Comprovantes PIX
```
POST   /receipts/upload            - Upload e processamento via IA
GET    /receipts                   - Listar (paginado, com filtros)
GET    /receipts/export/csv        - Exportar listagem em CSV
GET    /receipts/:id               - Buscar por ID
PATCH  /receipts/:id               - Atualizar dados
PATCH  /receipts/:id/reconcile     - Reconciliar com conta a receber
PATCH  /receipts/:id/unreconcile   - Desfazer reconciliação
DELETE /receipts/:id               - Remover
```

#### Contas a Receber
```
GET    /accounts-receivable                                           - Listar (com totalizadores)
GET    /accounts-receivable/:id                                       - Buscar por ID
POST   /accounts-receivable                                           - Criar
PATCH  /accounts-receivable/:id                                       - Atualizar
PATCH  /accounts-receivable/:id/cancel                                - Cancelar
PATCH  /accounts-receivable/:id/installments/mark-all-paid            - Marcar todas parcelas como pagas
PATCH  /accounts-receivable/:id/installments/:installmentId           - Atualizar parcela
PATCH  /accounts-receivable/:id/installments/:installmentId/mark-paid - Marcar parcela como paga
```

#### Dashboard
```
GET    /dashboard/resumo    - Totalizadores financeiros do período
GET    /dashboard/graphic   - Dados para gráficos
```

## Segurança

- **JWT:** Token no header `Authorization: Bearer <token>`
- **Multi-tenancy:** Cada endpoint filtra dados por `userId` via `@CurrentUser()`
- **Validação:** class-validator + class-transformer em todos os DTOs
- **Soft delete:** Clientes nunca são removidos fisicamente do banco

## Testes

```bash
# Testes unitários
npm run test

# Com cobertura
npm run test:cov

# Testes e2e
npm run test:e2e
```

## Arquitetura

```
src/
├── auth/                 # Login, register, forgot/reset-password, JWT guard, @CurrentUser
├── users/                # Perfil do usuário autenticado
├── clients/              # CRUD de clientes com paginação e soft delete
├── pix-receipts/         # Upload, OCR, IA, reconciliação e exportação CSV
├── accounts-receivable/  # Contas a receber com parcelas
├── dashboard/            # Resumo financeiro e dados de gráficos
├── warnings/             # Sistema de alertas
├── zapfy/                # Integração WhatsApp (webhook + envio)
├── email/                # Envio de e-mail via Nodemailer
├── prisma/               # PrismaService (singleton global)
└── utils/                # Helpers compartilhados
prisma/
├── schema.prisma         # Models: User, Client, PixReceipt, AccountReceivable, Warning...
└── migrations/           # Histórico de migrations
```

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js 22+ |
| Framework | NestJS 11 |
| ORM | Prisma 7 |
| Banco de dados | PostgreSQL 16 |
| Autenticação | JWT (passport-jwt) |
| OCR | Tesseract.js |
| IA | OpenAI API |
| Storage | Supabase Storage |
| E-mail | Nodemailer |
| Documentação | Swagger / OpenAPI |
| Testes | Jest + Supertest |
| Container | Docker + Docker Compose |
| WhatsApp | Zapfy |

## Variáveis de Ambiente

```env
PORT=3000
NODE_ENV=development

APP_URL=http://localhost:3000

DB_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_DB=

DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/DATABASE

JWT_SECRET=
JWT_EXPIRES_IN=

CORS_ORIGIN=*

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

OPENAI_API_KEY=

ZAPFY_BASE_URL=
ZAPFY_WEBHOOK_SECRET=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET=
```

## Licença

Este projeto está licenciado sob a [Licença MIT](./LICENSE).
