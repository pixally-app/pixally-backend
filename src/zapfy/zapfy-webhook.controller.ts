import { Body, Controller, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { EvolutionWebhookPayload } from './dto/webhook-payload.dto.js';
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
  @ApiOperation({ summary: 'Receber eventos de WhatsApp - chamado pelo provider, sem autenticação JWT' })
  @ApiResponse({ status: 200, description: 'Evento processado com sucesso' })
  @ApiResponse({ status: 401, description: 'Secret inválido ou ausente' })
  handleWebhook(
    @Query('secret') secret: string,
    @Body() payload: EvolutionWebhookPayload,
  ) {
    const expected = this.config.getOrThrow<string>('ZAPFY_WEBHOOK_SECRET');

    if (!secret || secret !== expected) {
      this.logger.warn('Webhook received with invalid secret');
      throw new UnauthorizedException('Invalid webhook secret');
    }

    this.logger.log(`Webhook recebido — evento: ${payload.event} | instância: ${payload.instance}`);

    return this.zapfyService.handleWebhook(payload);
  }
}
