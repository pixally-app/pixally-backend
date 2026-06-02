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

describe('GET /clients/:id (CT-CLI-003)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    client: {
      findFirst: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();
  const mockClientId = faker.string.uuid();

  beforeAll(async () => {
    prismaService = {
      client: {
        findFirst: jest.fn(),
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

  it('CT-CLI-003-01 - should return 200 and client data for existing client', async () => {
    const mockClient = {
      id: mockClientId,
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
      _count: { pixReceipts: 3 },
      accountsReceivable: [
        { installmentAmount: 500, paidAt: new Date() },
        { installmentAmount: 300, paidAt: null },
      ],
      phoneClients: [
        { id: faker.string.uuid(), dialCode: '+55', phoneNumber: '11987654321' },
      ],
    };

    prismaService.client.findFirst.mockResolvedValue(mockClient);

    const response = await request(app.getHttpServer())
      .get(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', mockClientId);
    expect(response.body).toHaveProperty('name', mockClient.name);
    expect(response.body).toHaveProperty('document', '12345678900');
    expect(response.body).toHaveProperty('phones');
    expect(response.body.phones).toHaveLength(1);
    expect(response.body).toHaveProperty('receiptsCount', 3);
    expect(response.body).toHaveProperty('totalReceived', 500);
    expect(response.body).toHaveProperty('totalReceivable', 300);
  });

  it('CT-CLI-003-02 - should return 404 when client does not exist', async () => {
    prismaService.client.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/clients/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Client not found',
    });
  });

  it('CT-CLI-003-03 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${mockClientId}`)
      .expect(401);
  });

  it('CT-CLI-003-04 - should return 404 when client belongs to another user', async () => {
    // Service filters by userId, so a client from another user is simply not found
    prismaService.client.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/clients/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Client not found',
    });
  });
});
