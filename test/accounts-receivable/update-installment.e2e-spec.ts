import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { AccountsReceivableController } from '../../src/accounts-receivable/accounts-receivable.controller.js';
import { AccountsReceivableService } from '../../src/accounts-receivable/accounts-receivable.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('PATCH /accounts-receivable/:id/installments/:installmentId', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    accountReceivable: { findFirst: jest.Mock<any> };
    installment: { update: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();
  const mockAccountId = faker.string.uuid();
  const mockInstallmentId = faker.string.uuid();

  const buildInstallment = (overrides = {}) => ({
    id: mockInstallmentId,
    accountReceivableId: mockAccountId,
    installmentNumber: 1,
    amount: 500,
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
      accountReceivable: { findFirst: jest.fn() },
      installment: { update: jest.fn() },
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

  it('should return 200 when updating installment dueDate', async () => {
    const inst = buildInstallment();
    const updated = buildMockAccount([{ ...inst, dueDate: new Date('2027-03-01') }]);
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount([inst])).mockResolvedValueOnce(updated);
    prismaService.installment.update.mockResolvedValue({ ...inst, dueDate: new Date('2027-03-01') });

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ dueDate: '2027-03-01' })
      .expect(200);

    expect(response.body).toHaveProperty('id', mockAccountId);
  });

  it('should return 200 when updating installment amount and redistributing others', async () => {
    const inst1 = buildInstallment({ id: mockInstallmentId, amount: 500 });
    const inst2 = buildInstallment({ id: faker.string.uuid(), installmentNumber: 2, amount: 500 });
    const inst3 = buildInstallment({ id: faker.string.uuid(), installmentNumber: 3, amount: 500 });
    const updated = buildMockAccount([{ ...inst1, amount: 600 }, { ...inst2, amount: 450 }, { ...inst3, amount: 450 }]);
    prismaService.accountReceivable.findFirst.mockResolvedValueOnce(buildMockAccount([inst1, inst2, inst3])).mockResolvedValueOnce(updated);
    prismaService.installment.update.mockResolvedValue({ ...inst1, amount: 600 });

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 600 })
      .expect(200);

    expect(response.body).toHaveProperty('id', mockAccountId);
  });

  it('should return 400 when installment is already paid', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount([buildInstallment({ paidAt: new Date() })]));

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 300 })
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Cannot edit a paid installment');
  });

  it('should return 400 when amount exceeds remaining balance', async () => {
    const inst1 = buildInstallment({ id: mockInstallmentId, amount: 500 });
    const inst2 = buildInstallment({ id: faker.string.uuid(), installmentNumber: 2, amount: 500 });
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount([inst1, inst2]));

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 2000 })
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Installment amount exceeds the remaining balance');
  });

  it('should return 404 when account does not exist', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 300 })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Account receivable not found');
  });

  it('should return 404 when installment does not belong to the account', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(
      buildMockAccount([buildInstallment({ id: faker.string.uuid() })]),
    );

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 300 })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Installment not found');
  });

  it('should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/installments/${mockInstallmentId}`)
      .expect(401);
  });
});
