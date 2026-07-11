import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna dados do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Dados do usuário' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findMe(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualiza dados do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 409, description: 'Email já está em uso' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.userId, dto);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Cria um novo usuário (apenas admin)' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 409, description: 'Email ou documento já cadastrado' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Desativa um usuário (apenas admin)' })
  @ApiResponse({ status: 204, description: 'Usuário desativado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
