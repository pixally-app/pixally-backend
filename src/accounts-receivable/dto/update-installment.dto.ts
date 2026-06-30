import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateInstallmentDto {
  @ApiPropertyOptional({ example: 200.0, description: 'Novo valor da parcela — as demais parcelas não pagas serão reajustadas automaticamente' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Nova data de vencimento desta parcela' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
