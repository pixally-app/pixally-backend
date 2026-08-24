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

describe('GET /receipts/:id', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { findMany: jest.Mock<any>; findFirst: jest.Mock<any> };
  };

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
      pixReceipt: { findMany: jest.fn(), findFirst: jest.fn() },
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

  it('[CT-COMP-003-01] should return 200 with receipt data including blob and warnings', async () => {
    const mockReceipt = buildMockReceipt({
      blob: [{ id: faker.string.uuid(), fileUrl: 'https://cdn.example.com/test.jpg', mimeType: 'image/jpeg' }],
      warnings: [{ id: faker.string.uuid(), type: 'yellow', message: 'Nenhum cliente vinculado', resolved: false }],
    });
    prismaService.pixReceipt.findFirst.mockResolvedValue(mockReceipt);

    const response = await request(app.getHttpServer())
      .get(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', mockReceiptId);
    expect(response.body).toHaveProperty('status', 'RECEIVED');
    expect(response.body.blob).toHaveLength(1);
    expect(response.body.warnings).toHaveLength(1);
  });

  it('[CT-COMP-003-02] should return 404 when receipt does not exist', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/receipts/${mockReceiptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Comprovante não encontrado');
  });

  it('[CT-COMP-003-03] should return 404 when receipt belongs to another user', async () => {
    prismaService.pixReceipt.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/receipts/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Comprovante não encontrado');
  });

  it('[CT-COMP-003-04] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get(`/receipts/${mockReceiptId}`)
      .expect(401);
  });
});
