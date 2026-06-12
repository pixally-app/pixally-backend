import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export enum AccountReceivableStatusFilter {
  TODOS = 'todos',
  PENDENTE = 'pendente',
  PAGO = 'pago',
  VENCIDO = 'vencido',
}

export class ListAccountsReceivableQueryDto {
  @ApiPropertyOptional({
    enum: AccountReceivableStatusFilter,
    example: AccountReceivableStatusFilter.PENDENTE,
    description: 'Filtro por status: todos, pendente, pago, vencido',
  })
  @IsOptional()
  @IsEnum(AccountReceivableStatusFilter)
  status?: AccountReceivableStatusFilter;

  @ApiPropertyOptional({ example: 'uuid-do-cliente', description: 'Filtrar por cliente' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}