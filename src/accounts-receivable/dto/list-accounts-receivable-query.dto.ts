import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export enum AccountReceivableStatusFilter {
  PENDENTE = 'pendente',
  PAGO = 'pago',
  VENCIDO = 'vencido',
}

export class ListAccountsReceivableQueryDto {
  @ApiPropertyOptional({
    enum: Object.values(AccountReceivableStatusFilter),
    example: AccountReceivableStatusFilter.PENDENTE,
    description: 'Filtro por status: pendente, pago, vencido',
  })
  @IsOptional()
  @IsEnum(AccountReceivableStatusFilter)
  status?: AccountReceivableStatusFilter;

  @ApiPropertyOptional({ example: 'uuid-do-cliente', description: 'Filtrar por cliente' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ example: 'uuid-do-grupo', description: 'Filtrar por grupo de parcelamento' })
  @IsOptional()
  @IsUUID()
  installmentGroupId?: string;

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