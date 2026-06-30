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
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function IsFutureOrTodayDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isFutureOrTodayDate',
      target: (object as any).constructor,
      propertyName,
      options: { message: 'dueDate must be today or in the future', ...validationOptions },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const input = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return input >= today;
        },
      },
    });
  };
}

export class CreateAccountReceivableDto {
  @ApiProperty({ example: 'uuid-do-cliente', description: 'ID do cliente' })
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @ApiPropertyOptional({ example: 'uuid-do-comprovante', description: 'ID do comprovante PIX vinculado' })
  @IsOptional()
  @IsUUID()
  pixReceiptId?: string;

  @ApiProperty({ example: 'Manutenção de ar condicionado', description: 'Nome do serviço' })
  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @ApiPropertyOptional({ example: 'Limpeza e recarga de gás', description: 'Descrição do serviço' })
  @IsOptional()
  @IsString()
  serviceDescription?: string;

  @ApiProperty({ example: 1500.0, description: 'Valor total da cobrança' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount: number;

  @ApiPropertyOptional({ example: 3, description: 'Quantidade de parcelas (omitir para pagamento único)' })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Type(() => Number)
  installmentCount?: number;

  @ApiProperty({ example: '2026-07-01', description: 'Data de vencimento da primeira parcela (ou única)' })
  @IsDateString()
  @IsFutureOrTodayDate()
  dueDate: string;

  @ApiPropertyOptional({ example: 'comprovante.pdf', description: 'Comprovante de pagamento' })
  @IsOptional()
  @IsString()
  payStub?: string;
}
