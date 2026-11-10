import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PixReceiptsService } from './pix-receipts.service.js';

const VALID_PIX_ID = 'E' + '1'.repeat(31);
const VALID_OCR_TEXT = `${VALID_PIX_ID}\nR$ 100,00\n10/01/2025, 14:30:00`;

const buildGptData = (overrides: Record<string, string> = {}) => ({
  id_transferencia: VALID_PIX_ID,
  valor: 'R$ 100,00',
  data_hora: '2025-01-10T14:30:00',
  descricao: '',
  origem_nome: 'João Silva',
  origem_documento: '123.456.789-00',
  origem_tipo_documento: 'CPF',
  origem_instituicao_bancaria: 'Nubank',
  origem_agencia: '',
  origem_conta: '',
  destino_nome: 'Maria Santos',
  destino_documento: '',
  destino_tipo_documento: '',
  destino_instituicao_bancaria: 'Itaú',
  destino_agencia: '',
  destino_conta: '',
  destino_tipo_conta: '',
  destino_chave_pix: '',
  ...overrides,
});

const buildReceipt = (overrides: Record<string, any> = {}) => ({
  id: 'receipt-1',
  userId: 'user-1',
  clientId: 'client-1',
  accountReceivableId: null,
  installmentId: null,
  status: 'ANALYSING',
  origin: 'manual',
  jid: null,
  pixTransactionId: null,
  depositAmount: null,
  depositDateTime: null,
  processmentOcrOutcome: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('PixReceiptsService', () => {
  let service: PixReceiptsService;

  const f = () => jest.fn<any>();

  const mockPrisma = {
    pixReceipt: {
      findMany: f(),
      findUnique: f(),
      findFirst: f(),
      create: f(),
      update: f(),
      count: f(),
      delete: f(),
    },
    pixReceiptBlob: { create: f(), updateMany: f(), deleteMany: f() },
    warning: { create: f(), createMany: f(), deleteMany: f() },
    installment: { findMany: f(), update: f(), updateMany: f() },
    accountReceivable: { findMany: f(), findFirst: f(), update: f() },
    client: { findFirst: f() },
    phoneClient: { findFirst: f() },
    $transaction: jest.fn(),
  };

  const mockStorage = { upload: f(), delete: f() };
  const mockOcr = { extractText: f(), pdfToJpeg: f() };
  const mockOpenai = { analyzeReceipt: f() };
  const mockQueue = { enqueue: jest.fn() };

  beforeAll(() => {
    service = new PixReceiptsService(
      mockPrisma as any,
      mockStorage as any,
      mockOcr as any,
      mockOpenai as any,
      mockQueue as any,
    );
  });

  beforeEach(() => {
    mockPrisma.$transaction.mockImplementation((callbackOrArray: any) => {
      if (Array.isArray(callbackOrArray)) return Promise.all(callbackOrArray);
      return callbackOrArray(mockPrisma);
    });
  });

  afterEach(() => { jest.resetAllMocks(); });

  describe('onApplicationBootstrap', () => {
    it('should do nothing when there are no stuck receipts', async () => {
      mockPrisma.pixReceipt.findMany.mockResolvedValue([]);

      await service.onApplicationBootstrap();

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should re-enqueue stuck ANALYSING receipts that have a blob', async () => {
      const stuck = [
        { id: 'r1', blob: [{ fileUrl: 'https://cdn/r1.jpg', mimeType: 'image/jpeg' }] },
        { id: 'r2', blob: [] },
      ];
      mockPrisma.pixReceipt.findMany.mockResolvedValue(stuck);

      await service.onApplicationBootstrap();

      expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('upload', () => {
    it('should create receipt with ANALYSING status and enqueue processing', async () => {
      const mockFile = { buffer: Buffer.from('img'), mimetype: 'image/jpeg' } as any;
      mockStorage.upload.mockResolvedValue({ path: 'receipts/x.jpg', url: 'https://cdn/x.jpg' });
      mockPrisma.pixReceipt.create.mockResolvedValue(buildReceipt());
      mockPrisma.pixReceiptBlob.create.mockResolvedValue({});

      const result = await service.upload('user-1', mockFile);

      expect(result).toMatchObject({ status: 'ANALYSING', origin: 'manual' });
      expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(service.upload('user-1', undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('processFromWebhook', () => {
    it('should set status to ANALYSING and enqueue processing job', async () => {
      mockPrisma.pixReceipt.update.mockResolvedValue({});

      await service.processFromWebhook('receipt-1', 'https://cdn/img.jpg', 'image/jpeg');

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith({
        where: { id: 'receipt-1' },
        data: { status: 'ANALYSING' },
      });
      expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('processReceipt', () => {
    it('should abort without error when receipt is not found', async () => {
      mockPrisma.pixReceipt.findUnique.mockResolvedValue(null);

      await service['processReceipt']('ghost-id', 'https://cdn/img.jpg', 'image/jpeg');

      expect(mockPrisma.pixReceipt.update).not.toHaveBeenCalled();
    });

    it('should convert PDF to JPEG before processing', async () => {
      const receipt = buildReceipt();
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff]);
      mockPrisma.pixReceipt.findUnique.mockResolvedValue(receipt);
      mockOcr.pdfToJpeg.mockResolvedValue(jpegBuffer);
      mockStorage.upload.mockResolvedValue({ path: 'receipts/x.jpg', url: 'https://cdn/x.jpg' });
      mockStorage.delete.mockResolvedValue(undefined);
      mockPrisma.pixReceiptBlob.updateMany.mockResolvedValue({});
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData());
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);
      mockPrisma.phoneClient.findFirst.mockResolvedValue(null);
      mockPrisma.accountReceivable.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.update.mockResolvedValue({});
      mockPrisma.warning.createMany.mockResolvedValue({});

      await service['processReceipt']('receipt-1', 'https://cdn/file.pdf', 'application/pdf');

      expect(mockOcr.pdfToJpeg).toHaveBeenCalledWith('https://cdn/file.pdf');
      expect(mockStorage.upload).toHaveBeenCalledWith(jpegBuffer, 'image/jpeg');
      expect(mockStorage.delete).toHaveBeenCalledWith('https://cdn/file.pdf');
    });

    it('should mark receipt as ERROR and create warning after all retries fail', async () => {
      jest.useFakeTimers();
      try {
        const receipt = buildReceipt();
        mockPrisma.pixReceipt.findUnique.mockResolvedValue(receipt);
        mockOcr.extractText.mockResolvedValue('');
        mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData());
        mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);
        mockPrisma.phoneClient.findFirst.mockResolvedValue(null);
        mockPrisma.accountReceivable.findMany.mockResolvedValue([]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockPrisma.$transaction as any).mockRejectedValue(new Error('DB failure'));
        mockPrisma.pixReceipt.update.mockResolvedValue({});
        mockPrisma.warning.create.mockResolvedValue({});

        const promise = service['processReceipt']('receipt-1', 'https://cdn/img.jpg', 'image/jpeg');
        await jest.advanceTimersByTimeAsync(120_000);
        await promise;

        expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { status: 'ERROR' } }),
        );
        expect(mockPrisma.warning.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ type: 'red', message: 'Falha ao processar o comprovante' }),
          }),
        );
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('runProcessing', () => {
    const setupBasicMocks = () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);
      mockPrisma.phoneClient.findFirst.mockResolvedValue(null);
      mockPrisma.accountReceivable.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.update.mockResolvedValue({});
      mockPrisma.warning.createMany.mockResolvedValue({});
    };

    it('should process receipt and set RECEIVED when all data is valid', async () => {
      const receipt = buildReceipt();
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData());
      setupBasicMocks();

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'RECEIVED' }) }),
      );
    });

    it('should set RED_FLAG when duplicate PIX transaction ID is found', async () => {
      const receipt = buildReceipt();
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData());
      mockPrisma.pixReceipt.findFirst
        .mockResolvedValueOnce({ id: 'duplicate-receipt' })
        .mockResolvedValueOnce(null);
      mockPrisma.phoneClient.findFirst.mockResolvedValue(null);
      mockPrisma.accountReceivable.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.update.mockResolvedValue({});
      mockPrisma.warning.createMany.mockResolvedValue({});

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'RED_FLAG' }) }),
      );
      expect(mockPrisma.warning.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: 'red', message: expect.stringContaining('duplicado') }),
          ]),
        }),
      );
    });

    it('should fallback to OCR and set YELLOW_FLAG when GPT throws', async () => {
      const receipt = buildReceipt({ clientId: 'client-1' });
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockRejectedValue(new Error('OpenAI down'));
      setupBasicMocks();

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.warning.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: 'yellow', message: expect.stringContaining('IA indisponível') }),
          ]),
        }),
      );
    });

    it('should fallback to OCR and set YELLOW_FLAG when GPT returns error field', async () => {
      const receipt = buildReceipt({ clientId: 'client-1' });
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue({ ...buildGptData(), error: 'não é comprovante PIX' });
      setupBasicMocks();

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.warning.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: 'yellow', message: expect.stringContaining('IA indisponível') }),
          ]),
        }),
      );
    });

    it('should set YELLOW_FLAG when no client is linked', async () => {
      const receipt = buildReceipt({ clientId: null, jid: null });
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData());
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);
      mockPrisma.accountReceivable.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.update.mockResolvedValue({});
      mockPrisma.warning.createMany.mockResolvedValue({});

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.warning.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: 'yellow', message: 'Nenhum cliente vinculado a este comprovante' }),
          ]),
        }),
      );
    });

    it('should resolve client from JID phone number when clientId is not set', async () => {
      const receipt = buildReceipt({ clientId: null, jid: '5511999999999@s.whatsapp.net' });
      const foundClientId = 'found-client-id';
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData());
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);
      mockPrisma.phoneClient.findFirst.mockResolvedValue({ clientId: foundClientId });
      mockPrisma.accountReceivable.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.update.mockResolvedValue({});
      mockPrisma.warning.createMany.mockResolvedValue({});

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clientId: foundClientId, status: 'RECEIVED' }),
        }),
      );
    });

    it('should auto-reconcile and set RECONCILED when a single matching account is found', async () => {
      const receipt = buildReceipt({ clientId: 'client-1' });
      const matchingAccount = {
        id: 'account-1',
        clientId: 'client-1',
        totalAmount: 100,
        status: 'PENDING',
        installments: [],
      };
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData({ valor: 'R$ 100,00' }));
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);
      mockPrisma.phoneClient.findFirst.mockResolvedValue(null);
      mockPrisma.accountReceivable.findMany.mockResolvedValue([matchingAccount]);
      mockPrisma.installment.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.accountReceivable.update.mockResolvedValue({});
      mockPrisma.pixReceipt.update.mockResolvedValue({});

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RECONCILED', accountReceivableId: 'account-1' }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated receipts', async () => {
      const receipts = [buildReceipt(), buildReceipt({ id: 'receipt-2' })];
      mockPrisma.pixReceipt.findMany.mockResolvedValue(receipts);
      mockPrisma.pixReceipt.count.mockResolvedValue(2);

      const result = await service.findAll('user-1');

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
    });

    it('should clamp page to 1 and limit to 100', async () => {
      mockPrisma.pixReceipt.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.count.mockResolvedValue(0);

      const result = await service.findAll('user-1', 0, 200);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);
    });
  });

  describe('findOne', () => {
    it('should return receipt with all includes', async () => {
      const receipt = { ...buildReceipt(), blob: [], warnings: [], client: null, accountReceivable: null };
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(receipt);

      const result = await service.findOne('user-1', 'receipt-1');

      expect(result).toHaveProperty('id', 'receipt-1');
    });

    it('should throw NotFoundException when receipt is not found', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when receipt does not exist', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);

      await expect(service.update('user-1', 'ghost-id', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is ANALYSING', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(buildReceipt({ status: 'ANALYSING' }));

      await expect(service.update('user-1', 'receipt-1', { depositAmount: 100 })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to change status of RECONCILED receipt', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(buildReceipt({ status: 'RECONCILED' }));

      await expect(service.update('user-1', 'receipt-1', { status: 'RECEIVED' as any })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when client does not exist', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(buildReceipt({ status: 'RECEIVED' }));
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(service.update('user-1', 'receipt-1', { clientId: 'bad-client' })).rejects.toThrow(NotFoundException);
    });

    it('should update and return receipt', async () => {
      const receipt = buildReceipt({ status: 'RECEIVED' });
      const updated = { ...receipt, depositAmount: 250, blob: [], warnings: [], client: null, accountReceivable: null };
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(receipt);
      mockPrisma.pixReceipt.update.mockResolvedValue(updated);

      const result = await service.update('user-1', 'receipt-1', { depositAmount: 250 });

      expect(result).toHaveProperty('depositAmount', 250);
    });
  });

  describe('runProcessing — uncovered branches', () => {
    const OCR_NO_PIX_ID = 'R$ 100,00\n10/01/2025, 14:30:00';
    const OCR_OTHER_PIX_ID = `E${'9'.repeat(31)}\nR$ 100,00\n10/01/2025, 14:30:00`;

    const setupBasicMocks = () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);
      mockPrisma.phoneClient.findFirst.mockResolvedValue(null);
      mockPrisma.accountReceivable.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.update.mockResolvedValue({});
      mockPrisma.warning.createMany.mockResolvedValue({});
    };

    it('should use OCR pix ID and warn when it diverges from GPT', async () => {
      const receipt = buildReceipt();
      mockOcr.extractText.mockResolvedValue(OCR_OTHER_PIX_ID);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData());
      setupBasicMocks();

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pixTransactionId: 'E' + '9'.repeat(31) }),
        }),
      );
    });

    it('should use OCR pix ID when GPT pix ID is invalid', async () => {
      const receipt = buildReceipt();
      mockOcr.extractText.mockResolvedValue(OCR_OTHER_PIX_ID);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData({ id_transferencia: 'invalido' }));
      setupBasicMocks();

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pixTransactionId: 'E' + '9'.repeat(31) }),
        }),
      );
    });

    it('should add invalid pix ID warning when neither GPT nor OCR have a valid pix ID', async () => {
      const receipt = buildReceipt();
      mockOcr.extractText.mockResolvedValue(OCR_NO_PIX_ID);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData({ id_transferencia: 'invalido' }));
      setupBasicMocks();

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.warning.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ message: expect.stringContaining('ID da transação PIX inválido') }),
          ]),
        }),
      );
    });

    it('should add conflicting datetime warning when another receipt has the same date and time', async () => {
      const receipt = buildReceipt();
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData());
      mockPrisma.pixReceipt.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'conflict-receipt' });
      mockPrisma.phoneClient.findFirst.mockResolvedValue(null);
      mockPrisma.accountReceivable.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.update.mockResolvedValue({});
      mockPrisma.warning.createMany.mockResolvedValue({});

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.warning.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ message: expect.stringContaining('Data e hora conflitam') }),
          ]),
        }),
      );
    });

    it('should use OCR amount and warn when GPT amount diverges', async () => {
      const receipt = buildReceipt({ clientId: 'client-1' });
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData({ valor: 'R$ 200,00' }));
      setupBasicMocks();

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ depositAmount: 100 }),
        }),
      );
    });

    it('should use OCR amount when GPT returns no amount', async () => {
      const receipt = buildReceipt({ clientId: 'client-1' });
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData({ valor: '' }));
      setupBasicMocks();

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ depositAmount: 100 }),
        }),
      );
    });

    it('should update single installment when reconciliation matches by installment amount', async () => {
      const receipt = buildReceipt({ clientId: 'client-1' });
      const account = {
        id: 'account-1',
        totalAmount: 500,
        status: 'PENDING',
        installments: [{ id: 'inst-1', amount: 100, paidAt: null }],
      };
      mockOcr.extractText.mockResolvedValue(VALID_OCR_TEXT);
      mockOpenai.analyzeReceipt.mockResolvedValue(buildGptData({ valor: 'R$ 100,00' }));
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);
      mockPrisma.phoneClient.findFirst.mockResolvedValue(null);
      mockPrisma.accountReceivable.findMany.mockResolvedValue([account]);
      mockPrisma.installment.update.mockResolvedValue({});
      mockPrisma.installment.findMany.mockResolvedValue([{ paidAt: new Date() }]);
      mockPrisma.accountReceivable.update.mockResolvedValue({});
      mockPrisma.pixReceipt.update.mockResolvedValue({});

      await service['runProcessing']('receipt-1', 'https://cdn/img.jpg', receipt as any);

      expect(mockPrisma.installment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paidAt: expect.any(Date) } }),
      );
    });

    it('should return paginated receipts filtered by clientName', async () => {
      mockPrisma.pixReceipt.findMany.mockResolvedValue([]);
      mockPrisma.pixReceipt.count.mockResolvedValue(0);

      await service.findAll('user-1', 1, 10, { clientName: 'João' });

      expect(mockPrisma.pixReceipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            client: expect.objectContaining({ name: expect.objectContaining({ contains: 'João' }) }),
          }),
        }),
      );
    });
  });

  describe('reconcile', () => {
    it('should throw NotFoundException when receipt is not found', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);

      await expect(service.reconcile('user-1', 'ghost-id', 'account-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when account is not found', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(buildReceipt());
      mockPrisma.accountReceivable.findFirst.mockResolvedValue(null);

      await expect(service.reconcile('user-1', 'receipt-1', 'ghost-account')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when account is CANCELLED', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(buildReceipt());
      mockPrisma.accountReceivable.findFirst.mockResolvedValue({ id: 'account-1', status: 'CANCELLED', totalAmount: 100 });

      await expect(service.reconcile('user-1', 'receipt-1', 'account-1')).rejects.toThrow(BadRequestException);
    });

    it('should reconcile receipt covering full account amount', async () => {
      const receipt = buildReceipt({ depositAmount: 100 });
      const account = { id: 'account-1', status: 'PENDING', totalAmount: 100 };
      mockPrisma.pixReceipt.findFirst
        .mockResolvedValueOnce(receipt)
        .mockResolvedValue({});
      mockPrisma.accountReceivable.findFirst.mockResolvedValue(account);
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.installment.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.accountReceivable.update.mockResolvedValue({});
      mockPrisma.pixReceipt.update.mockResolvedValue({});

      await service.reconcile('user-1', 'receipt-1', 'account-1');

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RECONCILED', accountReceivableId: 'account-1' }),
        }),
      );
    });

    it('should reconcile by matching a specific installment when amount is partial', async () => {
      const receipt = buildReceipt({ depositAmount: 100 });
      const account = { id: 'account-1', status: 'PENDING', totalAmount: 500 };
      const installment = { id: 'inst-1', amount: 100, paidAt: null };
      mockPrisma.pixReceipt.findFirst
        .mockResolvedValueOnce(receipt)
        .mockResolvedValue({});
      mockPrisma.accountReceivable.findFirst.mockResolvedValue(account);
      mockPrisma.installment.findMany
        .mockResolvedValueOnce([installment])
        .mockResolvedValue([{ paidAt: new Date() }]);
      mockPrisma.installment.update.mockResolvedValue({});
      mockPrisma.accountReceivable.update.mockResolvedValue({});
      mockPrisma.pixReceipt.update.mockResolvedValue({});

      await service.reconcile('user-1', 'receipt-1', 'account-1');

      expect(mockPrisma.installment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inst-1' }, data: { paidAt: expect.any(Date) } }),
      );
    });
  });

  describe('unreconcile', () => {
    it('should throw NotFoundException when receipt is not found', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);

      await expect(service.unreconcile('user-1', 'ghost-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when receipt has no link to undo', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(
        buildReceipt({ clientId: null, accountReceivableId: null, status: 'RECEIVED', warnings: [] }),
      );

      await expect(service.unreconcile('user-1', 'receipt-1')).rejects.toThrow(BadRequestException);
    });

    it('should unreconcile and restore status based on warnings', async () => {
      const receipt = {
        ...buildReceipt({ status: 'RECONCILED', accountReceivableId: 'account-1', installmentId: 'inst-1' }),
        warnings: [],
      };
      mockPrisma.pixReceipt.findFirst
        .mockResolvedValueOnce(receipt)
        .mockResolvedValue({});
      mockPrisma.installment.update.mockResolvedValue({});
      mockPrisma.installment.findMany.mockResolvedValue([{ paidAt: null }]);
      mockPrisma.accountReceivable.update.mockResolvedValue({});
      mockPrisma.pixReceipt.update.mockResolvedValue({});

      await service.unreconcile('user-1', 'receipt-1');

      expect(mockPrisma.pixReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RECEIVED', accountReceivableId: null }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when receipt is not found', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-1', 'ghost-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when receipt is ANALYSING', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(buildReceipt({ status: 'ANALYSING', blob: [] }));

      await expect(service.remove('user-1', 'receipt-1')).rejects.toThrow(BadRequestException);
    });

    it('should delete receipt and its blobs when not linked to an account', async () => {
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(buildReceipt({ status: 'RECEIVED', blob: [] }));
      mockPrisma.pixReceiptBlob.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.warning.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pixReceipt.delete.mockResolvedValue({});

      await service.remove('user-1', 'receipt-1');

      expect(mockPrisma.pixReceipt.delete).toHaveBeenCalledWith({ where: { id: 'receipt-1' } });
    });

    it('should revert installment and account status when receipt was linked to an account', async () => {
      const receipt = buildReceipt({
        status: 'RECONCILED',
        accountReceivableId: 'account-1',
        installmentId: 'inst-1',
        blob: [],
      });
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(receipt);
      mockPrisma.installment.update.mockResolvedValue({});
      mockPrisma.installment.findMany.mockResolvedValue([{ paidAt: null }]);
      mockPrisma.accountReceivable.update.mockResolvedValue({});
      mockPrisma.pixReceiptBlob.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.warning.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pixReceipt.delete.mockResolvedValue({});

      await service.remove('user-1', 'receipt-1');

      expect(mockPrisma.installment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paidAt: null } }),
      );
      expect(mockPrisma.pixReceipt.delete).toHaveBeenCalledWith({ where: { id: 'receipt-1' } });
    });

    it('should use updateMany to revert installments when receipt has no specific installmentId', async () => {
      const receipt = buildReceipt({
        status: 'RECONCILED',
        accountReceivableId: 'account-1',
        installmentId: null,
        blob: [],
      });
      mockPrisma.pixReceipt.findFirst.mockResolvedValue(receipt);
      mockPrisma.pixReceipt.findMany.mockResolvedValue([]);
      mockPrisma.installment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.installment.findMany.mockResolvedValue([{ paidAt: null }]);
      mockPrisma.accountReceivable.update.mockResolvedValue({});
      mockPrisma.pixReceiptBlob.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.warning.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pixReceipt.delete.mockResolvedValue({});

      await service.remove('user-1', 'receipt-1');

      expect(mockPrisma.installment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paidAt: null } }),
      );
    });
  });

  describe('parseAmount', () => {
    it('should parse amount with thousands dot separator (1.234,56)', () => {
      expect(service['parseAmount']('R$ 1.234,56')).toBe(1234.56);
    });

    it('should parse simple comma decimal (100,50)', () => {
      expect(service['parseAmount']('R$ 100,50')).toBe(100.50);
    });

    it('should return null for empty value', () => {
      expect(service['parseAmount']('')).toBeNull();
    });
  });
});
