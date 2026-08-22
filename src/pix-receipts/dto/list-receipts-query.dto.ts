import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ReceiptStatusFilter {
  ANALYSING = 'ANALYSING',
  RECEIVED = 'RECEIVED',
  RED_FLAG = 'RED_FLAG',
  YELLOW_FLAG = 'YELLOW_FLAG',
  RECONCILED = 'RECONCILED',
  ERROR = 'ERROR',
}

export enum ReceiptOriginFilter {
  MANUAL = 'manual',
  WHATSAPP = 'whatsapp',
}

export class ListReceiptsQueryDto {
  @ApiPropertyOptional({ enum: ReceiptStatusFilter })
  @IsOptional()
  @IsEnum(ReceiptStatusFilter)
  status?: ReceiptStatusFilter;

  @ApiPropertyOptional({ enum: ReceiptOriginFilter })
  @IsOptional()
  @IsEnum(ReceiptOriginFilter)
  origin?: ReceiptOriginFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
