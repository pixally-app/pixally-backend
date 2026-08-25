# Plano de Testes

**Sistema Inteligente para Processamento e Análise de Comprovantes PIX com Inteligência Artificial**

## 1. Identificação do Documento

|  |  |
|---|---|
| **Projeto** | Sistema PIX Comprovantes |
| **Versão** | 1.0 |
| **Data de criação** | Maio/2026 |
| **Responsável** | Danielle Silva de Melo |
| **Orientador** | Wesley Jhonnes Ramos Rolim |
| **Tecnologias** | NestJS, Next.js, TypeScript, PostgreSQL, Prisma |

## 2. Introdução

O sistema proposto tem como objetivo automatizar o processamento e a conciliação de comprovantes PIX recebidos via WhatsApp por microempreendedores individuais (MEIs), eliminando a conferência manual e proporcionando controle financeiro acessível. O sistema permite o cadastro e gerenciamento de clientes e contas a receber, utilizando técnicas de OCR e Inteligência Artificial para extrair, validar e conciliar os dados dos comprovantes recebidos, oferecendo um painel de controle com visão consolidada dos recebimentos, alertas de duplicidade e situação de inadimplência.

Este plano de testes descreve os cenários, critérios de aceitação e verificações que serão aplicados às funcionalidades principais do sistema, visando assegurar o funcionamento correto das rotas da API, a integridade dos dados financeiros e a precisão do processamento dos comprovantes PIX.

## 3. Escopo dos Testes

### 3.1 Funcionalidades Incluídas no Escopo

- Módulo de Autenticação (registro, login, recuperação de senha)
- Módulo de Usuários (perfil, atualização, criação e desativação por admin)
- Módulo de Clientes (CRUD completo)
- Módulo de Contas a Receber (CRUD + filtros por status)
- Módulo de Comprovantes (upload, extração OCR, validação por IA)
- Módulo de Conciliação (conciliação automática, detecção de duplicidade)
- Módulo de Dashboard (resumo de recebimentos, inadimplentes, alertas)
- Módulo de Integração WhatsApp (conexão, status, webhook de mensagens)
- Módulo de Alertas (listagem paginada com filtro por tipo, resolução de alertas)
- Segurança (autenticação JWT, proteção de rotas, CORS)

### 3.2 Funcionalidades Fora do Escopo

- Integração direta com a API do WhatsApp Business (dependência de serviço externo — testada via mocks)
- Integração com API de instituições financeiras (dependência de serviço externo)
- Testes de performance e carga
- Testes de acessibilidade
- Testes em dispositivos móveis

## 4. Objetivos dos Testes

Os testes têm como objetivos principais:

- Validar que todas as rotas da API respondem corretamente nos cenários esperados e inesperados
- Garantir que a extração de dados dos comprovantes PIX por OCR e IA funciona corretamente
- Verificar que a detecção de comprovantes duplicados opera com precisão
- Confirmar que a conciliação automática entre comprovantes e contas a receber está correta
- Assegurar que rotas protegidas rejeitam acessos não autenticados
- Atingir cobertura mínima de 70% das funcionalidades com testes de endpoint

## 5. Estratégia de Testes

### 5.1 Tipos de Testes

| Tipo de Testes | Ferramentas | Módulo Cobertos | Prioridade |
|---|---|---|---|
| Testes de Endpoint | Jest + Supertest | Todos os módulos | Alta |
| Testes Unitários | Jest | Conciliação, OCR, IA, Duplicidade | Alta |
| Testes E2E | Cypress | Fluxos principais do frontend | Média |

### 5.2 Abordagem

Os testes de endpoint serão desenvolvidos utilizando Jest combinado com Supertest, testando diretamente as rotas da API NestJS sem a necessidade de subir um servidor externo. Para cada rota serão contemplados no mínimo três cenários: sucesso, falha por dados inválidos e falha por ausência de autenticação.

Os testes unitários cobrem a camada de serviço e os adaptadores de APIs externas (OCR, armazenamento, OpenAI, fila de processamento). Esses serviços são testados de forma isolada, com mocks para todas as dependências externas.

A cobertura é intencionalmente dividida entre os dois tipos de execução: os testes de endpoint são responsáveis pela camada HTTP (controllers, DTOs, guards e pipes), enquanto os testes unitários cobrem a lógica de negócio e a integração com serviços externos. 

## 6. Casos de Teste

### 6.1 Módulo de Autenticação

#### CT-AUTH-001 — POST /auth/register

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-AUTH-001-01 | Cadastro com dados válidos | nome, email, documento, telefone e senha válidos | Usuário criado, retorna dados do usuário | 201 |
| CT-AUTH-001-02 | Email já cadastrado | Email existente no banco | Mensagem de erro: email já cadastrado | 409 |
| CT-AUTH-001-03 | Campo email ausente | Sem campo email | Mensagem de validação | 400 |
| CT-AUTH-001-04 | Campo documento ausente | Sem campo documento | Mensagem de validação | 400 |
| CT-AUTH-001-05 | Campo telefone ausente | Sem campo telefone | Mensagem de validação | 400 |
| CT-AUTH-001-06 | Campo senha ausente | Sem campo senha | Mensagem de validação | 400 |
| CT-AUTH-001-07 | Email em formato inválido | email = 'emailinvalido' | Mensagem de validação | 400 |
| CT-AUTH-001-08 | Senha abaixo do mínimo | senha com menos de 6 caracteres | Mensagem de validação | 400 |
| CT-AUTH-001-09 | Senha sem letra maiúscula | senha = 'abc@123' | Mensagem de validação | 400 |
| CT-AUTH-001-10 | Senha sem caractere especial | senha = 'Abc1234' | Mensagem de validação | 400 |
| CT-AUTH-001-11 | Senha sem número | senha = 'Abc@def' | Mensagem de validação | 400 |

#### CT-AUTH-002 — POST /auth/login

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-AUTH-002-01 | Login com credenciais válidas | email e senha corretos | Retorna access_token JWT | 200 |
| CT-AUTH-002-02 | Email incorreto | email errado, senha correta | Mensagem: Email ou senha inválidos | 401 |
| CT-AUTH-002-03 | Senha incorreta | email correto, senha errada | Mensagem: Email ou senha inválidos | 401 |
| CT-AUTH-002-04 | Email não cadastrado | email inexistente | Email ou senha inválidos | 401 |
| CT-AUTH-002-05 | Campo email ausente | Sem campo email | Mensagem de validação | 400 |
| CT-AUTH-002-06 | Campo senha ausente | Sem campo senha | Mensagem de validação | 400 |
| CT-AUTH-002-07 | Corpo da requisição vazio | Body vazio {} | Mensagem de validação | 400 |

#### CT-AUTH-003 — POST /auth/forgot-password

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-AUTH-003-01 | Email cadastrado válido | email existente no banco | Mensagem de confirmação de envio | 200 |
| CT-AUTH-003-02 | Email não cadastrado | email inexistente | Mensagem: email não encontrado | 404 |
| CT-AUTH-003-03 | Email em formato inválido | email = 'invalido' | Mensagem de validação | 400 |
| CT-AUTH-003-04 | Campo email ausente | Body vazio | Mensagem de validação | 400 |

### 6.2 Módulo de Usuários

#### CT-USR-001 — GET /users/me

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-USR-001-01 | Retornar dados do usuário autenticado | Token válido | Dados do usuário sem senha | 200 |
| CT-USR-001-02 | Sem autenticação | Sem token | Acesso negado | 401 |
| CT-USR-001-03 | Token de usuário inativo | Token de usuário com isActive = false | Acesso negado | 401 |

#### CT-USR-002 — PATCH /users/me

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-USR-002-01 | Atualizar username com dados válidos | Token válido + novo username | Usuário atualizado | 200 |
| CT-USR-002-02 | Atualizar email com dados válidos | Token válido + novo email disponível | Usuário atualizado com novo email | 200 |
| CT-USR-002-03 | Atualizar companyName | Token válido + novo companyName | Usuário atualizado | 200 |
| CT-USR-002-04 | Email já em uso por outro usuário | Token válido + email de outro usuário | Mensagem: email já está em uso | 409 |
| CT-USR-002-05 | Email em formato inválido | Token válido + email = 'invalido' | Mensagem de validação | 400 |
| CT-USR-002-06 | Body vazio | Token válido + body {} | Usuário retornado sem alterações | 200 |
| CT-USR-002-07 | Sem autenticação | Sem token | Acesso negado | 401 |
| CT-USR-002-08 | Token de usuário inativo | Token de usuário com isActive = false | Acesso negado | 401 |

#### CT-USR-003 — POST /users

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-USR-003-01 | Admin cria usuário com dados válidos | Token admin + dados completos | Usuário criado sem senha na resposta | 201 |
| CT-USR-003-02 | Email já cadastrado | Token admin + email existente | Mensagem: email já cadastrado | 409 |
| CT-USR-003-03 | Documento já cadastrado | Token admin + documento existente | Mensagem: documento já cadastrado | 409 |
| CT-USR-003-04 | Campos obrigatórios ausentes | Token admin + body incompleto | Mensagem de validação | 400 |
| CT-USR-003-05 | Senha sem letra maiúscula | Token admin + senha = 'abc@123' | Mensagem de validação | 400 |
| CT-USR-003-06 | Senha sem número | Token admin + senha = 'Abc@def' | Mensagem de validação | 400 |
| CT-USR-003-07 | Senha sem caractere especial | Token admin + senha = 'Abc1234' | Mensagem de validação | 400 |
| CT-USR-003-08 | Usuário com role user tenta criar | Token user | Acesso negado | 403 |
| CT-USR-003-09 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-USR-004 — DELETE /users/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-USR-004-01 | Admin desativa usuário existente | Token admin + ID válido | Usuário com isActive = false, sem conteúdo | 204 |
| CT-USR-004-02 | Usuário inexistente | Token admin + ID inválido | Mensagem: não encontrado | 404 |
| CT-USR-004-03 | Usuário com role user tenta desativar | Token user + ID válido | Acesso negado | 403 |
| CT-USR-004-04 | Sem autenticação | Sem token | Acesso negado | 401 |

### 6.3 Módulo de Clientes

#### CT-CLI-001 — POST /clients

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CLI-001-01 | Cadastro válido autenticado | Token válido + dados completos | Cliente criado com sucesso | 201 |
| CT-CLI-001-02 | Requisição sem autenticação | Sem token JWT | Acesso negado | 401 |
| CT-CLI-001-03 | Nome ausente | Token válido, sem nome | Mensagem de validação | 400 |
| CT-CLI-001-04 | Documento ausente | Token válido, sem documento | Mensagem de validação | 400 |
| CT-CLI-001-05 | Telefone em formato inválido | Token válido, telefone inválido | Mensagem de validação | 400 |
| CT-CLI-001-06 | Documento duplicado para o mesmo usuário | Token válido + documento já cadastrado | Mensagem: documento já registrado | 409 |
| CT-CLI-001-07 | Telefone já cadastrado | Token válido + telefone já existente | Mensagem: telefone já registrado | 409 |

#### CT-CLI-002 — GET /clients

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CLI-002-01 | Listar todos autenticado | Token válido | Lista de clientes do usuário | 200 |
| CT-CLI-002-02 | Sem autenticação | Sem token | Acesso negado | 401 |
| CT-CLI-002-03 | Usuário sem clientes | Token válido, banco vazio | Lista vazia [] | 200 |
| CT-CLI-002-04 | Filtrar por nome | Token válido + ?name=João | Lista filtrada por nome | 200 |
| CT-CLI-002-05 | Filtrar por documento | Token válido + ?document=12345678900 | Lista filtrada por documento (busca exata) | 200 |
| CT-CLI-002-06 | Filtrar por status | Token válido + ?status=true | Lista filtrada por status ativo | 200 |

#### CT-CLI-003 — GET /clients/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CLI-003-01 | Cliente existente | Token válido + ID válido | Dados do cliente | 200 |
| CT-CLI-003-02 | Cliente inexistente | Token válido + ID inválido | Mensagem: não encontrado | 404 |
| CT-CLI-003-03 | Sem autenticação | Sem token | Acesso negado | 401 |
| CT-CLI-003-04 | Cliente de outro usuário | Token válido + ID de outro usuário | Não encontrado | 404 |

#### CT-CLI-004 — PATCH /clients/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CLI-004-01 | Atualização válida | Token válido + dados válidos | Cliente atualizado | 200 |
| CT-CLI-004-02 | Cliente inexistente | Token válido + ID inválido | Mensagem: não encontrado | 404 |
| CT-CLI-004-03 | Sem autenticação | Sem token | Acesso negado | 401 |
| CT-CLI-004-04 | Documento duplicado | Token válido + documento já cadastrado por outro cliente | Mensagem: documento já registrado | 409 |
| CT-CLI-004-05 | Criar novo telefone | Token válido + phone sem id | Telefone criado, cliente atualizado | 200 |
| CT-CLI-004-06 | Atualizar telefone existente | Token válido + phone com id existente | Telefone atualizado, cliente atualizado | 200 |
| CT-CLI-004-07 | Novo telefone sem campos obrigatórios | Token válido + phone sem id e sem phoneNumber | Mensagem: dialCode e phoneNumber obrigatórios | 400 |
| CT-CLI-004-08 | Atualizar telefone só com phoneNumber | Token válido + phone com id e phoneNumber (sem dialCode) | dialCode resolvido do existente, telefone atualizado | 200 |
| CT-CLI-004-09 | Telefone duplicado no update | Token válido + phone com número já cadastrado | Mensagem: telefone já registrado | 409 |
| CT-CLI-004-10 | ID de telefone inexistente para o cliente | Token válido + phone com id inválido | Mensagem: telefone não encontrado | 404 |

#### CT-CLI-005 — DELETE /clients/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CLI-005-01 | Remoção válida (soft delete) | Token válido + ID existente sem contas abertas | Cliente removido (deletedAt preenchido) | 204 |
| CT-CLI-005-02 | Cliente inexistente | Token válido + ID inválido | Mensagem: não encontrado | 404 |
| CT-CLI-005-03 | Cliente com contas em aberto | Token válido + ID de cliente com contas PENDING ou OVERDUE | Mensagem: não é possível deletar cliente com contas abertas | 400 |
| CT-CLI-005-04 | Sem autenticação | Sem token | Acesso negado | 401 |

### 6.3 Módulo de Contas a Receber

#### CT-CON-001 — POST /accounts-receivable

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CON-001-01 | Criação válida | Token + cliente_id + valor + descrição + vencimento | Conta criada | 201 |
| CT-CON-001-02 | Sem autenticação | Sem token | Acesso negado | 401 |
| CT-CON-001-03 | Cliente inexistente | Token + cliente_id inválido | Mensagem: cliente não encontrado | 404 |
| CT-CON-001-04 | Valor inválido (negativo) | Token + valor = -100 | Mensagem de validação | 400 |
| CT-CON-001-05 | Data de vencimento no passado | Token + vencimento passado | Mensagem de validação | 400 |
| CT-CON-001-06 | Campos obrigatórios ausentes | Token + body incompleto | Mensagem de validação | 400 |
| CT-CON-001-07 | Criar conta parcelada válida | Token + valor + parcelas = 3 | Conta criada com o valor parcelado | 201 |
| CT-CON-001-08 | Número de parcelas inválido (zero) | Token + parcelas = 0 | Mensagem de validação | 400 |
| CT-CON-001-09 | Número de parcelas negativo | Token + parcelas = -2 | Mensagem de validação | 400 |

#### CT-CON-002 — GET /accounts-receivable (com filtros)

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CON-002-01 | Listar todas | Token válido | Lista de contas do usuário | 200 |
| CT-CON-002-02 | Filtrar por status=PENDING | Token + ?status=PENDING | Apenas contas pendentes | 200 |
| CT-CON-002-03 | Filtrar por status=PAID | Token + ?status=PAID | Apenas contas pagas | 200 |
| CT-CON-002-04 | Filtrar por status=OVERDUE | Token + ?status=OVERDUE | Apenas contas vencidas | 200 |
| CT-CON-002-05 | Status inválido | Token + ?status=invalido | Mensagem de validação | 400 |
| CT-CON-002-06 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-CON-003 — PATCH /accounts-receivable/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CON-003-01 | Atualizar valor com dados válidos | Token + valor novo válido | Conta atualizada com novo valor | 200 |
| CT-CON-003-02 | Atualizar descrição com dados válidos | Token + nova descrição | Conta atualizada com nova descrição | 200 |
| CT-CON-003-03 | Atualizar data de vencimento com dados válidos | Token + nova data futura | Conta atualizada com nova data | 200 |
| CT-CON-003-04 | Atualizar todos os campos simultaneamente | Token + valor + descrição + data | Todos os campos atualizados | 200 |
| CT-CON-003-05 | Marcar como pago manualmente | Token + paidAt preenchido | Conta marcada como paga | 200 |
| CT-CON-003-06 | Valor inválido (negativo) | Token + valor = -50 | Mensagem de validação | 400 |
| CT-CON-003-07 | Data de vencimento em formato inválido | Token + data = 'abc' | Mensagem de validação | 400 |
| CT-CON-003-08 | Conta inexistente | Token + ID inválido | Mensagem: não encontrado | 404 |
| CT-CON-003-09 | Conta de outro usuário | Token + ID de outro usuário | Não encontrado | 404 |
| CT-CON-003-10 | Sem autenticação | Sem token | Acesso negado | 401 |
| CT-CON-003-11 | Conta já paga | Token + ID de conta com status PAID | Operação não permitida | 400 |
| CT-CON-003-12 | Conta cancelada | Token + ID de conta com status CANCELLED | Operação não permitida | 400 |

#### CT-CON-004 — GET /accounts-receivable/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CON-004-01 | Conta existente com parcelas | Token + ID válido | Dados da conta com lista de parcelas | 200 |
| CT-CON-004-02 | Conta inexistente | Token + ID inválido | Mensagem: não encontrado | 404 |
| CT-CON-004-03 | Conta de outro usuário | Token + ID de outro usuário | Não encontrado | 404 |
| CT-CON-004-04 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-CON-005 — PATCH /accounts-receivable/:id/cancel

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CON-005-01 | Cancelar conta pendente | Token + ID de conta PENDING | Conta com status CANCELLED | 200 |
| CT-CON-005-02 | Conta inexistente | Token + ID inválido | Mensagem: não encontrado | 404 |
| CT-CON-005-03 | Conta já paga | Token + ID de conta PAID | Operação não permitida | 400 |
| CT-CON-005-04 | Conta já cancelada | Token + ID de conta CANCELLED | Operação não permitida | 400 |
| CT-CON-005-05 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-CON-006 — PATCH /accounts-receivable/:id/installments/:installmentId

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CON-006-01 | Atualizar data de vencimento da parcela | Token + nova dueDate futura | Parcela com nova data, conta retornada | 200 |
| CT-CON-006-02 | Atualizar valor com redistribuição automática | Token + novo amount válido | Demais parcelas redistribuídas proporcionalmente | 200 |
| CT-CON-006-03 | Parcela já paga | Token + installmentId com paidAt | Operação não permitida | 400 |
| CT-CON-006-04 | Valor excede saldo disponível | Token + amount maior que o total da conta | Mensagem: saldo insuficiente | 400 |
| CT-CON-006-05 | Conta inexistente | Token + ID de conta inválido | Mensagem: não encontrado | 404 |
| CT-CON-006-06 | Parcela não pertence à conta | Token + installmentId de outra conta | Mensagem: parcela não encontrada | 404 |
| CT-CON-006-07 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-CON-007 — PATCH /accounts-receivable/:id/installments/:installmentId/mark-paid

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CON-007-01 | Marcar última parcela como paga | Token + installmentId da única parcela pendente | Conta marcada como PAID automaticamente | 200 |
| CT-CON-007-02 | Marcar parcela com outras ainda abertas | Token + installmentId de uma parcela pendente | Conta permanece PENDING | 200 |
| CT-CON-007-03 | Parcela já paga | Token + installmentId com paidAt | Operação não permitida | 400 |
| CT-CON-007-04 | Conta inexistente | Token + ID de conta inválido | Mensagem: não encontrado | 404 |
| CT-CON-007-05 | Parcela não pertence à conta | Token + installmentId de outra conta | Mensagem: parcela não encontrada | 404 |
| CT-CON-007-06 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-CON-008 — PATCH /accounts-receivable/:id/installments/mark-all-paid

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-CON-008-01 | Marcar todas as parcelas como pagas | Token + ID de conta com parcelas pendentes | Todas as parcelas pagas, conta com status PAID | 200 |
| CT-CON-008-02 | Todas as parcelas já pagas | Token + ID de conta com todas parcelas pagas | Operação não permitida | 400 |
| CT-CON-008-03 | Conta inexistente | Token + ID inválido | Mensagem: não encontrado | 404 |
| CT-CON-008-04 | Sem autenticação | Sem token | Acesso negado | 401 |

### 6.4 Módulo de Comprovantes

#### CT-COMP-001 — POST /receipts/upload

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-COMP-001-01 | Upload de JPEG válido | Token + arquivo JPEG | Comprovante criado com status ANALYSING e origin manual | 201 |
| CT-COMP-001-02 | Upload de PDF válido | Token + arquivo PDF | Comprovante criado com status ANALYSING e documentFormat pdf | 201 |
| CT-COMP-001-03 | Sem arquivo anexado | Token + body vazio | Mensagem de validação | 400 |
| CT-COMP-001-04 | Arquivo acima de 5MB | Token + arquivo > 5MB | Erro de tamanho | 413 |
| CT-COMP-001-05 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-COMP-002 — GET /receipts

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-COMP-002-01 | Listar todos autenticado | Token válido | Lista paginada de comprovantes com total e totalPages | 200 |
| CT-COMP-002-02 | Filtrar por status | Token + ?status=RED_FLAG | Lista filtrada pelo status informado | 200 |
| CT-COMP-002-03 | Filtrar por nome do cliente | Token + ?clientName=João | Lista filtrada pelo nome do cliente | 200 |
| CT-COMP-002-04 | Sem comprovantes cadastrados | Token válido, banco vazio | Lista vazia com total 0 | 200 |
| CT-COMP-002-05 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-COMP-003 — GET /receipts/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-COMP-003-01 | Comprovante existente | Token + ID válido | Dados do comprovante com blob e warnings | 200 |
| CT-COMP-003-02 | Comprovante inexistente | Token + ID inválido | Mensagem: não encontrado | 404 |
| CT-COMP-003-03 | Comprovante de outro usuário | Token + ID de outro usuário | Não encontrado | 404 |
| CT-COMP-003-04 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-COMP-004 — PATCH /receipts/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-COMP-004-01 | Vincular cliente válido | Token + clientId existente do usuário | Comprovante atualizado com clientId | 200 |
| CT-COMP-004-02 | Atualizar depositAmount | Token + depositAmount numérico | Comprovante atualizado com novo valor | 200 |
| CT-COMP-004-03 | Comprovante em ANALYSING | Token + ID com status ANALYSING | Operação não permitida | 400 |
| CT-COMP-004-04 | Comprovante RECONCILED, alterar status | Token + ID RECONCILED + novo status | Operação não permitida | 400 |
| CT-COMP-004-05 | clientId de outro usuário | Token + clientId de outro usuário | Cliente não encontrado | 404 |
| CT-COMP-004-06 | Comprovante inexistente | Token + ID inválido | Não encontrado | 404 |
| CT-COMP-004-07 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-COMP-005 — PATCH /receipts/:id/reconcile

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-COMP-005-01 | Conciliar com conta válida | Token + accountReceivableId válido | Comprovante com status RECONCILED | 200 |
| CT-COMP-005-02 | Conta cancelada | Token + accountReceivableId de conta CANCELLED | Operação não permitida | 400 |
| CT-COMP-005-03 | Comprovante inexistente | Token + ID de comprovante inválido | Não encontrado | 404 |
| CT-COMP-005-04 | Conta inexistente | Token + accountReceivableId inválido | Não encontrado | 404 |
| CT-COMP-005-05 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-COMP-006 — PATCH /receipts/:id/unreconcile

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-COMP-006-01 | Desconciliar comprovante RECONCILED | Token + ID de comprovante RECONCILED | Comprovante com status RECEIVED, conta volta a PENDING | 200 |
| CT-COMP-006-02 | Comprovante não está conciliado | Token + ID de comprovante não RECONCILED | Operação não permitida | 400 |
| CT-COMP-006-03 | Comprovante inexistente | Token + ID inválido | Não encontrado | 404 |
| CT-COMP-006-04 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-COMP-007 — DELETE /receipts/:id

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-COMP-007-01 | Deletar comprovante válido | Token + ID existente não em ANALYSING | Comprovante removido, sem conteúdo | 204 |
| CT-COMP-007-02 | Comprovante em ANALYSING | Token + ID com status ANALYSING | Operação não permitida | 400 |
| CT-COMP-007-03 | Comprovante inexistente | Token + ID inválido | Não encontrado | 404 |
| CT-COMP-007-04 | Sem autenticação | Sem token | Acesso negado | 401 |

### 6.5 Módulo de Alertas

#### CT-WARN-001 — GET /warnings

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-WARN-001-01 | Listar alertas pendentes | Token válido | Lista paginada com `yellowCount` e `redCount` globais | 200 |
| CT-WARN-001-02 | Filtrar por tipo yellow | Token + ?type=yellow | Apenas alertas do tipo yellow | 200 |
| CT-WARN-001-03 | Filtrar por tipo red | Token + ?type=red | Apenas alertas do tipo red | 200 |
| CT-WARN-001-04 | Paginação customizada | Token + ?page=2&limit=5 | Página correta com `totalPages` calculado | 200 |
| CT-WARN-001-05 | Sem alertas pendentes | Token válido, nenhum alerta no banco | Lista vazia com contadores zerados | 200 |
| CT-WARN-001-06 | Tipo inválido | Token + ?type=invalido | Mensagem de validação | 400 |
| CT-WARN-001-07 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-WARN-002 — PATCH /warnings/:id/resolve

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-WARN-002-01 | Resolver alerta válido | Token + warningId + resolutionReason | Alerta com `resolved: true` e `resolvedAt` preenchido | 200 |
| CT-WARN-002-02 | Último alerta resolvido atualiza comprovante | Token + último warning de comprovante RED_FLAG | Comprovante atualizado para status RECEIVED | 200 |
| CT-WARN-002-03 | Alerta já resolvido | Token + warningId com `resolved: true` | Mensagem: alerta já foi resolvido | 400 |
| CT-WARN-002-04 | Alerta inexistente | Token + ID inválido | Mensagem: alerta não encontrado | 404 |
| CT-WARN-002-05 | resolutionReason ausente | Token + warningId + body sem motivo | Mensagem de validação | 400 |
| CT-WARN-002-06 | resolutionReason vazio | Token + warningId + motivo = '' | Mensagem de validação | 400 |
| CT-WARN-002-07 | ID não é UUID | Token + ID não-UUID | Erro de validação do pipe | 400 |
| CT-WARN-002-08 | Sem autenticação | Sem token | Acesso negado | 401 |

### 6.6 Módulo de Integração WhatsApp

#### CT-ZAP-001 — GET /zapfy/qrcode

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-ZAP-001-01 | Buscar QR code com integração ativa | Token válido + integração cadastrada | QR code em base64 e estado da instância | 200 |
| CT-ZAP-001-02 | Sem integração cadastrada para o usuário | Token válido + sem integração | Mensagem: integração não encontrada | 404 |
| CT-ZAP-001-03 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-ZAP-002 — GET /zapfy/status

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-ZAP-002-01 | Instância conectada (state = open) | Token válido + integração cadastrada | active: true, state: 'open' | 200 |
| CT-ZAP-002-02 | Instância desconectada (state = close) | Token válido + integração cadastrada | active: false, state: 'close' | 200 |
| CT-ZAP-002-03 | Sem integração cadastrada para o usuário | Token válido + sem integração | Mensagem: integração não encontrada | 404 |
| CT-ZAP-002-04 | API do Zapfy indisponível | Token válido + Zapfy fora do ar | Mensagem: serviço indisponível | 503 |
| CT-ZAP-002-05 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-ZAP-003 — POST /zapfy/disconnect

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-ZAP-003-01 | Desconectar instância com sucesso | Token válido + integração cadastrada | Integração desativada | 200 |
| CT-ZAP-003-02 | Sem integração cadastrada para o usuário | Token válido + sem integração | Mensagem: integração não encontrada | 404 |
| CT-ZAP-003-03 | API do Zapfy indisponível | Token válido + Zapfy fora do ar | Mensagem: serviço indisponível | 503 |
| CT-ZAP-003-04 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-ZAP-004 — POST /zapfy/admin/users/:userId/connect

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-ZAP-004-01 | Admin vincula nova integração a um usuário | Token admin + instanceKey + instanceToken | Integração criada | 200 |
| CT-ZAP-004-02 | Admin atualiza integração existente do usuário | Token admin + integração já existente | Integração atualizada com novos dados | 200 |
| CT-ZAP-004-03 | Campos obrigatórios ausentes | Token admin + body incompleto | Mensagem de validação | 400 |
| CT-ZAP-004-04 | Usuário com role user tenta conectar | Token user | Acesso negado | 403 |
| CT-ZAP-004-05 | Sem autenticação | Sem token | Acesso negado | 401 |

#### CT-ZAP-005 — POST /zapfy/webhook

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-ZAP-005-01 | Evento INSTANCE-CONNECTED com secret válido | ?secret=válido + payload INSTANCE-CONNECTED | Integração marcada como ativa | 200 |
| CT-ZAP-005-02 | Evento INSTANCE-DISCONNECTED com secret válido | ?secret=válido + payload INSTANCE-DISCONNECTED | Integração marcada como inativa | 200 |
| CT-ZAP-005-03 | Nova mensagem com imagem de remetente desconhecido | ?secret=válido + payload NEW-MESSAGE com imageMessage | Comprovante criado com clientId nulo | 200 |
| CT-ZAP-005-04 | Nova mensagem com imagem de cliente cadastrado | ?secret=válido + payload NEW-MESSAGE + número do cliente | Comprovante criado vinculado ao cliente | 200 |
| CT-ZAP-005-05 | Nova mensagem enviada pelo próprio usuário (fromMe) | ?secret=válido + payload NEW-MESSAGE com fromMe: true | Mensagem ignorada, nenhum comprovante criado | 200 |
| CT-ZAP-005-06 | Nova mensagem de grupo | ?secret=válido + payload NEW-MESSAGE com remoteJid @g.us | Mensagem ignorada, nenhum comprovante criado | 200 |
| CT-ZAP-005-07 | Nova mensagem sem mídia | ?secret=válido + payload NEW-MESSAGE sem imageMessage nem documentMessage | Mensagem ignorada, nenhum comprovante criado | 200 |
| CT-ZAP-005-08 | Comprovante apagado no WhatsApp | ?secret=válido + payload MESSAGE-UPDATED com messageStubType: 1 | isDeletedWhatsapp: true + warning criado | 200 |
| CT-ZAP-005-09 | Secret inválido ou ausente | ?secret=errado + qualquer payload | Acesso negado | 401 |

### 6.7 Módulo de Dashboard

#### CT-DASH-001

| ID | Cenário | Endpoint | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-DASH-001-01 | Resumo de recebimentos autenticado | GET /dashboard/resumo | Total pendente, total conciliado mensal, total vencido, total comprovantes mensal | 200 |
| CT-DASH-001-02 | Resumo sem autenticação | GET /dashboard/resumo | Acesso negado | 401 |
| CT-DASH-001-03 | Resumo dos recebidos nos últimos 7 dias | GET /dashboard/graphic | Dados e data dos últimos recebidos | 200 |

## 7. Testes Unitários

### 7.1 PixReceiptsService

| Funcionalidade | Escopo verificado |
|---|---|
| Upload e inicialização | Upload de arquivo com enfileiramento, rejeição sem arquivo, reprocessamento de comprovantes travados na inicialização |
| Processamento OCR + IA | Pipeline completo com dados válidos, fallback para OCR quando GPT falha ou retorna erro, status ERROR após esgotamento de retentativas, conversão de PDF antes do OCR |
| Detecção de inconsistências | Duplicidade por ID PIX, conflito de data/hora, divergência de valor entre OCR e IA, ausência de ID PIX válido |
| Vínculo de cliente | Resolução de cliente pelo telefone (JID) quando clientId não está definido, alerta quando nenhum cliente está vinculado |
| Conciliação automática | Conciliação por valor total, conciliação por parcela individual |
| CRUD com validações | Listagem paginada com filtros, busca por ID, atualização com validações de status, desconciliação, remoção com reversão de parcelas |

### 7.2 OcrService

| Funcionalidade | Escopo verificado |
|---|---|
| Extração de texto | JPEG válido retorna texto sem espaços extras; arquivo sem magic bytes lança exceção |
| Conversão de PDF | PDF válido retorna buffer JPEG; arquivo sem assinatura PDF lança exceção |

### 7.3 StorageService

| Funcionalidade | Escopo verificado |
|---|---|
| Upload | Extensão correta por MIME type (.jpg / .pdf), uso do bucket configurado, exceção em caso de erro do Supabase |
| Deleção | Remoção pelo nome de arquivo extraído da URL, tolerância a erro na deleção, retorno antecipado para URL vazia |

### 7.4 OpenAiService

| Funcionalidade | Escopo verificado |
|---|---|
| Análise de comprovante | Parse de JSON válido, remoção de bloco markdown antes do parse, retorno de objeto de erro para resposta inválida ou null, verificação de que URL e texto OCR chegam corretamente ao prompt |

### 7.5 QueueService

| Funcionalidade | Escopo verificado |
|---|---|
| Execução de jobs | Job único executado uma vez, múltiplos jobs executados na ordem, continuidade após erro interno em um job |
| Shutdown | Resolução imediata quando ocioso, aguarda job em andamento antes de encerrar |

## 8. Critérios de Aceite e Saída

### 8.1 Critérios de Entrada

- Ambiente de testes configurado e funcionando
- Todas as rotas implementadas e documentadas no Swagger
- Variáveis de ambiente .env.test configuradas

### 8.2 Critérios de Aceite

- Cobertura mínima de 70% das funcionalidades por testes de endpoint
- Cobertura mínima de 80% de linhas nos serviços críticos (pix-receipts, OCR, storage, OpenAI, queue)
- Nenhum teste de cenário de segurança (401/403) falhando
- Detecção de duplicidade funcionando corretamente
- Conciliação financeira retornando resultados corretos

### 8.3 Critérios de Saída

- Todos os casos de teste executados
- Defeitos críticos e de alta prioridade corrigidos e retestados
- Relatório de cobertura de testes gerado pelo Jest

## 9. Referências

**SON, Hannah.** How To Create A Test Plan: Steps, Examples, & Template. Testrail, 2026. Disponível em: https://www.testrail.com/blog/create-a-test-plan/. Acesso em: 22 maio 2026

**Free Test Plan Template.** Atlassian, [s.d.]. Disponível em: https://www.atlassian.com/software/confluence/resources/guides/how-to/test-plan. Acesso em: 22 maio 2026
