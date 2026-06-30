import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountsReceivableController } from './accounts-receivable.controller.js';
import { AccountsReceivableService } from './accounts-receivable.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AccountsReceivableController],
  providers: [AccountsReceivableService],
})
export class AccountsReceivableModule {}
