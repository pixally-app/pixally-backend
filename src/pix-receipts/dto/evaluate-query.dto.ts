import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class EvaluateQueryDto {
  @ApiProperty({
    enum: ['A', 'B', 'C', 'D'],
    description: 'A = Só OCR | B = GPT-4o só imagem | C = GPT-4o imagem + OCR (pipeline atual) | D = GPT-4o só texto OCR',
  })
  @IsIn(['A', 'B', 'C', 'D'])
  variant: 'A' | 'B' | 'C' | 'D';
}
