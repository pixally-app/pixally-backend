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

describe('POST /zapfy/admin/users/:userId/connect (CT-ZAP-004)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    zapifyIntegration: { findFirst: jest.Mock<any>; create: jest.Mock<any>; update: jest.Mock<any> };
  };

  const mockAdminId = faker.string.uuid();
  const mockUserId = faker.string.uuid();
  const targetUserId = faker.string.uuid();

  const validPayload = {
    instanceKey: 'my-instance-key',
    instanceToken: 'my-instance-token',
  };

  const buildMockIntegration = (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: targetUserId,
    instanceKey: validPayload.instanceKey,
    instanceToken: validPayload.instanceToken,
    active: false,
    connectedAt: null,
    disconnectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      zapifyIntegration: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [ZapfyController],
      providers: [
        ZapfyService,
        { provide: ZapfyClient, useValue: {} },
        { provide: PixReceiptsService, useValue: {} },
      ],
      prismaService,
    }));

    adminToken = jwtService.sign({ sub: mockAdminId, email: 'admin@test.com', role: 'admin' });
    userToken = jwtService.sign({ sub: mockUserId, email: 'user@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });
  afterEach(() => { jest.resetAllMocks(); });

  it('CT-ZAP-004-01 - should return 200 and create integration when none exists for the user', async () => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.zapifyIntegration.findFirst.mockResolvedValue(null);
    prismaService.zapifyIntegration.create.mockResolvedValue(buildMockIntegration());

    const response = await request(app.getHttpServer())
      .post(`/zapfy/admin/users/${targetUserId}/connect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPayload)
      .expect(200);

    expect(response.body).toMatchObject({
      instanceKey: validPayload.instanceKey,
      instanceToken: validPayload.instanceToken,
    });
    expect(prismaService.zapifyIntegration.create).toHaveBeenCalled();
    expect(prismaService.zapifyIntegration.update).not.toHaveBeenCalled();
  });

  it('CT-ZAP-004-02 - should return 200 and update integration when one already exists', async () => {
    const updated = buildMockIntegration({ instanceKey: 'new-key', instanceToken: 'new-token' });
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.zapifyIntegration.findFirst.mockResolvedValue(buildMockIntegration());
    prismaService.zapifyIntegration.update.mockResolvedValue(updated);

    const response = await request(app.getHttpServer())
      .post(`/zapfy/admin/users/${targetUserId}/connect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ instanceKey: 'new-key', instanceToken: 'new-token' })
      .expect(200);

    expect(response.body).toMatchObject({ instanceKey: 'new-key' });
    expect(prismaService.zapifyIntegration.update).toHaveBeenCalled();
    expect(prismaService.zapifyIntegration.create).not.toHaveBeenCalled();
  });

  it('CT-ZAP-004-03 - should return 400 when required fields are missing', async () => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });

    const response = await request(app.getHttpServer())
      .post(`/zapfy/admin/users/${targetUserId}/connect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    expect(Array.isArray(response.body.message)).toBe(true);
  });

  it('CT-ZAP-004-04 - should return 403 when user with role user tries to connect', async () => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });

    await request(app.getHttpServer())
      .post(`/zapfy/admin/users/${targetUserId}/connect`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(validPayload)
      .expect(403);
  });

  it('CT-ZAP-004-05 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .post(`/zapfy/admin/users/${targetUserId}/connect`)
      .send(validPayload)
      .expect(401);
  });
});
