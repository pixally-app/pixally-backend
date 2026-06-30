import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export enum AccountReceivableStatusFilter {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export class ListAccountsReceivableQueryDto {
  @ApiPropertyOptional({
    enum: Object.values(AccountReceivableStatusFilter),
    example: AccountReceivableStatusFilter.PENDING,
    description: 'Filtro por status: PENDING, PAID, OVERDUE, CANCELLED',
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