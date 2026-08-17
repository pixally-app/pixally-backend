import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { ReconcileReceiptDto } from './dto/reconcile-receipt.dto.js';
import { UpdateReceiptDto } from './dto/update-receipt.dto.js';
import { PixReceiptsService } from './pix-receipts.service.js';

@ApiTags('Pix Receipts')
@Controller('receipts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PixReceiptsController {
  constructor(private readonly pixReceiptsService: PixReceiptsService) {}

  @Post('upload')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar comprovante manualmente (imagem ou PDF)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Comprovante recebido e em processamento' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.pixReceiptsService.upload(user.userId, file);
  }

  @Get()
  @ApiOperation({ summary: 'Listar comprovantes do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista paginada de comprovantes' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('origin') origin?: string,
    @Query('clientName') clientName?: string,
  ) {
    return this.pixReceiptsService.findAll(
      user.userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      { status, origin, clientName },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar comprovante por ID' })
  @ApiResponse({ status: 200, description: 'Dados do comprovante com blob e warnings' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Comprovante não encontrado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.pixReceiptsService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar comprovante (vincular cliente, confirmar, etc.)' })
  @ApiResponse({ status: 200, description: 'Comprovante atualizado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Comprovante não encontrado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateReceiptDto,
  ) {
    return this.pixReceiptsService.update(user.userId, id, body);
  }

  @Patch(':id/reconcile')
  @ApiOperation({ summary: 'Conciliar comprovante com uma conta a receber' })
  @ApiResponse({ status: 200, description: 'Comprovante conciliado com sucesso' })
  @ApiResponse({ status: 400, description: 'Conta cancelada' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Comprovante ou conta a receber não encontrados' })
  reconcile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReconcileReceiptDto,
  ) {
    return this.pixReceiptsService.reconcile(user.userId, id, body.accountReceivableId);
  }

  @Patch(':id/unreconcile')
  @ApiOperation({ summary: 'Desvincular comprovante da conta a receber' })
  @ApiResponse({ status: 200, description: 'Comprovante desvinculado, conta volta a PENDING' })
  @ApiResponse({ status: 400, description: 'Comprovante não está conciliado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Comprovante não encontrado' })
  unreconcile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.pixReceiptsService.unreconcile(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar comprovante' })
  @ApiResponse({ status: 204, description: 'Comprovante deletado' })
  @ApiResponse({ status: 400, description: 'Comprovante ainda está sendo analisado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Comprovante não encontrado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.pixReceiptsService.remove(user.userId, id);
  }
}
