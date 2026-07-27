import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PixReceiptModel } from '../../generated/prisma/models/PixReceipt.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OcrService } from './ocr.service.js';
import { OpenAiService } from './openai.service.js';
import { StorageService } from './storage.service.js';

@Injectable()
export class PixReceiptsService {
  private readonly logger = new Logger(PixReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
    private readonly openai: OpenAiService,
  ) {}

  async upload(userId: string, file: Express.Multer.File) {
    const fileUrl = await this.storage.upload(file.buffer, file.mimetype);

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
        fileUrl,
        mimeType: file.mimetype,
      },
    });

    this.processReceipt(receipt.id, fileUrl, file.mimetype).catch((err) =>
      this.logger.error(`Erro ao processar receipt ${receipt.id}: ${err}`),
    );

    return receipt;
  }

  async processFromWebhook(receiptId: string, imageUrl: string, mimeType: string) {
    await this.prisma.pixReceipt.update({
      where: { id: receiptId },
      data: { status: 'ANALYSING' },
    });

    this.processReceipt(receiptId, imageUrl, mimeType).catch((err) =>
      this.logger.error(`Erro ao processar receipt ${receiptId}: ${err}`),
    );
  }

  private async processReceipt(receiptId: string, imageUrl: string, mimeType: string) {
    let receipt: PixReceiptModel | null = null;

    try {
      this.logger.log(`Iniciando processamento do receipt ${receiptId}`);

      receipt = await this.prisma.pixReceipt.findUnique({
        where: { id: receiptId },
      });

      const ocrText = mimeType !== 'application/pdf'
        ? await this.ocr.extractText(imageUrl)
        : '';

      const data = await this.openai.analyzeReceipt(imageUrl, ocrText, mimeType);

      if (data.error) {
        await this.prisma.pixReceipt.update({
          where: { id: receiptId },
          data: { status: 'ERROR', processmentOcrOutcome: ocrText },
        });
        await this.prisma.warning.create({
          data: {
            pixReceiptId: receiptId,
            clientId: receipt?.clientId ?? null,
            type: 'red',
            message: 'Falha ao processar o comprovante',
          },
        });
        return;
      }

      const warnings: { type: string; message: string }[] = [];

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
          where: {
            pixTransactionId: pixId,
            id: { not: receiptId },
          },
        });

        if (duplicate) {
          warnings.push({ type: 'red', message: 'Comprovante duplicado — já existe um registro com o mesmo ID PIX' });
        }
      }

      const missingFields = [
        data.valor,
        data.origem_nome,
        data.destino_nome,
        data.data_hora,
      ].some((f) => !f || f.trim() === '');

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
          where: {
            userId: receipt!.userId,
            depositDateTime,
            id: { not: receiptId },
          },
        });

        if (conflicting) {
          warnings.push({ type: 'red', message: 'Data e hora conflitam com outro comprovante já registrado' });
        }
      }

      if (!receipt?.clientId) {
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

      await this.prisma.pixReceipt.update({
        where: { id: receiptId },
        data: {
          status,
          processmentOcrOutcome: ocrText,
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
        },
      });

      if (warnings.length > 0) {
        await this.prisma.warning.createMany({
          data: warnings.map((w) => ({
            pixReceiptId: receiptId,
            clientId: receipt?.clientId ?? null,
            type: w.type,
            message: w.message,
          })),
        });
      }

      this.logger.log(`Receipt ${receiptId} processado com status ${status}`);
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

  private extractPixIdFromOcr(ocrText: string): string {
    const lines = ocrText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('E') && trimmed.length === 32) {
        return trimmed;
      }
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

  async findAll(
    userId: string,
    page = 1,
    limit = 20,
    filters: { status?: string; origin?: string; clientName?: string } = {},
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (filters.status) where['status'] = filters.status;
    if (filters.origin) where['origin'] = filters.origin;
    if (filters.clientName) {
      where['client'] = {
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
      },
    });

    if (!receipt) throw new NotFoundException('Receipt not found');

    return receipt;
  }

  async update(userId: string, id: string, data: { clientId?: string; status?: string; description?: string }) {
    const receipt = await this.prisma.pixReceipt.findFirst({
      where: { id, userId },
    });

    if (!receipt) throw new NotFoundException('Receipt not found');

    return this.prisma.pixReceipt.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    const receipt = await this.prisma.pixReceipt.findFirst({
      where: { id, userId },
    });

    if (!receipt) throw new NotFoundException('Receipt not found');

    if (receipt.status === 'ANALYSING') {
      throw new BadRequestException('Não é possível deletar um comprovante que ainda está sendo analisado');
    }

    await this.prisma.pixReceiptBlob.deleteMany({ where: { pixReceiptsId: id } });
    await this.prisma.warning.deleteMany({ where: { pixReceiptId: id } });
    await this.prisma.pixReceipt.delete({ where: { id } });
  }
}
