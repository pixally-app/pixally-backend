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

describe('PATCH /clients/:id (CT-CLI-004)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    client: {
      findFirst: jest.Mock<any>;
      update: jest.Mock<any>;
    };
    phoneClient: {
      findFirst: jest.Mock<any>;
      findUnique: jest.Mock<any>;
      update: jest.Mock<any>;
      create: jest.Mock<any>;
    };
    $transaction: jest.Mock<any>;
  };

  const mockUserId = faker.string.uuid();
  const mockClientId = faker.string.uuid();

  const existingClient = {
    id: mockClientId,
    userId: mockUserId,
    name: 'Original Name',
    document: '12345678900',
    documentType: 'cpf',
    status: true,
    phones: null,
    deletedAt: null,
    amount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    prismaService = {
      client: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      phoneClient: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
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

  it('CT-CLI-004-01 - should return 200 and updated client data', async () => {
    prismaService.client.findFirst.mockResolvedValue(existingClient);

    const updatedClient = {
      ...existingClient,
      name: 'Updated Name',
      updatedAt: new Date(),
      phoneClients: [],
    };

    prismaService.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        client: { update: jest.fn<any>().mockResolvedValue(updatedClient) },
        phoneClient: { findFirst: jest.fn<any>().mockResolvedValue(null) },
      };
      return fn(tx);
    });

    const response = await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Name' })
      .expect(200);

    expect(response.body).toHaveProperty('id', mockClientId);
    expect(response.body).toHaveProperty('name', 'Updated Name');
  });

  it('CT-CLI-004-02 - should return 404 when client does not exist', async () => {
    prismaService.client.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch(`/clients/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Name' })
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Client not found',
    });
  });

  it('CT-CLI-004-03 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .send({ name: 'Updated Name' })
      .expect(401);
  });
});
