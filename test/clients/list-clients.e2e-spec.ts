import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { ClientsController } from '../../src/clients/clients.controller.js';
import { ClientsService } from '../../src/clients/clients.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { JwtStrategy } from '../../src/auth/jwt.strategy.js';

describe('GET /clients (CT-CLI-002)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    client: {
      findMany: jest.Mock<any>;
      count: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();

  beforeAll(async () => {
    prismaService = {
      client: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret-key',
          signOptions: { expiresIn: '1h' },
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      controllers: [ClientsController],
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: JwtStrategy,
          useFactory: () =>
            new JwtStrategy({
              getOrThrow: () => 'test-secret-key',
            } as any),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => {
    await app.close();
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
          { installmentAmount: 100, paidAt: new Date() },
          { installmentAmount: 200, paidAt: null },
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
});
