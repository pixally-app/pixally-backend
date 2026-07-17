import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ZapfyClient } from './zapfy.client.js';
import type { ConnectIntegrationDto } from './dto/connect-integration.dto.js';
import type {
  ZapfyWebhookPayload,
  ZapfyNewMessagePayload,
  ZapfyMessageUpdatedPayload,
  ZapfyDocumentMessage,
  ZapfyImageMessage,
} from './dto/webhook-payload.dto.js';

@Injectable()
export class ZapfyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zapfyClient: ZapfyClient,
    private readonly config: ConfigService,
  ) {}

  async connectInstance(userId: string, dto: ConnectIntegrationDto) {
    const existing = await this.prisma.zapifyIntegration.findFirst({
      where: { userId },
    });

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
      await this.zapfyClient.disconnect(integration.instanceKey, integration.instanceToken);
    } catch {
      throw new ServiceUnavailableException('Zapfy API unavailable. Please try again later.');
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

    return this.zapfyClient.getQrCode(
      integration.instanceKey,
      integration.instanceToken,
    );
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
      ({ state } = await this.zapfyClient.getState(
        integration.instanceKey,
        integration.instanceToken,
      ));
    } catch {
      throw new ServiceUnavailableException('Zapfy API unavailable. Please try again later.');
    }

    const isConnected = state === 'connected' || state === 'open';

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

  async handleWebhook(payload: ZapfyWebhookPayload) {
    if (payload.type === 'INSTANCE-CONNECTED') {
      await this.handleInstanceConnected(payload.instanceKey);
      return;
    }

    if (payload.type === 'INSTANCE-DISCONNECTED') {
      await this.handleInstanceDisconnected(payload.instanceKey);
      return;
    }

    if (payload.type === 'NEW-MESSAGE') {
      await this.handleNewMessage(payload);
      return;
    }

    if (payload.type === 'MESSAGE-UPDATED') {
      await this.handleMessageUpdated(payload);
      return;
    }
  }

  private async handleInstanceConnected(instanceKey: string) {
    await this.prisma.zapifyIntegration.updateMany({
      where: { instanceKey },
      data: { active: true, connectedAt: new Date() },
    });
  }

  private async handleInstanceDisconnected(instanceKey: string) {
    await this.prisma.zapifyIntegration.updateMany({
      where: { instanceKey },
      data: { active: false, disconnectedAt: new Date() },
    });
  }

  private async handleNewMessage(payload: ZapfyNewMessagePayload) {
    const { instanceKey, data } = payload;
    const { key, message } = data;

    // ignore group messages — only direct contacts are processed
    if (key.remoteJid.endsWith('@g.us')) return;

    const media = this.extractMedia(message);
    if (!media) return;

    const integration = await this.prisma.zapifyIntegration.findUnique({
      where: { instanceKey },
    });
    if (!integration) return;

    const phoneNumber = key.remoteJid.split('@')[0];

    // try to link to a client by registered phone number
    const phoneClient = await this.prisma.phoneClient.findFirst({
      where: {
        phoneNumber: { endsWith: phoneNumber.slice(-8) },
        client: { userId: integration.userId, deletedAt: null },
      },
      select: { clientId: true },
    });

    const receipt = await this.prisma.pixReceipt.create({
      data: {
        userId: integration.userId,
        clientId: phoneClient?.clientId ?? null,
        status: 'PENDING',
        origin: 'whatsapp',
        jid: phoneNumber,
        messageId: key.id,
      },
    });

    await this.prisma.pixReceiptBlob.create({
      data: {
        pixReceiptsId: receipt.id,
        fileUrl: media.url,
        mimeType: media.mimetype,
      },
    });
  }

  private async handleMessageUpdated(payload: ZapfyMessageUpdatedPayload) {
    const { instanceKey, data } = payload;

    const integration = await this.prisma.zapifyIntegration.findUnique({
      where: { instanceKey },
    });
    if (!integration) return;

    for (const updateData of data) {
      const isDeleted =
        updateData.update.message == null || updateData.update.messageStubType === 1;

      if (!isDeleted) continue;

      const messageId = updateData.key?.id;
      const originalMessageId = updateData.update.key?.id;

      if (!messageId && !originalMessageId) continue;

      const receipt =
        (await this.prisma.pixReceipt.findFirst({
          where: { messageId: originalMessageId, userId: integration.userId },
        })) ??
        (await this.prisma.pixReceipt.findFirst({
          where: { messageId, userId: integration.userId },
        }));

      if (!receipt || receipt.isDeletedWhatsapp) continue;

      await this.prisma.pixReceipt.update({
        where: { id: receipt.id },
        data: { isDeletedWhatsapp: true },
      });

      await this.prisma.warning.create({
        data: {
          pixReceiptId: receipt.id,
          clientId: receipt.clientId,
          type: 'red',
          message: 'Comprovante apagado no WhatsApp',
        },
      });
    }
  }

  private extractMedia(
    message: ZapfyNewMessagePayload['data']['message'],
  ): ZapfyImageMessage | ZapfyDocumentMessage | null {
    return (
      message.imageMessage ??
      message.documentMessage ??
      message.documentWithCaptionMessage ??
      null
    );
  }
}
