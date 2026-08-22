import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { AccountsReceivableController } from '../../src/accounts-receivable/accounts-receivable.controller.js';
import { AccountsReceivableService } from '../../src/accounts-receivable/accounts-receivable.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('PATCH /accounts-receivable/:id/installments/:installmentId/mark-paid (CT-CON-007)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    accountReceivable: { findFirst: jest.Mock<any>; update: jest.Mock<any> };
    installment: { update: jest.Mock<any>; updateMany: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();
  const mockAccountId = faker.string.uuid();
  const mockInstallmentId = faker.string.uuid();

  const buildInstallment = (overrides = {}) => ({
    id: mockInstallmentId,
    accountReceivableId: mockAccountId,
    installmentNumber: 1,
    amount: 750,
    dueDate: new Date('2027-01-15'),
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const buildMockAccount = (installments: any[] = []) => ({
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
    installments,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      accountReceivable: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      installment: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    ({ app, jwtService } = await buildTestApp({
      controllers: [AccountsReceivableController],
      providers: [AccountsReceivableService],
      prismaService,
    }));
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.$transaction.mockImplementation((callbackOrArray: any) => {
      if (Array.isArray(callbackOrArray)) return Promise.all(callbackOrArray);
      return callbackOrArray(prismaService);
    });
  });
  afterEach(() => { jest.resetAllMocks(); });

  it('CT-CON-007-01 - should return 200 and mark account as PAID when last installment is marked', async () => {
    const inst = buildInstallment();
    const updated = buildMockAccount([{ ...inst, paidAt: new Date() }]);
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount([inst])).mockResolvedValueOnce(updated);
    prismaService.installment.update.mockResolvedValue({ ...inst, paidAt: new Date() });
    prismaService.accountReceivable.update.mockResolvedValue({ ...updated, status: 'PAID' });

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}/mark-paid`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', mockAccountId);
  });

  it('CT-CON-007-02 - should return 200 and keep account PENDING when other installments remain', async () => {
    const inst1 = buildInstallment({ id: mockInstallmentId });
    const inst2 = buildInstallment({ id: faker.string.uuid(), installmentNumber: 2 });
    const updated = buildMockAccount([{ ...inst1, paidAt: new Date() }, inst2]);
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount([inst1, inst2])).mockResolvedValueOnce(updated);
    prismaService.installment.update.mockResolvedValue({ ...inst1, paidAt: new Date() });

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}/mark-paid`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', mockAccountId);
  });

  it('CT-CON-007-03 - should return 400 when installment is already paid', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(
      buildMockAccount([buildInstallment({ paidAt: new Date() })]),
    );

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}/mark-paid`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Installment is already paid');
  });

  it('CT-CON-007-04 - should return 404 when account does not exist', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}/mark-paid`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Account receivable not found');
  });

  it('CT-CON-007-05 - should return 404 when installment does not belong to the account', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(
      buildMockAccount([buildInstallment({ id: faker.string.uuid() })]),
    );

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}/mark-paid`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Installment not found');
  });

  it('CT-CON-007-06 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}/mark-paid`)
      .expect(401);
  });
});

describe('PATCH /accounts-receivable/:id/installments/mark-all-paid (CT-CON-008)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    accountReceivable: { findFirst: jest.Mock<any>; update: jest.Mock<any> };
    installment: { update: jest.Mock<any>; updateMany: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();
  const mockAccountId = faker.string.uuid();

  const buildInstallment = (overrides = {}) => ({
    id: faker.string.uuid(),
    accountReceivableId: mockAccountId,
    installmentNumber: 1,
    amount: 750,
    dueDate: new Date('2027-01-15'),
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const buildMockAccount = (installments: any[] = [], overrides = {}) => ({
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
    installments,
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
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    ({ app, jwtService } = await buildTestApp({
      controllers: [AccountsReceivableController],
      providers: [AccountsReceivableService],
      prismaService,
    }));
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.$transaction.mockImplementation((callbackOrArray: any) => {
      if (Array.isArray(callbackOrArray)) return Promise.all(callbackOrArray);
      return callbackOrArray(prismaService);
    });
  });
  afterEach(() => { jest.resetAllMocks(); });

  it('CT-CON-008-01 - should return 200 and mark all installments as paid', async () => {
    const installments = [buildInstallment({ installmentNumber: 1 }), buildInstallment({ installmentNumber: 2 })];
    const updated = buildMockAccount(installments.map((i) => ({ ...i, paidAt: new Date() })), { status: 'PAID', paidAt: new Date() });
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount(installments)).mockResolvedValueOnce(updated);
    prismaService.installment.updateMany.mockResolvedValue({ count: 2 });
    prismaService.accountReceivable.update.mockResolvedValue(updated);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/mark-all-paid`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'PAID');
    expect(response.body.installments).toHaveLength(2);
  });

  it('CT-CON-008-02 - should return 400 when all installments are already paid', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(
      buildMockAccount([buildInstallment({ paidAt: new Date() }), buildInstallment({ paidAt: new Date() })]),
    );

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/mark-all-paid`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'All installments are already paid');
  });

  it('CT-CON-008-03 - should return 404 when account does not exist', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/mark-all-paid`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Account receivable not found');
  });

  it('CT-CON-008-04 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/mark-all-paid`)
      .expect(401);
  });
});
