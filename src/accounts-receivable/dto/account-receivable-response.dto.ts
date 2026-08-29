import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstallmentResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 1 })
  installmentNumber: number;

  @ApiProperty({ example: 50.0 })
  amount: number;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  dueDate: Date;

  @ApiProperty({ example: 'PENDING', description: 'PENDING | PAID | OVERDUE' })
  status: string;

  @ApiPropertyOptional({ example: '2026-06-15T10:00:00.000Z' })
  paidAt: Date | null;

  @ApiProperty({ example: '2026-06-11T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-11T00:00:00.000Z' })
  updatedAt: Date;
}

export class AccountReceivableResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'uuid' })
  clientId: string;

  @ApiProperty({ example: 'Danielle Melo' })
  clientName: string;

  @ApiProperty({ example: 'Manutenção de ar condicionado' })
  serviceName: string;

  @ApiPropertyOptional({ example: 'Limpeza e recarga de gás' })
  serviceDescription: string | null;

  @ApiProperty({ example: 1500.0 })
  totalAmount: number;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  dueDate: Date;

  @ApiProperty({ example: 'PENDING', description: 'PENDING | PAID | OVERDUE | CANCELLED' })
  status: string;

  @ApiPropertyOptional({ example: '2026-06-15T10:00:00.000Z' })
  paidAt: Date | null;

  @ApiPropertyOptional({ example: 'comprovante.pdf' })
  payStub: string | null;

  @ApiPropertyOptional({ example: false })
  matchedAutomatically: boolean | null;

  @ApiPropertyOptional({ type: [InstallmentResponseDto], description: 'Parcelas (apenas no GET por ID)' })
  installments?: InstallmentResponseDto[];

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

  @ApiProperty({ example: 1500.0, description: 'Soma total das contas pendentes (não vencidas) do usuário' })
  totalPending: number;

  @ApiProperty({ example: 800.0, description: 'Soma total das contas pagas do usuário' })
  totalPaid: number;

  @ApiProperty({ example: 200.0, description: 'Soma total das contas vencidas do usuário' })
  totalOverdue: number;
}
