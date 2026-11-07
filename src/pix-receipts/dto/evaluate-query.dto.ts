import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class EvaluateQueryDto {
  @ApiProperty({
    enum: ['A', 'B', 'C', 'D'],
    description: 'A = Só OCR | B = GPT-4o imagem + OCR (pipeline atual) | C = GPT-4o só texto OCR | D = GPT-4o só imagem',
  })
  @IsIn(['A', 'B', 'C', 'D'])
  variant: 'A' | 'B' | 'C' | 'D';

  @ApiProperty({
    required: false,
    default: 3,
    minimum: 1,
    maximum: 10,
    description: 'Número de execuções para variantes B, C e D (A sempre executa 1 vez por ser determinístico)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  execucoes?: number = 3;
}
