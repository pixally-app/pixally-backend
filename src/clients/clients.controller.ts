import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ClientsService } from './clients.service.js';
import { ListClientsQueryDto } from './dto/list-clients-query.dto.js';
import { PaginatedClientsResponseDto } from './dto/client-response.dto.js';

@ApiTags('Clients')
@Controller('clients')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista paginada de clientes', type: PaginatedClientsResponseDto })
  @ApiResponse({ status: 401, description: 'Não autorizado - token JWT inválido ou ausente' })
  findAll(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Query() query: ListClientsQueryDto,
  ) {
    return this.clientsService.findAll(user.userId, query);
  }
}
