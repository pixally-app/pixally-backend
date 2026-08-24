import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { ListWarningsQueryDto } from './dto/list-warnings-query.dto.js';
import { ResolveWarningDto } from './dto/resolve-warning.dto.js';
import { WarningsService } from './warnings.service.js';

@ApiTags('Warnings')
@Controller('warnings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WarningsController {
  constructor(private readonly warningsService: WarningsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar alertas pendentes do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista paginada de alertas pendentes' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListWarningsQueryDto) {
    return this.warningsService.findAll(user.userId, query.page, query.limit, query.type);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolver um alerta' })
  @ApiResponse({ status: 200, description: 'Alerta resolvido' })
  @ApiResponse({ status: 400, description: 'Alerta já foi resolvido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Alerta não encontrado' })
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveWarningDto,
  ) {
    return this.warningsService.resolve(user.userId, id, body.resolutionReason);
  }
}
