import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { PixReceiptsService } from '../../src/pix-receipts/pix-receipts.service.js';
import { ZapfyClient } from '../../src/zapfy/zapfy.client.js';
import { ZapfyWebhookController } from '../../src/zapfy/zapfy-webhook.controller.js';
import { ZapfyService } from '../../src/zapfy/zapfy.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

const WEBHOOK_SECRET = 'test-webhook-secret';

describe('POST /zapfy/webhook (CT-ZAP-005)', () => {
  let app: INestApplication;
  let pixReceiptsService: { processFromWebhook: jest.Mock<any> };
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    zapifyIntegration: { findUnique: jest.Mock<any>; updateMany: jest.Mock<any> };
    pixReceipt: { create: jest.Mock<any>; findFirst: jest.Mock<any>; update: jest.Mock<any> };
    pixReceiptBlob: { create: jest.Mock<any> };
    phoneClient: { findFirst: jest.Mock<any> };
    warning: { create: jest.Mock<any> };
  };

  const mockInstanceKey = 'test-instance-key';
  const mockUserId = faker.string.uuid();
  const mockClientId = faker.string.uuid();

  const buildMockIntegration = (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: mockUserId,
    instanceKey: mockInstanceKey,
    instanceToken: 'test-instance-token',
    active: false,
    connectedAt: null,
    disconnectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const buildMockReceipt = (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: mockUserId,
    clientId: null,
    status: 'ANALYSING',
    origin: 'whatsapp',
    documentFormat: 'image',
    jid: '5511999999999',
    messageId: faker.string.uuid(),
    isDeletedWhatsapp: false,
    ...overrides,
  });

  const buildNewMessagePayload = (overrides: Record<string, any> = {}) => ({
    type: 'NEW-MESSAGE',
    instanceKey: mockInstanceKey,
    id: faker.string.uuid(),
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: faker.string.uuid() },
      message: { imageMessage: { url: 'https://example.com/img.jpg', mimetype: 'image/jpeg' } },
      messageTimestamp: Date.now(),
      status: 1,
    },
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      zapifyIntegration: { findUnique: jest.fn(), updateMany: jest.fn() },
      pixReceipt: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      pixReceiptBlob: { create: jest.fn() },
      phoneClient: { findFirst: jest.fn() },
      warning: { create: jest.fn() },
    };

    pixReceiptsService = { processFromWebhook: jest.fn() };

    ({ app } = await buildTestApp({
      controllers: [ZapfyWebhookController],
      providers: [
        ZapfyService,
        { provide: ZapfyClient, useValue: {} },
        { provide: PixReceiptsService, useValue: pixReceiptsService },
        { provide: ConfigService, useValue: { getOrThrow: () => WEBHOOK_SECRET } },
      ],
      prismaService,
    }));
  });

  afterAll(async () => { await app.close(); });
  afterEach(() => { jest.resetAllMocks(); });

  it('CT-ZAP-005-01 - should return 200 and mark integration as active on INSTANCE-CONNECTED', async () => {
    prismaService.zapifyIntegration.updateMany.mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .post(`/zapfy/webhook?secret=${WEBHOOK_SECRET}`)
      .send({ type: 'INSTANCE-CONNECTED', instanceKey: mockInstanceKey, data: null })
      .expect(200);

    expect(prismaService.zapifyIntegration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: true }) }),
    );
  });

  it('CT-ZAP-005-02 - should return 200 and mark integration as inactive on INSTANCE-DISCONNECTED', async () => {
    prismaService.zapifyIntegration.updateMany.mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .post(`/zapfy/webhook?secret=${WEBHOOK_SECRET}`)
      .send({ type: 'INSTANCE-DISCONNECTED', instanceKey: mockInstanceKey, data: null })
      .expect(200);

    expect(prismaService.zapifyIntegration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: false }) }),
    );
  });

  it('CT-ZAP-005-03 - should return 200 and create receipt with clientId null for unknown sender', async () => {
    const receipt = buildMockReceipt();
    prismaService.zapifyIntegration.findUnique.mockResolvedValue(buildMockIntegration());
    prismaService.phoneClient.findFirst.mockResolvedValue(null);
    prismaService.pixReceipt.create.mockResolvedValue(receipt);
    prismaService.pixReceiptBlob.create.mockResolvedValue({});
    pixReceiptsService.processFromWebhook.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post(`/zapfy/webhook?secret=${WEBHOOK_SECRET}`)
      .send(buildNewMessagePayload())
      .expect(200);

    expect(prismaService.pixReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: null, origin: 'whatsapp' }) }),
    );
    expect(pixReceiptsService.processFromWebhook).toHaveBeenCalledWith(
      receipt.id,
      'https://example.com/img.jpg',
      'image/jpeg',
    );
  });

  it('CT-ZAP-005-04 - should return 200 and create receipt linked to client when sender is known', async () => {
    const receipt = buildMockReceipt({ clientId: mockClientId });
    prismaService.zapifyIntegration.findUnique.mockResolvedValue(buildMockIntegration());
    prismaService.phoneClient.findFirst.mockResolvedValue({ clientId: mockClientId });
    prismaService.pixReceipt.create.mockResolvedValue(receipt);
    prismaService.pixReceiptBlob.create.mockResolvedValue({});
    pixReceiptsService.processFromWebhook.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post(`/zapfy/webhook?secret=${WEBHOOK_SECRET}`)
      .send(buildNewMessagePayload())
      .expect(200);

    expect(prismaService.pixReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: mockClientId }) }),
    );
  });

  it('CT-ZAP-005-05 - should return 200 and ignore messages sent by the instance owner (fromMe)', async () => {
    await request(app.getHttpServer())
      .post(`/zapfy/webhook?secret=${WEBHOOK_SECRET}`)
      .send(buildNewMessagePayload({ data: { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: true, id: faker.string.uuid() }, message: { imageMessage: { url: 'https://example.com/img.jpg', mimetype: 'image/jpeg' } }, messageTimestamp: Date.now(), status: 1 } }))
      .expect(200);

    expect(prismaService.pixReceipt.create).not.toHaveBeenCalled();
    expect(pixReceiptsService.processFromWebhook).not.toHaveBeenCalled();
  });

  it('CT-ZAP-005-06 - should return 200 and ignore messages from groups', async () => {
    await request(app.getHttpServer())
      .post(`/zapfy/webhook?secret=${WEBHOOK_SECRET}`)
      .send(buildNewMessagePayload({ data: { key: { remoteJid: '120363000000000000@g.us', fromMe: false, id: faker.string.uuid() }, message: { imageMessage: { url: 'https://example.com/img.jpg', mimetype: 'image/jpeg' } }, messageTimestamp: Date.now(), status: 1 } }))
      .expect(200);

    expect(prismaService.pixReceipt.create).not.toHaveBeenCalled();
    expect(pixReceiptsService.processFromWebhook).not.toHaveBeenCalled();
  });

  it('CT-ZAP-005-07 - should return 200 and ignore messages without media', async () => {
    await request(app.getHttpServer())
      .post(`/zapfy/webhook?secret=${WEBHOOK_SECRET}`)
      .send(buildNewMessagePayload({ data: { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: faker.string.uuid() }, message: {}, messageTimestamp: Date.now(), status: 1 } }))
      .expect(200);

    expect(prismaService.pixReceipt.create).not.toHaveBeenCalled();
    expect(pixReceiptsService.processFromWebhook).not.toHaveBeenCalled();
  });

  it('CT-ZAP-005-08 - should return 200, flag receipt as deleted and create warning on MESSAGE-UPDATED', async () => {
    const messageId = faker.string.uuid();
    const receipt = buildMockReceipt({ messageId });
    prismaService.zapifyIntegration.findUnique.mockResolvedValue(buildMockIntegration());
    prismaService.pixReceipt.findFirst.mockResolvedValue(receipt);
    prismaService.pixReceipt.update.mockResolvedValue({});
    prismaService.warning.create.mockResolvedValue({});

    await request(app.getHttpServer())
      .post(`/zapfy/webhook?secret=${WEBHOOK_SECRET}`)
      .send({
        type: 'MESSAGE-UPDATED',
        instanceKey: mockInstanceKey,
        id: faker.string.uuid(),
        data: [{
          key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: messageId },
          update: { message: null, messageStubType: 1, key: { id: messageId } },
        }],
      })
      .expect(200);

    expect(prismaService.pixReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isDeletedWhatsapp: true } }),
    );
    expect(prismaService.warning.create).toHaveBeenCalled();
  });

  it('CT-ZAP-005-09 - should return 401 when webhook secret is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/zapfy/webhook?secret=wrong-secret')
      .send({ type: 'INSTANCE-CONNECTED', instanceKey: mockInstanceKey, data: null })
      .expect(401);

    expect(response.body).toHaveProperty('message', 'Invalid webhook secret');
  });
});
