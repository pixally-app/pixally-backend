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

describe('PATCH /receipts/:id/unreconcile', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { findMany: jest.Mock<any>; findFirst: jest.Mock<any>; update: jest.Mock<any> };
    accountReceivable: { update: jest.Mock<any> };
    installment: { findMany: jest.Mock<any>; update: jest.Mock<any>; updateMany: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();
  const mockReceiptId = faker.string.uuid();
  const mockAccountId = faker.string.uuid();
  const mockInstallmentId = faker.string.uuid();

  const buildMockReceipt = (overrides = {}) => ({
    id: mockReceiptId,
    userId: mockUserId,
    status: 'RECONCILED',
    origin: 'manual',
    documentFormat: 'image',
    clientId: faker.string.uuid(),
    accountReceivableId: mockAccountId,
    installmentId: mockInstallmentId,
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

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      pixReceipt: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      accountReceivable: { update: jest.fn() },
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

  it('[CT-COMP-006-01] should return 200 and unreconcile receipt', async () => {
    const mockReceipt = buildMockReceipt();
    const restoredReceipt = buildMockReceipt({
      status: 'RECEIVED',
      accountReceivableId: null,
      installmentId: null,
    });

    prismaService.pixReceipt.findFirst
      .mockResolvedValueOnce(mockReceipt)
      .mockResolvedValueOnce(restoredReceipt);

    prismaService.installment.update.mockResolvedValue({ id: mockInstallmentId, paidAt: null });
    prismaService.installment.findMany.mockResolvedValue([{ paidAt: null }]);
    prismaService.accountReceivable.update.mockResolvedValue({ id: mockAccountId, status: 'PENDING' });
    prismaService.pixReceipt.update.mockResolvedValue(restoredReceipt);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/unreconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', mockReceiptId);
    expect(response.body).toHaveProperty('status', 'RECEIVED');
    expect(response.body).toHaveProperty('accountReceivableId', null);
  });

  it('[CT-COMP-006-02] should return 400 when receipt has no link to undo', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(
      buildMockReceipt({ clientId: null, accountReceivableId: null, installmentId: null, status: 'RECEIVED' }),
    );

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/unreconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Comprovante não possui vínculo para desfazer');
  });

  it('[CT-COMP-006-03] should return 404 when receipt does not exist', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/unreconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Comprovante não encontrado');
  });

  it('[CT-COMP-006-04] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/unreconcile`)
      .expect(401);
  });

  it('[CT-COMP-006-05] should return 200 and unreconcile when receipt has no installmentId', async () => {
    const mockReceipt = buildMockReceipt({ installmentId: null });
    const restoredReceipt = buildMockReceipt({ status: 'RECEIVED', accountReceivableId: null, installmentId: null });

    prismaService.pixReceipt.findFirst
      .mockResolvedValueOnce(mockReceipt)
      .mockResolvedValueOnce(restoredReceipt);

    prismaService.pixReceipt.findMany.mockResolvedValue([]);
    prismaService.installment.updateMany.mockResolvedValue({ count: 1 });
    prismaService.installment.findMany.mockResolvedValue([{ paidAt: null }]);
    prismaService.accountReceivable.update.mockResolvedValue({});
    prismaService.pixReceipt.update.mockResolvedValue(restoredReceipt);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}/unreconcile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'RECEIVED');
    expect(prismaService.installment.updateMany).toHaveBeenCalled();
  });
});
