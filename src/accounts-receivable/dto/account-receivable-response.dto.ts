import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountReceivableResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'uuid' })
  clientId: string;

  @ApiPropertyOptional({ example: 'uuid' })
  pixReceiptId: string | null;

  @ApiPropertyOptional({ example: 'Consultoria mensal' })
  descriptionService: string | null;

  @ApiProperty({ example: 1500.0 })
  totalAmount: number;

  @ApiPropertyOptional({ example: 'uuid' })
  installmentGroupId: string | null;

  @ApiPropertyOptional({ example: 3 })
  installmentCount: number | null;

  @ApiPropertyOptional({ example: 1 })
  installmentNumber: number | null;

  @ApiProperty({ example: 500.0 })
  installmentAmount: number;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  dueDate: Date;

  @ApiProperty({ example: 'pendente', description: 'pendente | pago | vencido' })
  status: string;

  @ApiPropertyOptional({ example: '2026-06-15T10:00:00.000Z' })
  paidAt: Date | null;

  @ApiPropertyOptional({ example: 'comprovante.pdf' })
  payStub: string | null;

  @ApiPropertyOptional({ example: false })
  matchedAutomatically: boolean | null;

  @ApiProperty({ example: '2026-06-11T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-11T00:00:00.000Z' })
  updatedAt: Date;
}

export class PaginatedAccountsReceivableResponseDto {
  @ApiProperty({ type: [AccountReceivableResponseDto] })
  data: AccountReceivableResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}