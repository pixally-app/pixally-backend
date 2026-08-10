import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateReceiptDto {
  @ApiPropertyOptional({ description: 'ID do cliente a vincular' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Novo status do comprovante' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Descrição manual do comprovante' })
  @IsOptional()
  @IsString()
  description?: string;
}
