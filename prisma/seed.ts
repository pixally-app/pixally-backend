import 'dotenv/config';
import { PrismaClient, Role } from '../generated/prisma/client.js';
import * as bcrypt from 'bcrypt';
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
      role: Role.admin,
      isActive: true,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      username: 'joao',
      email: 'joao@gmail.com',
      password: await bcrypt.hash('User@123', 10),
      document: generateCnpj(),
      phone: generatePhone(),
      role: Role.user,
      isActive: true,
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
