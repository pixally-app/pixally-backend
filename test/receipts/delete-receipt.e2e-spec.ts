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

describe('DELETE /receipts/:id', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { findMany: jest.Mock<any>; findFirst: jest.Mock<any>; delete: jest.Mock<any> };
    pixReceiptBlob: { deleteMany: jest.Mock<any> };
    warning: { deleteMany: jest.Mock<any> };
    installment: { update: jest.Mock<any>; updateMany: jest.Mock<any>; findMany: jest.Mock<any> };
    accountReceivable: { update: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockStorageService: { upload: jest.Mock<any>; delete: jest.Mock<any> } = { upload: jest.fn(), delete: jest.fn() };

  const mockUserId = faker.string.uuid();
  const mockReceiptId = faker.string.uuid();

  const buildMockReceipt = (overrides = {}) => ({
    id: mockReceiptId,
    userId: mockUserId,
    status: 'RECEIVED',
    origin: 'manual',
    documentFormat: 'image',
    clientId: null,
    accountReceivableId: null,
    installmentId: null,
    depositAmount: null,
    blob: [{ id: faker.string.uuid(), fileUrl: 'https://cdn.example.com/test.jpg', mimeType: 'image/jpeg' }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      pixReceipt: { findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
      pixReceiptBlob: { deleteMany: jest.fn() },
      warning: { deleteMany: jest.fn() },
      installment: { update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
      accountReceivable: { update: jest.fn() },
      $transaction: jest.fn(),
    };

    prismaService.pixReceipt.findMany.mockResolvedValue([]);

    ({ app, jwtService } = await buildTestApp({
      controllers: [PixReceiptsController],
      providers: [
        PixReceiptsService,
        { provide: StorageService, useValue: mockStorageService },
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
    mockStorageService.delete.mockResolvedValue(undefined);
  });

  afterEach(() => { jest.resetAllMocks(); });

  it('[CT-COMP-007-01] should return 204 when deleting an existing receipt', async () => {
    const mockReceipt = buildMockReceipt();
    prismaService.pixReceipt.findFirst.mockResolvedValue(mockReceipt);
    prismaService.pixReceiptBlob.deleteMany.mockResolvedValue({ count: 1 });
    prismaService.warning.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.pixReceipt.delete.mockResolvedValue({ id: mockReceiptId });

    await request(app.getHttpServer())
      .delete(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    expect(mockStorageService.delete).toHaveBeenCalledTimes(1);
    expect(mockStorageService.delete).toHaveBeenCalledWith('https://cdn.example.com/test.jpg');
  });

  it('[CT-COMP-007-02] should return 400 when receipt is in ANALYSING status', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(buildMockReceipt({ status: 'ANALYSING' }));

    const response = await request(app.getHttpServer())
      .delete(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Não é possível deletar um comprovante que ainda está sendo analisado');
  });

  it('[CT-COMP-007-03] should return 404 when receipt does not exist', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .delete(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Comprovante não encontrado');
  });

  it('[CT-COMP-007-04] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .delete(`/receipts/${mockReceiptId}`)
      .expect(401);
  });

  it('[CT-COMP-007-05] should return 204 and restore account installments when receipt was reconciled', async () => {
    const accountId = faker.string.uuid();
    const installmentId = faker.string.uuid();
    const mockReceipt = buildMockReceipt({
      accountReceivableId: accountId,
      installmentId,
      status: 'RECONCILED',
    });
    prismaService.pixReceipt.findFirst.mockResolvedValue(mockReceipt);
    prismaService.installment.update.mockResolvedValue({});
    prismaService.installment.findMany.mockResolvedValue([{ paidAt: null }]);
    prismaService.accountReceivable.update.mockResolvedValue({});
    prismaService.pixReceiptBlob.deleteMany.mockResolvedValue({ count: 1 });
    prismaService.warning.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.pixReceipt.delete.mockResolvedValue({ id: mockReceiptId });

    await request(app.getHttpServer())
      .delete(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    expect(prismaService.installment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: installmentId }, data: { paidAt: null } }),
    );
    expect(prismaService.accountReceivable.update).toHaveBeenCalled();
  });
});
