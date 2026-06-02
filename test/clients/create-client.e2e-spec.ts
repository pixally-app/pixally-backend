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

describe('POST /clients (CT-CLI-001)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    client: {
      findFirst: jest.Mock<any>;
      create: jest.Mock<any>;
    };
    phoneClient: {
      findFirst: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();

  const validPayload = {
    name: faker.person.fullName(),
    document: '12345678900',
    documentType: 'cpf',
    phones: [{ dialCode: '+55', phoneNumber: '11987654321' }],
  };

  beforeAll(async () => {
    prismaService = {
      client: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      phoneClient: {
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

  it('CT-CLI-001-01 - should return 201 and client data with valid creation', async () => {
    prismaService.client.findFirst.mockResolvedValue(null);
    prismaService.phoneClient.findFirst.mockResolvedValue(null);

    const createdClient = {
      id: faker.string.uuid(),
      userId: mockUserId,
      name: validPayload.name,
      document: validPayload.document,
      documentType: validPayload.documentType,
      status: true,
      phones: null,
      deletedAt: null,
      amount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      phoneClients: [
        { id: faker.string.uuid(), clientId: '', dialCode: '+55', phoneNumber: '11987654321' },
      ],
    };
    prismaService.client.create.mockResolvedValue(createdClient);

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validPayload)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name', validPayload.name);
    expect(response.body).toHaveProperty('document', validPayload.document);
    expect(response.body).toHaveProperty('phones');
    expect(Array.isArray(response.body.phones)).toBe(true);
    expect(response.body.phones).toHaveLength(1);
    expect(response.body.phones[0]).toHaveProperty('phoneNumber', '11987654321');
  });

  it('CT-CLI-001-02 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .post('/clients')
      .send(validPayload)
      .expect(401);
  });

  it('CT-CLI-001-03 - should return 400 when name is missing', async () => {
    const { name, ...payloadWithoutName } = validPayload;

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payloadWithoutName)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('name')]),
    );
  });

  it('CT-CLI-001-04 - should return 400 when document is missing', async () => {
    const { document, ...payloadWithoutDocument } = validPayload;

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payloadWithoutDocument)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('document')]),
    );
  });

  it('CT-CLI-001-05 - should return 400 when phone format is invalid for Brazilian number', async () => {
    prismaService.client.findFirst.mockResolvedValue(null);
    prismaService.phoneClient.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        ...validPayload,
        phones: [{ dialCode: '+55', phoneNumber: '1234' }],
      })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Invalid Brazilian phone number');
  });

  it('CT-CLI-001-06 - should return 409 when document is already registered for the same user', async () => {
    prismaService.client.findFirst.mockResolvedValue({
      id: faker.string.uuid(),
      document: validPayload.document,
    });

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validPayload)
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
    });
    expect(response.body.message).toContain(validPayload.document);
  });

  it('CT-CLI-001-07 - should return 409 when phone number is already registered', async () => {
    prismaService.client.findFirst.mockResolvedValue(null);
    prismaService.phoneClient.findFirst.mockResolvedValue({
      id: faker.string.uuid(),
      dialCode: '+55',
      phoneNumber: '11987654321',
    });

    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validPayload)
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Phone number already registered',
    });
  });
});
