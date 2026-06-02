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

  it('CT-CLI-004-04 - should return 409 when document is already registered for another client', async () => {
    prismaService.client.findFirst
      .mockResolvedValueOnce(existingClient)
      .mockResolvedValueOnce({ id: faker.string.uuid(), document: '99988877766' });

    const response = await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ document: '99988877766' })
      .expect(409);

    expect(response.body).toHaveProperty('statusCode', 409);
    expect(response.body.message).toContain('99988877766');
  });

  it('CT-CLI-004-05 - should return 200 when creating a new phone', async () => {
    prismaService.client.findFirst.mockResolvedValue(existingClient);

    const updatedClient = {
      ...existingClient,
      updatedAt: new Date(),
      phoneClients: [
        { id: faker.string.uuid(), clientId: mockClientId, dialCode: '+55', phoneNumber: '11987654321' },
      ],
    };

    prismaService.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        client: { update: jest.fn<any>().mockResolvedValue(updatedClient) },
        phoneClient: {
          findFirst: jest.fn<any>().mockResolvedValue(null),
          create: jest.fn<any>().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    const response = await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phones: [{ dialCode: '+55', phoneNumber: '11987654321' }] })
      .expect(200);

    expect(response.body).toHaveProperty('phones');
    expect(response.body.phones).toHaveLength(1);
    expect(response.body.phones[0]).toHaveProperty('phoneNumber', '11987654321');
  });

  it('CT-CLI-004-06 - should return 200 when updating an existing phone', async () => {
    const phoneId = faker.string.uuid();
    prismaService.client.findFirst.mockResolvedValue(existingClient);
    prismaService.phoneClient.findUnique.mockResolvedValue({
      id: phoneId,
      clientId: mockClientId,
      dialCode: '+55',
      phoneNumber: '11987654321',
    });

    const updatedClient = {
      ...existingClient,
      updatedAt: new Date(),
      phoneClients: [
        { id: phoneId, clientId: mockClientId, dialCode: '+55', phoneNumber: '11999999999' },
      ],
    };

    prismaService.$transaction.mockImplementation(async (fn: any) => {
      const findFirstMock = jest.fn<any>()
        .mockResolvedValueOnce(null) // uniqueness check — no conflict
        .mockResolvedValueOnce({ id: phoneId, clientId: mockClientId }); // existence check — found
      const tx = {
        client: { update: jest.fn<any>().mockResolvedValue(updatedClient) },
        phoneClient: {
          findFirst: findFirstMock,
          update: jest.fn<any>().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    const response = await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phones: [{ id: phoneId, dialCode: '+55', phoneNumber: '11999999999' }] })
      .expect(200);

    expect(response.body).toHaveProperty('phones');
    expect(response.body.phones[0]).toHaveProperty('phoneNumber', '11999999999');
  });

  it('CT-CLI-004-07 - should return 400 when new phone is missing dialCode or phoneNumber', async () => {
    prismaService.client.findFirst.mockResolvedValue(existingClient);

    const response = await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phones: [{ dialCode: '+55' }] })
      .expect(400);

    expect(response.body).toHaveProperty('statusCode', 400);
    expect(response.body.message).toContain('Both dialCode and phoneNumber are required');
  });

  it('CT-CLI-004-08 - should resolve dialCode from existing phone when only phoneNumber is sent', async () => {
    const phoneId = faker.string.uuid();
    prismaService.client.findFirst.mockResolvedValue(existingClient);
    prismaService.phoneClient.findUnique.mockResolvedValue({
      id: phoneId,
      clientId: mockClientId,
      dialCode: '+55',
      phoneNumber: '11987654321',
    });

    const updatedClient = {
      ...existingClient,
      updatedAt: new Date(),
      phoneClients: [
        { id: phoneId, clientId: mockClientId, dialCode: '+55', phoneNumber: '11988888888' },
      ],
    };

    prismaService.$transaction.mockImplementation(async (fn: any) => {
      const findFirstMock = jest.fn<any>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: phoneId, clientId: mockClientId });
      const tx = {
        client: { update: jest.fn<any>().mockResolvedValue(updatedClient) },
        phoneClient: {
          findFirst: findFirstMock,
          update: jest.fn<any>().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    const response = await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phones: [{ id: phoneId, phoneNumber: '11988888888' }] })
      .expect(200);

    expect(response.body.phones[0]).toHaveProperty('phoneNumber', '11988888888');
  });

  it('CT-CLI-004-09 - should return 409 when phone number is duplicated in update', async () => {
    prismaService.client.findFirst.mockResolvedValue(existingClient);

    prismaService.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        phoneClient: {
          findFirst: jest.fn<any>().mockResolvedValue({
            id: faker.string.uuid(),
            dialCode: '+55',
            phoneNumber: '11987654321',
          }),
        },
      };
      return fn(tx);
    });

    const response = await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phones: [{ dialCode: '+55', phoneNumber: '11987654321' }] })
      .expect(409);

    expect(response.body).toHaveProperty('statusCode', 409);
  });

  it('CT-CLI-004-10 - should return 404 when phone id does not belong to the client', async () => {
    const fakePhoneId = faker.string.uuid();
    prismaService.client.findFirst.mockResolvedValue(existingClient);

    prismaService.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        phoneClient: {
          findFirst: jest.fn<any>()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null),
        },
      };
      return fn(tx);
    });

    const response = await request(app.getHttpServer())
      .patch(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phones: [{ id: fakePhoneId, dialCode: '+55', phoneNumber: '11977777777' }] })
      .expect(404);

    expect(response.body).toHaveProperty('statusCode', 404);
    expect(response.body.message).toContain(fakePhoneId);
  });
});
