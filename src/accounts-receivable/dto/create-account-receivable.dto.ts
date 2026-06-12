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
  clientId: string;

  @ApiPropertyOptional({ example: 'uuid-do-comprovante', description: 'ID do comprovante PIX vinculado' })
  @IsOptional()
  @IsUUID()
  pixReceiptId?: string;

  @ApiPropertyOptional({ example: 'Consultoria mensal', description: 'Descrição do serviço' })
  @IsOptional()
  @IsString()
  descriptionService?: string;

  @ApiProperty({ example: 1500.0, description: 'Valor total da cobrança' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount: number;

  @ApiPropertyOptional({ example: 'uuid-grupo', description: 'ID do grupo de parcelamento' })
  @IsOptional()
  @IsUUID()
  installmentGroupId?: string;

  @ApiPropertyOptional({ example: 3, description: 'Quantidade de parcelas' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  installmentCount?: number;

  @ApiPropertyOptional({ example: 1, description: 'Número da parcela atual' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  installmentNumber?: number;

  @ApiProperty({ example: 500.0, description: 'Valor da parcela' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  installmentAmount: number;

  @ApiProperty({ example: '2026-07-01', description: 'Data de vencimento (YYYY-MM-DD)' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ example: 'comprovante.pdf', description: 'Comprovante de pagamento' })
  @IsOptional()
  @IsString()
  payStub?: string;
}
