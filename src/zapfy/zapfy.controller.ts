import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ConnectIntegrationDto } from './dto/connect-integration.dto.js';
import { IntegrationStatusResponseDto, QrCodeResponseDto } from './dto/integration-status.dto.js';
import { ZapfyService } from './zapfy.service.js';

@ApiTags('Zapfy')
@Controller('zapfy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ZapfyController {
  constructor(private readonly zapfyService: ZapfyService) {}

  @Get('qrcode')
  @ApiOperation({ summary: 'Buscar QR code para conectar WhatsApp' })
  @ApiResponse({ status: 200, description: 'QR code em base64', type: QrCodeResponseDto })
  @ApiResponse({ status: 401, description: 'Não autorizado - token JWT inválido ou ausente' })
  @ApiResponse({ status: 404, description: 'Nenhuma integração Zapfy encontrada para este usuário' })
  @ApiResponse({ status: 422, description: 'Credenciais Zapfy inválidas' })
  getQrCode(@CurrentUser() user: AuthenticatedUser) {
    return this.zapfyService.getQrCode(user.userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Buscar status da conexão com WhatsApp' })
  @ApiResponse({ status: 200, description: 'Status da instância', type: IntegrationStatusResponseDto })
  @ApiResponse({ status: 401, description: 'Não autorizado - token JWT inválido ou ausente' })
  @ApiResponse({ status: 404, description: 'Nenhuma integração Zapfy encontrada para este usuário' })
  @ApiResponse({ status: 422, description: 'Credenciais Zapfy inválidas' })
  @ApiResponse({ status: 503, description: 'API do Zapfy indisponível' })
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.zapfyService.getStatus(user.userId);
  }

  @Post('disconnect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desconectar instância WhatsApp' })
  @ApiResponse({ status: 200, description: 'Instância desconectada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token JWT inválido ou ausente' })
  @ApiResponse({ status: 404, description: 'Nenhuma integração Zapfy encontrada para este usuário' })
  @ApiResponse({ status: 503, description: 'API do Zapfy indisponível' })
  disconnect(@CurrentUser() user: AuthenticatedUser) {
    return this.zapfyService.disconnect(user.userId);
  }

  @Post('admin/users/:userId/connect')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Vincular instância Zapfy a um usuário e configurar webhook' })
  @ApiResponse({ status: 200, description: 'Integração salva e webhook configurado' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token JWT inválido ou ausente' })
  @ApiResponse({ status: 403, description: 'Acesso negado — apenas administradores' })
  connectInstance(@Param('userId') userId: string, @Body() dto: ConnectIntegrationDto) {
    return this.zapfyService.connectInstance(userId, dto);
  }
}
