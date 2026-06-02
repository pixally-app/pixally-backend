import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { ListClientsQueryDto } from './dto/list-clients-query.dto.js';
import { ClientResponseDto, PaginatedClientsResponseDto } from './dto/client-response.dto.js';

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

  @Get(':id')
  @ApiOperation({ summary: 'Buscar cliente por ID' })
  @ApiResponse({ status: 200, description: 'Dados do cliente', type: ClientResponseDto })
  @ApiResponse({ status: 401, description: 'Não autorizado - token JWT inválido ou ausente' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  findOne(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('id') id: string,
  ) {
    return this.clientsService.findOne(user.userId, id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Criar novo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso', type: ClientResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token JWT inválido ou ausente' })
  @ApiResponse({ status: 409, description: 'Documento ou telefone já cadastrado' })
  create(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar cliente' })
  @ApiResponse({ status: 200, description: 'Cliente atualizado com sucesso', type: ClientResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token JWT inválido ou ausente' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  @ApiResponse({ status: 409, description: 'Documento ou telefone já cadastrado' })
  update(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.userId, id, dto);
  }
}
