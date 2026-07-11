import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { AccountsReceivableController } from '../../src/accounts-receivable/accounts-receivable.controller.js';
import { AccountsReceivableService } from '../../src/accounts-receivable/accounts-receivable.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('GET /accounts-receivable (CT-CON-002)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
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
      user: { findUnique: jest.fn() },
      accountReceivable: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [AccountsReceivableController],
      providers: [AccountsReceivableService],
      prismaService,
    }));
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => { prismaService.user.findUnique.mockResolvedValue({ isActive: true }); });
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
