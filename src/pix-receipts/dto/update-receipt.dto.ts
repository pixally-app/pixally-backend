import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export enum ReceiptStatus {
  RECEIVED = 'RECEIVED',
  RED_FLAG = 'RED_FLAG',
  YELLOW_FLAG = 'YELLOW_FLAG',
  ERROR = 'ERROR',
}

export class UpdateReceiptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: ReceiptStatus })
  @IsOptional()
  @IsEnum(ReceiptStatus)
  status?: ReceiptStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pixTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.depositAmount !== null)
  @IsNumber()
  depositAmount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositDateTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositOriginName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositOriginDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositOriginDocumentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositOriginBank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositOriginAgency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositOriginAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositDestinationName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositDestinationDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositDestinationDocumentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositDestinationBank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositDestinationAgency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  depositDestinationAccount?: string;
}
