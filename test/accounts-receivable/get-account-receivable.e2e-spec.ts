import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { AccountsReceivableController } from '../../src/accounts-receivable/accounts-receivable.controller.js';
import { AccountsReceivableService } from '../../src/accounts-receivable/accounts-receivable.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { JwtStrategy } from '../../src/auth/jwt.strategy.js';

describe('GET /accounts-receivable/:id', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: { accountReceivable: { findFirst: jest.Mock<any> } };

  const mockUserId = faker.string.uuid();
  const mockAccountId = faker.string.uuid();

  const buildMockAccount = (overrides = {}) => ({
    id: mockAccountId,
    userId: mockUserId,
    clientId: faker.string.uuid(),
    pixReceiptId: null,
    clientName: 'Cliente Teste',
    serviceName: 'Serviço Teste',
    serviceDescription: null,
    totalAmount: 1500,
    dueDate: new Date('2027-01-15'),
    status: 'PENDING',
    paidAt: null,
    payStub: null,
    matchedAutomatically: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    installments: [],
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = { accountReceivable: { findFirst: jest.fn() } };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret-key', signOptions: { expiresIn: '1h' } }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      controllers: [AccountsReceivableController],
      providers: [
        AccountsReceivableService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: JwtStrategy,
          useFactory: () => new JwtStrategy({ getOrThrow: () => 'test-secret-key' } as any),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });
  afterEach(() => { jest.resetAllMocks(); });

  it('should return 200 and account data with installments', async () => {
    const installments = [
      {
        id: faker.string.uuid(),
        installmentNumber: 1,
        amount: 750,
        dueDate: new Date('2027-01-15'),
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: faker.string.uuid(),
        installmentNumber: 2,
        amount: 750,
        dueDate: new Date('2027-02-15'),
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount({ installments }));

    const response = await request(app.getHttpServer())
      .get(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', mockAccountId);
    expect(response.body).toHaveProperty('installments');
    expect(response.body.installments).toHaveLength(2);
  });

  it('should return 404 when account does not exist', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Account receivable not found');
  });

  it('should return 404 when account belongs to another user', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/accounts-receivable/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Account receivable not found');
  });

  it('should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get(`/accounts-receivable/${mockAccountId}`)
      .expect(401);
  });
});
