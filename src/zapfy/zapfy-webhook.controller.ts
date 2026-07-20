import { Body, Controller, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ZapfyWebhookPayload } from './dto/webhook-payload.dto.js';
import { ZapfyService } from './zapfy.service.js';

@ApiTags('Zapfy')
@Controller('zapfy')
export class ZapfyWebhookController {
  private readonly logger = new Logger(ZapfyWebhookController.name);

  constructor(
    private readonly zapfyService: ZapfyService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receber eventos do Zapfy - chamado pelo Zapfy, sem autenticação JWT' })
  @ApiResponse({ status: 200, description: 'Evento processado com sucesso' })
  @ApiResponse({ status: 401, description: 'Secret inválido ou ausente' })
  handleWebhook(
    @Query('secret') secret: string,
    @Body() payload: ZapfyWebhookPayload,
  ) {
    const expected = this.config.getOrThrow<string>('ZAPFY_WEBHOOK_SECRET');

    if (!secret || secret !== expected) {
      this.logger.warn('Webhook received with invalid secret');
      throw new UnauthorizedException('Invalid webhook secret');
    }

    this.logger.log(`Webhook recebido — tipo: ${payload.type} | instância: ${payload.instanceKey}`);

    return this.zapfyService.handleWebhook(payload);
  }
}
