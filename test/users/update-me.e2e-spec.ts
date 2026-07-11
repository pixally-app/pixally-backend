import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { UsersController } from '../../src/users/users.controller.js';
import { UsersService } from '../../src/users/users.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('PATCH /users/me (CT-USR-002)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: {
      findUnique: jest.Mock<any>;
      findFirst: jest.Mock<any>;
      update: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();

  const mockUser = {
    id: mockUserId,
    username: 'João Silva',
    companyName: 'Empresa Ltda',
    email: 'joao@gmail.com',
    document: '12345678900',
    phone: '11999999999',
    role: 'user',
    createdAt: new Date(),
  };

  beforeAll(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [UsersController],
      providers: [UsersService],
      prismaService,
    }));
    accessToken = jwtService.sign({ sub: mockUserId, email: mockUser.email, role: 'user' });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('CT-USR-002-01 - should return 200 when updating username', async () => {
    const updatedUser = { ...mockUser, username: 'Novo Nome' };

    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(mockUser);
    prismaService.user.update.mockResolvedValue(updatedUser);

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ username: 'Novo Nome' })
      .expect(200);

    expect(response.body).toHaveProperty('username', 'Novo Nome');
    expect(response.body).not.toHaveProperty('password');
  });

  it('CT-USR-002-02 - should return 200 when updating email', async () => {
    const newEmail = faker.internet.email().toLowerCase();
    const updatedUser = { ...mockUser, email: newEmail };

    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(mockUser);
    prismaService.user.findFirst.mockResolvedValue(null);
    prismaService.user.update.mockResolvedValue(updatedUser);

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: newEmail })
      .expect(200);

    expect(response.body).toHaveProperty('email', newEmail);
  });

  it('CT-USR-002-03 - should return 200 when updating companyName', async () => {
    const updatedUser = { ...mockUser, companyName: 'Nova Empresa' };

    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(mockUser);
    prismaService.user.update.mockResolvedValue(updatedUser);

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyName: 'Nova Empresa' })
      .expect(200);

    expect(response.body).toHaveProperty('companyName', 'Nova Empresa');
  });

  it('CT-USR-002-04 - should return 409 when email is already in use', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(mockUser);
    prismaService.user.findFirst.mockResolvedValue({ id: faker.string.uuid() });

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'outro@gmail.com' })
      .expect(409);

    expect(response.body).toMatchObject({ statusCode: 409 });
  });

  it('CT-USR-002-05 - should return 400 when email format is invalid', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: true });

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'emailinvalido' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });

  it('CT-USR-002-06 - should return 200 with empty body and no changes', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(mockUser);
    prismaService.user.update.mockResolvedValue(mockUser);

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);

    expect(response.body).toHaveProperty('id', mockUserId);
  });

  it('CT-USR-002-07 - should return 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ username: 'Novo Nome' })
      .expect(401);
  });

  it('CT-USR-002-08 - should return 401 when user is inactive', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: false });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ username: 'Novo Nome' })
      .expect(401);
  });
});
