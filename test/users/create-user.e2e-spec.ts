import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { UsersController } from '../../src/users/users.controller.js';
import { UsersService } from '../../src/users/users.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('POST /users (CT-USR-003)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;
  let prismaService: {
    user: {
      findUnique: jest.Mock<any>;
      create: jest.Mock<any>;
    };
  };

  const mockAdminId = faker.string.uuid();
  const mockUserId = faker.string.uuid();

  const validPayload = {
    username: 'João Silva',
    email: 'joao@gmail.com',
    document: '12345678900',
    phone: '11999999999',
    password: 'Senha@123',
  };

  const createdUser = {
    id: faker.string.uuid(),
    username: validPayload.username,
    companyName: null,
    email: validPayload.email,
    document: validPayload.document,
    phone: validPayload.phone,
    role: 'user',
    createdAt: new Date(),
  };

  beforeAll(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [UsersController],
      providers: [UsersService],
      prismaService,
    }));
    adminToken = jwtService.sign({ sub: mockAdminId, email: 'admin@gmail.com', role: 'admin' });
    userToken = jwtService.sign({ sub: mockUserId, email: 'user@gmail.com', role: 'user' });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('CT-USR-003-01 - should return 201 when admin creates a user with valid data', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaService.user.create.mockResolvedValue(createdUser);

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPayload)
      .expect(201);

    expect(response.body).toMatchObject({
      username: validPayload.username,
      email: validPayload.email,
      document: validPayload.document,
      role: 'user',
    });
    expect(response.body).not.toHaveProperty('password');
  });

  it('CT-USR-003-02 - should return 409 when email is already registered', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce({ id: faker.string.uuid(), email: validPayload.email });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPayload)
      .expect(409);

    expect(response.body).toMatchObject({ statusCode: 409 });
    expect(response.body.message).toContain('Email');
  });

  it('CT-USR-003-03 - should return 409 when document is already registered', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: faker.string.uuid(), document: validPayload.document });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPayload)
      .expect(409);

    expect(response.body).toMatchObject({ statusCode: 409 });
    expect(response.body.message).toContain('Documento');
  });

  it('CT-USR-003-04 - should return 400 when required fields are missing', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: true });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'João' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(Array.isArray(response.body.message)).toBe(true);
  });

  it('CT-USR-003-05 - should return 400 when password has no uppercase letter', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: true });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validPayload, password: 'abc@123' })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('uppercase')]),
    );
  });

  it('CT-USR-003-06 - should return 400 when password has no number', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: true });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validPayload, password: 'Abc@def' })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('number')]),
    );
  });

  it('CT-USR-003-07 - should return 400 when password has no special character', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: true });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validPayload, password: 'Abc1234' })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('special')]),
    );
  });

  it('CT-USR-003-08 - should return 403 when user with role user tries to create', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: true });

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .send(validPayload)
      .expect(403);
  });

  it('CT-USR-003-09 - should return 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send(validPayload)
      .expect(401);
  });
});
