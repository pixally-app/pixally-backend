import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ZapfyClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly logger = new Logger(ZapfyClient.name);

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('EVOLUTION_SERVER_URL');
    this.apiKey = config.getOrThrow<string>('EVOLUTION_API_KEY');
  }

  private get headers() {
    return { 'apikey': this.apiKey, 'Content-Type': 'application/json' };
  }

  private async throwWithBody(res: Response, label: string): Promise<never> {
    const body = await res.text().catch(() => '(sem body)');
    this.logger.error(`${label} — status ${res.status}: ${body}`);

    if (res.status === 401 || res.status === 403) {
      throw new UnprocessableEntityException(
        'Invalid Evolution API credentials. Check the EVOLUTION_API_KEY.',
      );
    }

    throw new InternalServerErrorException(`${label} (${res.status}): ${body}`);
  }

  async createInstance(instanceName: string, webhookUrl: string) {
    const url = `${this.baseUrl}/instance/create`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          enabled: true,
          url: webhookUrl,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
          webhookBase64: false,
          byEvents: false,
        },
      }),
    });

    if (!res.ok) return this.throwWithBody(res, 'Evolution: erro ao criar instância');
    return res.json();
  }

  async getQrCode(instanceName: string) {
    const url = `${this.baseUrl}/instance/connect/${instanceName}`;
    const res = await fetch(url, { headers: this.headers });

    if (!res.ok) return this.throwWithBody(res, 'Evolution: erro ao buscar QR code');

    const data = await res.json() as { base64?: string; code?: string };

    return {
      qrCode: data.base64 ?? null,
      state: data.base64 ? 'connecting' : 'open',
    };
  }

  async disconnect(instanceName: string) {
    const url = `${this.baseUrl}/instance/logout/${instanceName}`;
    const res = await fetch(url, { method: 'DELETE', headers: this.headers });
    if (!res.ok) return this.throwWithBody(res, 'Evolution: erro ao desconectar instância');
  }

  async getState(instanceName: string) {
    const url = `${this.baseUrl}/instance/connectionState/${instanceName}`;
    const res = await fetch(url, { headers: this.headers });

    if (!res.ok) return this.throwWithBody(res, 'Evolution: erro ao buscar status');

    const data = await res.json() as { instance: { state: string } };
    return { state: data.instance?.state ?? 'close' };
  }

  async getMediaBase64(instanceName: string, key: { id: string; remoteJid: string; fromMe: boolean }) {
    const url = `${this.baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ message: { key } }),
    });

    if (!res.ok) return this.throwWithBody(res, 'Evolution: erro ao baixar mídia');

    const data = await res.json() as { base64: string; mimetype?: string };
    return data;
  }
}
