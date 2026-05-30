import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClientResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({ example: 'João Silva' })
  name: string;

  @ApiProperty({ example: '123.456.789-00' })
  document: string;

  @ApiPropertyOptional({ example: 'cpf' })
  documentType: string;

  @ApiProperty({ example: true })
  status: boolean;

  @ApiPropertyOptional({ example: '+55 11 98765-4321' })
  phones: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-20T14:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: 3 })
  receiptsCount: number;

  @ApiProperty({ example: 45000 })
  totalReceived: number;

  @ApiProperty({ example: 35000 })
  totalReceivable: number;
}

export class PaginatedClientsResponseDto {
  @ApiProperty({ type: [ClientResponseDto] })
  data: ClientResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}
