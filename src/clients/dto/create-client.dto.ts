import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PhoneDto {
  @ApiProperty({ example: '+55', description: 'Código do país' })
  @IsString()
  @IsNotEmpty()
  dialCode: string;

  @ApiProperty({ example: '11987654321', description: 'Número de telefone' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class CreateClientDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '12345678900', description: 'CPF ou CNPJ' })
  @IsString()
  @IsNotEmpty()
  document: string;

  @ApiPropertyOptional({ example: 'cpf', description: 'Tipo do documento (cpf ou cnpj)' })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({ example: true, description: 'Status do cliente' })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ example: 'Rua das Flores', description: 'Rua ou Avenida' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: 'Centro', description: 'Bairro' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: '123', description: 'Número do endereço' })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({
    type: [PhoneDto],
    description: 'Lista de telefones do cliente',
    example: [{ dialCode: '+55', phoneNumber: '11987654321' }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones?: PhoneDto[];
}
