import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { ClientsController } from '../../src/clients/clients.controller.js';
import { ClientsService } from '../../src/clients/clients.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('GET /clients (CT-CLI-002)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    client: {
      findMany: jest.Mock<any>;
      count: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      client: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [ClientsController],
      providers: [ClientsService],
      prismaService,
    }));
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('CT-CLI-002-01 - should return 200 and paginated list of clients', async () => {
    const mockClients = [
      {
        id: faker.string.uuid(),
        userId: mockUserId,
        name: faker.person.fullName(),
        document: '12345678900',
        documentType: 'cpf',
        status: true,
        phones: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        _count: { pixReceipts: 2 },
        accountsReceivable: [
          { totalAmount: 100, paidAt: new Date() },
          { totalAmount: 200, paidAt: null },
        ],
        phoneClients: [
          { id: faker.string.uuid(), dialCode: '+55', phoneNumber: '11987654321' },
        ],
      },
    ];

    prismaService.client.findMany.mockResolvedValue(mockClients);
    prismaService.client.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total', 1);
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('limit', 10);
    expect(response.body).toHaveProperty('totalPages', 1);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toHaveProperty('name');
    expect(response.body.data[0]).toHaveProperty('phones');
    expect(response.body.data[0]).toHaveProperty('receiptsCount', 2);
    expect(response.body.data[0]).toHaveProperty('totalReceived', 100);
    expect(response.body.data[0]).toHaveProperty('totalReceivable', 200);
  });

  it('CT-CLI-002-02 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get('/clients')
      .expect(401);
  });

  it('CT-CLI-002-03 - should return 200 with empty list when user has no clients', async () => {
    prismaService.client.findMany.mockResolvedValue([]);
    prismaService.client.count.mockResolvedValue(0);

    const response = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toEqual([]);
    expect(response.body).toHaveProperty('total', 0);
    expect(response.body).toHaveProperty('totalPages', 0);
  });

  it('CT-CLI-002-04 - should return 200 and filter by name', async () => {
    prismaService.client.findMany.mockResolvedValue([]);
    prismaService.client.count.mockResolvedValue(0);

    await request(app.getHttpServer())
      .get('/clients?name=João')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(prismaService.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'João', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('CT-CLI-002-05 - should return 200 and filter by document', async () => {
    prismaService.client.findMany.mockResolvedValue([]);
    prismaService.client.count.mockResolvedValue(0);

    await request(app.getHttpServer())
      .get('/clients?document=12345678900')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(prismaService.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          document: '12345678900',
        }),
      }),
    );
  });

  it('CT-CLI-002-06 - should return 200 and filter by status', async () => {
    prismaService.client.findMany.mockResolvedValue([]);
    prismaService.client.count.mockResolvedValue(0);

    await request(app.getHttpServer())
      .get('/clients?status=true')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(prismaService.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: true,
        }),
      }),
    );
  });
});
