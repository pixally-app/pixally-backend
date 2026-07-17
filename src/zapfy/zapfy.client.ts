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
  private readonly logger = new Logger(ZapfyClient.name);

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('ZAPFY_BASE_URL');
  }

  private instanceUrl(instanceKey: string, instanceToken: string) {
    return `${this.baseUrl}/instance/${instanceKey}/token/${instanceToken}`;
  }

  private async throwWithBody(res: Response, label: string): Promise<never> {
    const body = await res.text().catch(() => '(sem body)');
    this.logger.error(`${label} — status ${res.status}: ${body}`);

    if (res.status === 401) {
      throw new UnprocessableEntityException(
        'Invalid Zapfy credentials. Check the instanceKey and instanceToken.',
      );
    }

    throw new InternalServerErrorException(`${label} (${res.status}): ${body}`);
  }

  async getQrCode(instanceKey: string, instanceToken: string) {
    const url = `${this.instanceUrl(instanceKey, instanceToken)}/connect`;
    const res = await fetch(url, { method: 'POST' });

    if (!res.ok) return this.throwWithBody(res, 'Zapfy: erro ao buscar QR code');

    const data = await res.json() as {
      result: { qrCode?: string; state: string; contact?: { id: string } };
      isValid: boolean;
    };

    return {
      qrCode: data.result.qrCode ?? null,
      state: data.result.state,
    };
  }

  async disconnect(instanceKey: string, instanceToken: string) {
    const url = `${this.instanceUrl(instanceKey, instanceToken)}/disconnect`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) return this.throwWithBody(res, 'Zapfy: erro ao desconectar instância');
  }

  async getState(instanceKey: string, instanceToken: string) {
    const url = `${this.instanceUrl(instanceKey, instanceToken)}/getState`;
    const res = await fetch(url);

    if (!res.ok) return this.throwWithBody(res, 'Zapfy: erro ao buscar status');

    const data = await res.json() as { result: { state: string }; isValid: boolean };
    return { state: data.result.state };
  }


}
