import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { ClientsController } from '../../src/clients/clients.controller.js';
import { ClientsService } from '../../src/clients/clients.service.js';
import { buildTestApp } from '../helpers/build-test-app.js';

describe('DELETE /clients/:id (CT-CLI-005)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let prismaService: {
    user: { findUnique: jest.Mock<any> };
    client: {
      findFirst: jest.Mock<any>;
      update: jest.Mock<any>;
    };
    accountReceivable: {
      count: jest.Mock<any>;
    };
  };

  const mockUserId = faker.string.uuid();
  const mockClientId = faker.string.uuid();

  beforeAll(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      client: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      accountReceivable: {
        count: jest.fn(),
      },
    };

    ({ app, jwtService } = await buildTestApp({
      controllers: [ClientsController],
      providers: [ClientsService],
      prismaService,
    }));
    accessToken = jwtService.sign({ sub: mockUserId, email: 'test@test.com', role: 'user' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prismaService.user.findUnique.mockResolvedValue({ isActive: true });
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
    prismaService.accountReceivable.count.mockResolvedValue(0);
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

  it('CT-CLI-005-03 - should return 400 when client has open accounts receivable', async () => {
    prismaService.client.findFirst.mockResolvedValue({
      id: mockClientId,
      userId: mockUserId,
      name: 'Test Client',
      document: '12345678900',
      deletedAt: null,
    });
    prismaService.accountReceivable.count.mockResolvedValue(2);

    const response = await request(app.getHttpServer())
      .delete(`/clients/${mockClientId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Cannot delete a client with open accounts receivable. Please cancel or resolve them first.');
  });

  it('CT-CLI-005-04 - should return 401 when no JWT token is provided', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${mockClientId}`)
      .expect(401);
  });
});
