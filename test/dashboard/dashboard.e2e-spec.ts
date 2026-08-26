import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { DashboardController } from '../../src/dashboard/dashboard.controller.js';
import { DashboardService } from '../../src/dashboard/dashboard.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('Dashboard', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    pixReceipt: { aggregate: jest.Mock<any>; count: jest.Mock<any>; findMany: jest.Mock<any> };
    accountReceivable: { aggregate: jest.Mock<any> };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      pixReceipt: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      accountReceivable: { aggregate: jest.fn() },
      $transaction: jest.fn(),
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [DashboardController],
      providers: [DashboardService],
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

  describe('GET /dashboard/resumo', () => {
    it('[CT-DASH-001-01] should return 200 with financial summary for the current month', async () => {
      prismaService.$transaction.mockResolvedValue([
        { _sum: { depositAmount: 1500 } },
        { _sum: { totalAmount: 800 } },
        { _sum: { totalAmount: 200 } },
        3,
      ]);

      const response = await request(app.getHttpServer())
        .get('/dashboard/resumo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('receivedThisMonth', 1500);
      expect(response.body).toHaveProperty('totalPending', 800);
      expect(response.body).toHaveProperty('totalOverdue', 200);
      expect(response.body).toHaveProperty('processedThisMonth', 3);
    });

    it('[CT-DASH-001-02] should return 401 when no JWT token is provided', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/resumo')
        .expect(401);
    });
  });

  describe('GET /dashboard/graphic', () => {
    it('[CT-DASH-001-03] should return 200 with receipts grouped by day for the last 7 days', async () => {
      prismaService.pixReceipt.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/dashboard/graphic')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(7);
      response.body.forEach((entry: any) => {
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('valor');
        expect(typeof entry.date).toBe('string');
        expect(typeof entry.valor).toBe('number');
      });
    });

    it('[CT-DASH-001-04] should correctly sum amounts grouped by day and ignore receipts with null depositDateTime', async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);

      prismaService.pixReceipt.findMany.mockResolvedValue([
        { depositDateTime: today, depositAmount: 100 },
        { depositDateTime: today, depositAmount: 50 },
        { depositDateTime: yesterday, depositAmount: 200 },
        { depositDateTime: null, depositAmount: 300 },
      ]);

      const response = await request(app.getHttpServer())
        .get('/dashboard/graphic')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      const todayEntry = response.body.find((e: any) => e.date === fmt(today));
      const yesterdayEntry = response.body.find((e: any) => e.date === fmt(yesterday));

      expect(todayEntry.valor).toBe(150);
      expect(yesterdayEntry.valor).toBe(200);
    });
  });
});
