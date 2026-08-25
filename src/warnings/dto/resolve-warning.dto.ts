import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResolveWarningDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  resolutionReason!: string;
}
