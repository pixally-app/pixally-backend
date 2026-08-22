import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsReceivableModule } from './accounts-receivable/accounts-receivable.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { PixReceiptsModule } from './pix-receipts/pix-receipts.module.js';
import { ZapfyModule } from './zapfy/zapfy.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, ClientsModule, AccountsReceivableModule, UsersModule, ZapfyModule, PixReceiptsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
