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

describe('GET /accounts-receivable (CT-CON-002)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    accountReceivable: {
      findMany: jest.Mock<any>;
      count: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();

  const buildMockAccount = (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: mockUserId,
    clientId: faker.string.uuid(),
    pixReceiptId: null,
    clientName: 'Cliente Teste',
    serviceName: 'Serviço Teste',
    serviceDescription: null,
    totalAmount: 500,
    dueDate: new Date('2027-01-15'),
    status: 'PENDING',
    paidAt: null,
    payStub: null,
    matchedAutomatically: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      accountReceivable: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

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

  it('CT-CON-002-01 - should return 200 and paginated list of accounts', async () => {
    const records = [buildMockAccount(), buildMockAccount()];
    prismaService.accountReceivable.findMany.mockResolvedValue(records);
    prismaService.accountReceivable.count.mockResolvedValue(2);

    const response = await request(app.getHttpServer())
      .get('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total', 2);
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('totalPages', 1);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('CT-CON-002-02 - should return 200 filtering by status PENDING', async () => {
    const records = [buildMockAccount()];
    prismaService.accountReceivable.findMany.mockResolvedValue(records);
    prismaService.accountReceivable.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/accounts-receivable?status=PENDING')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
  });

  it('CT-CON-002-03 - should return 200 filtering by status PAID', async () => {
    const records = [buildMockAccount({ status: 'PAID', paidAt: new Date() })];
    prismaService.accountReceivable.findMany.mockResolvedValue(records);
    prismaService.accountReceivable.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/accounts-receivable?status=PAID')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
  });

  it('CT-CON-002-04 - should return 200 filtering by status OVERDUE', async () => {
    const records = [buildMockAccount({ status: 'PENDING', dueDate: new Date('2020-01-01') })];
    prismaService.accountReceivable.findMany.mockResolvedValue(records);
    prismaService.accountReceivable.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/accounts-receivable?status=OVERDUE')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
  });

  it('CT-CON-002-05 - should return 400 when status value is invalid', async () => {
    const response = await request(app.getHttpServer())
      .get('/accounts-receivable?status=invalido')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('CT-CON-002-06 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get('/accounts-receivable')
      .expect(401);
  });
});
