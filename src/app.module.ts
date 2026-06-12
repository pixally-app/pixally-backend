import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsReceivableModule } from './accounts-receivable/accounts-receivable.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, ClientsModule, AccountsReceivableModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
