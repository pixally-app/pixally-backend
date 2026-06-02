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

describe('DELETE /clients/:id (CT-CLI-005)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    client: {
      findFirst: jest.Mock<any>;
      update: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();
  const mockClientId = faker.string.uuid();

  beforeAll(async () => {
    prismaService = {
      client: {
        findFirst: jest.fn(),
        update: jest.fn(),
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

  it('CT-CLI-005-01 - should return 204 when client is successfully deleted', async () => {
    prismaService.client.findFirst.mockResolvedValue({
      id: mockClientId,
      userId: mockUserId,
      name: 'Test Client',
      document: '12345678900',
      deletedAt: null,
    });
    prismaService.client.update.mockResolvedValue({});

    await request(app.getHttpServer())
      .delete(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    expect(prismaService.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockClientId },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('CT-CLI-005-02 - should return 404 when client does not exist', async () => {
    prismaService.client.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .delete(`/clients/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Client not found',
    });
  });

  it('CT-CLI-005-03 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${mockClientId}`)
      .expect(401);
  });
});
