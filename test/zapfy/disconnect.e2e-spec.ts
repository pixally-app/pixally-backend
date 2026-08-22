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

describe('POST /zapfy/disconnect (CT-ZAP-003)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let zapfyClient: { disconnect: jest.Mock<any> };
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    zapifyIntegration: { findFirst: jest.Mock<any>; update: jest.Mock<any> };
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
      zapifyIntegration: { findFirst: jest.fn(), update: jest.fn() },
    };

    zapfyClient = { disconnect: jest.fn() };

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

  it('CT-ZAP-003-01 - should return 200 and deactivate integration on disconnect', async () => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.zapifyIntegration.findFirst.mockResolvedValue(buildMockIntegration());
    zapfyClient.disconnect.mockResolvedValue(undefined);
    prismaService.zapifyIntegration.update.mockResolvedValue({});

    await request(app.getHttpServer())
      .post('/zapfy/disconnect')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(prismaService.zapifyIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: false }) }),
    );
  });

  it('CT-ZAP-003-02 - should return 404 when no integration is found for the user', async () => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.zapifyIntegration.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/zapfy/disconnect')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Zapfy integration not found for this user');
  });

  it('CT-ZAP-003-03 - should return 503 when Zapfy API is unavailable', async () => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.zapifyIntegration.findFirst.mockResolvedValue(buildMockIntegration());
    zapfyClient.disconnect.mockRejectedValue(new Error('Network error'));

    const response = await request(app.getHttpServer())
      .post('/zapfy/disconnect')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(503);

    expect(response.body).toHaveProperty('message', 'Zapfy API unavailable. Please try again later.');
  });

  it('CT-ZAP-003-04 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .post('/zapfy/disconnect')
      .expect(401);
  });
});
