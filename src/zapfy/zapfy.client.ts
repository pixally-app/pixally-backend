import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ZapfyClient {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('ZAPFY_BASE_URL');
  }

  private instanceUrl(instanceKey: string, instanceToken: string, instanceApiUrl?: string | null) {
    const base = instanceApiUrl ?? this.baseUrl;
    return `${base}/instance/${instanceKey}/token/${instanceToken}`;
  }

  async getQrCode(instanceKey: string, instanceToken: string, instanceApiUrl?: string | null) {
    const url = `${this.instanceUrl(instanceKey, instanceToken, instanceApiUrl)}/connect`;
    const res = await fetch(url, { method: 'POST' });

    if (!res.ok) throw new InternalServerErrorException('Zapfy: erro ao buscar QR code');

    return res.json() as Promise<{ qrcode: string }>;
  }

  async getState(instanceKey: string, instanceToken: string, instanceApiUrl?: string | null) {
    const url = `${this.instanceUrl(instanceKey, instanceToken, instanceApiUrl)}/getState`;
    const res = await fetch(url);

    if (!res.ok) throw new InternalServerErrorException('Zapfy: erro ao buscar status');

    return res.json() as Promise<{ state: string }>;
  }

  async updateWebhook(
    instanceKey: string,
    instanceToken: string,
    webhookUrl: string,
    instanceApiUrl?: string | null,
  ) {
    const url = `${this.instanceUrl(instanceKey, instanceToken, instanceApiUrl)}/updateWebhook`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });

    if (!res.ok) throw new InternalServerErrorException('Zapfy: erro ao configurar webhook');
  }
}
