# Requisitos do Sistema

## Requisitos Funcionais (RF)

### Integração com WhatsApp para captura automática

| ID | Requisito | Status |
|----|-----------|--------|
| RF01 | O sistema deve permitir a conexão com o WhatsApp via leitura de QR code | Implementado |
| RF02 | O sistema deve receber automaticamente mensagens de imagem e documentos PDF enviados via WhatsApp | Implementado |
| RF03 | O sistema deve suportar o recebimento de comprovantes via mensagens privadas do WhatsApp | Implementado |
| RF04 | O sistema deve armazenar a imagem/documento original do comprovante recebido | Implementado |
| RF05 | O sistema deve registrar a origem do comprovante (WhatsApp ou upload manual) | Implementado |

### OCR e IA para extração de dados

| ID | Requisito | Status |
|----|-----------|--------|
| RF06 | O sistema deve processar imagens de comprovantes PIX utilizando OCR para extrair o texto | Implementado |
| RF07 | O sistema deve processar documentos PDF de comprovantes PIX | Implementado |
| RF08 | O sistema deve utilizar Inteligência Artificial para extrair dados estruturados do comprovante: valor, data, pagador, banco, agência, conta e identificador da transação | Implementado |
| RF09 | O sistema deve vincular automaticamente o comprovante ao cliente com base nos dados extraídos (telefone ou documento) | Implementado |
| RF10 | O sistema deve permitir a edição manual dos dados extraídos caso haja erro na extração | Implementado |
| RF11 | O sistema deve registrar o status de processamento do comprovante (Em análise, Erro, Pendente, Recebido) | Implementado |

### Módulo de contas a receber com conciliação automática

| ID | Requisito | Status |
|----|-----------|--------|
| RF12 | O sistema deve permitir o cadastro de clientes com nome, documento (CPF/CNPJ), descrição e telefone | Implementado |
| RF13 | O sistema deve permitir o registro de contas a receber, com descrição do serviço/produto, valor total, valor parcelado, data de vencimento e cliente vinculado | Implementado |
| RF14 | O sistema deve realizar a baixa automática dos comprovantes recebidos e as contas a receber cadastradas | Implementado |
| RF15 | O sistema deve atualizar o status da conta a receber ao identificar o pagamento correspondente (Em aberto, Pago, Vencido) | Implementado |
| RF16 | O sistema deve identificar pagamentos com valor divergente do esperado | Implementado |

### Dashboard e painel de controle

| ID | Requisito | Status |
|----|-----------|--------|
| RF17 | O sistema deve exibir um painel com a visão consolidada dos recebimentos (total recebido, total a receber, total vencido) | Implementado |
| RF18 | O sistema deve permitir filtrar comprovantes por período, cliente, status e origem | Implementado |
| RF19 | O sistema deve gerar alertas de duplicidade quando identificar comprovantes com mesmo identificador de transação | Implementado |
| RF20 | O sistema deve gerar alertas de inconsistência (valor divergente, dados suspeitos) | Implementado |
| RF21 | O sistema deve exibir a situação de inadimplência por cliente (contas vencidas e não pagas) | Implementado |
| RF22 | O sistema deve permitir a exportação dos dados de recebimentos em formato CSV | Implementado |
| RF23 | O sistema deve exibir alertas visuais com classificação por severidade (amarelo para atenção, vermelho para crítico) | Implementado |

### Requisitos Gerais

| ID | Requisito | Status |
|----|-----------|--------|
| RF24 | O sistema deve exigir autenticação para acesso às funcionalidades | Implementado |
| RF25 | O sistema deve permitir o upload manual de comprovantes (imagem ou PDF) | Implementado |

---

## Requisitos Não Funcionais (RNF)

| ID | Categoria | Requisito | Status |
|----|-----------|-----------|--------|
| RNF01 | Usabilidade | A interface deve ser responsiva e acessível em dispositivos móveis e desktop | Implementado |
| RNF02 | Usabilidade | O sistema deve ser utilizável por microempreendedores sem conhecimento técnico ou contábil | Implementado |
| RNF03 | Desempenho | O processamento de um comprovante (OCR + IA) deve ser concluído em até 60 segundos | Implementado |
| RNF04 | Desempenho | O sistema deve suportar o processamento de múltiplos comprovantes simultaneamente | Implementado |
| RNF05 | Desempenho | O sistema deve processar comprovantes de forma assíncrona, sem bloquear a interface do usuário | Implementado |
| RNF06 | Segurança | As senhas dos usuários devem ser armazenadas com hash criptográfico | Implementado |
| RNF07 | Segurança | A comunicação entre cliente e servidor deve utilizar o protocolo HTTPS | Infraestrutura |
| RNF08 | Segurança | O acesso às rotas da API deve ser protegido por token JWT | Implementado |
| RNF09 | Confiabilidade | O sistema deve armazenar o comprovante original mesmo em caso de falha na extração, permitindo reprocessamento | Implementado |
| RNF10 | Compatibilidade | O sistema deve processar comprovantes PIX de diferentes instituições bancárias (layouts variados) | Implementado |
| RNF11 | Disponibilidade | O webhook de recebimento de mensagens deve estar disponível continuamente para não perder comprovantes | Implementado |
| RNF12 | Portabilidade | O sistema deve ser implantável via containers Docker | Implementado |
| RNF13 | Manutenibilidade | O sistema deve utilizar controle de versão (Git) e migrações para alterações no banco de dados | Implementado |
