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

describe('GET /receipts/export/csv', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { findMany: jest.Mock<any> };
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
    depositAmount: 150.0,
    depositDateTime: new Date('2025-06-01T10:00:00Z'),
    depositOriginName: 'João Silva',
    depositOriginDocument: '123.456.789-00',
    depositOriginBank: 'Nubank',
    depositDestinationName: 'Maria Santos',
    description: null,
    pixTransactionId: 'E' + '1'.repeat(31),
    client: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      pixReceipt: { findMany: jest.fn() },
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
    prismaService.pixReceipt.findMany.mockResolvedValue([]);
  });

  afterEach(() => { jest.resetAllMocks(); });

  it('[CT-COMP-008-01] should return 200 with text/csv content-type and one data row per receipt', async () => {
    const receipts = [buildMockReceipt(), buildMockReceipt()];
    prismaService.pixReceipt.findMany.mockResolvedValue(receipts);

    const response = await request(app.getHttpServer())
      .get('/receipts/export/csv')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/csv/);
    const lines = response.text.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(3); // 1 cabeçalho + 2 linhas de dados
  });

  it('[CT-COMP-008-02] should return Content-Disposition attachment header with correct filename', async () => {
    const response = await request(app.getHttpServer())
      .get('/receipts/export/csv')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('comprovantes.csv');
  });

  it('[CT-COMP-008-03] should return only the header row when there are no receipts', async () => {
    const response = await request(app.getHttpServer())
      .get('/receipts/export/csv')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const lines = response.text.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      '"Data/Hora","Valor","Status","Nome Remetente","CPF/CNPJ Remetente","Banco Remetente","Nome Destinatário","Descrição","Cliente","ID Transação PIX"',
    );
  });

  it('[CT-COMP-008-04] should apply status filter', async () => {
    await request(app.getHttpServer())
      .get('/receipts/export/csv?status=RED_FLAG')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(prismaService.pixReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'RED_FLAG' }),
      }),
    );
  });

  it('[CT-COMP-008-05] should apply origin filter', async () => {
    await request(app.getHttpServer())
      .get('/receipts/export/csv?origin=whatsapp')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(prismaService.pixReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ origin: 'whatsapp' }),
      }),
    );
  });

  it('[CT-COMP-008-06] should apply clientName filter', async () => {
    await request(app.getHttpServer())
      .get('/receipts/export/csv?clientName=João')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(prismaService.pixReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          client: expect.objectContaining({
            name: expect.objectContaining({ contains: 'João' }),
          }),
        }),
      }),
    );
  });

  it('[CT-COMP-008-07] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get('/receipts/export/csv')
      .expect(401);
  });
});
