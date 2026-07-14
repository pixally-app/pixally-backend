import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConnectIntegrationDto {
  @ApiProperty({ example: 'b08f4262-b74f-4b7b-9958-1c7d5d1dc5e7', description: 'Chave da instância Zapfy' })
  @IsString()
  @IsNotEmpty()
  instanceKey: string;

  @ApiProperty({ example: 'token-secreto', description: 'Token da instância Zapfy' })
  @IsString()
  @IsNotEmpty()
  instanceToken: string;

  @ApiPropertyOptional({ example: 'https://api.zapfy.me/v1', description: 'URL base da API Zapfy' })
  @IsOptional()
  @IsString()
  instanceApiUrl?: string;
}