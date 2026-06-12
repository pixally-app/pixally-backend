import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { AccountsReceivableService } from './accounts-receivable.service.js';
import { AccountReceivableResponseDto, PaginatedAccountsReceivableResponseDto } from './dto/account-receivable-response.dto.js';
import { CreateAccountReceivableDto } from './dto/create-account-receivable.dto.js';
import { ListAccountsReceivableQueryDto } from './dto/list-accounts-receivable-query.dto.js';
import { UpdateAccountReceivableDto } from './dto/update-account-receivable.dto.js';

@ApiTags('Accounts Receivable')
@Controller('contas')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountsReceivableController {
  constructor(private readonly accountsReceivableService: AccountsReceivableService) {}

  @Get()
  @ApiOperation({ summary: 'Listar contas a receber do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista paginada de contas a receber', type: PaginatedAccountsReceivableResponseDto })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAccountsReceivableQueryDto,
  ) {
    return this.accountsReceivableService.findAll(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar conta a receber por ID' })
  @ApiResponse({ status: 200, description: 'Dados da conta a receber', type: AccountReceivableResponseDto })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Conta a receber não encontrada' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.accountsReceivableService.findOne(user.userId, id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Criar conta a receber' })
  @ApiResponse({ status: 201, description: 'Conta a receber criada com sucesso', type: AccountReceivableResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountReceivableDto,
  ) {
    return this.accountsReceivableService.create(user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar conta a receber' })
  @ApiResponse({ status: 200, description: 'Conta a receber atualizada com sucesso', type: AccountReceivableResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Conta a receber não encontrada' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccountReceivableDto,
  ) {
    return this.accountsReceivableService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remover conta a receber' })
  @ApiResponse({ status: 204, description: 'Conta a receber removida com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Conta a receber não encontrada' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.accountsReceivableService.remove(user.userId, id);
  }
}
