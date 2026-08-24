import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WarningsController } from './warnings.controller.js';
import { WarningsService } from './warnings.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WarningsController],
  providers: [WarningsService],
})
export class WarningsModule {}
