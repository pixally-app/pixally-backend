import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { AccountsReceivableController } from '../../src/accounts-receivable/accounts-receivable.controller.js';
import { AccountsReceivableService } from '../../src/accounts-receivable/accounts-receivable.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('POST /accounts-receivable (CT-CON-001)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    client: { findFirst: jest.Mock<any> };
    accountReceivable: { create: jest.Mock<any> };
  };

  const mockUserId = faker.string.uuid();
  const mockClientId = faker.string.uuid();

  const futureDate = '2027-01-15';

  const validPayload = {
    clientId: mockClientId,
    serviceName: 'Manutenção de ar condicionado',
    totalAmount: 1500,
    dueDate: futureDate,
  };

  const mockClient = {
    id: mockClientId,
    name: 'Cliente Teste',
    userId: mockUserId,
    deletedAt: null,
  };

  const buildMockAccount = (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: mockUserId,
    clientId: mockClientId,
    pixReceiptId: null,
    clientName: mockClient.name,
    serviceName: validPayload.serviceName,
    serviceDescription: null,
    totalAmount: validPayload.totalAmount,
    dueDate: new Date(futureDate),
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
      client: { findFirst: jest.fn() },
      accountReceivable: { create: jest.fn() },
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [AccountsReceivableController],
      providers: [AccountsReceivableService],
      prismaService,
    }));
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('CT-CON-001-01 - should return 201 and account data with valid creation', async () => {
    prismaService.client.findFirst.mockResolvedValue(mockClient);
    prismaService.accountReceivable.create.mockResolvedValue(buildMockAccount());

    const response = await request(app.getHttpServer())
      .post('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validPayload)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('serviceName', validPayload.serviceName);
    expect(response.body).toHaveProperty('totalAmount', validPayload.totalAmount);
    expect(response.body).toHaveProperty('status', 'PENDING');
  });

  it('CT-CON-001-02 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .post('/accounts-receivable')
      .send(validPayload)
      .expect(401);
  });

  it('CT-CON-001-03 - should return 404 when client does not exist', async () => {
    prismaService.client.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validPayload)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Client not found');
  });

  it('CT-CON-001-04 - should return 400 when totalAmount is negative', async () => {
    const response = await request(app.getHttpServer())
      .post('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPayload, totalAmount: -100 })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('CT-CON-001-05 - should return 201 when dueDate is in the past', async () => {
    prismaService.client.findFirst.mockResolvedValue(mockClient);
    prismaService.accountReceivable.create.mockResolvedValue(
      buildMockAccount({ dueDate: new Date('2020-01-01') }),
    );

    const response = await request(app.getHttpServer())
      .post('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPayload, dueDate: '2020-01-01' })
      .expect(201);

    expect(response.body).toHaveProperty('id');
  });

  it('CT-CON-001-06 - should return 400 when required fields are missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(Array.isArray(response.body.message)).toBe(true);
  });

  it('CT-CON-001-07 - should return 201 and create account with 3 installments', async () => {
    const installments = Array.from({ length: 3 }, (_, i) => ({
      id: faker.string.uuid(),
      accountReceivableId: faker.string.uuid(),
      installmentNumber: i + 1,
      amount: 500,
      dueDate: new Date(futureDate),
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    prismaService.client.findFirst.mockResolvedValue(mockClient);
    prismaService.accountReceivable.create.mockResolvedValue(buildMockAccount({ installments }));

    const response = await request(app.getHttpServer())
      .post('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPayload, installmentCount: 3 })
      .expect(201);

    expect(response.body).toHaveProperty('installments');
    expect(response.body.installments).toHaveLength(3);
    expect(response.body.installments[0]).toHaveProperty('installmentNumber', 1);
  });

  it('CT-CON-001-08 - should return 400 when installmentCount is zero', async () => {
    const response = await request(app.getHttpServer())
      .post('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPayload, installmentCount: 0 })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('CT-CON-001-09 - should return 400 when installmentCount is negative', async () => {
    const response = await request(app.getHttpServer())
      .post('/accounts-receivable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validPayload, installmentCount: -2 })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });
});
