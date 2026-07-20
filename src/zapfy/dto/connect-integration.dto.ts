import { ApiProperty } from '@nestjs/swagger';
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

}