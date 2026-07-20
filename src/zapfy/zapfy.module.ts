import { Module } from '@nestjs/common';
import { ZapfyClient } from './zapfy.client.js';
import { ZapfyController } from './zapfy.controller.js';
import { ZapfyWebhookController } from './zapfy-webhook.controller.js';
import { ZapfyService } from './zapfy.service.js';

@Module({
  controllers: [ZapfyController, ZapfyWebhookController],
  providers: [ZapfyService, ZapfyClient],
})
export class ZapfyModule {}
