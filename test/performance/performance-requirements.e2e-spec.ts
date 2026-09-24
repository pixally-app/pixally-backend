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

const OCR_SIMULATED_DELAY_MS = 3_000;
const AI_SIMULATED_DELAY_MS = 8_000;
const MAX_PROCESSING_TIME_MS = 60_000;
const MAX_UPLOAD_RESPONSE_TIME_MS = 1_000;

const buildPixId = () => 'E' + faker.string.alphanumeric(31);

const buildMockOcrText = (pixId: string) =>
  `Comprovante de transferência PIX\nValor: R$ 150,00\nData: 01/01/2025, 10:30:00\n${pixId}`;

const buildMockAiData = (pixId: string) => ({
  id_transferencia: pixId,
  data_hora: '2025-01-01T10:30:00',
  valor: 'R$ 150,00',
  descricao: '',
  origem_nome: 'João Silva',
  origem_documento: '123.456.789-00',
  origem_tipo_documento: 'CPF',
  origem_instituicao_bancaria: 'Banco do Brasil',
  origem_agencia: '0001',
  origem_conta: '12345-6',
  destino_nome: 'Maria Souza',
  destino_documento: '987.654.321-00',
  destino_tipo_documento: 'CPF',
  destino_instituicao_bancaria: 'Nubank',
  destino_agencia: '',
  destino_conta: '',
  destino_tipo_conta: '',
  destino_chave_pix: 'maria@email.com',
});

const buildMockReceipt = (userId: string, overrides = {}) => ({
  id: faker.string.uuid(),
  userId,
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

const buildTxMock = () => ({
  pixReceipt: { update: jest.fn<any>().mockResolvedValue({}) },
  warning: { createMany: jest.fn<any>().mockResolvedValue({}) },
  installment: { update: jest.fn<any>().mockResolvedValue({}), updateMany: jest.fn<any>().mockResolvedValue({}) },
  accountReceivable: { update: jest.fn<any>().mockResolvedValue({}) },
});

describe('Performance Requirements', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let mockUserId: string;
  let prismaService: any;

  const fileBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

  beforeAll(async () => {
    mockUserId = faker.string.uuid();

    const mockOcrService = {
      extractText: jest.fn<any>().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, OCR_SIMULATED_DELAY_MS));
        return buildMockOcrText(buildPixId());
      }),
      pdfToJpeg: jest.fn<any>(),
    };

    const mockOpenAiService = {
      analyzeReceipt: jest.fn<any>().mockImplementation(async (_imageUrl: string, ocrText: string) => {
        await new Promise((r) => setTimeout(r, AI_SIMULATED_DELAY_MS));
        const match = ocrText.match(/E[A-Za-z0-9]{31}/);
        const pixId = match ? match[0] : buildPixId();
        return buildMockAiData(pixId);
      }),
    };

    prismaService = {
      user: { findUnique: jest.fn<any>().mockResolvedValue({ isActive: true }) },
      pixReceipt: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        create: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        findFirst: jest.fn<any>().mockResolvedValue(null),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      pixReceiptBlob: {
        create: jest.fn<any>().mockResolvedValue({}),
        updateMany: jest.fn<any>().mockResolvedValue({}),
      },
      phoneClient: { findFirst: jest.fn<any>().mockResolvedValue(null) },
      accountReceivable: { findMany: jest.fn<any>().mockResolvedValue([]) },
      warning: { create: jest.fn<any>().mockResolvedValue({}) },
      $transaction: jest.fn<any>().mockImplementation(async (fn: any) => fn(buildTxMock())),
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [PixReceiptsController],
      providers: [
        PixReceiptsService,
        QueueService,
        {
          provide: StorageService,
          useValue: {
            upload: jest.fn<any>().mockResolvedValue({ path: 'receipts/test.jpg', url: 'https://cdn.example.com/test.jpg' }),
            delete: jest.fn(),
          },
        },
        { provide: OcrService, useValue: mockOcrService },
        { provide: OpenAiService, useValue: mockOpenAiService },
      ],
      prismaService,
    }));

    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.pixReceipt.findMany.mockResolvedValue([]);
    prismaService.pixReceipt.findFirst.mockResolvedValue(null);
    prismaService.pixReceiptBlob.create.mockResolvedValue({});
    prismaService.$transaction.mockImplementation(async (fn: any) => fn(buildTxMock()));
  });

  describe('RNF05 — processamento assíncrono', () => {
    it('[RNF05-01] deve retornar resposta com status ANALYSING antes do processamento terminar', async () => {
      const mockReceipt = buildMockReceipt(mockUserId);
      prismaService.pixReceipt.create.mockResolvedValue(mockReceipt);
      prismaService.pixReceipt.findUnique.mockResolvedValue(mockReceipt);

      const start = Date.now();

      const response = await request(app.getHttpServer())
        .post('/receipts/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', fileBuffer, { filename: 'comprovante.jpg', contentType: 'image/jpeg' })
        .expect(201);

      const elapsed = Date.now() - start;

      expect(response.body.status).toBe('ANALYSING');
      // resposta deve chegar antes do OCR terminar (~3s), confirmando que o endpoint não bloqueia
      expect(elapsed).toBeLessThan(MAX_UPLOAD_RESPONSE_TIME_MS);
    });
  });

  describe('RNF03 — tempo de processamento', () => {
    it('[RNF03-01] deve processar um comprovante (OCR + IA) em até 60 segundos', async () => {
      const mockReceipt = buildMockReceipt(mockUserId);
      prismaService.pixReceipt.create.mockResolvedValue(mockReceipt);
      prismaService.pixReceipt.findUnique.mockResolvedValue(mockReceipt);

      let processingCompleted = false;
      prismaService.$transaction.mockImplementationOnce(async (fn: any) => {
        const result = await fn(buildTxMock());
        processingCompleted = true;
        return result;
      });

      const start = Date.now();

      await request(app.getHttpServer())
        .post('/receipts/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', fileBuffer, { filename: 'comprovante.jpg', contentType: 'image/jpeg' })
        .expect(201);

      const deadline = Date.now() + MAX_PROCESSING_TIME_MS;
      while (!processingCompleted && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
      }

      const elapsed = Date.now() - start;

      expect(processingCompleted).toBe(true);
      expect(elapsed).toBeLessThan(MAX_PROCESSING_TIME_MS);
    }, MAX_PROCESSING_TIME_MS + 10_000);
  });

  describe('RNF04 — múltiplos comprovantes simultâneos', () => {
    it('[RNF04-01] deve processar 3 comprovantes simultaneamente sem bloqueio entre eles', async () => {
      const count = 3;
      const mockReceipts = Array.from({ length: count }, () => buildMockReceipt(mockUserId));

      mockReceipts.forEach((r) => {
        prismaService.pixReceipt.create.mockResolvedValueOnce(r);
        prismaService.pixReceipt.findUnique.mockResolvedValueOnce(r);
      });

      let completedCount = 0;
      prismaService.$transaction.mockImplementation(async (fn: any) => {
        const result = await fn(buildTxMock());
        completedCount++;
        return result;
      });

      const start = Date.now();

      await Promise.all(
        Array.from({ length: count }, () =>
          request(app.getHttpServer())
            .post('/receipts/upload')
            .set('Authorization', `Bearer ${accessToken}`)
            .attach('file', fileBuffer, { filename: 'comprovante.jpg', contentType: 'image/jpeg' }),
        ),
      );

      const deadline = Date.now() + MAX_PROCESSING_TIME_MS;
      while (completedCount < count && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
      }

      const elapsed = Date.now() - start;

      expect(completedCount).toBe(count);
      // processamento paralelo (~11s) deve ser significativamente mais rápido que serial (~33s)
      expect(elapsed).toBeLessThan((OCR_SIMULATED_DELAY_MS + AI_SIMULATED_DELAY_MS) * 2);
    }, MAX_PROCESSING_TIME_MS + 10_000);
  });
});