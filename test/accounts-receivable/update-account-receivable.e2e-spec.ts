import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { AccountsReceivableController } from '../../src/accounts-receivable/accounts-receivable.controller.js';
import { AccountsReceivableService } from '../../src/accounts-receivable/accounts-receivable.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('PATCH /accounts-receivable (CT-CON-003)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    accountReceivable: {
      findFirst: jest.Mock<any>;
      update: jest.Mock<any>;
    };
    installment: {
      updateMany: jest.Mock<any>;
    };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();
  const mockAccountId = faker.string.uuid();

  const buildMockAccount = (overrides: Record<string, any> = {}) => ({
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
    prismaService = {
      user: { findUnique: jest.fn() },
      accountReceivable: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      installment: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((args: any[]) => Promise.all(args)),
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

  it('CT-CON-003-01 - should return 200 when updating totalAmount', async () => {
    const updated = buildMockAccount({ totalAmount: 2000 });
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount()).mockResolvedValueOnce(updated);
    prismaService.accountReceivable.update.mockResolvedValue(updated);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totalAmount: 2000 })
      .expect(200);

    expect(response.body).toHaveProperty('totalAmount', 2000);
  });

  it('CT-CON-003-02 - should return 200 when updating serviceDescription', async () => {
    const updated = buildMockAccount({ serviceDescription: 'Nova descrição' });
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount()).mockResolvedValueOnce(updated);
    prismaService.accountReceivable.update.mockResolvedValue(updated);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ serviceDescription: 'Nova descrição' })
      .expect(200);

    expect(response.body).toHaveProperty('serviceDescription', 'Nova descrição');
  });

  it('CT-CON-003-03 - should return 200 when updating dueDate', async () => {
    const updated = buildMockAccount({ dueDate: new Date('2027-06-01') });
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount()).mockResolvedValueOnce(updated);
    prismaService.accountReceivable.update.mockResolvedValue(updated);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ dueDate: '2027-06-01' })
      .expect(200);

    expect(response.body).toHaveProperty('id', mockAccountId);
  });

  it('CT-CON-003-04 - should return 200 when updating all fields simultaneously', async () => {
    const updated = buildMockAccount({ totalAmount: 3000, serviceDescription: 'Desc atualizada', dueDate: new Date('2027-09-01') });
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount()).mockResolvedValueOnce(updated);
    prismaService.accountReceivable.update.mockResolvedValue(updated);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totalAmount: 3000, serviceDescription: 'Desc atualizada', dueDate: '2027-09-01' })
      .expect(200);

    expect(response.body).toHaveProperty('totalAmount', 3000);
    expect(response.body).toHaveProperty('serviceDescription', 'Desc atualizada');
  });

  it('CT-CON-003-05 - should return 200 when marking account as paid via paidAt', async () => {
    const paidAt = '2027-01-10T10:00:00Z';
    const updated = buildMockAccount({ status: 'PAID', paidAt: new Date(paidAt) });
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount()).mockResolvedValueOnce(updated);
    prismaService.accountReceivable.update.mockResolvedValue(updated);
    prismaService.installment.updateMany.mockResolvedValue({ count: 0 });

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paidAt })
      .expect(200);

    expect(response.body).toHaveProperty('status', 'PAID');
  });

  it('CT-CON-003-06 - should return 400 when totalAmount is negative', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totalAmount: -50 })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('CT-CON-003-07 - should return 400 when dueDate format is invalid', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ dueDate: 'abc' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('CT-CON-003-08 - should return 404 when account does not exist', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ serviceName: 'Novo nome' })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Account receivable not found');
  });

  it('CT-CON-003-09 - should return 404 when account belongs to another user', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ serviceName: 'Novo nome' })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Account receivable not found');
  });

  it('CT-CON-003-10 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .send({ serviceName: 'Novo nome' })
      .expect(401);
  });

  it('CT-CON-003-11 - should return 400 when account is already paid', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount({ status: 'PAID', paidAt: new Date() }));

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ serviceName: 'Novo nome' })
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Cannot update a paid account receivable');
  });

  it('CT-CON-003-12 - should return 400 when account is cancelled', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount({ status: 'CANCELLED' }));

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ serviceName: 'Novo nome' })
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Cannot update a cancelled account receivable');
  });
});
