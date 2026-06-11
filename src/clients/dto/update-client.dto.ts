import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class UpdatePhoneDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID do telefone existente (omitir para criar novo)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: '+55', description: 'Código do país' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dialCode?: string;

  @ApiPropertyOptional({ example: '11987654321', description: 'Número de telefone' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;
}

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: '12345678900', description: 'CPF ou CNPJ' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  document?: string;

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
    type: [UpdatePhoneDto],
    description: 'Telefones para atualizar (com id) ou criar (sem id)',
    example: [{ id: '550e8400-e29b-41d4-a716-446655440000', dialCode: '+55', phoneNumber: '11987654321' }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePhoneDto)
  phones?: UpdatePhoneDto[];
}
