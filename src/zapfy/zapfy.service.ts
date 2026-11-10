import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../pix-receipts/storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PixReceiptsService } from '../pix-receipts/pix-receipts.service.js';
import { ZapfyClient } from './zapfy.client.js';
import type { ConnectIntegrationDto } from './dto/connect-integration.dto.js';
import type {
  EvolutionWebhookPayload,
  EvolutionMessagesUpsertPayload,
  EvolutionConnectionUpdatePayload,
  EvolutionMediaMessage,
} from './dto/webhook-payload.dto.js';

@Injectable()
export class ZapfyService {
  private readonly logger = new Logger(ZapfyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zapfyClient: ZapfyClient,
    private readonly pixReceiptsService: PixReceiptsService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async connectInstance(userId: string, dto: ConnectIntegrationDto) {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const webhookSecret = this.config.getOrThrow<string>('ZAPFY_WEBHOOK_SECRET');
    const webhookUrl = `${appUrl}/zapfy/webhook?secret=${webhookSecret}`;

    const existing = await this.prisma.zapifyIntegration.findFirst({
      where: { userId },
    });

    await this.zapfyClient.createInstance(dto.instanceKey, webhookUrl);

    if (existing) {
      return this.prisma.zapifyIntegration.update({
        where: { id: existing.id },
        data: {
          instanceKey: dto.instanceKey,
          instanceToken: dto.instanceToken,
          active: false,
        },
      });
    }

    return this.prisma.zapifyIntegration.create({
      data: {
        userId,
        instanceKey: dto.instanceKey,
        instanceToken: dto.instanceToken,
        active: false,
      },
    });
  }

  async disconnect(userId: string) {
    const integration = await this.prisma.zapifyIntegration.findFirst({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException('Zapfy integration not found for this user');
    }

    try {
      await this.zapfyClient.disconnect(integration.instanceKey);
    } catch {
      throw new ServiceUnavailableException('WhatsApp API unavailable. Please try again later.');
    }

    await this.prisma.zapifyIntegration.update({
      where: { id: integration.id },
      data: { active: false, disconnectedAt: new Date() },
    });
  }

  async getQrCode(userId: string) {
    const integration = await this.prisma.zapifyIntegration.findFirst({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException('Zapfy integration not found for this user');
    }

    return this.zapfyClient.getQrCode(integration.instanceKey);
  }

  async getStatus(userId: string) {
    const integration = await this.prisma.zapifyIntegration.findFirst({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException('Zapfy integration not found for this user');
    }

    let state: string;

    try {
      ({ state } = await this.zapfyClient.getState(integration.instanceKey));
    } catch {
      throw new ServiceUnavailableException('WhatsApp API unavailable. Please try again later.');
    }

    const isConnected = state === 'open';

    if (isConnected && !integration.active) {
      await this.prisma.zapifyIntegration.update({
        where: { id: integration.id },
        data: { active: true, connectedAt: new Date() },
      });
    }

    if (!isConnected && integration.active) {
      await this.prisma.zapifyIntegration.update({
        where: { id: integration.id },
        data: { active: false, disconnectedAt: new Date() },
      });
    }

    return {
      state,
      active: isConnected,
      connectedAt: integration.connectedAt,
      disconnectedAt: integration.disconnectedAt,
    };
  }

  async handleWebhook(payload: EvolutionWebhookPayload) {
    if (payload.event === 'connection.update') {
      await this.handleConnectionUpdate(payload as EvolutionConnectionUpdatePayload);
      return;
    }

    if (payload.event === 'messages.upsert') {
      await this.handleNewMessage(payload as EvolutionMessagesUpsertPayload);
      return;
    }
  }

  private async handleConnectionUpdate(payload: EvolutionConnectionUpdatePayload) {
    const { instance, data } = payload;
    const isConnected = data.state === 'open';

    await this.prisma.zapifyIntegration.updateMany({
      where: { instanceKey: instance },
      data: isConnected
        ? { active: true, connectedAt: new Date() }
        : { active: false, disconnectedAt: new Date() },
    });
  }

  private async handleNewMessage(payload: EvolutionMessagesUpsertPayload) {
    const { instance, data } = payload;
    const { key, message } = data;

    if (key.fromMe) return;
    if (key.remoteJid.endsWith('@g.us')) return;

    const media = this.extractMedia(message);
    if (!media) return;

    const integration = await this.prisma.zapifyIntegration.findUnique({
      where: { instanceKey: instance },
    });
    if (!integration) return;

    const rawJid = key.remoteJid;
    const phoneNumber = rawJid.split('@')[0];

    const phoneClient = await this.prisma.phoneClient.findFirst({
      where: {
        phoneNumber: { endsWith: phoneNumber.slice(-8) },
        client: { userId: integration.userId, deletedAt: null },
      },
      select: { clientId: true },
    });

    const mimeType = media.mimetype;

    let fileUrl: string;
    try {
      const { base64 } = await this.zapfyClient.getMediaBase64(instance, {
        id: key.id,
        remoteJid: key.remoteJid,
        fromMe: key.fromMe,
      });

      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
      const buffer = Buffer.from(base64Data, 'base64');
      const uploaded = await this.storage.upload(buffer, mimeType);
      fileUrl = uploaded.url;
    } catch (err) {
      this.logger.error(`Erro ao baixar/subir mídia do WhatsApp: ${err}`);
      return;
    }

    const receipt = await this.prisma.pixReceipt.create({
      data: {
        userId: integration.userId,
        clientId: phoneClient?.clientId ?? null,
        status: 'ANALYSING',
        origin: 'whatsapp',
        documentFormat: mimeType === 'application/pdf' ? 'pdf' : 'image',
        jid: phoneNumber,
        messageId: key.id,
      },
    });

    await this.prisma.pixReceiptBlob.create({
      data: {
        pixReceiptsId: receipt.id,
        fileUrl,
        mimeType,
      },
    });

    await this.pixReceiptsService.processFromWebhook(receipt.id, fileUrl, mimeType);
  }

  private extractMedia(message: EvolutionMessagesUpsertPayload['data']['message']): EvolutionMediaMessage | null {
    if (message.imageMessage) return message.imageMessage;
    if (message.documentMessage) return message.documentMessage;
    if (message.documentWithCaptionMessage?.message?.documentMessage) {
      return message.documentWithCaptionMessage.message.documentMessage;
    }
    return null;
  }
}
