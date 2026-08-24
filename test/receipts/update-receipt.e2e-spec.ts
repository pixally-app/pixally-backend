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

describe('PATCH /receipts/:id', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { findMany: jest.Mock<any>; findFirst: jest.Mock<any>; update: jest.Mock<any> };
    client: { findFirst: jest.Mock<any> };
  };

  const mockUserId = faker.string.uuid();
  const mockReceiptId = faker.string.uuid();
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
    pixTransactionId: null,
    depositAmount: null,
    depositDateTime: null,
    depositOriginName: null,
    depositOriginDocument: null,
    depositOriginDocumentType: null,
    depositOriginBank: null,
    depositOriginAgency: null,
    depositOriginAccount: null,
    depositDestinationName: null,
    depositDestinationDocument: null,
    depositDestinationDocumentType: null,
    depositDestinationBank: null,
    depositDestinationAgency: null,
    depositDestinationAccount: null,
    description: null,
    processmentOcrOutcome: null,
    jid: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    blob: [],
    warnings: [],
    client: null,
    accountReceivable: null,
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      pixReceipt: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      client: { findFirst: jest.fn() },
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
  });

  afterEach(() => { jest.resetAllMocks(); });

  it('[CT-COMP-004-01] should return 200 when linking a client to the receipt', async () => {
    const updated = buildMockReceipt({ clientId: mockClientId, client: { id: mockClientId, name: 'João Silva' } });
    prismaService.pixReceipt.findFirst.mockResolvedValue(buildMockReceipt());
    prismaService.client.findFirst.mockResolvedValue({ id: mockClientId, name: 'João Silva', userId: mockUserId, deletedAt: null });
    prismaService.pixReceipt.update.mockResolvedValue(updated);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ clientId: mockClientId })
      .expect(200);

    expect(response.body).toHaveProperty('id', mockReceiptId);
    expect(response.body).toHaveProperty('clientId', mockClientId);
  });

  it('[CT-COMP-004-02] should return 200 when updating depositAmount', async () => {
    const updated = buildMockReceipt({ depositAmount: 250.0 });
    prismaService.pixReceipt.findFirst.mockResolvedValue(buildMockReceipt());
    prismaService.pixReceipt.update.mockResolvedValue(updated);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ depositAmount: 250.0 })
      .expect(200);

    expect(response.body).toHaveProperty('depositAmount', 250.0);
  });

  it('[CT-COMP-004-03] should return 400 when receipt is in ANALYSING status', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(buildMockReceipt({ status: 'ANALYSING' }));

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ depositAmount: 100 })
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Não é possível editar um comprovante que ainda está sendo analisado');
  });

  it('[CT-COMP-004-04] should return 400 when trying to change status of a RECONCILED receipt', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(buildMockReceipt({ status: 'RECONCILED' }));

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'RECEIVED' })
      .expect(400);

    expect(response.body).toHaveProperty(
      'message',
      'Use o endpoint de desconciliação antes de alterar o status de um comprovante conciliado',
    );
  });

  it('[CT-COMP-004-05] should return 404 when receipt does not exist', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ depositAmount: 100 })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Comprovante não encontrado');
  });

  it('[CT-COMP-004-06] should return 404 when client does not exist', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(buildMockReceipt());
    prismaService.client.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ clientId: faker.string.uuid() })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Cliente não encontrado');
  });

  it('[CT-COMP-004-07] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/receipts/${mockReceiptId}`)
      .send({ depositAmount: 100 })
      .expect(401);
  });
});
