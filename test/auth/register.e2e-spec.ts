import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { AuthController } from '../../src/auth/auth.controller.js';
import { AuthService } from '../../src/auth/auth.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { EmailService } from '../../src/email/email.service.js';

describe('POST /auth/register (CT-AUTH-001)', () => {
  let app: INestApplication;
  let prismaService: {
    user: {
      findUnique: jest.Mock<any>;
      create: jest.Mock<any>;
    };
  };

  const validPayload = {
    username: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: 'Test@1234',
    document: '12345678900',
    phone: '11999999999',
  };

  beforeAll(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
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
        { provide: EmailService, useValue: { sendResetPasswordEmail: jest.fn() } },
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

  it('CT-AUTH-001-01 - should return 201 and user data with valid registration', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    const createdUser = {
      id: faker.string.uuid(),
      username: validPayload.username,
      email: validPayload.email,
      document: validPayload.document,
      phone: validPayload.phone,
      password: 'hashed_password',
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaService.user.create.mockResolvedValue(createdUser);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(validPayload)
      .expect(201);

    expect(response.body).toHaveProperty('access_token');
    expect(typeof response.body.access_token).toBe('string');
    expect(response.body.access_token.split('.')).toHaveLength(3);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('id', createdUser.id);
    expect(response.body.user).toHaveProperty('email', validPayload.email);
    expect(response.body.user).toHaveProperty('username', validPayload.username);
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('CT-AUTH-001-02 - should return 409 when email is already registered', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({
      id: faker.string.uuid(),
      email: validPayload.email,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(validPayload)
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
    });
  });

  it('CT-AUTH-001-02b - should return 409 when document is already registered', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: faker.string.uuid(), document: validPayload.document });

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(validPayload)
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Document already registered',
    });
  });

  it('CT-AUTH-001-02c - should return 409 on P2002 race condition for email', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    const prismaError = new Error('Unique constraint failed');
    Object.assign(prismaError, { code: 'P2002', meta: { target: ['email'] } });
    prismaService.user.create.mockRejectedValue(prismaError);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(validPayload)
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
    });
  });

  it('CT-AUTH-001-02d - should return 409 on P2002 race condition for document', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    const prismaError = new Error('Unique constraint failed');
    Object.assign(prismaError, { code: 'P2002', meta: { target: ['document'] } });
    prismaService.user.create.mockRejectedValue(prismaError);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(validPayload)
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Document already registered',
    });
  });

  it('CT-AUTH-001-03 - should return 400 when email field is missing', async () => {
    const { email, ...payloadWithoutEmail } = validPayload;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payloadWithoutEmail)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });

  it('CT-AUTH-001-04 - should return 400 when document field is missing', async () => {
    const { document, ...payloadWithoutDocument } = validPayload;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payloadWithoutDocument)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('document')]),
    );
  });

  it('CT-AUTH-001-05 - should return 400 when phone field is missing', async () => {
    const { phone, ...payloadWithoutPhone } = validPayload;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payloadWithoutPhone)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('phone')]),
    );
  });

  it('CT-AUTH-001-06 - should return 400 when password field is missing', async () => {
    const { password, ...payloadWithoutPassword } = validPayload;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(payloadWithoutPassword)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('password')]),
    );
  });

  it('CT-AUTH-001-07 - should return 400 when email format is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...validPayload, email: 'emailinvalido' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });

  it('CT-AUTH-001-08 - should return 400 when password is below minimum length', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...validPayload, password: 'Ab@1' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('password')]),
    );
  });

  it('CT-AUTH-001-09 - should return 400 when password has no uppercase letter', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...validPayload, password: 'abc@123' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('uppercase'),
      ]),
    );
  });

  it('CT-AUTH-001-10 - should return 400 when password has no special character', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...validPayload, password: 'Abc1234' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('special character'),
      ]),
    );
  });

  it('CT-AUTH-001-11 - should return 400 when password has no number', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...validPayload, password: 'Abc@def' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('number'),
      ]),
    );
  });
});
