import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { PixReceiptsController } from '../../src/pix-receipts/pix-receipts.controller.js';
import { PixReceiptsService } from '../../src/pix-receipts/pix-receipts.service.js';
import { StorageService } from '../../src/pix-receipts/storage.service.js';
import { OcrService } from '../../src/pix-receipts/ocr.service.js';
import { OpenAiService } from '../../src/pix-receipts/openai.service.js';
import { QueueService } from '../../src/pix-receipts/queue.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('PATCH /receipts/:id/reconcile', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { findMany: jest.Mock<any>; findFirst: jest.Mock<any>; update: jest.Mock<any> };
    accountReceivable: { findFirst: jest.Mock<any>; update: jest.Mock<any> };
    installment: { findMany: jest.Mock<any>; update: jest.Mock<any>; updateMany: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();
  const mockReceiptId = faker.string.uuid();
  const mockAccountId = faker.string.uuid();
  const mockClientId = faker.string.uuid();

  const buildMockReceipt = (overrides = {}) => ({
    id: mockReceiptId,
    userId: mockUserId,
    status: 'RECEIVED',
    origin: 'manual',
    documentFormat: 'image',
    clientId: null,
    accountReceivableId: null,
    installmentId: null,
    depositAmount: 500,
    depositDateTime: null,
    blob: [],
    warnings: [],
    client: null,
    accountReceivable: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const buildMockAccount = (overrides = {}) => ({
    id: mockAccountId,
    userId: mockUserId,
    clientId: mockClientId,
    clientName: 'João Silva',
    serviceName: 'Serviço Teste',
    totalAmount: 500,
    status: 'PENDING',
    dueDate: new Date('2027-01-15'),
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
      pixReceipt: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      accountReceivable: { findFirst: jest.fn(), update: jest.fn() },
      installment: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    prismaService.pixReceipt.findMany.mockResolvedValue([]);

    ({ app, jwtService } = await buildTestApp({
      controllers: [PixReceiptsController],
      providers: [
        PixReceiptsService,
        { provide: StorageService, useValue: {} },
        { provide: OcrService, useValue: {} },
        { provide: OpenAiService, useValue: {} },
        { provide: QueueService, useValue: { enqueue: jest.fn() } },
      ],
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

  it('[CT-COMP-005-01] should return 200 and reconcile receipt with account receivable', async () => {
    const mockReceipt = buildMockReceipt();
    const mockAccount = buildMockAccount();
    const updatedReceipt = buildMockReceipt({ status: 'RECONCILED', accountReceivableId: mockAccountId, clientId: mockClientId });

    prismaService.pixReceipt.findFirst
      .mockResolvedValueOnce(mockReceipt)
      .mockResolvedValueOnce(updatedReceipt);

    prismaService.accountReceivable.findFirst.mockResolvedValue(mockAccount);

    prismaService.installment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    prismaService.installment.updateMany.mockResolvedValue({ count: 0 });
    prismaService.accountReceivable.update.mockResolvedValue({ ...mockAccount, status: 'PAID' });
    prismaService.pixReceipt.update.mockResolvedValue(updatedReceipt);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/reconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountReceivableId: mockAccountId })
      .expect(200);

    expect(response.body).toHaveProperty('id', mockReceiptId);
    expect(response.body).toHaveProperty('status', 'RECONCILED');
    expect(response.body).toHaveProperty('accountReceivableId', mockAccountId);
  });

  it('[CT-COMP-005-02] should return 404 when receipt does not exist', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/reconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountReceivableId: mockAccountId })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Comprovante não encontrado');
  });

  it('[CT-COMP-005-03] should return 404 when account receivable does not exist', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(buildMockReceipt());
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/reconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountReceivableId: faker.string.uuid() })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Conta a receber não encontrada');
  });

  it('[CT-COMP-005-04] should return 400 when account receivable is CANCELLED', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(buildMockReceipt());
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount({ status: 'CANCELLED' }));

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/reconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountReceivableId: mockAccountId })
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Não é possível conciliar com uma conta cancelada');
  });

  it('[CT-COMP-005-05] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/reconcile`)
      .send({ accountReceivableId: mockAccountId })
      .expect(401);
  });

  it('[CT-COMP-005-06] should return 200 and unlink previous account before linking new one', async () => {
    const prevAccountId = faker.string.uuid();
    const prevInstallmentId = faker.string.uuid();
    const mockReceipt = buildMockReceipt({
      accountReceivableId: prevAccountId,
      installmentId: prevInstallmentId,
    });
    const updatedReceipt = buildMockReceipt({ status: 'RECONCILED', accountReceivableId: mockAccountId });

    prismaService.pixReceipt.findFirst
      .mockResolvedValueOnce(mockReceipt)
      .mockResolvedValueOnce(updatedReceipt);

    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount());

    prismaService.installment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    prismaService.installment.update.mockResolvedValue({});
    prismaService.installment.updateMany.mockResolvedValue({ count: 0 });
    prismaService.accountReceivable.update.mockResolvedValue({});
    prismaService.pixReceipt.update.mockResolvedValue(updatedReceipt);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/reconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountReceivableId: mockAccountId })
      .expect(200);

    expect(response.body).toHaveProperty('status', 'RECONCILED');
    expect(prismaService.installment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: prevInstallmentId }, data: { paidAt: null } }),
    );
  });

  it('[CT-COMP-005-07] should return 200 and link to matching installment when amount is partial', async () => {
    const installmentId = faker.string.uuid();
    const mockReceipt = buildMockReceipt({ depositAmount: 250 });
    const mockAccount = buildMockAccount({ totalAmount: 500 });
    const installment = { id: installmentId, amount: 250, paidAt: null, installmentNumber: 1 };
    const updatedReceipt = buildMockReceipt({ status: 'RECONCILED', accountReceivableId: mockAccountId, installmentId });

    prismaService.pixReceipt.findFirst
      .mockResolvedValueOnce(mockReceipt)
      .mockResolvedValueOnce(updatedReceipt);

    prismaService.accountReceivable.findFirst.mockResolvedValue(mockAccount);

    prismaService.installment.findMany
      .mockResolvedValueOnce([installment])
      .mockResolvedValueOnce([{ ...installment, paidAt: new Date() }]);

    prismaService.installment.update.mockResolvedValue({});
    prismaService.accountReceivable.update.mockResolvedValue({});
    prismaService.pixReceipt.update.mockResolvedValue(updatedReceipt);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/reconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ accountReceivableId: mockAccountId })
      .expect(200);

    expect(response.body).toHaveProperty('status', 'RECONCILED');
    expect(prismaService.installment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: installmentId }, data: { paidAt: expect.any(Date) } }),
    );
  });
});
