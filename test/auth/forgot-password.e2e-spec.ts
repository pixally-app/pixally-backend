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

describe('POST /auth/forgot-password (CT-AUTH-003)', () => {
  let app: INestApplication;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    passwordResetToken: {
      create: jest.Mock<any>;
      updateMany: jest.Mock<any>;
    };
  };
  let emailService: { sendResetPasswordEmail: jest.Mock<any> };

  const mockUser = {
    id: faker.string.uuid(),
    username: faker.internet.username(),
    email: faker.internet.email().toLowerCase(),
    password: 'hashed-password',
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    emailService = {
      sendResetPasswordEmail: jest.fn(),
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
        { provide: EmailService, useValue: emailService },
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

  it('CT-AUTH-003-01 - should return 200 and send reset email for a registered email', async () => {
    prismaService.user.findUnique.mockResolvedValue(mockUser);
    prismaService.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prismaService.passwordResetToken.create.mockResolvedValue({ id: faker.string.uuid() });
    emailService.sendResetPasswordEmail.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: mockUser.email })
      .expect(200);

    expect(response.body).toEqual({
      message: 'Password reset email sent successfully',
    });
    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: mockUser.email },
    });
    expect(prismaService.passwordResetToken.updateMany).toHaveBeenCalled();
    expect(prismaService.passwordResetToken.create).toHaveBeenCalled();
    expect(emailService.sendResetPasswordEmail).toHaveBeenCalledWith(
      mockUser.email,
      expect.any(String),
    );
  });

  it('CT-AUTH-003-02 - should return 200 with same message for an unregistered email (prevents user enumeration)', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nonexistent@email.com' })
      .expect(200);

    expect(response.body).toEqual({
      message: 'Password reset email sent successfully',
    });
    expect(prismaService.passwordResetToken.create).not.toHaveBeenCalled();
    expect(emailService.sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it('CT-AUTH-003-03 - should return 400 for an invalid email format', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'invalido' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });

  it('CT-AUTH-003-04 - should return 400 when email field is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });
});
