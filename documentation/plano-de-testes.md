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
- Módulo de Clientes (CRUD completo)
- Módulo de Contas a Receber (CRUD + filtros por status)
- Módulo de Comprovantes (upload, extração OCR, validação por IA)
- Módulo de Conciliação (conciliação automática, detecção de duplicidade)
- Módulo de Dashboard (resumo de recebimentos, inadimplentes, alertas)
- Segurança (autenticação JWT, proteção de rotas, CORS)

### 3.2 Funcionalidades Fora do Escopo

- Integração com WhatsApp Business API (dependência de serviço externo)
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

Os testes unitários serão focados nas funcionalidades mais complexas do sistema, especialmente no serviço de extração OCR com IA generativa, na lógica de detecção de duplicidade de comprovantes e no motor de conciliação financeira. Esses serviços serão testados de forma isolada, utilizando mocks para as dependências externas.

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

### 6.2 Módulo de Clientes

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
| CT-COMP-001-01 | Upload de imagem válida | Token + arquivo PNG/JPG/PDF de comprovante | Dados extraídos: valor, data, pagador, banco, ID transação | 201 |
| CT-COMP-001-02 | Imagem sem dados reconhecíveis | Token + imagem aleatória | Mensagem: não foi possível extrair dados | 422 |
| CT-COMP-001-03 | Formato de arquivo inválido | Token + arquivo inválido | Mensagem de validação de formato | 400 |
| CT-COMP-001-04 | Sem arquivo anexado | Token + body vazio | Mensagem de validação | 400 |
| CT-COMP-001-05 | Sem autenticação | Sem token + imagem | Acesso negado | 401 |
| CT-COMP-001-06 | Imagem com baixa resolução | Token + imagem de baixa qualidade | Dados parcialmente extraídos ou erro | 422 |
| CT-COMP-001-07 | Comprovante duplicado | Token + imagem já enviada anteriormente | Alerta de duplicidade retornado | 200 |

#### CT-COMP-002 — GET /receipts

| ID | Cenário | Dados de Entrada | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-COMP-002-01 | Listar todos autenticado | Token válido | Lista de comprovantes | 200 |
| CT-COMP-002-02 | Sem autenticação | Sem token | Acesso negado | 401 |
| CT-COMP-002-03 | Sem comprovantes cadastrados | Token válido, banco vazio | Lista vazia [] | 200 |

### 6.5 Módulo de Dashboard

#### CT-DASH-001

| ID | Cenário | Endpoint | Resultado Esperado | Status HTTP |
|---|---|---|---|---|
| CT-DASH-001-01 | Resumo de recebimentos autenticado | GET /dashboard/resumo | Total pendente, total conciliado mensal, total vencido, total comprovantes mensal | 200 |
| CT-DASH-001-02 | Resumo sem autenticação | GET /dashboard/resumo | Acesso negado | 401 |
| CT-DASH-001-03 | Resumo dos recebidos nos últimos 7 dias | GET /dashboard/graphic | Dados e data dos últimos recebidos | 200 |

## 7. Testes Unitários

### 7.1 Serviço de Extração OCR + IA

| ID | Cenário | Entrada | Saída Esperada |
|---|---|---|---|
| TU-OCR-001 | Extrair valor de comprovante válido | Mock de imagem com valor R$ 150,00 | valor: 150.00 |
| TU-OCR-002 | Extrair data de comprovante válido | Mock de imagem com data 01/05/2026 | data: '2026-05-01' |
| TU-OCR-003 | Extrair nome do pagador | Mock de imagem com nome 'João Silva' | pagador: 'João Silva' |
| TU-OCR-004 | Extrair identificador da transação | Mock de imagem com ID de transação | idTransacao: 'xxx-xxx-xxx' |
| TU-OCR-005 | Imagem ilegível lança exceção | Mock de imagem corrompida | Mensagem de validação |
| TU-OCR-006 | Imagem sem dados PIX lança exceção | Mock de imagem de paisagem | Mensagem de validação |

### 7.2 Serviço de Conciliação

| ID | Cenário | Entrada | Saída Esperada |
|---|---|---|---|
| TU-CONC-001 | Valores iguais conciliam corretamente | Comprovante R$ 200 + Conta R$ 200 | status: 'conciliado' |
| TU-CONC-002 | Valores divergentes geram alerta | Comprovante R$ 150 + Conta R$ 200 | status: 'divergente', diferenca: 50 |
| TU-CONC-003 | Conta vencida é marcada como inadimplente | Conta com vencimento no passado | status: 'vencido' |
| TU-CONC-004 | Conta paga não pode ser conciliada novamente | Conta com status 'pago' | Mensagem de validação |

## 8. Critérios de Aceite e Saída

### 8.1 Critérios de Entrada

- Ambiente de testes configurado e funcionando
- Todas as rotas implementadas e documentadas no Swagger
- Variáveis de ambiente .env.test configuradas

### 8.2 Critérios de Aceite

- Cobertura mínima de 70% das funcionalidades por testes de endpoint
- 100% dos testes unitários das funcionalidades críticas passando
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
