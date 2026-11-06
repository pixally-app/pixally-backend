import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import type { PixReceiptModel, PixReceiptWhereInput } from '../../generated/prisma/models/PixReceipt.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateReceiptDto } from './dto/update-receipt.dto.js';
import { OcrService } from './ocr.service.js';
import { OpenAiService } from './openai.service.js';
import type { ReceiptData } from './openai.service.js';
import { QueueService } from './queue.service.js';
import { StorageService } from './storage.service.js';

type ReceiptWarning = { type: string; message: string };

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [30_000, 60_000];

@Injectable()
export class PixReceiptsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PixReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
    private readonly openai: OpenAiService,
    private readonly queue: QueueService,
  ) {}

  async onApplicationBootstrap() {
    const stuck = await this.prisma.pixReceipt.findMany({
      where: { status: 'ANALYSING' },
      include: { blob: true },
    });

    if (stuck.length === 0) return;

    this.logger.warn(`Recuperando ${stuck.length} comprovante(s) presos em ANALYSING...`);

    for (const receipt of stuck) {
      const blob = receipt.blob[0];
      if (!blob?.fileUrl || !blob.mimeType) continue;
      const { fileUrl, mimeType } = blob;
      this.queue.enqueue(() => this.processReceipt(receipt.id, fileUrl, mimeType));
    }
  }

  async upload(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo não enviado');

    const { path: filePath, url: fileUrl } = await this.storage.upload(file.buffer, file.mimetype);

    const receipt = await this.prisma.pixReceipt.create({
      data: {
        userId,
        status: 'ANALYSING',
        origin: 'manual',
        documentFormat: file.mimetype === 'application/pdf' ? 'pdf' : 'image',
      },
    });

    await this.prisma.pixReceiptBlob.create({
      data: {
        pixReceiptsId: receipt.id,
        filePath,
        fileUrl,
        mimeType: file.mimetype,
      },
    });

    this.queue.enqueue(() => this.processReceipt(receipt.id, fileUrl, file.mimetype));

    return receipt;
  }

  async processFromWebhook(receiptId: string, imageUrl: string, mimeType: string) {
    await this.prisma.pixReceipt.update({
      where: { id: receiptId },
      data: { status: 'ANALYSING' },
    });

    this.queue.enqueue(() => this.processReceipt(receiptId, imageUrl, mimeType));
  }

  private async processReceipt(receiptId: string, imageUrl: string, mimeType: string) {
    let receipt: PixReceiptModel | null = null;

    try {
      this.logger.log(`Iniciando processamento do receipt ${receiptId}`);

      receipt = await this.prisma.pixReceipt.findUnique({ where: { id: receiptId } });

      if (!receipt) {
        this.logger.warn(`Receipt ${receiptId} não encontrado, abortando processamento.`);
        return;
      }

      if (mimeType === 'application/pdf') {
        const originalPdfUrl = imageUrl;
        const jpegBuffer = await this.ocr.pdfToJpeg(imageUrl);
        const { path: jpegPath, url: jpegUrl } = await this.storage.upload(jpegBuffer, 'image/jpeg');
        await this.prisma.pixReceiptBlob.updateMany({
          where: { pixReceiptsId: receiptId },
          data: { filePath: jpegPath, fileUrl: jpegUrl, mimeType: 'image/jpeg' },
        });
        imageUrl = jpegUrl;
        mimeType = 'image/jpeg';
        await this.storage.delete(originalPdfUrl);
      }

      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await this.runProcessing(receiptId, imageUrl, receipt!);
          return;
        } catch (err) {
          lastError = err;
          if (attempt < MAX_ATTEMPTS) {
            const delay = RETRY_DELAYS_MS[attempt - 1];
            this.logger.warn(
              `Receipt ${receiptId}: tentativa ${attempt}/${MAX_ATTEMPTS} falhou. Aguardando ${delay / 1000}s...`,
            );
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
      throw lastError;

    } catch (err) {
      this.logger.error(`Falha ao processar receipt ${receiptId}: ${err}`);
      await this.prisma.pixReceipt.update({
        where: { id: receiptId },
        data: { status: 'ERROR' },
      });
      await this.prisma.warning.create({
        data: {
          pixReceiptId: receiptId,
          clientId: receipt?.clientId ?? null,
          type: 'red',
          message: 'Falha ao processar o comprovante',
        },
      });
    }
  }

  private async runProcessing(receiptId: string, imageUrl: string, receipt: PixReceiptModel) {
    const startTime = Date.now();
    const warnings: ReceiptWarning[] = [];

    const ocrText = await this.ocr.extractText(imageUrl);

    let data: ReceiptData;
    let usedOcrFallback = false;

    try {
      const gptResult = await this.openai.analyzeReceipt(imageUrl, ocrText);
      if (gptResult.error) {
        this.logger.warn(`GPT retornou erro para receipt ${receiptId}: ${gptResult.error}. Usando fallback OCR.`);
        data = this.buildOcrFallbackData(ocrText);
        usedOcrFallback = true;
      } else {
        data = gptResult;
      }
    } catch (err) {
      this.logger.warn(`GPT indisponível para receipt ${receiptId}, usando fallback OCR: ${err}`);
      data = this.buildOcrFallbackData(ocrText);
      usedOcrFallback = true;
    }

    if (usedOcrFallback) {
      warnings.push({ type: 'yellow', message: 'Análise de IA indisponível, dados extraídos parcialmente' });
    }

    const pixIdFromGpt = data.id_transferencia?.trim() ?? '';
    const pixIdFromOcr = this.extractPixIdFromOcr(ocrText);

    const isValidGpt = pixIdFromGpt.startsWith('E') && pixIdFromGpt.length === 32;
    const isValidOcr = pixIdFromOcr.startsWith('E') && pixIdFromOcr.length === 32;

    let pixId = '';
    if (isValidOcr && pixIdFromOcr !== pixIdFromGpt) {
      this.logger.warn(`PIX ID do GPT divergiu do OCR — usando OCR: ${pixIdFromOcr}`);
      pixId = pixIdFromOcr;
    } else if (isValidGpt) {
      pixId = pixIdFromGpt;
    } else if (isValidOcr) {
      pixId = pixIdFromOcr;
    }

    const isValidPixId = pixId.length === 32 && pixId.startsWith('E');

    if (!isValidPixId) {
      warnings.push({ type: 'red', message: 'ID da transação PIX inválido ou ausente' });
    }

    if (isValidPixId) {
      const duplicate = await this.prisma.pixReceipt.findFirst({
        where: { pixTransactionId: pixId, userId: receipt.userId, id: { not: receiptId } },
      });
      if (duplicate) {
        warnings.push({ type: 'red', message: 'Comprovante duplicado — já existe um registro com o mesmo ID PIX' });
      }
    }

    const missingFields = [data.valor, data.origem_nome, data.destino_nome, data.data_hora].some(
      (f) => !f || f.trim() === '',
    );
    if (missingFields) {
      warnings.push({ type: 'yellow', message: 'Alguns campos não puderam ser lidos com precisão' });
    }

    let depositDateTime: Date | null = null;
    if (data.data_hora) {
      const parsed = new Date(data.data_hora);
      if (!isNaN(parsed.getTime())) depositDateTime = parsed;
    }

    if (depositDateTime) {
      const conflicting = await this.prisma.pixReceipt.findFirst({
        where: { userId: receipt.userId, depositDateTime, id: { not: receiptId } },
      });
      if (conflicting) {
        warnings.push({ type: 'red', message: 'Data e hora conflitam com outro comprovante já registrado' });
      }
    }

    let resolvedClientId = receipt.clientId ?? null;

    if (!resolvedClientId && receipt.jid) {
      const byPhone = await this.prisma.phoneClient.findFirst({
        where: {
          phoneNumber: { endsWith: receipt.jid.slice(-8) },
          client: { userId: receipt.userId, deletedAt: null },
        },
        select: { clientId: true },
      });
      resolvedClientId = byPhone?.clientId ?? null;
    }

    if (!resolvedClientId) {
      warnings.push({ type: 'yellow', message: 'Nenhum cliente vinculado a este comprovante' });
    }

    const hasRedFlag = warnings.some((w) => w.type === 'red');
    const hasYellowFlag = warnings.some((w) => w.type === 'yellow');
    const status = hasRedFlag ? 'RED_FLAG' : hasYellowFlag ? 'YELLOW_FLAG' : 'RECEIVED';

    const amountFromGpt = this.parseAmount(data.valor);
    const amountFromOcr = this.extractAmountFromOcr(ocrText);

    let depositAmount: number | null = amountFromGpt;
    if (amountFromOcr !== null && amountFromGpt !== null && Math.abs(amountFromOcr - amountFromGpt) > 0.01) {
      this.logger.warn(`Valor do GPT (${amountFromGpt}) divergiu do OCR (${amountFromOcr}) — usando OCR`);
      depositAmount = amountFromOcr;
    } else if (amountFromOcr !== null && amountFromGpt === null) {
      depositAmount = amountFromOcr;
    }

    let resolvedAccountReceivableId: string | null = null;
    let resolvedInstallmentId: string | null = null;

    if (!hasRedFlag && resolvedClientId && depositAmount !== null) {
      const match = await this.findReconciliationMatch(receipt.userId, resolvedClientId, depositAmount);
      if (match) {
        resolvedAccountReceivableId = match.accountId;
        resolvedInstallmentId = match.installmentId;
      }
    }

    const finalStatus = resolvedAccountReceivableId ? 'RECONCILED' : status;

    await this.prisma.$transaction(async (tx) => {
      await tx.pixReceipt.update({
        where: { id: receiptId },
        data: {
          status: finalStatus,
          clientId: resolvedClientId,
          accountReceivableId: resolvedAccountReceivableId,
          installmentId: resolvedInstallmentId,
          processmentOcrOutcome: ocrText,
          processingTimeMs: Date.now() - startTime,
          usedFallback: usedOcrFallback,
          pixTransactionId: pixId || null,
          depositDateTime,
          depositAmount,
          depositOriginName: data.origem_nome || null,
          depositOriginDocument: data.origem_documento || null,
          depositOriginDocumentType: data.origem_tipo_documento || null,
          depositOriginBank: data.origem_instituicao_bancaria || null,
          depositOriginAgency: data.origem_agencia || null,
          depositOriginAccount: data.origem_conta || null,
          depositDestinationName: data.destino_nome || null,
          depositDestinationDocument: data.destino_documento || null,
          depositDestinationDocumentType: data.destino_tipo_documento || null,
          depositDestinationBank: data.destino_instituicao_bancaria || null,
          depositDestinationAgency: data.destino_agencia || null,
          depositDestinationAccount: data.destino_conta || null,
          description: data.descricao || null,
        },
      });

      if (resolvedAccountReceivableId) {
        const now = new Date();

        if (resolvedInstallmentId) {
          await tx.installment.update({
            where: { id: resolvedInstallmentId },
            data: { paidAt: now },
          });
        } else {
          await tx.installment.updateMany({
            where: { accountReceivableId: resolvedAccountReceivableId, paidAt: null },
            data: { paidAt: now },
          });
        }

        const freshInstallments = await tx.installment.findMany({
          where: { accountReceivableId: resolvedAccountReceivableId },
        });
        const allPaid = freshInstallments.length === 0 || freshInstallments.every((i) => i.paidAt !== null);

        await tx.accountReceivable.update({
          where: { id: resolvedAccountReceivableId },
          data: { status: allPaid ? 'PAID' : 'PENDING', paidAt: allPaid ? now : null, matchedAutomatically: true },
        });
      }

      if (warnings.length > 0) {
        await tx.warning.createMany({
          data: warnings.map((w) => ({
            pixReceiptId: receiptId,
            clientId: resolvedClientId,
            type: w.type,
            message: w.message,
          })),
        });
      }
    });

    this.logger.log(`Receipt ${receiptId} processado com status ${finalStatus}`);
  }

  private buildOcrFallbackData(ocrText: string): ReceiptData {
    const amountMatch = ocrText.match(/R\$\s?[0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})/);
    return {
      id_transferencia: this.extractPixIdFromOcr(ocrText),
      valor: amountMatch?.[0] ?? '',
      data_hora: this.extractDateFromOcr(ocrText) ?? '',
      descricao: '',
      origem_nome: '',
      origem_documento: this.extractDocumentFromOcr(ocrText) ?? '',
      origem_tipo_documento: '',
      origem_instituicao_bancaria: '',
      origem_agencia: '',
      origem_conta: '',
      destino_nome: '',
      destino_documento: '',
      destino_tipo_documento: '',
      destino_instituicao_bancaria: '',
      destino_agencia: '',
      destino_conta: '',
      destino_tipo_conta: '',
      destino_chave_pix: '',
    };
  }

  private extractDateFromOcr(ocrText: string): string | null {
    const match = ocrText.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return null;
    const [, day, month, year, h = '00', m = '00', s = '00'] = match;
    return `${year}-${month}-${day}T${h}:${m}:${s}`;
  }

  private extractDocumentFromOcr(ocrText: string): string | null {
    const cnpj = ocrText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (cnpj) return cnpj[0];
    const cpf = ocrText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    if (cpf) return cpf[0];
    return null;
  }

  private extractPixIdFromOcr(ocrText: string): string {
    const lines = ocrText.split('\n');
    for (const line of lines) {
      const match = line.match(/E[A-Za-z0-9]{31}/);
      if (match) return match[0];
    }
    return '';
  }

  private extractAmountFromOcr(ocrText: string): number | null {
    const match = ocrText.match(/R\$\s?[0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})/);
    if (!match) return null;
    return this.parseAmount(match[0]);
  }

  private parseAmount(value: string | null | undefined): number | null {
    if (!value) return null;
    const cleaned = value.replace('R$', '').replace(/\s/g, '');
    let normalized: string;
    if (cleaned.includes(',') && cleaned.includes('.')) {
      const [intPart, decPart] = cleaned.split(',');
      normalized = intPart.replace(/\./g, '') + '.' + decPart;
    } else {
      normalized = cleaned.replace(',', '.');
    }
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }

  private async findReconciliationMatch(
    userId: string,
    clientId: string,
    depositAmount: number,
  ): Promise<{ accountId: string; installmentId: string | null } | null> {
    const pendingAccounts = await this.prisma.accountReceivable.findMany({
      where: { userId, clientId, status: { notIn: ['PAID', 'CANCELLED'] } },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    const matches: Array<{ accountId: string; installmentId: string | null }> = [];

    for (const account of pendingAccounts) {
      const accountTotal = Number(account.totalAmount);
      if (depositAmount >= accountTotal) {
        matches.push({ accountId: account.id, installmentId: null });
      } else {
        const inst = account.installments.find(
          (i) => !i.paidAt && Math.abs(Number(i.amount) - depositAmount) < 0.01,
        );
        if (inst) matches.push({ accountId: account.id, installmentId: inst.id });
      }
    }

    return matches.length === 1 ? matches[0] : null;
  }

  private escapeCsv(v: unknown): string {
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
  }

  async exportCsv(
    userId: string,
    filters: { status?: string; origin?: string; clientName?: string } = {},
  ): Promise<string> {
    const where: PixReceiptWhereInput = { userId };

    if (filters.status) where.status = filters.status;
    if (filters.origin) where.origin = filters.origin;
    if (filters.clientName) {
      where.client = {
        name: { contains: filters.clientName, mode: 'insensitive' },
        deletedAt: null,
      };
    }

    const receipts = await this.prisma.pixReceipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { name: true } } },
    });

    const headers = [
      'Data/Hora',
      'Valor',
      'Status',
      'Nome Remetente',
      'CPF/CNPJ Remetente',
      'Banco Remetente',
      'Nome Destinatário',
      'Descrição',
      'Cliente',
      'ID Transação PIX',
    ];

    const rows = receipts.map((r) =>
      [
        this.escapeCsv(r.depositDateTime ? r.depositDateTime.toISOString() : ''),
        this.escapeCsv(r.depositAmount !== null ? Number(r.depositAmount) : ''),
        this.escapeCsv(r.status),
        this.escapeCsv(r.depositOriginName),
        this.escapeCsv(r.depositOriginDocument),
        this.escapeCsv(r.depositOriginBank),
        this.escapeCsv(r.depositDestinationName),
        this.escapeCsv(r.description),
        this.escapeCsv(r.client?.name),
        this.escapeCsv(r.pixTransactionId),
      ].join(','),
    );

    return [headers.map((h) => this.escapeCsv(h)).join(','), ...rows].join('\r\n');
  }

  async evaluateCsv(userId: string, variant: 'A' | 'B' | 'C' | 'D'): Promise<string> {
    const receipts = await this.prisma.pixReceipt.findMany({
      where: { userId },
      include: { blob: true },
      orderBy: { createdAt: 'asc' },
    });

    const headers = [
      'comprovante_id', 'variante', 'execucao',
      'id_transacao_extraido', 'nome_pagador_extraido', 'valor_extraido',
      'data_hora_extraido', 'banco_extraido',
      'tempo_ocr_s', 'tempo_api_s', 'tempo_total_s',
      'tokens_entrada', 'tokens_saida',
      'valor_no_texto_ocr', 'observacao',
    ];

    const rows = await Promise.all(
      receipts
        .filter((r) => r.blob[0]?.fileUrl)
        .map(async (receipt) => {
          const fileUrl = receipt.blob[0].fileUrl as string;
          const startTotal = Date.now();
          let ocrText = '';
          let ocrTimeS = 0;
          let apiTimeS = 0;
          let tokensIn = 0;
          let tokensOut = 0;
          let data: Partial<import('./openai.service.js').ReceiptData> = {};
          let observacao = '';

          try {
            if (variant === 'A') {
              const t = Date.now();
              ocrText = await this.ocr.extractText(fileUrl);
              ocrTimeS = (Date.now() - t) / 1000;
              data = this.buildOcrFallbackData(ocrText);
            } else {
              if (variant === 'C' || variant === 'D') {
                const t = Date.now();
                ocrText = await this.ocr.extractText(fileUrl);
                ocrTimeS = (Date.now() - t) / 1000;
              }

              const t = Date.now();
              const result = await this.openai.analyzeForEvaluation(
                fileUrl,
                ocrText,
                variant === 'B' || variant === 'C',
                variant === 'C' || variant === 'D',
              );
              apiTimeS = (Date.now() - t) / 1000;
              data = result.data;
              tokensIn = result.tokensIn;
              tokensOut = result.tokensOut;
            }
          } catch (err) {
            observacao = `Erro: ${String(err).slice(0, 100)}`;
          }

          const totalTimeS = (Date.now() - startTotal) / 1000;
          const valorNoOcr = ocrText ? (this.extractAmountFromOcr(ocrText) !== null ? '1' : '0') : '';

          return [
            this.escapeCsv(receipt.id),
            this.escapeCsv(variant),
            this.escapeCsv('1'),
            this.escapeCsv(data.id_transferencia ?? ''),
            this.escapeCsv(data.origem_nome ?? ''),
            this.escapeCsv(data.valor ?? ''),
            this.escapeCsv(data.data_hora ?? ''),
            this.escapeCsv(data.origem_instituicao_bancaria ?? ''),
            this.escapeCsv(ocrTimeS || ''),
            this.escapeCsv(apiTimeS || ''),
            this.escapeCsv(totalTimeS),
            this.escapeCsv(tokensIn || ''),
            this.escapeCsv(tokensOut || ''),
            this.escapeCsv(valorNoOcr),
            this.escapeCsv(observacao),
          ].join(',');
        }),
    );

    return [headers.map((h) => this.escapeCsv(h)).join(','), ...rows].join('\r\n');
  }

  async findAll(
    userId: string,
    page = 1,
    limit = 20,
    filters: { status?: string; origin?: string; clientName?: string } = {},
  ) {
    page = Math.max(1, page);
    limit = Math.max(1, Math.min(limit, 100));

    const skip = (page - 1) * limit;

    const where: PixReceiptWhereInput = { userId };

    if (filters.status) where.status = filters.status;
    if (filters.origin) where.origin = filters.origin;
    if (filters.clientName) {
      where.client = {
        name: { contains: filters.clientName, mode: 'insensitive' },
        deletedAt: null,
      };
    }

    const [receipts, total] = await this.prisma.$transaction([
      this.prisma.pixReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          blob: true,
          warnings: true,
          client: { select: { id: true, name: true } },
        },
      }),
      this.prisma.pixReceipt.count({ where }),
    ]);

    return {
      data: receipts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(userId: string, id: string) {
    const receipt = await this.prisma.pixReceipt.findFirst({
      where: { id, userId },
      include: {
        blob: true,
        warnings: true,
        client: true,
        accountReceivable: {
          include: { installments: { orderBy: { installmentNumber: 'asc' } } },
        },
      },
    });

    if (!receipt) throw new NotFoundException('Comprovante não encontrado');

    return receipt;
  }

  async reconcile(userId: string, receiptId: string, accountReceivableId: string) {
    const receipt = await this.prisma.pixReceipt.findFirst({
      where: { id: receiptId, userId },
    });

    if (!receipt) throw new NotFoundException('Comprovante não encontrado');

    const accountReceivable = await this.prisma.accountReceivable.findFirst({
      where: { id: accountReceivableId, userId },
    });

    if (!accountReceivable) throw new NotFoundException('Conta a receber não encontrada');

    if (accountReceivable.status === 'CANCELLED') {
      throw new BadRequestException('Não é possível conciliar com uma conta cancelada');
    }

    const installments = await this.prisma.installment.findMany({
      where: { accountReceivableId },
      orderBy: { installmentNumber: 'asc' },
    });

    const receiptAmount = receipt.depositAmount ? Number(receipt.depositAmount) : null;
    const accountTotal = Number(accountReceivable.totalAmount);
    const coversFullAmount = receiptAmount !== null && receiptAmount >= accountTotal;

    const matchingInstallment =
      receiptAmount !== null && !coversFullAmount
        ? (installments.find((i) => !i.paidAt && Math.abs(Number(i.amount) - receiptAmount) < 0.01) ?? null)
        : null;

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      if (receipt.accountReceivableId && receipt.accountReceivableId !== accountReceivableId) {
        const prevAccountId = receipt.accountReceivableId;

        if (receipt.installmentId) {
          await tx.installment.update({
            where: { id: receipt.installmentId },
            data: { paidAt: null },
          });
        } else {
          const otherReceipts = await tx.pixReceipt.findMany({
            where: { accountReceivableId: prevAccountId, id: { not: receiptId } },
            select: { installmentId: true },
          });
          const protectedIds = otherReceipts.map((r) => r.installmentId).filter(Boolean) as string[];
          await tx.installment.updateMany({
            where: {
              accountReceivableId: prevAccountId,
              paidAt: { not: null },
              ...(protectedIds.length > 0 && { id: { notIn: protectedIds } }),
            },
            data: { paidAt: null },
          });
        }

        const prevInstallments = await tx.installment.findMany({ where: { accountReceivableId: prevAccountId } });
        const prevAllPaid = prevInstallments.length > 0 && prevInstallments.every((i) => i.paidAt !== null);
        await tx.accountReceivable.update({
          where: { id: prevAccountId },
          data: { status: prevAllPaid ? 'PAID' : 'PENDING', paidAt: prevAllPaid ? now : null },
        });
      }

      let newInstallmentId: string | null = null;

      if (coversFullAmount) {
        await tx.installment.updateMany({
          where: { accountReceivableId, paidAt: null },
          data: { paidAt: now },
        });
      } else if (matchingInstallment) {
        await tx.installment.update({
          where: { id: matchingInstallment.id },
          data: { paidAt: now },
        });
        newInstallmentId = matchingInstallment.id;
      }

      const freshInstallments = await tx.installment.findMany({ where: { accountReceivableId } });
      const allPaid = freshInstallments.length > 0 && freshInstallments.every((i) => i.paidAt !== null);
      const isPaid = freshInstallments.length === 0 ? coversFullAmount : allPaid;

      await tx.accountReceivable.update({
        where: { id: accountReceivableId },
        data: { status: isPaid ? 'PAID' : 'PENDING', paidAt: isPaid ? now : null, matchedAutomatically: false },
      });

      await tx.pixReceipt.update({
        where: { id: receiptId },
        data: {
          status: 'RECONCILED',
          clientId: accountReceivable.clientId,
          accountReceivableId,
          installmentId: newInstallmentId,
        },
      });
    });

    return this.prisma.pixReceipt.findFirst({
      where: { id: receiptId },
      include: {
        blob: true,
        warnings: true,
        client: true,
        accountReceivable: {
          include: { installments: { orderBy: { installmentNumber: 'asc' } } },
        },
      },
    });
  }

  async unreconcile(userId: string, receiptId: string) {
    const receipt = await this.prisma.pixReceipt.findFirst({
      where: { id: receiptId, userId },
      include: { warnings: true },
    });

    if (!receipt) throw new NotFoundException('Comprovante não encontrado');

    if (!receipt.clientId && !receipt.accountReceivableId && receipt.status !== 'RECONCILED') {
      throw new BadRequestException('Comprovante não possui vínculo para desfazer');
    }

    const hasRed = receipt.warnings.some((w) => w.type === 'red' && !w.resolved);
    const hasYellow = receipt.warnings.some((w) => w.type === 'yellow' && !w.resolved);
    const restoredStatus = hasRed ? 'RED_FLAG' : hasYellow ? 'YELLOW_FLAG' : 'RECEIVED';

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      if (receipt.accountReceivableId) {
        if (receipt.installmentId) {
          await tx.installment.update({
            where: { id: receipt.installmentId },
            data: { paidAt: null },
          });
        } else {
          const otherReceipts = await tx.pixReceipt.findMany({
            where: { accountReceivableId: receipt.accountReceivableId, id: { not: receiptId } },
            select: { installmentId: true },
          });
          const protectedIds = otherReceipts.map((r) => r.installmentId).filter(Boolean) as string[];
          await tx.installment.updateMany({
            where: {
              accountReceivableId: receipt.accountReceivableId,
              paidAt: { not: null },
              ...(protectedIds.length > 0 && { id: { notIn: protectedIds } }),
            },
            data: { paidAt: null },
          });
        }

        const remaining = await tx.installment.findMany({ where: { accountReceivableId: receipt.accountReceivableId } });
        const allPaid = remaining.length > 0 && remaining.every((i) => i.paidAt !== null);
        await tx.accountReceivable.update({
          where: { id: receipt.accountReceivableId },
          data: { status: allPaid ? 'PAID' : 'PENDING', paidAt: allPaid ? now : null },
        });
      }

      await tx.pixReceipt.update({
        where: { id: receiptId },
        data: { accountReceivableId: null, installmentId: null, status: restoredStatus },
      });
    });

    return this.prisma.pixReceipt.findFirst({
      where: { id: receiptId },
      include: {
        blob: true,
        warnings: true,
        client: true,
        accountReceivable: {
          include: { installments: { orderBy: { installmentNumber: 'asc' } } },
        },
      },
    });
  }

  async update(userId: string, id: string, data: UpdateReceiptDto) {
    const receipt = await this.prisma.pixReceipt.findFirst({
      where: { id, userId },
    });

    if (!receipt) throw new NotFoundException('Comprovante não encontrado');

    if (receipt.status === 'ANALYSING') {
      throw new BadRequestException('Não é possível editar um comprovante que ainda está sendo analisado');
    }

    if (receipt.status === 'RECONCILED' && data.status !== undefined) {
      throw new BadRequestException('Use o endpoint de desconciliação antes de alterar o status de um comprovante conciliado');
    }

    if (data.clientId !== undefined && data.clientId !== null) {
      const client = await this.prisma.client.findFirst({
        where: { id: data.clientId, userId, deletedAt: null },
      });
      if (!client) throw new NotFoundException('Cliente não encontrado');
    }

    const depositDateTime =
      data.depositDateTime !== undefined
        ? data.depositDateTime
          ? new Date(data.depositDateTime)
          : null
        : undefined;

    return this.prisma.pixReceipt.update({
      where: { id },
      data: {
        ...(data.clientId !== undefined && { clientId: data.clientId }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.pixTransactionId !== undefined && { pixTransactionId: data.pixTransactionId || null }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.depositAmount !== undefined && { depositAmount: data.depositAmount }),
        ...(depositDateTime !== undefined && { depositDateTime }),
        ...(data.depositOriginName !== undefined && { depositOriginName: data.depositOriginName || null }),
        ...(data.depositOriginDocument !== undefined && { depositOriginDocument: data.depositOriginDocument || null }),
        ...(data.depositOriginDocumentType !== undefined && { depositOriginDocumentType: data.depositOriginDocumentType || null }),
        ...(data.depositOriginBank !== undefined && { depositOriginBank: data.depositOriginBank || null }),
        ...(data.depositOriginAgency !== undefined && { depositOriginAgency: data.depositOriginAgency || null }),
        ...(data.depositOriginAccount !== undefined && { depositOriginAccount: data.depositOriginAccount || null }),
        ...(data.depositDestinationName !== undefined && { depositDestinationName: data.depositDestinationName || null }),
        ...(data.depositDestinationDocument !== undefined && { depositDestinationDocument: data.depositDestinationDocument || null }),
        ...(data.depositDestinationDocumentType !== undefined && { depositDestinationDocumentType: data.depositDestinationDocumentType || null }),
        ...(data.depositDestinationBank !== undefined && { depositDestinationBank: data.depositDestinationBank || null }),
        ...(data.depositDestinationAgency !== undefined && { depositDestinationAgency: data.depositDestinationAgency || null }),
        ...(data.depositDestinationAccount !== undefined && { depositDestinationAccount: data.depositDestinationAccount || null }),
      },
      include: {
        blob: true,
        warnings: true,
        client: true,
        accountReceivable: {
          include: { installments: { orderBy: { installmentNumber: 'asc' } } },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    const receipt = await this.prisma.pixReceipt.findFirst({
      where: { id, userId },
      include: { blob: true },
    });

    if (!receipt) throw new NotFoundException('Comprovante não encontrado');

    if (receipt.status === 'ANALYSING') {
      throw new BadRequestException('Não é possível deletar um comprovante que ainda está sendo analisado');
    }

    await this.prisma.$transaction(async (tx) => {
      if (receipt.accountReceivableId) {
        const now = new Date();

        if (receipt.installmentId) {
          await tx.installment.update({
            where: { id: receipt.installmentId },
            data: { paidAt: null },
          });
        } else {
          const otherReceipts = await tx.pixReceipt.findMany({
            where: { accountReceivableId: receipt.accountReceivableId, id: { not: id } },
            select: { installmentId: true },
          });
          const protectedIds = otherReceipts.map((r) => r.installmentId).filter(Boolean) as string[];
          await tx.installment.updateMany({
            where: {
              accountReceivableId: receipt.accountReceivableId,
              paidAt: { not: null },
              ...(protectedIds.length > 0 && { id: { notIn: protectedIds } }),
            },
            data: { paidAt: null },
          });
        }

        const remaining = await tx.installment.findMany({
          where: { accountReceivableId: receipt.accountReceivableId },
        });
        const allPaid = remaining.length > 0 && remaining.every((i) => i.paidAt !== null);
        await tx.accountReceivable.update({
          where: { id: receipt.accountReceivableId },
          data: { status: allPaid ? 'PAID' : 'PENDING', paidAt: allPaid ? now : null },
        });
      }

      await tx.pixReceiptBlob.deleteMany({ where: { pixReceiptsId: id } });
      await tx.warning.deleteMany({ where: { pixReceiptId: id } });
      await tx.pixReceipt.delete({ where: { id } });
    });

    for (const blob of receipt.blob) {
      if (blob.fileUrl) await this.storage.delete(blob.fileUrl);
    }
  }
}
