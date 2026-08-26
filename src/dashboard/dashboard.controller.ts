import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumo')
  @ApiOperation({ summary: 'Resumo financeiro do mês atual' })
  @ApiResponse({ status: 200, description: 'Recebido no mês, a receber, vencidos e comprovantes processados' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user.userId);
  }

  @Get('graphic')
  @ApiOperation({ summary: 'Recebimentos dos últimos 7 dias' })
  @ApiResponse({ status: 200, description: 'Array com data e valor recebido por dia' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getGraphic(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getGraphic(user.userId);
  }
}
