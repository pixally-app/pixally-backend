import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { UsersController } from '../../src/users/users.controller.js';
import { UsersService } from '../../src/users/users.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('DELETE /users/:id (CT-USR-004)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;
  let prismaService: {
    user: {
      findUnique: jest.Mock<any>;
      update: jest.Mock<any>;
    };
  };

  const mockAdminId = faker.string.uuid();
  const mockUserId = faker.string.uuid();
  const mockTargetId = faker.string.uuid();

  const mockTarget = {
    id: mockTargetId,
    username: 'João Silva',
    email: 'joao@gmail.com',
    role: 'user',
    isActive: true,
  };

  beforeAll(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
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

  it('CT-USR-004-01 - should return 204 when admin deactivates an existing user', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(mockTarget);
    prismaService.user.update.mockResolvedValue({ ...mockTarget, isActive: false });

    await request(app.getHttpServer())
      .delete(`/users/${mockTargetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    expect(prismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockTargetId },
        data: { isActive: false },
      }),
    );
  });

  it('CT-USR-004-02 - should return 404 when user does not exist', async () => {
    prismaService.user.findUnique
      .mockResolvedValueOnce({ isActive: true })
      .mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .delete(`/users/${faker.string.uuid()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body).toMatchObject({ statusCode: 404 });
  });

  it('CT-USR-004-03 - should return 403 when user with role user tries to deactivate', async () => {
    prismaService.user.findUnique.mockResolvedValueOnce({ isActive: true });

    await request(app.getHttpServer())
      .delete(`/users/${mockTargetId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('CT-USR-004-04 - should return 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${mockTargetId}`)
      .expect(401);
  });
});
