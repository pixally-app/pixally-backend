import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateAccountReceivableDto {
  @ApiPropertyOptional({ example: 'uuid-do-comprovante' })
  @IsOptional()
  @IsUUID()
  pixReceiptId?: string;

  @ApiPropertyOptional({ example: 'Consultoria mensal' })
  @IsOptional()
  @IsString()
  descriptionService?: string;

  @ApiPropertyOptional({ example: 1500.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  installmentCount?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  installmentNumber?: number;

  @ApiPropertyOptional({ example: 500.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  installmentAmount?: number;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: '2026-06-15T10:00:00Z', description: 'Data de pagamento (preencher ao marcar como pago)' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ example: 'comprovante.pdf' })
  @IsOptional()
  @IsString()
  payStub?: string;
}
