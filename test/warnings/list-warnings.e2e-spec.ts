import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { WarningsController } from '../../src/warnings/warnings.controller.js';
import { WarningsService } from '../../src/warnings/warnings.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('GET /warnings', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    warning: { findMany: jest.Mock<any>; count: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();

  const buildMockWarning = (overrides = {}) => ({
    id: faker.string.uuid(),
    pixReceiptId: faker.string.uuid(),
    clientId: faker.string.uuid(),
    type: 'yellow',
    message: 'Alguns campos não puderam ser lidos com precisão',
    resolved: null,
    resolutionReason: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: { name: 'Cliente Teste' },
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      warning: { findMany: jest.fn(), count: jest.fn() },
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

  it('[CT-WARN-001-01] should return 200 with paginated list and global counts', async () => {
    const warnings = [buildMockWarning(), buildMockWarning({ type: 'red' })];
    prismaService.warning.findMany.mockResolvedValue(warnings);
    prismaService.warning.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const response = await request(app.getHttpServer())
      .get('/warnings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveLength(2);
    expect(response.body).toHaveProperty('total', 2);
    expect(response.body).toHaveProperty('yellowCount', 1);
    expect(response.body).toHaveProperty('redCount', 1);
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('limit', 20);
    expect(response.body).toHaveProperty('totalPages', 1);
  });

  it('[CT-WARN-001-02] should return 200 filtering by type=yellow', async () => {
    const yellowWarnings = [buildMockWarning({ type: 'yellow' })];
    prismaService.warning.findMany.mockResolvedValue(yellowWarnings);
    prismaService.warning.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const response = await request(app.getHttpServer())
      .get('/warnings?type=yellow')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toHaveProperty('type', 'yellow');
    expect(response.body).toHaveProperty('total', 1);
  });

  it('[CT-WARN-001-03] should return 200 filtering by type=red', async () => {
    const redWarnings = [buildMockWarning({ type: 'red', message: 'Comprovante duplicado' })];
    prismaService.warning.findMany.mockResolvedValue(redWarnings);
    prismaService.warning.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const response = await request(app.getHttpServer())
      .get('/warnings?type=red')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toHaveProperty('type', 'red');
  });

  it('[CT-WARN-001-04] should return 200 with custom page and limit', async () => {
    prismaService.warning.findMany.mockResolvedValue([]);
    prismaService.warning.count
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(10);

    const response = await request(app.getHttpServer())
      .get('/warnings?page=2&limit=5')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('page', 2);
    expect(response.body).toHaveProperty('limit', 5);
    expect(response.body).toHaveProperty('total', 25);
    expect(response.body).toHaveProperty('totalPages', 5);
  });

  it('[CT-WARN-001-05] should return 200 with empty list when no pending warnings exist', async () => {
    prismaService.warning.findMany.mockResolvedValue([]);
    prismaService.warning.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const response = await request(app.getHttpServer())
      .get('/warnings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(0);
    expect(response.body).toHaveProperty('total', 0);
    expect(response.body).toHaveProperty('yellowCount', 0);
    expect(response.body).toHaveProperty('redCount', 0);
  });

  it('[CT-WARN-001-06] should return 400 when type filter is invalid', async () => {
    await request(app.getHttpServer())
      .get('/warnings?type=invalido')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('[CT-WARN-001-07] should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get('/warnings')
      .expect(401);
  });
});
