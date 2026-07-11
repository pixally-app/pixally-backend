import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { UsersController } from '../../src/users/users.controller.js';
import { UsersService } from '../../src/users/users.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('GET /users/me (CT-USR-001)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: { user: { findUnique: jest.Mock<any> } };

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

  it('CT-USR-001-01 - should return 200 with authenticated user data', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(mockUser);

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: mockUserId,
      username: mockUser.username,
      email: mockUser.email,
      document: mockUser.document,
      phone: mockUser.phone,
      role: mockUser.role,
    });
    expect(response.body).not.toHaveProperty('password');
  });

  it('CT-USR-001-02 - should return 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .get('/users/me')
      .expect(401);
  });

  it('CT-USR-001-03 - should return 401 when user is inactive', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: false });

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
