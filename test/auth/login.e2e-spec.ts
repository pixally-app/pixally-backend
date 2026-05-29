import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthController } from '../../src/auth/auth.controller.js';
import { AuthService } from '../../src/auth/auth.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('POST /auth/login (CT-AUTH-002)', () => {
  let app: INestApplication;
  let prismaService: { user: { findUnique: jest.Mock<any> } };

  const plainPassword = 'Test@1234';
  let hashedPassword: string;
  let mockUser: Record<string, unknown>;

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash(plainPassword, 10);

    mockUser = {
      id: faker.string.uuid(),
      username: faker.internet.username(),
      email: faker.internet.email().toLowerCase(),
      password: hashedPassword,
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaService = {
      user: {
        findUnique: jest.fn(),
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
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('CT-AUTH-002-01 - should return 200 and a JWT access_token with valid credentials', async () => {
    prismaService.user.findUnique.mockResolvedValue(mockUser);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: mockUser.email, password: plainPassword })
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    expect(typeof response.body.access_token).toBe('string');
    expect(response.body.access_token.split('.')).toHaveLength(3);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('id', mockUser.id);
    expect(response.body.user).toHaveProperty('email', mockUser.email);
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('CT-AUTH-002-02 - should return 401 when email is incorrect', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'wrong@email.com', password: plainPassword })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });
  });

  it('CT-AUTH-002-03 - should return 401 when password is incorrect', async () => {
    prismaService.user.findUnique.mockResolvedValue(mockUser);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: mockUser.email, password: 'WrongPassword123' })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });
  });

  it('CT-AUTH-002-04 - should return 401 for an unregistered email', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: faker.internet.email(), password: plainPassword })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });
  });

  it('CT-AUTH-002-05 - should return 400 when email field is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ password: plainPassword })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });

  it('CT-AUTH-002-06 - should return 400 when password field is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: faker.internet.email() })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('password')]),
    );
  });

  it('CT-AUTH-002-07 - should return 400 when request body is empty', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(Array.isArray(response.body.message)).toBe(true);
    expect(response.body.message.length).toBeGreaterThanOrEqual(2);
  });
});
