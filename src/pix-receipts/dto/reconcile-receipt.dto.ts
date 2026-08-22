import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ReconcileReceiptDto {
  @ApiProperty({ description: 'ID da conta a receber a ser conciliada' })
  @IsUUID()
  accountReceivableId: string;
}
