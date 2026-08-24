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

describe('POST /receipts/upload', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { findMany: jest.Mock<any>; create: jest.Mock<any> };
    pixReceiptBlob: { create: jest.Mock<any> };
  };

  const mockStorageService = { upload: jest.fn<any>(), delete: jest.fn() };
  const mockQueueService = { enqueue: jest.fn() };

  const mockUserId = faker.string.uuid();

  const buildMockReceipt = (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: mockUserId,
    status: 'ANALYSING',
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
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      pixReceipt: { findMany: jest.fn(), create: jest.fn() },
      pixReceiptBlob: { create: jest.fn() },
    };
    prismaService.pixReceipt.findMany.mockResolvedValue([]);

    ({ app, jwtService } = await buildTestApp({
      controllers: [PixReceiptsController],
      providers: [
        PixReceiptsService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: OcrService, useValue: {} },
        { provide: OpenAiService, useValue: {} },
        { provide: QueueService, useValue: mockQueueService },
      ],
      prismaService,
    }));

    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    mockStorageService.upload.mockResolvedValue({ path: 'receipts/test.jpg', url: 'https://cdn.example.com/test.jpg' });
    mockQueueService.enqueue.mockImplementation(() => {});
  });

  afterEach(() => { jest.resetAllMocks(); });

  it('[CT-COMP-001-01] should return 201 with status ANALYSING on valid image upload', async () => {
    const mockReceipt = buildMockReceipt();
    prismaService.pixReceipt.create.mockResolvedValue(mockReceipt);
    prismaService.pixReceiptBlob.create.mockResolvedValue({});

    const fileBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    const response = await request(app.getHttpServer())
      .post('/receipts/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', fileBuffer, { filename: 'comprovante.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(response.body).toHaveProperty('status', 'ANALYSING');
    expect(response.body).toHaveProperty('origin', 'manual');
    expect(mockStorageService.upload).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueue).toHaveBeenCalledTimes(1);
  });

  it('[CT-COMP-001-02] should return 201 with status ANALYSING on valid PDF upload', async () => {
    const mockReceipt = buildMockReceipt({ documentFormat: 'pdf' });
    prismaService.pixReceipt.create.mockResolvedValue(mockReceipt);
    prismaService.pixReceiptBlob.create.mockResolvedValue({});

    const pdfBuffer = Buffer.from('%PDF-1.4 test');

    const response = await request(app.getHttpServer())
      .post('/receipts/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', pdfBuffer, { filename: 'comprovante.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(response.body).toHaveProperty('status', 'ANALYSING');
    expect(response.body).toHaveProperty('documentFormat', 'pdf');
  });

  it('[CT-COMP-001-03] should return 400 when no file is sent', async () => {
    const response = await request(app.getHttpServer())
      .post('/receipts/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Arquivo não enviado');
  });

  it('[CT-COMP-001-04] should return 413 when file exceeds 5MB limit', async () => {
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024);

    await request(app.getHttpServer())
      .post('/receipts/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' })
      .expect(413);
  });

  it('[CT-COMP-001-05] should return 401 when no JWT token is provided', async () => {
    const fileBuffer = Buffer.from([0xff, 0xd8, 0xff]);

    await request(app.getHttpServer())
      .post('/receipts/upload')
      .attach('file', fileBuffer, { filename: 'comprovante.jpg', contentType: 'image/jpeg' })
      .expect(401);
  });
});
