import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QrCodeResponseDto {
  @ApiProperty({ example: 'data:image/png;base64,...', description: 'QR code em base64 para escanear no WhatsApp' })
  qrCode: string;
}

export class IntegrationStatusResponseDto {
  @ApiProperty({ example: 'open', description: 'Estado da instância (open = conectado, close = desconectado)' })
  state: string;

  @ApiProperty({ example: true, description: 'Se a instância está ativa no banco' })
  active: boolean;

  @ApiPropertyOptional({ example: '2026-07-14T10:00:00.000Z', description: 'Data da última conexão' })
  connectedAt: Date | null;

  @ApiPropertyOptional({ example: '2026-07-14T11:00:00.000Z', description: 'Data da última desconexão' })
  disconnectedAt: Date | null;
}
