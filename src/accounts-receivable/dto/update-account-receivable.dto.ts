import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateAccountReceivableDto {
  @ApiPropertyOptional({ example: 'Manutenção de ar condicionado' })
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiPropertyOptional({ example: 'Limpeza e recarga de gás' })
  @IsOptional()
  @IsString()
  serviceDescription?: string;

  @ApiPropertyOptional({ example: 1500.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount?: number;

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
