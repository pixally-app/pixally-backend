import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { WarningsController } from '../../src/warnings/warnings.controller.js';
import { WarningsService } from '../../src/warnings/warnings.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('PATCH /warnings/:id/resolve', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    warning: { findFirst: jest.Mock<any>; update: jest.Mock<any>; findMany: jest.Mock<any> };
    pixReceipt: { update: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();
  const mockWarningId = faker.string.uuid();
  const mockReceiptId = faker.string.uuid();

  const buildMockWarning = (overrides = {}) => ({
    id: mockWarningId,
    pixReceiptId: mockReceiptId,
    clientId: faker.string.uuid(),
    type: 'yellow',
    message: 'Alguns campos não puderam ser lidos com precisão',
    resolved: null,
    resolutionReason: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    pixReceipt: {
      id: mockReceiptId,
      userId: mockUserId,
      status: 'YELLOW_FLAG',
    },
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      warning: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      pixReceipt: { update: jest.fn() },
      $transaction: jest.fn(),
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [WarningsController],
      providers: [WarningsService],
      prismaService,
    }));

    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
    prismaService.$transaction.mockImplementation((callbackOrArray: any) => {
      if (Array.isArray(callbackOrArray)) return Promise.all(callbackOrArray);
      return callbackOrArray(prismaService);
    });
  });

  afterEach(() => { jest.resetAllMocks(); });

  it('[CT-WARN-002-01] should return 200 and resolve the warning', async () => {
    const warning = buildMockWarning();
    const resolved = { ...warning, resolved: true, resolutionReason: 'Verificado manualmente', resolvedAt: new Date() };
    prismaService.warning.findFirst.mockResolvedValue(warning);
    prismaService.warning.update.mockResolvedValue(resolved);
    prismaService.warning.findMany.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .patch(`/warnings/${mockWarningId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ resolutionReason: 'Verificado manualmente' })
      .expect(200);

    expect(response.body).toHaveProperty('resolved', true);
    expect(response.body).toHaveProperty('resolutionReason', 'Verificado manualmente');
  });

  it('[CT-WARN-002-02] should update receipt to RECEIVED when last warning is resolved', async () => {
    const warning = buildMockWarning({
      type: 'red',
      pixReceipt: { id: mockReceiptId, userId: mockUserId, status: 'RED_FLAG' },
    });
    const resolved = { ...warning, resolved: true, resolutionReason: 'Falso positivo', resolvedAt: new Date() };
    prismaService.warning.findFirst.mockResolvedValue(warning);
    prismaService.warning.update.mockResolvedValue(resolved);
    prismaService.warning.findMany.mockResolvedValue([]);

    await request(app.getHttpServer())
      .patch(`/warnings/${mockWarningId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ resolutionReason: 'Falso positivo' })
      .expect(200);

    expect(prismaService.pixReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'RECEIVED' } }),
    );
  });

  it('[CT-WARN-002-03] should return 400 when warning is already resolved', async () => {
    prismaService.warning.findFirst.mockResolvedValue(buildMockWarning({ resolved: true }));

    const response = await request(app.getHttpServer())
      .patch(`/warnings/${mockWarningId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ resolutionReason: 'Qualquer motivo' })
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Alerta já foi resolvido');
  });

  it('[CT-WARN-002-04] should return 404 when warning does not exist', async () => {
    prismaService.warning.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/warnings/${mockWarningId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ resolutionReason: 'Qualquer motivo' })
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Alerta não encontrado');
  });

  it('[CT-WARN-002-05] should return 400 when resolutionReason is missing', async () => {
    await request(app.getHttpServer())
      .patch(`/warnings/${mockWarningId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);
  });

  it('[CT-WARN-002-06] should return 400 when resolutionReason is empty string', async () => {
    await request(app.getHttpServer())
      .patch(`/warnings/${mockWarningId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ resolutionReason: '' })
      .expect(400);
  });

  it('[CT-WARN-002-07] should return 400 when id is not a valid UUID', async () => {
    await request(app.getHttpServer())
      .patch('/warnings/id-invalido/resolve')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ resolutionReason: 'Qualquer motivo' })
      .expect(400);
  });

  it('[CT-WARN-002-08] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/warnings/${mockWarningId}/resolve`)
      .send({ resolutionReason: 'Qualquer motivo' })
      .expect(401);
  });
});
