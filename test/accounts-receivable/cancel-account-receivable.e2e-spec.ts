import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { AccountsReceivableController } from '../../src/accounts-receivable/accounts-receivable.controller.js';
import { AccountsReceivableService } from '../../src/accounts-receivable/accounts-receivable.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('PATCH /accounts-receivable/:id/cancel', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    accountReceivable: {
      findFirst: jest.Mock<any>;
      update: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();
  const mockAccountId = faker.string.uuid();

  const buildMockAccount = (overrides = {}) => ({
    id: mockAccountId,
    userId: mockUserId,
    clientId: faker.string.uuid(),
    pixReceiptId: null,
    clientName: 'Cliente Teste',
    serviceName: 'Serviço Teste',
    serviceDescription: null,
    totalAmount: 1500,
    dueDate: new Date('2027-01-15'),
    status: 'PENDING',
    paidAt: null,
    payStub: null,
    matchedAutomatically: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      accountReceivable: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [AccountsReceivableController],
      providers: [AccountsReceivableService],
      prismaService,
    }));
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => { prismaService.user.findUnique.mockResolvedValue({ isActive: true }); });
  afterEach(() => { jest.resetAllMocks(); });

  it('should return 200 and cancel a pending account', async () => {
    const cancelled = buildMockAccount({ status: 'CANCELLED' });
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount());
    prismaService.accountReceivable.update.mockResolvedValue(cancelled);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'CANCELLED');
  });

  it('should return 404 when account does not exist', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toHaveProperty('message', 'Account receivable not found');
  });

  it('should return 400 when account is already paid', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount({ status: 'PAID', paidAt: new Date() }));

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Cannot cancel a paid account receivable');
  });

  it('should return 400 when account is already cancelled', async () => {
    prismaService.accountReceivable.findFirst.mockResolvedValue(buildMockAccount({ status: 'CANCELLED' }));

    const response = await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Account receivable is already cancelled');
  });

  it('should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/accounts-receivable/${mockAccountId}/cancel`)
      .expect(401);
  });
});
