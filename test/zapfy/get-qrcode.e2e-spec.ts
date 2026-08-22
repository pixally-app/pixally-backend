import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { PixReceiptsService } from '../../src/pix-receipts/pix-receipts.service.js';
import { ZapfyClient } from '../../src/zapfy/zapfy.client.js';
import { ZapfyController } from '../../src/zapfy/zapfy.controller.js';
import { ZapfyService } from '../../src/zapfy/zapfy.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('GET /zapfy/qrcode (CT-ZAP-001)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let zapfyClient: { getQrCode: jest.Mock<any> };
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    zapifyIntegration: { findFirst: jest.Mock<any> };
  };

  const mockUserId = faker.string.uuid();

  const buildMockIntegration = (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: mockUserId,
    instanceKey: 'test-instance-key',
    instanceToken: 'test-instance-token',
    active: true,
    connectedAt: new Date(),
    disconnectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      zapifyIntegration: { findFirst: jest.fn() },
    };

    zapfyClient = { getQrCode: jest.fn() };

    ({ app, jwtService } = await buildTestApp({
      controllers: [ZapfyController],
      providers: [
        ZapfyService,
        { provide: ZapfyClient, useValue: zapfyClient },
        { provide: PixReceiptsService, useValue: {} },
      ],
      prismaService,
    }));

    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });
  afterEach(() => { jest.resetAllMocks(); });

  it('CT-ZAP-001-01 - should return 200 with QR code when integration exists', async () => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.zapifyIntegration.findFirst.mockResolvedValue(buildMockIntegration());
    zapfyClient.getQrCode.mockResolvedValue({ qrCode: 'data:image/png;base64,abc123', state: 'open' });

    const response = await request(app.getHttpServer())
      .get('/zapfy/qrcode')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('qrCode', 'data:image/png;base64,abc123');
    expect(response.body).toHaveProperty('state', 'open');
  });

  it('CT-ZAP-001-02 - should return 404 when no integration is found for the user', async () => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.zapifyIntegration.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get('/zapfy/qrcode')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Zapfy integration not found for this user');
  });

  it('CT-ZAP-001-03 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get('/zapfy/qrcode')
      .expect(401);
  });
});
