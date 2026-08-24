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

describe('GET /receipts', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { findMany: jest.Mock<any>; count: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();

  const buildMockReceipt = (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: mockUserId,
    status: 'RECEIVED',
    origin: 'manual',
    documentFormat: 'image',
    clientId: null,
    accountReceivableId: null,
    installmentId: null,
    depositAmount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    blob: [],
    warnings: [],
    client: null,
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      pixReceipt: { findMany: jest.fn(), count: jest.fn() },
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

  it('[CT-COMP-002-01] should return 200 with paginated list', async () => {
    const receipts = [buildMockReceipt(), buildMockReceipt()];
    prismaService.pixReceipt.findMany.mockResolvedValue(receipts);
    prismaService.pixReceipt.count.mockResolvedValue(2);

    const response = await request(app.getHttpServer())
      .get('/receipts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveLength(2);
    expect(response.body).toHaveProperty('total', 2);
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('limit', 20);
    expect(response.body).toHaveProperty('totalPages', 1);
  });

  it('[CT-COMP-002-02] should return 200 with status filter applied', async () => {
    const receipt = buildMockReceipt({ status: 'RED_FLAG' });
    prismaService.pixReceipt.findMany.mockResolvedValue([receipt]);
    prismaService.pixReceipt.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/receipts?status=RED_FLAG')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toHaveProperty('status', 'RED_FLAG');
  });

  it('[CT-COMP-002-03] should return 200 with clientName filter applied', async () => {
    const receipt = buildMockReceipt({ client: { id: faker.string.uuid(), name: 'João Silva' } });
    prismaService.pixReceipt.findMany.mockResolvedValue([receipt]);
    prismaService.pixReceipt.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/receipts?clientName=João')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
  });

  it('[CT-COMP-002-04] should return 200 with custom page and limit', async () => {
    prismaService.pixReceipt.findMany.mockResolvedValue([]);
    prismaService.pixReceipt.count.mockResolvedValue(50);

    const response = await request(app.getHttpServer())
      .get('/receipts?page=2&limit=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('page', 2);
    expect(response.body).toHaveProperty('limit', 10);
    expect(response.body).toHaveProperty('total', 50);
    expect(response.body).toHaveProperty('totalPages', 5);
  });

  it('[CT-COMP-002-05] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get('/receipts')
      .expect(401);
  });
});
