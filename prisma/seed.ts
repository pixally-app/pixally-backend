import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker/locale/pt_BR';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.trim()) {
  throw new Error(
    'Missing required DATABASE_URL environment variable. Set DATABASE_URL before running prisma/seed.ts.',
  );
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

function generateCpf(): string {
  return faker.string.numeric(11);
}

function generateCnpj(): string {
  return faker.string.numeric(14);
}

function generatePhone(): string {
  return faker.string.numeric(11);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed script cannot run in production environment.');
  }

  console.log('Limpando banco...');
  await prisma.accountReceivable.deleteMany();
  await prisma.warning.deleteMany();
  await prisma.pixReceiptBlob.deleteMany();
  await prisma.pixReceipt.deleteMany();
  await prisma.monitoredContact.deleteMany();
  await prisma.phoneClient.deleteMany();
  await prisma.client.deleteMany();
  await prisma.zapifyIntegration.deleteMany();
  await prisma.user.deleteMany();

  console.log('Criando usuários...');
  const user1 = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@gmail.com',
      password: '$2a$12$g/n3MFCBKlSey9YCyGQ0QeLZ0YD08j3BqkkhD38bZA5JaYusR2FDi',
      document: generateCpf(),
      phone: generatePhone(),
      role: 'admin',
      isActive: true,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      username: 'joao',
      email: 'joao@gmail.com',
      password: '$2b$10$fakehashedpassword0987654321',
      document: generateCnpj(),
      phone: generatePhone(),
      role: 'user',
      isActive: true,
    },
  });

  console.log('Criando integrações Zapify...');
  await prisma.zapifyIntegration.create({
    data: {
      userId: user1.id,
      active: true,
      instanceApiUrl: 'https://api.zapify.example.com/instance1',
      instanceKey: faker.string.alphanumeric(32),
      instanceToken: faker.string.alphanumeric(64),
    },
  });

  await prisma.zapifyIntegration.create({
    data: {
      userId: user2.id,
      active: false,
      instanceApiUrl: 'https://api.zapify.example.com/instance2',
      instanceKey: faker.string.alphanumeric(32),
      instanceToken: faker.string.alphanumeric(64),
    },
  });

  console.log('Criando clientes...');
  const clients = [];

  for (const user of [user1, user2]) {
    for (let i = 0; i < 3; i++) {
      const isCpf = faker.datatype.boolean();
      const client = await prisma.client.create({
        data: {
          userId: user.id,
          name: faker.person.fullName(),
          document: isCpf ? generateCpf() : generateCnpj(),
          documentType: isCpf ? 'CPF' : 'CNPJ',
          status: true,
          amount: faker.number.float({ min: 100, max: 50000, fractionDigits: 2 }),
          phones: [{ dialCode: '+55', phoneNumber: generatePhone() }],
        },
      });
      clients.push({ client, userId: user.id });
    }
  }

  console.log('Criando telefones dos clientes...');
  for (const { client } of clients) {
    await prisma.phoneClient.create({
      data: {
        clientId: client.id,
        dialCode: '+55',
        phoneNumber: generatePhone(),
      },
    });
  }

  console.log('Criando contatos monitorados...');
  for (const { client, userId } of clients.slice(0, 4)) {
    await prisma.monitoredContact.create({
      data: {
        userId,
        clientId: client.id,
        phoneJid: `55${generatePhone()}@s.whatsapp.net`,
        isActive: true,
      },
    });
  }

  console.log('Criando comprovantes PIX...');
  const pixReceipts = [];
  const banks = ['Banco do Brasil', 'Itaú', 'Bradesco', 'Nubank', 'Santander', 'Caixa'];
  const statuses = ['pending', 'validated', 'rejected', 'processing'];

  for (const { client, userId } of clients) {
    for (let i = 0; i < faker.number.int({ min: 2, max: 4 }); i++) {
      const depositAmount = faker.number.float({ min: 50, max: 10000, fractionDigits: 2 });
      const receipt = await prisma.pixReceipt.create({
        data: {
          userId,
          clientId: client.id,
          status: faker.helpers.arrayElement(statuses),
          origin: 'whatsapp',
          documentFormat: faker.helpers.arrayElement(['image', 'pdf']),
          description: `Pagamento ${faker.commerce.productName()}`,
          depositDateTime: faker.date.recent({ days: 30 }),
          depositAmount,
          depositOriginName: faker.person.fullName(),
          depositOriginDocument: generateCpf(),
          depositOriginDocumentType: 'CPF',
          depositOriginBank: faker.helpers.arrayElement(banks),
          depositOriginAgency: faker.string.numeric(4),
          depositOriginAccount: faker.string.numeric(8),
          depositDestinationName: client.name,
          depositDestinationDocument: client.document,
          depositDestinationDocumentType: client.documentType ?? 'CPF',
          depositDestinationBank: faker.helpers.arrayElement(banks),
          depositDestinationAgency: faker.string.numeric(4),
          depositDestinationAccount: faker.string.numeric(8),
          pixTransactionId: faker.string.uuid(),
          processmentOcrOutcome: JSON.stringify({
            raw: `PIX recebido R$ ${depositAmount}`,
            confidence: faker.number.float({ min: 0.85, max: 0.99, fractionDigits: 2 }),
          }),
          jid: `55${generatePhone()}@s.whatsapp.net`,
          messageId: faker.string.alphanumeric(20),
          isDeletedWhatsapp: false,
        },
      });
      pixReceipts.push({ receipt, userId, clientId: client.id });
    }
  }

  console.log('Criando blobs dos comprovantes...');
  for (const { receipt } of pixReceipts) {
    await prisma.pixReceiptBlob.create({
      data: {
        pixReceiptsId: receipt.id,
        mimeType: receipt.documentFormat === 'pdf' ? 'application/pdf' : 'image/jpeg',
        filePath: `/uploads/receipts/${receipt.id}.${receipt.documentFormat === 'pdf' ? 'pdf' : 'jpg'}`,
        fileUrl: `https://storage.example.com/receipts/${receipt.id}`,
      },
    });
  }

  console.log('Criando alertas (warnings)...');
  const warningTypes = ['duplicate', 'amount_mismatch', 'expired', 'invalid_document'];

  for (const { receipt, clientId } of pixReceipts.slice(0, 5)) {
    await prisma.warning.create({
      data: {
        pixReceiptId: receipt.id,
        clientId,
        type: faker.helpers.arrayElement(warningTypes),
        message: faker.helpers.arrayElement([
          'Comprovante possivelmente duplicado',
          'Valor do comprovante diverge do esperado',
          'Comprovante expirado (mais de 24h)',
          'Documento do pagador não confere',
        ]),
        resolved: faker.datatype.boolean(),
        resolutionReason: faker.datatype.boolean() ? 'Verificado manualmente' : null,
        resolvedAt: faker.datatype.boolean() ? faker.date.recent({ days: 7 }) : null,
      },
    });
  }

  console.log('Criando contas a receber...');
  for (const { client, userId } of clients) {
    const totalAmount = faker.number.float({ min: 500, max: 5000, fractionDigits: 2 });
    const installmentCount = faker.helpers.arrayElement([1, 2, 3, 6]);
    const installmentAmount = parseFloat((totalAmount / installmentCount).toFixed(2));
    const groupId = faker.string.uuid();

    const relatedReceipt = pixReceipts.find(
      (p) => p.clientId === client.id && p.receipt.status === 'validated',
    );

    for (let i = 1; i <= installmentCount; i++) {
      const isPaid = i === 1 && faker.datatype.boolean();
      await prisma.accountReceivable.create({
        data: {
          userId,
          clientId: client.id,
          pixReceiptId: isPaid && relatedReceipt ? relatedReceipt.receipt.id : null,
          descriptionService: faker.commerce.productName(),
          totalAmount,
          installmentGroupId: groupId,
          installmentCount,
          installmentNumber: i,
          installmentAmount,
          dueDate: faker.date.soon({ days: 30 * i }),
          status: isPaid ? 'paid' : 'pending',
          paidAt: isPaid ? faker.date.recent({ days: 5 }) : null,
          payStub: isPaid ? faker.string.alphanumeric(12) : null,
          matchedAutomatically: isPaid ? faker.datatype.boolean() : null,
        },
      });
    }
  }

  console.log('Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
