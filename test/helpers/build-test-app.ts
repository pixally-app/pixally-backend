import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { JwtStrategy } from '../../src/auth/jwt.strategy.js';
import { RolesGuard } from '../../src/auth/roles.guard.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export async function buildTestApp({
  controllers,
  providers,
  prismaService,
}: {
  controllers: any[];
  providers: any[];
  prismaService: any;
}): Promise<{ app: INestApplication; jwtService: JwtService }> {
  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: 'test-secret-key', signOptions: { expiresIn: '1h' } }),
      PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    controllers,
    providers: [
      ...providers,
      RolesGuard,
      Reflector,
      { provide: PrismaService, useValue: prismaService },
      {
        provide: JwtStrategy,
        useFactory: () =>
          new JwtStrategy(
            { getOrThrow: () => 'test-secret-key' } as any,
            prismaService as any,
          ),
      },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();

  const jwtService = module.get(JwtService);
  return { app, jwtService };
}
