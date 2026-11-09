import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAccountReceivableDto {
  @ApiProperty({ example: 'uuid-do-cliente', description: 'ID do cliente' })
  @IsUUID()
  @IsNotEmpty()
  clientId!: string;

  @ApiProperty({ example: 'Manutenção de ar condicionado', description: 'Nome do serviço' })
  @IsString()
  @IsNotEmpty()
  serviceName!: string;

  @ApiPropertyOptional({ example: 'Limpeza e recarga de gás', description: 'Descrição do serviço' })
  @IsOptional()
  @IsString()
  serviceDescription?: string;

  @ApiProperty({ example: 1500.0, description: 'Valor total da cobrança' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount!: number;

  @ApiPropertyOptional({ example: 3, description: 'Quantidade de parcelas (mínimo 1; omitir para pagamento único)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  installmentCount?: number;

  @ApiProperty({ example: '2026-07-01', description: 'Data de vencimento da primeira parcela (ou única)' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ example: 'comprovante.pdf', description: 'Comprovante de pagamento' })
  @IsOptional()
  @IsString()
  payStub?: string;
}
